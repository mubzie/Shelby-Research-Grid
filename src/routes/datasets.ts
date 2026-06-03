import { Router, Request, Response } from 'express';
import multer from 'multer';
import ShelbyClient from '../services/ShelbyClient';
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

    // Upload to Shelby (stub)
    const result = await ShelbyClient.uploadDataset(file.buffer, metadata);

    // Verify blob integrity (merkle root) via Shelby RPC or fallback
    let integrityVerified = false;
    try {
      integrityVerified = await ShelbyClient.verifyBlobIntegrity(result.blobId, result.merkleRoot);
    } catch (e: any) {
      console.warn('Integrity verification failed', e?.message || e);
    }

    // Persist minimal dataset record (best-effort)
    // If DATABASE_URL not provided, skip DB write to avoid connection errors in local dev
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set — skipping DB insert (dev mode)');
      return res.json({ dataset_id: null, shelby_blob_id: result.blobId, merkle_root: result.merkleRoot, integrity_verified: integrityVerified, warning: 'DB skipped (no DATABASE_URL)' });
    }

    try {
      const q = `INSERT INTO datasets (uploader_addr, shelby_blob_id, merkle_root, title, description, virus_types, file_size_bytes, is_public) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`;
      const values = [uploader, result.blobId, result.merkleRoot, metadata.title || null, metadata.description || null, metadata.virus_types || null, file.size || 0, metadata.is_public || false];
      const r = await pool.query(q, values);
      const datasetId = r.rows[0].id;
      return res.json({ dataset_id: datasetId, shelby_blob_id: result.blobId, merkle_root: result.merkleRoot });
    } catch (dbErr: any) {
      console.warn('DB insert failed, returning upload result anyway', dbErr.message || dbErr);
      return res.json({ dataset_id: null, shelby_blob_id: result.blobId, merkle_root: result.merkleRoot, warning: 'DB unavailable' });
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
    // Basic query: select public datasets
    let q = 'SELECT * FROM datasets WHERE is_public = true';
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

// Dev-only seed endpoint: GET /datasets/seed (development only)
router.get('/seed', (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
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

export default router;
