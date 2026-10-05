import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

// The CloudFront Function is plain JS with no exports, so load its source and evaluate it.
const source = readFileSync('infrastructure/cloudfront/spa-fallback.js', 'utf8');
const handler = new Function(`${source}; return handler;`)() as (e: {
  request: { uri: string };
}) => { uri: string };

const rewrite = (uri: string) => handler({ request: { uri } }).uri;

describe('SPA fallback CloudFront Function', () => {
  it('serves the entry document for the root', () => {
    expect(rewrite('/')).toBe('/index.html');
  });

  it('serves the entry document for client-side paths without a file extension', () => {
    expect(rewrite('/gallery')).toBe('/index.html');
    expect(rewrite('/some/deep/path')).toBe('/index.html');
    expect(rewrite('/some/deep/path/')).toBe('/index.html');
  });

  it('leaves real files alone, including hashed bundles and images', () => {
    expect(rewrite('/index.html')).toBe('/index.html');
    expect(rewrite('/assets/index-Ab12Cd.js')).toBe('/assets/index-Ab12Cd.js');
    expect(rewrite('/assets/logo-script.png')).toBe('/assets/logo-script.png');
    expect(rewrite('/favicon.ico')).toBe('/favicon.ico');
  });

  it('does not turn a missing file into the entry document', () => {
    // A request for a file that does not exist must stay a failure, not a 200 page.
    expect(rewrite('/assets/missing.png')).toBe('/assets/missing.png');
  });

  it('never rewrites API paths, so API errors are never masked', () => {
    expect(rewrite('/api/contact')).toBe('/api/contact');
    expect(rewrite('/api/unknown')).toBe('/api/unknown');
  });

  it('treats a dot in a directory name as a path, not an extension', () => {
    expect(rewrite('/v1.2/about')).toBe('/index.html');
  });
});
