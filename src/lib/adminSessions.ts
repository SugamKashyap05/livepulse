import crypto from "crypto"

const TOKEN_BYTES = 32
const NONCE_HEX_LENGTH = 16
const EXPIRES_HEX_LENGTH = 12
const SIGNATURE_HEX_LENGTH =
  TOKEN_BYTES * 2 - NONCE_HEX_LENGTH - EXPIRES_HEX_LENGTH

function getAdminSecret() {
  return process.env.ADMIN_SECRET || null
}

export function createAdminSession(): string {
  const adminSecret = getAdminSecret()
  if (!adminSecret) throw new Error("Admin auth is not configured")

  const nonce = crypto.randomBytes(NONCE_HEX_LENGTH / 2).toString("hex")
  const expiresHex = (Date.now() + 24 * 60 * 60 * 1000)
    .toString(16)
    .padStart(EXPIRES_HEX_LENGTH, "0")
    .slice(-EXPIRES_HEX_LENGTH)
  const payload = `${nonce}${expiresHex}`
  const signature = crypto
    .createHmac("sha256", adminSecret)
    .update(payload)
    .digest("hex")
    .slice(0, SIGNATURE_HEX_LENGTH)

  return `${payload}${signature}`
}

export function validateAdminSession(token: string): boolean {
  const adminSecret = getAdminSecret()
  if (!adminSecret) return false
  if (!/^[a-f0-9]{64}$/i.test(token)) return false

  const payloadLength = NONCE_HEX_LENGTH + EXPIRES_HEX_LENGTH
  const payload = token.slice(0, payloadLength)
  const expiresHex = token.slice(NONCE_HEX_LENGTH, payloadLength)
  const signature = token.slice(payloadLength)
  const expiresAt = parseInt(expiresHex, 16)

  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false
  }

  const expected = crypto
    .createHmac("sha256", adminSecret)
    .update(payload)
    .digest("hex")
    .slice(0, SIGNATURE_HEX_LENGTH)

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    )
  } catch {
    return false
  }
}

export function deleteAdminSession(token: string): void {
  void token
}
