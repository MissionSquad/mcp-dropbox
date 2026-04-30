import * as crypto from 'node:crypto'

export class SecretEncryptor {
  private key: Buffer
  private readonly algorithm = 'aes-256-gcm'

  constructor(key: Buffer | string) {
    if (typeof key === 'string') {
      this.key = crypto.createHash('sha256').update(key).digest()
      return
    }

    if (key.length !== 32) {
      throw new Error('Key must be 32 bytes long for AES-256-GCM.')
    }

    this.key = key
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }

  decrypt(data: string): string {
    const parts = data.split(':')

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format.')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encryptedText = parts[2]

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }
}

