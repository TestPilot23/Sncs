const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type FetchFn = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** True only when Cloudflare confirms the token. Throws if Cloudflare cannot be reached, so the caller
 *  can fail closed rather than treat an outage as "valid" or "invalid". */
export async function verifyTurnstile(
  fetchFn: FetchFn,
  secret: string,
  token: string,
  ip: string,
): Promise<boolean> {
  const res = await fetchFn(SITEVERIFY, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`turnstile_http_error`);
  const data = (await res.json()) as { success?: unknown };
  return data.success === true;
}
