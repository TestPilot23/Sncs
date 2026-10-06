import { describe, it, expect, vi } from 'vitest';
import { verifyTurnstile } from '../../lambda/contact/src/turnstile';

const reply = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body });

describe('verifyTurnstile', () => {
  it('posts the secret, token and client ip to Cloudflare siteverify', async () => {
    const fetchFn = reply({ success: true });
    await verifyTurnstile(fetchFn, 'sekret', 'tok123', '203.0.113.9');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    const sent = new URLSearchParams(init.body as string);
    expect(sent.get('secret')).toBe('sekret');
    expect(sent.get('response')).toBe('tok123');
    expect(sent.get('remoteip')).toBe('203.0.113.9');
  });

  it('is true only when Cloudflare says success', async () => {
    expect(await verifyTurnstile(reply({ success: true }), 's', 't', 'ip')).toBe(true);
    expect(await verifyTurnstile(reply({ success: false }), 's', 't', 'ip')).toBe(false);
    expect(await verifyTurnstile(reply({}), 's', 't', 'ip')).toBe(false);
    expect(await verifyTurnstile(reply({ success: 'true' }), 's', 't', 'ip')).toBe(false);
  });

  it('throws when Cloudflare cannot be reached or answers with an error status', async () => {
    await expect(
      verifyTurnstile(vi.fn().mockRejectedValue(new Error('network')), 's', 't', 'ip'),
    ).rejects.toThrow();
    await expect(
      verifyTurnstile(reply({ success: true }, false), 's', 't', 'ip'),
    ).rejects.toThrow();
  });
});
