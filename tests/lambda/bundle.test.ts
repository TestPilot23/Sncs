import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

// The unit tests exercise the source. This one exercises the artifact Lambda actually runs: it builds
// the real bundle and loads it in a fresh Node process, the way Lambda's runtime does. It catches
// packaging faults the source tests cannot, e.g. an ESM bundle that crashes with "Dynamic require of
// node:https is not supported", or a module that loads but exports no handler.
describe('built Lambda bundle', () => {
  it('loads in a fresh Node process and answers a request', { timeout: 30_000 }, () => {
    // Start clean so a stale artifact from an earlier build can never make this pass.
    rmSync('lambda/contact/dist', { recursive: true, force: true });
    execFileSync('npm', ['run', 'build:lambda', '--silent'], { stdio: 'pipe' });
    const script = `
      const m = require('./lambda/contact/dist/index.cjs');
      if (typeof m.handler !== 'function') { console.log('NO_HANDLER'); process.exit(1); }
      m.handler({
        headers: { 'content-type': 'application/json' },
        body: '{}',
        requestContext: { requestId: 'bundle-test', http: { sourceIp: '203.0.113.1' } },
      }).then((r) => console.log('RESULT ' + JSON.stringify({ status: r.statusCode, body: r.body })));
    `;
    const out = execFileSync('node', ['-e', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        FROM_ADDRESS: 'quotes@example.test',
        FROM_NAME: 'Test',
        SHOP_PHONE: '555',
        SHOP_HOURS: 'always',
        CONFIG_SET: 'test',
        TURNSTILE_SECRET_PARAM: '/test',
        OWNER_EMAILS: 'owner@example.test',
      },
    });
    const line = out.split('\n').find((l) => l.startsWith('RESULT '));
    expect(line).toBeDefined();
    const result = JSON.parse(line!.slice('RESULT '.length));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'invalid',
      fields: ['name', 'email', 'service', 'message'],
    });
  });
});
