import { Router, Request, Response } from 'express';
import ShelbyClient from '../services/ShelbyClient';
import AptosClient from '../services/AptosClient';
import { unwrapDataKey, decrypt } from '../services/EncryptionService';
import pool from '../services/db';
import config from '../config';

const router = Router();

/**
 * Fetch the dataset owner + encryption metadata for a blob.
 * The owner address drives the on-chain access check and the read loop.
 */
async function fetchDatasetMeta(blobId: string): Promise<{
  owner: string;
  enc_iv: string | null;
  enc_auth_tag: string | null;
  enc_data_key: string | null;
} | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const r = await pool.query(
      'SELECT uploader_addr, enc_iv, enc_auth_tag, enc_data_key FROM datasets WHERE shelby_blob_id = $1',
      [blobId]
    );
    const row = r.rows[0];
    return row ? { owner: row.uploader_addr, enc_iv: row.enc_iv, enc_auth_tag: row.enc_auth_tag, enc_data_key: row.enc_data_key } : null;
  } catch {
    return null;
  }
}

async function isDatasetOwner(datasetId: string, address: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const r = await pool.query('SELECT 1 FROM datasets WHERE id = $1 AND uploader_addr = $2', [datasetId, address]);
    return r.rowCount === 1;
  } catch {
    return false;
  }
}

/**
 * Record a read on behalf of the owner:
 * on-chain log_read_by_platform + record_read_by_platform (platform operator role) + DB counters.
 */
async function recordRead(ownerAddr: string, datasetId: string, readerAddr: string, bytesDownloaded: number): Promise<void> {
  const rate = config.payment.micropaymentRateMillAPT;
  try {
    await AptosClient.logRead(ownerAddr, datasetId, readerAddr, bytesDownloaded);
  } catch (e: any) {
    console.warn('[download] log_read failed', e?.message || e);
  }
  try {
    await AptosClient.recordRead(ownerAddr, datasetId, readerAddr, rate);
  } catch (e: any) {
    console.warn('[download] record_read failed', e?.message || e);
  }
  if (!process.env.DATABASE_URL) return;
  try {
    await pool.query(
      `INSERT INTO read_logs (dataset_id, reader_addr, bytes_downloaded)
       SELECT id, $2, $3 FROM datasets WHERE id = $1`,
      [datasetId, readerAddr, bytesDownloaded]
    );
    await pool.query(
      `UPDATE datasets SET total_reads = total_reads + 1, total_revenue_earned_millAPT = total_revenue_earned_millAPT + $2 WHERE id = $1`,
      [datasetId, rate]
    );
  } catch (e: any) {
    console.warn('[download] DB read recording failed', e?.message || e);
  }
}

/**
 * Serve the blob: authorize (owner or on-chain grant), download from Shelby, decrypt, record the read.
 */
async function serveBlob(req: Request, res: Response, blobId: string, datasetId: string, readerAddr: string): Promise<void> {
  if (!blobId) {
    res.status(400).json({ error: 'blob_id is required' });
    return;
  }

  const meta = await fetchDatasetMeta(blobId);

  // Enforce on-chain access check when a dataset + reader is provided
  if (datasetId && readerAddr) {
    const isOwner = await isDatasetOwner(datasetId, readerAddr);
    if (!isOwner) {
      // Access check against the OWNER's address (user-signed registration)
      const ownerAddr = meta?.owner || '';
      const hasAccess = ownerAddr ? await AptosClient.hasValidAccess(ownerAddr, datasetId, readerAddr) : false;
      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied: no valid on-chain grant for this dataset' });
        return;
      }
    }
  }

  try {
    const buf = await ShelbyClient.downloadDataset(blobId);

    // Decrypt with the stored (wrapped) data key when the dataset is encrypted
    if (meta?.enc_data_key && meta.enc_iv && meta.enc_auth_tag) {
      const dataKey = unwrapDataKey(meta.enc_data_key);
      const plain = decrypt(buf.toString('base64'), dataKey, meta.enc_iv, meta.enc_auth_tag);
      // Record the read (on-chain + DB) when access was enforced
      if (datasetId && readerAddr && meta.owner) {
        await recordRead(meta.owner, datasetId, readerAddr, plain.length);
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Blob-Size', String(plain.length));
      res.send(plain);
      return;
    }

    // Legacy / plaintext path
    if (datasetId && readerAddr && meta?.owner) {
      await recordRead(meta.owner, datasetId, readerAddr, buf.length);
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Blob-Size', String(buf.length));
    res.send(buf);
  } catch (err: any) {
    console.error(err);
    const details = String(err?.message || '');
    if (details.includes('429') || details.toLowerCase().includes('rate limit')) {
      res.status(503).json({ error: 'Shelby RPC is rate-limited. Wait a few minutes and try again.', details });
      return;
    }
    res.status(500).json({ error: 'Download failed', details });
  }
}

// GET /download?blob_id=...&dataset_id=...&reader_addr=...
router.get('/', async (req: Request, res: Response) => {
  const blobId = String(Array.isArray(req.query.blob_id) ? req.query.blob_id[0] : (req.query.blob_id as string) || '');
  const datasetId = String(Array.isArray(req.query.dataset_id) ? req.query.dataset_id[0] : (req.query.dataset_id as string) || '');
  const readerAddr = String(Array.isArray(req.query.reader_addr) ? req.query.reader_addr[0] : (req.query.reader_addr as string) || '');
  await serveBlob(req, res, blobId, datasetId, readerAddr);
});

// Legacy dev helper: GET /download/:blobId (no slashes)
router.get('/:blobId', async (req: Request, res: Response) => {
  const blobId = String((req.params as any).blobId || '');
  const datasetId = String(Array.isArray(req.query.dataset_id) ? req.query.dataset_id[0] : (req.query.dataset_id as string) || '');
  const readerAddr = String(Array.isArray(req.query.reader_addr) ? req.query.reader_addr[0] : (req.query.reader_addr as string) || '');
  await serveBlob(req, res, blobId, datasetId, readerAddr);
});

export default router;
