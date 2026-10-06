import { extname } from 'node:path';

export type Upload = { key: string; cacheControl: string; contentType: string };

const HASHED = /^assets\/index-/;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function cacheControlFor(key: string): string {
  if (HASHED.test(key)) return 'public, max-age=31536000, immutable';
  if (key.startsWith('assets/')) return 'public, max-age=86400';
  return 'no-cache';
}

export function contentTypeFor(key: string): string {
  const type = TYPES[extname(key).toLowerCase()];
  if (!type) throw new Error(`no content type known for ${key}`);
  return type;
}

/** Hashed assets first, everything else second, index.html last, so a page never points at a missing file. */
export function planUploads(keys: string[]): Upload[] {
  if (!keys.includes('index.html')) throw new Error('build has no index.html');
  const rank = (k: string) => (HASHED.test(k) ? 0 : k === 'index.html' ? 2 : 1);
  return [...keys]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((key) => ({
      key,
      cacheControl: cacheControlFor(key),
      contentType: contentTypeFor(key),
    }));
}

/** `aws` argument lists, in the order they must run. Nothing is ever deleted: old objects stay for rollback. */
export function deployCommands(
  uploads: Upload[],
  bucket: string,
  distributionId: string,
): string[][] {
  return [
    ...uploads.map((u) => [
      's3',
      'cp',
      `dist/${u.key}`,
      `s3://${bucket}/${u.key}`,
      '--cache-control',
      u.cacheControl,
      '--content-type',
      u.contentType,
      '--only-show-errors',
    ]),
    [
      'cloudfront',
      'create-invalidation',
      '--distribution-id',
      distributionId,
      '--paths',
      '/index.html',
      '/',
    ],
  ];
}
