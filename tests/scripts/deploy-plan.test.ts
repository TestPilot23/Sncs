import { describe, expect, it } from 'vitest';
import {
  cacheControlFor,
  contentTypeFor,
  deployCommands,
  planUploads,
} from '../../scripts/lib/deploy-plan.ts';

const files = [
  'index.html',
  'favicon.svg',
  'icons.svg',
  'assets/index-8yJxTPru.js',
  'assets/index-Abc123.css',
  'assets/embroidery-detail.jpg',
  'assets/favicon.png',
];

describe('cache headers', () => {
  it.each([
    ['assets/index-8yJxTPru.js', 'public, max-age=31536000, immutable'],
    ['assets/index-Abc123.css', 'public, max-age=31536000, immutable'],
    ['assets/embroidery-detail.jpg', 'public, max-age=86400'],
    ['assets/favicon.png', 'public, max-age=86400'],
    ['index.html', 'no-cache'],
    ['favicon.svg', 'no-cache'],
  ])('%s -> %s', (key, expected) => {
    expect(cacheControlFor(key)).toBe(expected);
  });

  it('only treats the top-level assets/ folder as assets', () => {
    expect(cacheControlFor('nested/assets/a.png')).toBe('no-cache');
  });

  it('does not treat a lookalike outside /assets/ as hashed', () => {
    expect(cacheControlFor('index-8yJxTPru.js')).toBe('no-cache');
  });
});

describe('content types', () => {
  it.each([
    ['index.html', 'text/html; charset=utf-8'],
    ['assets/index-x.js', 'text/javascript; charset=utf-8'],
    ['assets/index-x.css', 'text/css; charset=utf-8'],
    ['favicon.svg', 'image/svg+xml'],
    ['assets/a.jpg', 'image/jpeg'],
    ['assets/a.png', 'image/png'],
  ])('%s -> %s', (key, expected) => {
    expect(contentTypeFor(key)).toBe(expected);
  });

  it('refuses a file type it does not know rather than guessing', () => {
    expect(() => contentTypeFor('assets/a.exe')).toThrow(/a\.exe/);
  });
});

describe('upload order', () => {
  const plan = planUploads(files);

  it('uploads hashed assets first, other files second and index.html last', () => {
    expect(plan.map((p) => p.key)).toEqual([
      'assets/index-8yJxTPru.js',
      'assets/index-Abc123.css',
      'assets/embroidery-detail.jpg',
      'assets/favicon.png',
      'favicon.svg',
      'icons.svg',
      'index.html',
    ]);
  });

  it('puts index.html last even when the input lists it first', () => {
    expect(plan.at(-1)?.key).toBe('index.html');
  });

  it('never leaves a hashed asset after index.html', () => {
    const last = plan.findIndex((p) => p.key === 'index.html');
    expect(plan.slice(last).every((p) => !p.key.startsWith('assets/index-'))).toBe(true);
  });

  it('attaches the cache header and content type to every entry', () => {
    for (const p of plan) {
      expect(p.cacheControl).toBe(cacheControlFor(p.key));
      expect(p.contentType).toBe(contentTypeFor(p.key));
    }
  });

  it('fails when there is no index.html (an incomplete build must not deploy)', () => {
    expect(() => planUploads(['assets/index-a.js'])).toThrow(/index\.html/);
  });
});

describe('aws commands', () => {
  const cmds = deployCommands(planUploads(files), 'my-bucket', 'EDIST123');

  it('copies each file to the bucket with its cache header and content type', () => {
    const first = cmds[0];
    expect(first).toEqual([
      's3',
      'cp',
      'dist/assets/index-8yJxTPru.js',
      's3://my-bucket/assets/index-8yJxTPru.js',
      '--cache-control',
      'public, max-age=31536000, immutable',
      '--content-type',
      'text/javascript; charset=utf-8',
      '--only-show-errors',
    ]);
  });

  it('ends with the index.html copy and then an invalidation of only /index.html and /', () => {
    expect(cmds.at(-2)?.[3]).toBe('s3://my-bucket/index.html');
    expect(cmds.at(-1)).toEqual([
      'cloudfront',
      'create-invalidation',
      '--distribution-id',
      'EDIST123',
      '--paths',
      '/index.html',
      '/',
    ]);
  });

  it('never deletes anything from the bucket', () => {
    expect(cmds.flat().some((a) => a === 'rm' || a === '--delete' || a === 'sync')).toBe(false);
  });
});
