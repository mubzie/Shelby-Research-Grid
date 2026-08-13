export interface EncryptedFile {
  ciphertext: Uint8Array
  iv: string
  authTag: string
  dataKey: string
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const fromBase64 = (b64: string): Uint8Array => {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const getCrypto = (): Crypto => {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto
  }
  throw new Error('WebCrypto is not available in this environment')
}

/**
 * Encrypts file bytes client-side with AES-256-GCM using a random per-dataset key.
 * The ciphertext (with auth tag split out) is what travels over the network.
 */
export async function encryptFile(data: ArrayBuffer | Uint8Array): Promise<EncryptedFile> {
  const cryptoApi = getCrypto()
  const keyBytes = cryptoApi.getRandomValues(new Uint8Array(32))
  const ivBytes = cryptoApi.getRandomValues(new Uint8Array(12))
  const source = data instanceof Uint8Array ? data.slice().buffer : data

  const cryptoKey = await cryptoApi.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const encrypted = new Uint8Array(await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, cryptoKey, source))

  // WebCrypto appends the 16-byte GCM auth tag to the ciphertext
  const authTag = encrypted.slice(encrypted.length - 16)
  const ciphertext = encrypted.slice(0, encrypted.length - 16)

  return {
    ciphertext,
    iv: toBase64(ivBytes),
    authTag: toBase64(authTag),
    dataKey: toBase64(keyBytes),
  }
}

/**
 * Decrypts ciphertext produced by encryptFile (recombines the auth tag for WebCrypto).
 */
export async function decryptFile(
  ciphertext: Uint8Array,
  ivB64: string,
  authTagB64: string,
  dataKeyB64: string
): Promise<Uint8Array> {
  const cryptoApi = getCrypto()
  const keyBytes = fromBase64(dataKeyB64)
  const iv = fromBase64(ivB64)
  const tag = fromBase64(authTagB64)
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.length)

  const cryptoKey = await cryptoApi.subtle.importKey('raw', keyBytes as BufferSource, { name: 'AES-GCM' }, false, ['decrypt'])
  const plain = new Uint8Array(await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cryptoKey, combined as BufferSource))
  return plain
}
