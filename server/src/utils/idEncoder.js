const SALT = 0x6d2b79f5;

export function encodeId(num) {
  if (num === null || num === undefined) return '';
  const id = Number(num);
  if (isNaN(id) || id <= 0) return String(num);

  let x = (id ^ SALT) >>> 0;
  x = ((x << 13) | (x >>> 19)) >>> 0;
  return 'x' + x.toString(36);
}

export function decodeId(code) {
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

  const parsed = Number(s);
  return isNaN(parsed) ? 0 : parsed;
}

export default { encodeId, decodeId };
