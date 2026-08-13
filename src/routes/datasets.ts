import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import ShelbyClient from '../services/ShelbyClient';
import AptosClient from '../services/AptosClient';
import { wrapDataKey } from '../services/EncryptionService';
import pool from '../services/db';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// POST /datasets/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    const uploader = req.body.uploader_addr;

    if (!file) return res.status(400).json({ error: 'No file provided' });
    if (!uploader) return res.status(400).json({ error: 'No uploader address provided' });

    // Client-side encryption metadata (base64 iv / auth tag / wrapped data key)
    const encIv = String(req.body.iv || '');
    const encAuthTag = String(req.body.auth_tag || '');
    const dataKeyB64 = String(req.body.data_key || '');
    const isEncrypted = Boolean(encIv && encAuthTag && dataKeyB64);
    if (!isEncrypted) {
      console.warn('[datasets] upload received PLAINTEXT (no encryption metadata)');
    }
    const wrapped = isEncrypted ? wrapDataKey(dataKeyB64) : null;
    // Normalize client base64 iv/auth tag to hex for storage
    const encIvHex = isEncrypted ? Buffer.from(encIv, 'base64').toString('hex') : null;
    const encAuthTagHex = isEncrypted ? Buffer.from(encAuthTag, 'base64').toString('hex') : null;
    // Allocate the dataset id up front so the blob name can reference it
    const datasetId = crypto.randomUUID();

    // Upload ciphertext to Shelby (real blob registration + storage upload)
    const result = await ShelbyClient.uploadDataset(file.buffer, datasetId);

    // Verify blob integrity by recomputing the merkle root from downloaded bytes
    let integrityVerified = false;
    try {
      integrityVerified = await ShelbyClient.verifyBlobIntegrity(result.blobId, result.merkleRoot);
    } catch (e: any) {
      console.warn('Integrity verification failed', e?.message || e);
    }

    // Persist the dataset record (best-effort; skip if DATABASE_URL is not set)
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set — skipping DB insert (dev mode)');
      return res.json({ dataset_id: datasetId, shelby_blob_id: result.blobId, merkle_root: result.merkleRoot, integrity_verified: integrityVerified, warning: 'DB skipped (no DATABASE_URL)' });
    }

    try {
      const q = `INSERT INTO datasets (id, uploader_addr, shelby_blob_id, merkle_root, title, description, virus_types, file_size_bytes, is_public, enc_iv, enc_auth_tag, enc_data_key)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`;
      const values = [datasetId, uploader, result.blobId, result.merkleRoot, metadata.title || null, metadata.description || null, metadata.virus_types || null, result.size, metadata.is_public || false,
        encIvHex, encAuthTagHex, wrapped];
      await pool.query(q, values);

      // Register dataset ownership on-chain (real transaction; no stub fallback)
      let onChainTx: string | null = null;
      try {
        const reg = await AptosClient.registerDataset(uploader, String(datasetId));
        if (reg.txHash && !reg.txHash.startsWith('stub-')) onChainTx = reg.txHash;
      } catch (chainErr: any) {
        console.warn('On-chain registration failed', chainErr?.message || chainErr);
      }

      return res.json({ dataset_id: datasetId, shelby_blob_id: result.blobId, merkle_root: result.merkleRoot, integrity_verified: integrityVerified, encrypted: isEncrypted, on_chain_tx: onChainTx });
    } catch (dbErr: any) {
      console.warn('DB insert failed, returning upload result anyway', dbErr.message || dbErr);
      return res.json({ dataset_id: datasetId, shelby_blob_id: result.blobId, merkle_root: result.merkleRoot, warning: 'DB unavailable' });
    }

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// GET /datasets — list public datasets (filters: virus_type, uploader_addr, limit, offset)
router.get('/', async (req: Request, res: Response) => {
  const virusType = Array.isArray(req.query.virus_type) ? req.query.virus_type[0] : (req.query.virus_type as string) || '';
  const uploader = Array.isArray(req.query.uploader_addr) ? req.query.uploader_addr[0] : (req.query.uploader_addr as string) || '';
  const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
  const offset = parseInt(String(req.query.offset || '0'), 10) || 0;

  // If no DB configured, try Shelby RPC (if configured) or return fallback
  if (!process.env.DATABASE_URL) {
    try {
      const shelbyList = await ShelbyClient.listDatasets(String(uploader || ''));
      return res.json({ datasets: shelbyList, source: 'shelby' });
    } catch (e: any) {
      console.warn('Shelby list failed', e?.message || e);
      return res.json({ datasets: [], warning: 'DB not configured; public listing unavailable in dev' });
    }
  }

  try {
    // Owners see their own datasets regardless of visibility; anonymous listing is public-only
    let q = uploader ? 'SELECT * FROM datasets WHERE true' : 'SELECT * FROM datasets WHERE is_public = true';
    const vals: any[] = [];
    if (virusType) {
      vals.push(virusType);
      q += ` AND $${vals.length} = ANY(virus_types)`;
    }
    if (uploader) {
      vals.push(uploader);
      q += ` AND uploader_addr = $${vals.length}`;
    }
    vals.push(limit, offset);
    q += ` ORDER BY created_at DESC LIMIT $${vals.length-1} OFFSET $${vals.length}`;

    const r = await pool.query(q, vals);
    return res.json({ datasets: r.rows });
  } catch (err: any) {
    console.error('List datasets failed', err);
    return res.status(500).json({ error: 'List failed', details: err.message });
  }
});

// POST /datasets/:id/grants — grant time-limited read access to a collaborator
router.post('/:id/grants', async (req: Request, res: Response) => {
  try {
    const datasetId = String((req.params as any).id || '');
    const granteeAddr = String(req.body.grantee_addr || '');
    const durationSecs = parseInt(String(req.body.duration_secs || '3600'), 10);
    const readLimit = parseInt(String(req.body.read_limit || '10'), 10);

    if (!datasetId || !granteeAddr) {
      return res.status(400).json({ error: 'dataset_id and grantee_addr are required' });
    }

    const result = await AptosClient.grantAccess('', datasetId, granteeAddr, durationSecs, readLimit);
    return res.json({ dataset_id: datasetId, grantee_addr: granteeAddr, tx_hash: result.txHash });
  } catch (err: any) {
    console.error('Grant access failed', err);
    return res.status(500).json({ error: 'Grant failed', details: err.message });
  }
});

// DELETE /datasets/:id/grants/:grantee — revoke access
router.delete('/:id/grants/:grantee', async (req: Request, res: Response) => {
  try {
    const datasetId = String((req.params as any).id || '');
    const granteeAddr = String((req.params as any).grantee || '');

    if (!datasetId || !granteeAddr) {
      return res.status(400).json({ error: 'dataset_id and grantee are required' });
    }

    const result = await AptosClient.revokeAccess('', datasetId, granteeAddr);
    return res.json({ dataset_id: datasetId, grantee_addr: granteeAddr, tx_hash: result.txHash });
  } catch (err: any) {
    console.error('Revoke access failed', err);
    return res.status(500).json({ error: 'Revoke failed', details: err.message });
  }
});

// GET /datasets/stats?uploader_addr=... — dashboard stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const uploader = Array.isArray(req.query.uploader_addr) ? req.query.uploader_addr[0] : (req.query.uploader_addr as string) || '';

    if (!process.env.DATABASE_URL) {
      return res.json({ datasets_count: 0, total_reads: 0, total_revenue_millAPT: 0, warning: 'DB not configured' });
    }

    let datasetsCount = 0;
    let totalReads = 0;
    let totalRevenue = 0;

    if (uploader) {
      const ds = await pool.query('SELECT COUNT(*)::int AS count FROM datasets WHERE uploader_addr = $1', [uploader]);
      datasetsCount = ds.rows[0]?.count || 0;
      const reads = await pool.query(
        `SELECT COALESCE(SUM(d.total_reads), 0)::bigint AS reads, COALESCE(SUM(d.total_revenue_earned_millAPT), 0)::bigint AS revenue FROM datasets d WHERE d.uploader_addr = $1`,
        [uploader]
      );
      totalReads = Number(reads.rows[0]?.reads || 0);
      totalRevenue = Number(reads.rows[0]?.revenue || 0);
    } else {
      const ds = await pool.query('SELECT COUNT(*)::int AS count FROM datasets');
      datasetsCount = ds.rows[0]?.count || 0;
      const reads = await pool.query('SELECT COALESCE(SUM(total_reads), 0)::bigint AS reads, COALESCE(SUM(total_revenue_earned_millAPT), 0)::bigint AS revenue FROM datasets');
      totalReads = Number(reads.rows[0]?.reads || 0);
      totalRevenue = Number(reads.rows[0]?.revenue || 0);
    }

    return res.json({ datasets_count: datasetsCount, total_reads: totalReads, total_revenue_millAPT: totalRevenue });
  } catch (err: any) {
    console.error('Stats failed', err);
    return res.status(500).json({ error: 'Stats failed', details: err.message });
  }
});

// GET /datasets/activity?uploader_addr=... — recent reads + access grants for the user's datasets
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const uploader = Array.isArray(req.query.uploader_addr) ? req.query.uploader_addr[0] : (req.query.uploader_addr as string) || '';

    if (!process.env.DATABASE_URL || !uploader) {
      return res.json({ activity: [] });
    }

    const reads = await pool.query(
      `SELECT rl.read_at, rl.reader_addr, rl.bytes_downloaded, d.title, d.id AS dataset_id
       FROM read_logs rl JOIN datasets d ON d.id = rl.dataset_id
       WHERE d.uploader_addr = $1
       ORDER BY rl.read_at DESC LIMIT 10`,
      [uploader]
    );
    const grants = await pool.query(
      `SELECT ag.granted_at, ag.grantee_addr, ag.expires_at, ag.read_limit, ag.read_count, d.title, d.id AS dataset_id
       FROM access_grants ag JOIN datasets d ON d.id = ag.dataset_id
       WHERE d.uploader_addr = $1
       ORDER BY ag.granted_at DESC LIMIT 10`,
      [uploader]
    );

    const activity = [
      ...reads.rows.map((r: any) => ({
        type: 'read',
        dataset_id: r.dataset_id,
        dataset_title: r.title,
        reader_addr: r.reader_addr,
        bytes_downloaded: r.bytes_downloaded,
        at: r.read_at,
      })),
      ...grants.rows.map((g: any) => ({
        type: 'access_granted',
        dataset_id: g.dataset_id,
        dataset_title: g.title,
        grantee_addr: g.grantee_addr,
        expires_at: g.expires_at,
        read_limit: g.read_limit,
        read_count: g.read_count,
        at: g.granted_at,
      })),
    ].sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10);

    return res.json({ activity });
  } catch (err: any) {
    console.error('Activity failed', err);
    return res.status(500).json({ error: 'Activity failed', details: err.message });
  }
});

// Dev-only seed endpoint: GET /datasets/seed (development only)
router.get('/seed', (req: Request, res: Response) => {  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not Found' });
  }
  const samples = [
    {
      id: 'sample-1',
      uploader_addr: '0xDEADBEEF',
      shelby_blob_id: 'blob_sample_1',
      merkle_root: '0xabc123',
      title: 'Sample SARS-CoV-2 sequences',
      description: 'Seed dataset for UI testing',
      virus_types: ['SARS-CoV-2'],
      file_size_bytes: 12345,
      is_public: true,
      created_at: new Date().toISOString(),
      total_reads: 0,
      total_revenue_earned_millAPT: 0
    }
  ];
  return res.json({ datasets: samples });
});

// GET /datasets/:id — single dataset detail (public + owner-visible)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const datasetId = String((req.params as any).id || '');
    const viewer = Array.isArray(req.query.viewer_addr) ? req.query.viewer_addr[0] : (req.query.viewer_addr as string) || '';

    if (!process.env.DATABASE_URL) {
      return res.status(404).json({ error: 'Not found' });
    }

    let q = 'SELECT * FROM datasets WHERE id = $1';
    const vals: any[] = [datasetId];
    if (viewer) {
      vals.push(viewer);
      q += ' AND (is_public = true OR uploader_addr = $2)';
    } else {
      q += ' AND is_public = true';
    }
    const r = await pool.query(q, vals);
    if (!r.rows[0]) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    return res.json({ dataset: r.rows[0] });
  } catch (err: any) {
    console.error('Dataset detail failed', err);
    return res.status(500).json({ error: 'Dataset detail failed', details: err.message });
  }
});

export default router;
