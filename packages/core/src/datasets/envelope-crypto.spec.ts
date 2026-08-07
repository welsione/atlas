import { describe, expect, it } from '@jest/globals'
import { EnvelopeCrypto } from './envelope-crypto.js'

describe('EnvelopeCrypto', () => {
  it('信封加密：DEK 包装/解包 + 内容加解密往返', () => {
    const crypto = new EnvelopeCrypto('test-kek')
    const wrapped = crypto.wrapNewDek()
    const dek = crypto.unwrapDek(wrapped)
    expect(dek).toHaveLength(32)

    const plain = 'sk-secret-value'
    const cipher = crypto.encryptWithDek(dek, plain)
    expect(cipher).not.toContain(plain)
    expect(crypto.decryptWithDek(dek, cipher)).toBe(plain)
  })

  it('不同 KEK 无法解包（密钥隔离）', () => {
    const a = new EnvelopeCrypto('kek-a')
    const b = new EnvelopeCrypto('kek-b')
    const wrapped = a.wrapNewDek()
    expect(() => b.unwrapDek(wrapped)).toThrow()
  })

  it('同一明文每次加密产生不同密文（随机 IV）', () => {
    const crypto = new EnvelopeCrypto('test-kek')
    const dek = crypto.unwrapDek(crypto.wrapNewDek())
    const c1 = crypto.encryptWithDek(dek, 'same')
    const c2 = crypto.encryptWithDek(dek, 'same')
    expect(c1).not.toBe(c2)
    expect(crypto.decryptWithDek(dek, c1)).toBe('same')
    expect(crypto.decryptWithDek(dek, c2)).toBe('same')
  })
})
