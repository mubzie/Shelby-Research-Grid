import { encryptFile, decryptFile } from './encryption'

describe('encryption utils', () => {
  it('encrypts file bytes and the ciphertext differs from plaintext', async () => {
    const plaintext = new TextEncoder().encode('SENSITIVE RESEARCH DATA')
    const result = await encryptFile(plaintext)

    expect(result.ciphertext).not.toEqual(plaintext)
    expect(result.iv).toBeTruthy()
    expect(result.authTag).toHaveLength(24) // 16 bytes base64
    expect(result.dataKey).toHaveLength(44) // 32 bytes base64
  })

  it('round-trips: decrypt(encrypt(data)) === data', async () => {
    const plaintext = new TextEncoder().encode('virus sequences row,row,row')
    const enc = await encryptFile(plaintext)
    const dec = await decryptFile(enc.ciphertext, enc.iv, enc.authTag, enc.dataKey)

    expect(new TextDecoder().decode(dec)).toBe('virus sequences row,row,row')
  })

  it('fails to decrypt with the wrong key (auth tag validation)', async () => {
    const plaintext = new TextEncoder().encode('secret')
    const enc = await encryptFile(plaintext)
    const wrongKey = btoa('wrong-key-wrong-key-wrong-key-1234')

    await expect(decryptFile(enc.ciphertext, enc.iv, enc.authTag, wrongKey)).rejects.toThrow()
  })

  it('produces a different ciphertext per file (random IV + key)', async () => {
    const plaintext = new TextEncoder().encode('same input')
    const a = await encryptFile(plaintext)
    const b = await encryptFile(plaintext)

    expect(a.ciphertext).not.toEqual(b.ciphertext)
  })

  it('accepts ArrayBuffer input', async () => {
    const plaintext = new TextEncoder().encode('buffer input')
    const enc = await encryptFile(plaintext.buffer)
    const dec = await decryptFile(enc.ciphertext, enc.iv, enc.authTag, enc.dataKey)
    expect(new TextDecoder().decode(dec)).toBe('buffer input')
  })
})
