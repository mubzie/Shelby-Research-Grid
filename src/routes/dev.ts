import { Router, Request, Response } from 'express';
import multer from 'multer';
import { deriveKeyFromSeed, encrypt } from '../services/EncryptionService';
import ShelbyClient from '../services/ShelbyClient';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Block dev routes unless NODE_ENV=development
router.use((req: Request, res: Response, next) => {
  if (process.env.NODE_ENV !== 'development') return res.status(403).json({ error: 'Dev routes disabled' });
  return next();
});

// POST /dev/encrypt-upload - dev-only: encrypt a file with derived key, upload to Shelby stub
router.post('/encrypt-upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const seed = req.body.seed || `dev-seed-${Date.now()}`;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const key = deriveKeyFromSeed(seed);
    const enc = encrypt(file.buffer, key);
    const encryptedBuffer = Buffer.from(enc.ciphertext, 'base64');

    const result = await ShelbyClient.uploadDataset(encryptedBuffer, metadata);

    return res.json({ result, encryption: { iv: enc.iv, authTag: enc.authTag, seedHint: seed.slice(0,8) } });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Dev encrypt-upload failed', details: err.message });
  }
});

export default router;
