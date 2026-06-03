import crypto from 'crypto';

export function deriveKeyFromSeed(seed: any, salt = 'shelby-key-salt'): Buffer {
  const s = String(seed || '');
  return crypto.pbkdf2Sync(s, salt, 100000, 32, 'sha256');
}

export function encrypt(plaintext: Buffer, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('base64')
  };
}

export function decrypt(ciphertextB64: string, key: Buffer, ivHex: any, authTagHex: any) {
  const iv = Buffer.from(String(ivHex || ''), 'hex');
  const authTag = Buffer.from(String(authTagHex || ''), 'hex');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain;
}
