import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
// Domain-separates the derived key from any other use of AUTH_SECRET (e.g.
// NextAuth's own session/JWT signing), so this ciphertext can't be produced
// or read by code that only knows how NextAuth itself uses the secret.
const KEY_INFO = "dibayar-invoice-share-token-v1";
const ENCODING_VERSION = "v1";

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", KEY_INFO, KEY_BYTES));
}

function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required to encrypt or decrypt a share token");
  }
  return secret;
}

// Authenticated-encryption-at-rest counterpart to hashShareToken: the hash
// alone can verify a presented token but can never reproduce it, so the
// owner-facing "reuse my existing link" flow needs a reversible form. AES-256-GCM
// with a random IV per call keeps this indistinguishable from random noise to
// anyone without AUTH_SECRET, and its auth tag makes tampering with a stored
// ciphertext (e.g. a corrupted/partial DB write) fail decryption loudly rather
// than silently returning a wrong token.
export function encryptShareToken(token: string, secret: string = requireAuthSecret()): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [ENCODING_VERSION, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ".",
  );
}

// Never throws: a corrupted/unrecognized/foreign-key ciphertext is treated
// exactly like "can't recover the plaintext" (null), the same fallback state
// already used for a share created before this encryption existed.
export function decryptShareToken(encoded: string, secret: string = requireAuthSecret()): string | null {
  try {
    const [version, ivB64, authTagB64, ciphertextB64] = encoded.split(".");
    if (version !== ENCODING_VERSION || !ivB64 || !authTagB64 || !ciphertextB64) return null;

    const key = deriveKey(secret);
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}
