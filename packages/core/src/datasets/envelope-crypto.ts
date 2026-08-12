import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * 信封加密：KEK（ATLAS_ENC_KEY）+ 每数据集随机 DEK。
 * secret 密文由 DEK 加密；DEK 由 KEK 加密成 dek_wrapped 存库。
 * 格式：iv(12B) + ciphertext + tag(16B)，Base64（与 Java 版一致）。
 */
export class EnvelopeCrypto {
  private readonly kek: Buffer

  constructor(encKey: string) {
    this.kek = createHash('sha256').update(encKey || 'atlas-dev-encryption-key-change-me').digest()
  }

  /** 生成随机 DEK（32 字节）并返回其 KEK 包装（Base64 iv+ciphertext）。 */
  wrapNewDek(): string {
    return aesGcmEncrypt(this.kek, randomBytes(32))
  }

  /** 解包 DEK。 */
  unwrapDek(dekWrapped: string): Buffer {
    return aesGcmDecrypt(this.kek, dekWrapped)
  }

  encryptWithDek(dek: Buffer, plain: string): string {
    return aesGcmEncrypt(dek, Buffer.from(plain, 'utf8'))
  }

  decryptWithDek(dek: Buffer, ciphertext: string): string {
    return aesGcmDecrypt(dek, ciphertext).toString('utf8')
  }
}

/** AES-256-GCM：随机 IV 前置，格式 iv(12)+ciphertext+tag(16)，Base64。 */
function aesGcmEncrypt(key: Buffer, plain: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, encrypted, tag]).toString('base64')
}

function aesGcmDecrypt(key: Buffer, combined: string): Buffer {
  const data = Buffer.from(combined, 'base64')
  const iv = data.subarray(0, 12)
  const tag = data.subarray(data.length - 16)
  const encrypted = data.subarray(12, data.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}
