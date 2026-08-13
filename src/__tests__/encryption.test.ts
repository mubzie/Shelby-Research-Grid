import { wrapDataKey, unwrapDataKey, encrypt, decrypt, deriveKeyFromSeed } from '../services/EncryptionService';

describe('EncryptionService', () => {
  it('wrapDataKey / unwrapDataKey round-trips a client data key', () => {
    const rawKey = Buffer.alloc(32, 7).toString('base64');
    const wrapped = wrapDataKey(rawKey);
    expect(wrapped).toContain('|');
    const unwrapped = unwrapDataKey(wrapped);
    expect(unwrapped.toString('base64')).toBe(rawKey);
  });

  it('unwrapping with the wrong seed fails (auth tag mismatch)', () => {
    const wrapped = wrapDataKey(Buffer.alloc(32, 1).toString('base64'));
    const originalSeed = process.env.SERVER_KEY_SEED;
    process.env.SERVER_KEY_SEED = 'different-seed';
    try {
      expect(() => unwrapDataKey(wrapped)).toThrow();
    } finally {
      process.env.SERVER_KEY_SEED = originalSeed;
    }
  });

  it('encrypt / decrypt round-trip with a derived key', () => {
    const key = deriveKeyFromSeed('test-seed');
    const enc = encrypt(Buffer.from('plaintext payload'), key);
    expect(enc.ciphertext).not.toContain('plaintext');
    const plain = decrypt(enc.ciphertext, key, enc.iv, enc.authTag);
    expect(plain.toString('utf8')).toBe('plaintext payload');
  });

  it('decrypt fails when the auth tag is tampered', () => {
    const key = deriveKeyFromSeed('test-seed');
    const enc = encrypt(Buffer.from('integrity check'), key);
    const badTag = (parseInt(enc.authTag, 16) ^ 1).toString(16).padStart(enc.authTag.length, '0');
    expect(() => decrypt(enc.ciphertext, key, enc.iv, badTag)).toThrow();
  });
});
