import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce recommended for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag
const DEFAULT_KEY_VERSION = 'v1';

/**
 * Resolves the 32-byte encryption key buffer from hex string or env var.
 * @param {string} [keyHex] - Optional 64-char hex string
 * @returns {Buffer} 32-byte key buffer
 */
function resolveKeyBuffer(keyHex) {
  const hex = keyHex || process.env.GATEWAY_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('GATEWAY_ENCRYPTION_KEY environment variable is not defined.');
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error(`Invalid GATEWAY_ENCRYPTION_KEY length: expected 32 bytes (64 hex characters), got ${buf.length} bytes.`);
  }
  return buf;
}

/**
 * Encrypts a plaintext secret using AES-256-GCM with a fresh random IV.
 * @param {string} plaintext - The plain secret string (e.g., API key_secret or webhook secret)
 * @param {string} [keyHex] - Optional 32-byte hex key override
 * @returns {{ encrypted: string, iv: string, authTag: string, keyVersion: string }}
 */
export function encryptSecret(plaintext, keyHex) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptSecret: plaintext must be a non-empty string.');
  }

  const key = resolveKeyBuffer(keyHex);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
    keyVersion: DEFAULT_KEY_VERSION
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext using the given IV, authTag, and key.
 * Throws an error if ciphertext or tag was tampered with.
 * @param {string} encryptedHex - Ciphertext in hex
 * @param {string} ivHex - 12-byte IV in hex (24 chars)
 * @param {string} authTagHex - 16-byte Auth Tag in hex (32 chars)
 * @param {string} [keyVersion='v1'] - Version identifier of the key
 * @param {string} [keyHex] - Optional 32-byte hex key override
 * @returns {string} Decrypted plaintext string
 */
export function decryptSecret(encryptedHex, ivHex, authTagHex, keyVersion = 'v1', keyHex) {
  if (!encryptedHex || !ivHex || !authTagHex) {
    throw new Error('decryptSecret: encrypted, iv, and authTag are required.');
  }

  const key = resolveKeyBuffer(keyHex);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}.`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid AuthTag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}.`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a cryptographically secure random 32-byte hex key for configuration.
 * @returns {string} 64-char hex string
 */
export function generateKeyHex() {
  return crypto.randomBytes(32).toString('hex');
}

