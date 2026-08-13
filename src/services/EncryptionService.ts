import crypto from 'crypto';

const SERVER_KEY_SALT = 'shelby-server-key-salt';

/**
 * Derive the server-side wrapping key from an env secret (or the platform key).
 */
export function serverWrappingKey(): Buffer {
  const seed = process.env.SERVER_KEY_SEED || process.env.APTOS_PRIVATE_KEY || 'dev-server-key-seed';
  return deriveKeyFromSeed(seed, SERVER_KEY_SALT);
}

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

/**
 * Wrap a client-provided data key (base64) with the server wrapping key.
 * Returns a self-contained string: ciphertext(ivHex/authTagHex) as "ct|iv|tag".
 */
export function wrapDataKey(dataKeyB64: string): string {
  const enc = encrypt(Buffer.from(dataKeyB64, 'base64'), serverWrappingKey());
  return `${enc.ciphertext}|${enc.iv}|${enc.authTag}`;
}

/**
 * Unwrap a wrapped data key back to the raw key buffer.
 */
export function unwrapDataKey(wrapped: string): Buffer {
  const [ct, iv, tag] = wrapped.split('|');
  return decrypt(ct, serverWrappingKey(), iv, tag);
}
