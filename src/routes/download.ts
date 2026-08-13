import { Router, Request, Response } from 'express';
import ShelbyClient from '../services/ShelbyClient';
import AptosClient from '../services/AptosClient';
import { unwrapDataKey, decrypt } from '../services/EncryptionService';
import pool from '../services/db';
import config from '../config';

const router = Router();

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
 * Record a read: on-chain log_read + record_read (best-effort) and DB read_logs + counters.
 */
async function recordRead(datasetId: string, readerAddr: string, bytesDownloaded: number): Promise<void> {
  const rate = config.payment.micropaymentRateMillAPT;
  try {
    await AptosClient.logRead(datasetId, readerAddr, bytesDownloaded);
  } catch (e: any) {
    console.warn('[download] log_read failed', e?.message || e);
  }
  try {
    await AptosClient.recordRead('', datasetId, readerAddr, rate);
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

interface EncMetadata {
  enc_iv: string | null;
  enc_auth_tag: string | null;
  enc_data_key: string | null;
}

async function fetchEncMetadata(blobId: string): Promise<EncMetadata | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const r = await pool.query('SELECT enc_iv, enc_auth_tag, enc_data_key FROM datasets WHERE shelby_blob_id = $1', [blobId]);
    return (r.rows[0] as EncMetadata) || null;
  } catch {
    return null;
  }
}

// GET /download?blob_id=...&dataset_id=...&reader_addr=...
// Authorization: on-chain has_valid_access check for the reader, then real blob retrieval + decrypt
router.get('/', async (req: Request, res: Response) => {
  const blobId = String(Array.isArray(req.query.blob_id) ? req.query.blob_id[0] : (req.query.blob_id as string) || '');
  const datasetId = String(Array.isArray(req.query.dataset_id) ? req.query.dataset_id[0] : (req.query.dataset_id as string) || '');
  const readerAddr = String(Array.isArray(req.query.reader_addr) ? req.query.reader_addr[0] : (req.query.reader_addr as string) || '');

  if (!blobId) {
    return res.status(400).json({ error: 'blob_id is required' });
  }

  // Enforce on-chain access check when a dataset + reader is provided
  if (datasetId && readerAddr) {
    const isOwner = await isDatasetOwner(datasetId, readerAddr);
    if (isOwner) {
      // Owners can always download their own datasets
    } else {
      const hasAccess = await AptosClient.hasValidAccess(datasetId, readerAddr);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: no valid on-chain grant for this dataset' });
      }
    }
  }

  try {
    const buf = await ShelbyClient.downloadDataset(blobId);

    // Decrypt with the stored (wrapped) data key when the dataset is encrypted
    const enc = await fetchEncMetadata(blobId);
    if (enc?.enc_data_key && enc.enc_iv && enc.enc_auth_tag) {
      const dataKey = unwrapDataKey(enc.enc_data_key);
      const plain = decrypt(buf.toString('base64'), dataKey, enc.enc_iv, enc.enc_auth_tag);
      // Record the read (on-chain + DB) when access was enforced
      if (datasetId && readerAddr) {
        await recordRead(datasetId, readerAddr, plain.length);
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Blob-Size', String(plain.length));
      return res.send(plain);
    }

    // Legacy / plaintext path
    if (datasetId && readerAddr) {
      await recordRead(datasetId, readerAddr, buf.length);
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Blob-Size', String(buf.length));
    return res.send(buf);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

// Legacy dev helper: GET /download/:blobId (no slashes)
router.get('/:blobId', async (req: Request, res: Response) => {
  const blobId = String((req.params as any).blobId || '');
  const datasetId = String(Array.isArray(req.query.dataset_id) ? req.query.dataset_id[0] : (req.query.dataset_id as string) || '');
  const readerAddr = String(Array.isArray(req.query.reader_addr) ? req.query.reader_addr[0] : (req.query.reader_addr as string) || '');

  if (datasetId && readerAddr) {
    const isOwner = await isDatasetOwner(datasetId, readerAddr);
    if (!isOwner) {
      const hasAccess = await AptosClient.hasValidAccess(datasetId, readerAddr);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: no valid on-chain grant for this dataset' });
      }
    }
  }

  try {
    const buf = await ShelbyClient.downloadDataset(blobId);

    const enc = await fetchEncMetadata(blobId);
    if (enc?.enc_data_key && enc.enc_iv && enc.enc_auth_tag) {
      const dataKey = unwrapDataKey(enc.enc_data_key);
      const plain = decrypt(buf.toString('base64'), dataKey, enc.enc_iv, enc.enc_auth_tag);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Blob-Size', String(plain.length));
      return res.send(plain);
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    return res.send(buf);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

export default router;
