export function slugify(text: string) {
  return text
    .toString()
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export function fmtErr(err: unknown): string {
  if (err instanceof Error) {
    return err.stack || err.message;
  }
  return String(err);
}