/**
 * Reversible Alphanumeric ID Obfuscation Utility
 * Encodes numeric database IDs into clean, non-human-readable alphanumeric slugs
 * for public and internal URLs (e.g. 6 -> "xuv6mcl").
 */

const SALT = 0x6d2b79f5;

/**
 * Encodes a numeric ID into an alphanumeric string.
 * e.g., 6 -> "xuv6mcl", 12 -> "xuv7o9x"
 */
export function encodeId(num: any): string {
  if (num === null || num === undefined) return '';
  const id = Number(num);
  if (isNaN(id) || id <= 0) return String(num);

  // Bitwise permutation cipher
  let x = (id ^ SALT) >>> 0;
  x = ((x << 13) | (x >>> 19)) >>> 0;
  return 'x' + x.toString(36);
}

/**
 * Decodes an alphanumeric string back into the original numeric ID.
 * Gracefully handles legacy numeric IDs (e.g., "6" -> 6) as well as encoded strings ("xuv6mcl" -> 6).
 */
export function decodeId(code: any): number {
  if (code === null || code === undefined || code === '') return 0;
  if (typeof code === 'number') return code;

  const s = String(code).trim();
  if (s.startsWith('x') || s.startsWith('X')) {
    const raw = parseInt(s.slice(1), 36);
    if (!isNaN(raw) && raw > 0) {
      let x = ((raw >>> 13) | (raw << 19)) >>> 0;
      const decoded = (x ^ SALT) >>> 0;
      if (decoded > 0 && decoded < 2147483647) {
        return decoded;
      }
    }
  }

  // Fallback: check if it's already a raw numeric ID
  const parsed = Number(s);
  return isNaN(parsed) ? 0 : parsed;
}

export default { encodeId, decodeId };
