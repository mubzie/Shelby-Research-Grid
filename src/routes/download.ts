import { Router, Request, Response } from 'express';
import ShelbyClient from '../services/ShelbyClient';
import { deriveKeyFromSeed, decrypt } from '../services/EncryptionService';

const router = Router();

// GET /download/:blobId?seed=...  (dev-only helper)
router.get('/:blobId', async (req: Request, res: Response) => {
  const blobId = String((req.params as any).blobId || '');
  const seed = Array.isArray(req.query.seed) ? req.query.seed[0] : (req.query.seed as string) || '';

  try {
    const buf = await ShelbyClient.downloadDataset(blobId);
    if (!seed) {
      // return encrypted bytes
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.send(buf);
    }

    const key = deriveKeyFromSeed(String(seed));
    // For stubbed client we assume buffer is base64 ciphertext
    const ciphertextB64 = buf.toString('base64');
    // In real implementation IV and authTag are stored separately; here assume appended metadata
    const iv = Array.isArray(req.query.iv) ? req.query.iv[0] : (req.query.iv as string) || '';
    const authTag = Array.isArray(req.query.authTag) ? req.query.authTag[0] : (req.query.authTag as string) || '';
    const plain = decrypt(ciphertextB64, key, String(iv), String(authTag));
    return res.json({ decrypted: plain.toString('utf8') });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

export default router;
