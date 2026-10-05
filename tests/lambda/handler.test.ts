import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHandler, type ContactEvent } from '../../lambda/contact/src/handler';
import type { ComposedEmail } from '../../lambda/contact/src/email';

const config = {
  ownerEmails: ['owner@example.com'],
  fromAddress: 'quotes@stitchesncolorstudio.com',
  fromName: 'Stitches-n-Color Studio',
  shopPhone: '(314) 921-7075',
  shopHours: 'Monday–Friday, 9 AM – 4 PM',
  maxBodyBytes: 16 * 1024,
};

const goodBody = {
  name: 'Jeff Grenard',
  email: 'jeff@customer.test',
  phone: '314-555-0100',
  service: 'Screen Printing',
  qty: '24 hoodies',
  message: 'Spring league hoodies, navy, logo on the back',
  turnstileToken: 'tok-ok',
};

let sent: ComposedEmail[];
let logs: Record<string, unknown>[];
let send: ReturnType<typeof vi.fn>;
let verify: ReturnType<typeof vi.fn>;

const build = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) =>
  createHandler({
    config,
    send: send as never,
    verifyTurnstile: verify as never,
    log: (e) => logs.push(e),
    ...overrides,
  });

const event = (body: unknown, extra: Partial<ContactEvent> = {}): ContactEvent => ({
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
  isBase64Encoded: false,
  requestContext: { requestId: 'req-1', http: { sourceIp: '203.0.113.9' } },
  ...extra,
});

const json = (r: { body: string }) => JSON.parse(r.body);

beforeEach(() => {
  sent = [];
  logs = [];
  send = vi.fn(async (m: ComposedEmail) => {
    sent.push(m);
  });
  verify = vi.fn(async () => true);
});

describe('a valid request', () => {
  it('returns 200, notifies the owner first, then auto-replies to the customer', async () => {
    const r = await build()(event(goodBody));
    expect(r.statusCode).toBe(200);
    expect(json(r)).toEqual({ ok: true });
    expect(sent.map((m) => m.to)).toEqual([['owner@example.com'], ['jeff@customer.test']]);
    expect(sent[0].replyTo).toEqual(['jeff@customer.test']);
    expect(sent[1].replyTo).toEqual(['owner@example.com']);
  });

  it('verifies the Turnstile token with the client ip', async () => {
    await build()(event(goodBody));
    expect(verify).toHaveBeenCalledWith('tok-ok', '203.0.113.9');
  });

  it('hints Cloudflare with the visitor ip from cf-connecting-ip, not the CDN edge address', async () => {
    await build()(
      event(goodBody, {
        headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '198.51.100.7' },
      }),
    );
    expect(verify).toHaveBeenCalledWith('tok-ok', '198.51.100.7');
  });

  it('accepts a charset on the content type, in any header case', async () => {
    const r = await build()(
      event(goodBody, { headers: { 'Content-Type': 'application/json; charset=utf-8' } }),
    );
    expect(r.statusCode).toBe(200);
  });

  it('decodes a base64 body', async () => {
    const b64 = Buffer.from(JSON.stringify(goodBody)).toString('base64');
    const r = await build()(event(b64, { isBase64Encoded: true }));
    expect(r.statusCode).toBe(200);
  });

  it('answers with a JSON content type', async () => {
    const r = await build()(event(goodBody));
    expect(r.headers['content-type']).toBe('application/json');
  });
});

describe('rejected requests send nothing', () => {
  it('400 naming the field when validation fails, without calling Cloudflare', async () => {
    const r = await build()(event({ ...goodBody, email: 'not-an-email' }));
    expect(r.statusCode).toBe(400);
    expect(json(r)).toEqual({ error: 'invalid', fields: ['email'] });
    expect(sent).toHaveLength(0);
    expect(verify).not.toHaveBeenCalled();
  });

  it('400 for a service that is not offered', async () => {
    const r = await build()(event({ ...goodBody, service: 'Pet Grooming' }));
    expect(r.statusCode).toBe(400);
    expect(json(r).fields).toEqual(['service']);
  });

  it('413 when the body exceeds the size cap', async () => {
    const r = await build()(event({ ...goodBody, message: 'a'.repeat(20 * 1024) }));
    expect(r.statusCode).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it('415 for any content type other than JSON', async () => {
    for (const ct of ['text/plain', 'application/x-www-form-urlencoded', undefined]) {
      const r = await build()(event(goodBody, { headers: ct ? { 'content-type': ct } : {} }));
      expect(r.statusCode).toBe(415);
    }
    expect(sent).toHaveLength(0);
  });

  it('400 for malformed JSON', async () => {
    const r = await build()(event('{not json'));
    expect(r.statusCode).toBe(400);
    expect(json(r).error).toBe('invalid_json');
  });

  it('400 for an empty body', async () => {
    const r = await build()(event(goodBody, { body: null }));
    expect(r.statusCode).toBe(400);
  });

  it('400 when the Turnstile token is missing, without calling Cloudflare', async () => {
    const { turnstileToken: _t, ...noToken } = goodBody;
    const r = await build()(event(noToken));
    expect(r.statusCode).toBe(400);
    expect(json(r).fields).toEqual(['turnstileToken']);
    expect(verify).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('400 when Cloudflare reports the token invalid', async () => {
    verify = vi.fn(async () => false);
    const r = await build()(event(goodBody));
    expect(r.statusCode).toBe(400);
    expect(json(r).fields).toEqual(['turnstileToken']);
    expect(sent).toHaveLength(0);
  });

  it('502 and no mail when Cloudflare cannot be reached (fails closed)', async () => {
    verify = vi.fn(async () => {
      throw new Error('network');
    });
    const r = await build()(event(goodBody));
    expect(r.statusCode).toBe(502);
    expect(sent).toHaveLength(0);
  });
});

describe('honeypot', () => {
  it('returns 200 success and sends nothing when the hidden field is filled', async () => {
    const r = await build()(event({ ...goodBody, website: 'http://spam.example' }));
    expect(r.statusCode).toBe(200);
    expect(json(r)).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
    expect(verify).not.toHaveBeenCalled();
  });

  it('is not triggered by an empty or whitespace value', async () => {
    const r = await build()(event({ ...goodBody, website: '  ' }));
    expect(sent).toHaveLength(2);
    expect(r.statusCode).toBe(200);
  });
});

describe('failure semantics protect the lead', () => {
  it('502 and no auto-reply when the owner notification fails', async () => {
    send = vi.fn(async () => {
      throw new Error('ses down');
    });
    const r = await build()(event(goodBody));
    expect(r.statusCode).toBe(502);
    expect(json(r).error).toBe('delivery_failed');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('200 and a logged failure when only the auto-reply fails', async () => {
    send = vi
      .fn()
      .mockImplementationOnce(async (m: ComposedEmail) => {
        sent.push(m);
      })
      .mockRejectedValueOnce(new Error('bounce'));
    const r = await build()(event(goodBody));
    expect(r.statusCode).toBe(200);
    expect(logs.some((l) => l.outcome === 'auto_reply_failed')).toBe(true);
  });

  it('502 and no mail when no owner recipient is configured', async () => {
    const r = await build({ config: { ...config, ownerEmails: [] } })(event(goodBody));
    expect(r.statusCode).toBe(502);
    expect(sent).toHaveLength(0);
  });
});

describe('logging never records personal data', () => {
  it('logs the request id, service and outcome but none of the submitted content', async () => {
    await build()(event(goodBody));
    const all = JSON.stringify(logs);
    expect(all).toContain('req-1');
    expect(all).toContain('Screen Printing');
    expect(all).toContain('ok');
    for (const secret of [
      '314-555-0100',
      'Spring league',
      'jeff@customer.test',
      'jeff',
      'Grenard',
      'tok-ok',
    ]) {
      expect(all).not.toContain(secret);
    }
  });

  it('does not log content for rejected or failed requests either', async () => {
    send = vi.fn(async () => {
      throw new Error('boom jeff@customer.test');
    });
    await build()(event(goodBody));
    await build()(event({ ...goodBody, email: 'bad' }));
    const all = JSON.stringify(logs);
    expect(all).not.toContain('jeff@customer.test');
    expect(all).not.toContain('Spring league');
    expect(all).not.toContain('314-555-0100');
  });
});
