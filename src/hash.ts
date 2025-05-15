import * as crypto from 'crypto';

export function md5hashObject(obj: any): string {
  if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) {
    throw new Error('Cannot compute md5 hash for falsy object');
  }
  return md5hash(JSON.stringify(obj));
}

export function md5hash(x: string): string {
  const hash = crypto.createHash('md5');
  hash.update(JSON.stringify(x));
  return hash.digest('hex');
}
