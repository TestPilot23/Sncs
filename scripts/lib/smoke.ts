export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type Failure = { check: 'home' | 'asset-cache' | 'contact-route'; detail: string };
export type SmokeResult = { ok: boolean; failures: Failure[] };

const IMMUTABLE = 'public, max-age=31536000, immutable';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Proves the live site without sending mail: the contact route only ever gets an empty (invalid) body. */
export async function runSmoke(base: string, fetcher: Fetch = fetch): Promise<SmokeResult> {
  const failures: Failure[] = [];
  const fail = (check: Failure['check'], detail: string) => failures.push({ check, detail });
  const url = (path: string) => new URL(path, base).toString();

  let html = '';
  try {
    const res = await fetcher(url('/'));
    html = await res.text();
    if (res.status !== 200) fail('home', `GET / returned ${res.status}`);
    else if (!html.includes('<div id="root">')) fail('home', 'GET / has no <div id="root">');
  } catch (e) {
    fail('home', message(e));
  }

  const asset = /\/assets\/index-[\w-]+\.(?:js|css)/.exec(html)?.[0];
  if (!asset) {
    // when / already failed there is nothing to look at, and that failure is reported above
    if (!failures.some((f) => f.check === 'home'))
      fail('asset-cache', 'no hashed asset in index.html');
  } else {
    try {
      const res = await fetcher(url(asset));
      const cc = res.headers.get('cache-control');
      if (res.status !== 200 || cc !== IMMUTABLE) {
        fail('asset-cache', `${asset} returned ${res.status} with cache-control ${cc}`);
      }
    } catch (e) {
      fail('asset-cache', message(e));
    }
  }

  try {
    const res = await fetcher(url('/api/contact'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const type = res.headers.get('content-type') ?? '';
    if (res.status !== 400 || !type.includes('application/json')) {
      fail(
        'contact-route',
        `POST /api/contact returned ${res.status} ${type || '(no content-type)'}`,
      );
    }
  } catch (e) {
    fail('contact-route', message(e));
  }

  return { ok: failures.length === 0, failures };
}
