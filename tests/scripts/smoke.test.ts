import { describe, expect, it } from 'vitest';
import { runSmoke, type Fetch } from '../../scripts/lib/smoke.ts';

const HTML = '<html><script src="/assets/index-8yJxTPru.js"></script><div id="root"></div></html>';
const IMMUTABLE = 'public, max-age=31536000, immutable';

type Reply = { status?: number; headers?: Record<string, string>; body?: string };
const healthy: Record<string, Reply> = {
  'GET /': { status: 200, headers: { 'content-type': 'text/html' }, body: HTML },
  'GET /assets/index-8yJxTPru.js': {
    status: 200,
    headers: { 'cache-control': IMMUTABLE },
    body: '',
  },
  'POST /api/contact': {
    status: 400,
    headers: { 'content-type': 'application/json' },
    body: '{"fields":["name"]}',
  },
};

function fakeFetch(overrides: Record<string, Reply> = {}, calls: string[] = []): Fetch {
  const replies = { ...healthy, ...overrides };
  return async (url, init) => {
    const path = new URL(url).pathname;
    const key = `${init?.method ?? 'GET'} ${path}`;
    calls.push(key);
    const r = replies[key];
    if (!r) throw new Error(`unexpected request ${key}`);
    return new Response(r.body ?? '', { status: r.status ?? 200, headers: r.headers });
  };
}

const names = (r: Awaited<ReturnType<typeof runSmoke>>) => r.failures.map((f) => f.check);

describe('smoke checks', () => {
  it('passes a healthy site', async () => {
    expect(await runSmoke('https://x.test', fakeFetch())).toEqual({ ok: true, failures: [] });
  });

  it('fails when / is not 200', async () => {
    const r = await runSmoke('https://x.test', fakeFetch({ 'GET /': { status: 503, body: HTML } }));
    expect(names(r)).toContain('home');
  });

  it('fails when / does not contain the app root', async () => {
    const r = await runSmoke(
      'https://x.test',
      fakeFetch({ 'GET /': { status: 200, body: 'oops' } }),
    );
    expect(names(r)).toEqual(['home']);
  });

  it('fails when the hashed asset is not immutable', async () => {
    const r = await runSmoke(
      'https://x.test',
      fakeFetch({ 'GET /assets/index-8yJxTPru.js': { headers: { 'cache-control': 'no-cache' } } }),
    );
    expect(names(r)).toEqual(['asset-cache']);
  });

  it('fails when the contact route returns HTML', async () => {
    const r = await runSmoke(
      'https://x.test',
      fakeFetch({
        'POST /api/contact': { status: 200, headers: { 'content-type': 'text/html' }, body: HTML },
      }),
    );
    expect(names(r)).toEqual(['contact-route']);
  });

  it('fails when the contact route returns 5xx', async () => {
    const r = await runSmoke(
      'https://x.test',
      fakeFetch({
        'POST /api/contact': { status: 502, headers: { 'content-type': 'application/json' } },
      }),
    );
    expect(names(r)).toEqual(['contact-route']);
  });

  it('fails when 400 comes back as HTML (SPA fallback swallowing /api)', async () => {
    const r = await runSmoke(
      'https://x.test',
      fakeFetch({ 'POST /api/contact': { status: 400, headers: { 'content-type': 'text/html' } } }),
    );
    expect(names(r)).toEqual(['contact-route']);
  });

  it('reports a network error as a failed check instead of throwing', async () => {
    const boom: Fetch = async () => {
      throw new Error('ECONNRESET');
    };
    const r = await runSmoke('https://x.test', boom);
    expect(r.ok).toBe(false);
    expect(r.failures.every((f) => /ECONNRESET/.test(f.detail))).toBe(true);
  });

  it('sends only an invalid body to the contact route, never a valid one', async () => {
    let sent = '';
    const f: Fetch = async (url, init) => {
      if (init?.method === 'POST') sent = String(init.body);
      return fakeFetch()(url, init);
    };
    await runSmoke('https://x.test', f);
    expect(JSON.parse(sent)).toEqual({});
  });
});
