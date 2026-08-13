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
// The user signs register_dataset with their wallet FIRST; this endpoint verifies that
// on-chain tx, then uploads the blob to Shelby and persists the record.
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    const uploader = req.body.uploader_addr;
    const datasetId = String(req.body.dataset_id || '');
    const registerTxHash = String(req.body.register_tx_hash || '');

    if (!file) return res.status(400).json({ error: 'No file provided' });
    if (!uploader) return res.status(400).json({ error: 'No uploader address provided' });
    if (!datasetId) return res.status(400).json({ error: 'No dataset_id provided (generate it in the client)' });
    if (!registerTxHash) return res.status(400).json({ error: 'No register_tx_hash provided (sign register_dataset with your wallet first)' });

    // Verify the user-signed on-chain registration
    const verified = await AptosClient.verifyRegisterTx(registerTxHash, datasetId, uploader);
    if (!verified) {
      return res.status(403).json({ error: 'register_dataset transaction could not be verified on-chain' });
    }

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

    // Upload ciphertext to Shelby (real blob registration + storage upload)
    const result = await ShelbyClient.uploadDataset(file.buffer, datasetId);

    // Optional integrity re-verification (downloads the blob back — burns RPC quota; off by default)
    let integrityVerified = false;
    if (process.env.VERIFY_BLOB_INTEGRITY === 'true') {
      try {
        integrityVerified = await ShelbyClient.verifyBlobIntegrity(result.blobId, result.merkleRoot);
      } catch (e: any) {
        console.warn('Integrity verification failed', e?.message || e);
      }
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

      return res.json({ dataset_id: datasetId, shelby_blob_id: result.blobId, merkle_root: result.merkleRoot, integrity_verified: integrityVerified, encrypted: isEncrypted, on_chain_tx: registerTxHash });
    } catch (dbErr: any) {
      console.warn('DB insert failed, returning upload result anyway', dbErr.message || dbErr);
      return res.json({ dataset_id: datasetId, shelby_blob_id: result.blobId, merkle_root: result.merkleRoot, warning: 'DB unavailable' });
    }

  } catch (err: any) {
    console.error(err);
    const details = String(err?.message || '');
    if (details.includes('429') || details.toLowerCase().includes('rate limit')) {
      return res.status(503).json({
        error: 'Shelby RPC is rate-limited. Wait a few minutes and try again.',
        details,
      });
    }
    return res.status(500).json({ error: 'Upload failed', details });
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

// POST /datasets/:id/access-requests — a reader requests access (owner approves by signing grant_access)
router.post('/:id/access-requests', async (req: Request, res: Response) => {
  try {
    const datasetId = String((req.params as any).id || '');
    const requesterAddr = String(req.body.requester_addr || '');

    if (!datasetId || !requesterAddr) {
      return res.status(400).json({ error: 'dataset_id and requester_addr are required' });
    }
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'DB unavailable' });
    }

    // Prevent requesting access to your own dataset
    const ds = await pool.query('SELECT uploader_addr FROM datasets WHERE id = $1', [datasetId]);
    if (!ds.rows[0]) return res.status(404).json({ error: 'Dataset not found' });
    if (ds.rows[0].uploader_addr.toLowerCase() === requesterAddr.toLowerCase()) {
      return res.status(400).json({ error: 'You own this dataset' });
    }

    const r = await pool.query(
      `INSERT INTO access_requests (dataset_id, requester_addr, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (dataset_id, requester_addr) DO UPDATE SET status = 'pending', created_at = NOW()
       RETURNING id, status`,
      [datasetId, requesterAddr]
    );
    return res.status(201).json({ request_id: r.rows[0].id, status: r.rows[0].status });
  } catch (err: any) {
    console.error('Access request failed', err);
    return res.status(500).json({ error: 'Access request failed', details: err.message });
  }
});

// GET /datasets/access-requests?owner_addr=... — pending/in-progress requests for the owner's datasets
router.get('/access-requests', async (req: Request, res: Response) => {
  try {
    const owner = Array.isArray(req.query.owner_addr) ? req.query.owner_addr[0] : (req.query.owner_addr as string) || '';
    if (!process.env.DATABASE_URL || !owner) {
      return res.json({ requests: [] });
    }
    const r = await pool.query(
      `SELECT ar.id, ar.dataset_id, ar.requester_addr, ar.status, ar.created_at, d.title AS dataset_title
       FROM access_requests ar JOIN datasets d ON d.id = ar.dataset_id
       WHERE d.uploader_addr = $1
       ORDER BY ar.created_at DESC`,
      [owner]
    );
    return res.json({ requests: r.rows });
  } catch (err: any) {
    console.error('Access requests list failed', err);
    return res.status(500).json({ error: 'Access requests failed', details: err.message });
  }
});

// POST /datasets/:id/access-requests/:requestId/approve
// The OWNER signs grant_access in their wallet, then reports the tx hash here for verification.
router.post('/:id/access-requests/:requestId/approve', async (req: Request, res: Response) => {
  try {
    const datasetId = String((req.params as any).id || '');
    const requestId = String((req.params as any).requestId || '');
    const grantTxHash = String(req.body.grant_tx_hash || '');
    const ownerAddr = String(req.body.owner_addr || '');

    if (!datasetId || !requestId || !grantTxHash || !ownerAddr) {
      return res.status(400).json({ error: 'dataset_id, requestId, owner_addr and grant_tx_hash are required' });
    }
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'DB unavailable' });
    }

    const reqRow = await pool.query(
      `SELECT ar.id, ar.requester_addr, d.uploader_addr
       FROM access_requests ar JOIN datasets d ON d.id = ar.dataset_id
       WHERE ar.id = $1 AND ar.dataset_id = $2 AND ar.status = 'pending'`,
      [requestId, datasetId]
    );
    if (!reqRow.rows[0]) return res.status(404).json({ error: 'Pending request not found' });
    if (reqRow.rows[0].uploader_addr.toLowerCase() !== ownerAddr.toLowerCase()) {
      return res.status(403).json({ error: 'Only the dataset owner can approve' });
    }

    const verified = await AptosClient.verifyGrantTx(grantTxHash, datasetId, reqRow.rows[0].requester_addr, ownerAddr);
    if (!verified) {
      return res.status(403).json({ error: 'grant_access transaction could not be verified on-chain' });
    }

    await pool.query(`UPDATE access_requests SET status = 'granted', resolved_at = NOW() WHERE id = $1`, [requestId]);
    return res.json({ request_id: requestId, status: 'granted', tx_hash: grantTxHash });
  } catch (err: any) {
    console.error('Approve access request failed', err);
    return res.status(500).json({ error: 'Approve failed', details: err.message });
  }
});

// POST /datasets/:id/access-requests/:requestId/reject
router.post('/:id/access-requests/:requestId/reject', async (req: Request, res: Response) => {
  try {
    const requestId = String((req.params as any).requestId || '');
    const ownerAddr = String(req.body.owner_addr || '');
    if (!process.env.DATABASE_URL || !requestId || !ownerAddr) {
      return res.status(400).json({ error: 'requestId and owner_addr are required' });
    }
    const r = await pool.query(
      `UPDATE access_requests ar SET status = 'rejected', resolved_at = NOW()
       FROM datasets d
       WHERE ar.id = $1 AND ar.dataset_id = d.id AND d.uploader_addr = $2 AND ar.status = 'pending'
       RETURNING ar.id`,
      [requestId, ownerAddr]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Pending request not found' });
    return res.json({ request_id: requestId, status: 'rejected' });
  } catch (err: any) {
    console.error('Reject access request failed', err);
    return res.status(500).json({ error: 'Reject failed', details: err.message });
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
