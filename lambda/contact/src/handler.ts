import { HONEYPOT_FIELD, TURNSTILE_TOKEN_MAX, validateContact } from '../../../src/shared/contact';
import { composeAutoReply, composeOwnerEmail, type ComposedEmail, type MailConfig } from './email';

export interface ContactConfig extends MailConfig {
  maxBodyBytes: number;
}

export interface ContactEvent {
  headers: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext: { requestId: string; http: { sourceIp: string } };
}

export interface ContactResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface Deps {
  config: ContactConfig;
  send: (email: ComposedEmail) => Promise<void>;
  verifyTurnstile: (token: string, ip: string) => Promise<boolean>;
  log: (entry: Record<string, unknown>) => void;
}

const reply = (statusCode: number, body: unknown): ContactResponse => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const header = (h: ContactEvent['headers'], name: string) =>
  Object.entries(h).find(([k]) => k.toLowerCase() === name)?.[1];

export function createHandler({ config, send, verifyTurnstile, log }: Deps) {
  return async (event: ContactEvent): Promise<ContactResponse> => {
    const requestId = event.requestContext.requestId;
    // Logs carry the request id, service, outcome and error class only: never submitted content.
    const done = (res: ContactResponse, outcome: string, extra: Record<string, unknown> = {}) => {
      log({ requestId, outcome, status: res.statusCode, ...extra });
      return res;
    };

    const mediaType = (header(event.headers, 'content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (mediaType !== 'application/json') {
      return done(reply(415, { error: 'unsupported_media_type' }), 'unsupported_media_type');
    }

    const rawBody = event.body ?? '';
    const text = event.isBase64Encoded ? Buffer.from(rawBody, 'base64').toString('utf8') : rawBody;
    if (Buffer.byteLength(text, 'utf8') > config.maxBodyBytes) {
      return done(reply(413, { error: 'too_large' }), 'too_large');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return done(reply(400, { error: 'invalid_json' }), 'invalid_json');
    }

    const raw = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<
      string,
      unknown
    >;
    const honeypot = raw[HONEYPOT_FIELD];
    if (typeof honeypot === 'string' && honeypot.trim() !== '') {
      return done(reply(200, { ok: true }), 'honeypot');
    }

    const result = validateContact(parsed);
    if (!result.ok) {
      return done(reply(400, { error: 'invalid', fields: result.fields }), 'invalid', {
        fields: result.fields,
      });
    }
    const fields = result.value;

    const token = raw.turnstileToken;
    if (typeof token !== 'string' || token === '' || token.length > TURNSTILE_TOKEN_MAX) {
      return done(reply(400, { error: 'invalid', fields: ['turnstileToken'] }), 'no_token');
    }

    if (config.ownerEmails.length === 0) {
      return done(reply(502, { error: 'delivery_failed' }), 'misconfigured');
    }

    try {
      if (!(await verifyTurnstile(token, clientIp(event)))) {
        return done(reply(400, { error: 'invalid', fields: ['turnstileToken'] }), 'bad_token');
      }
    } catch (err) {
      return done(reply(502, { error: 'verification_unavailable' }), 'verify_failed', {
        errorClass: errorClass(err),
      });
    }

    const base = { service: fields.service };
    try {
      await send(composeOwnerEmail(fields, config));
    } catch (err) {
      return done(reply(502, { error: 'delivery_failed' }), 'owner_send_failed', {
        ...base,
        errorClass: errorClass(err),
      });
    }

    try {
      await send(composeAutoReply(fields, config));
    } catch (err) {
      return done(reply(200, { ok: true }), 'auto_reply_failed', {
        ...base,
        errorClass: errorClass(err),
      });
    }
    return done(reply(200, { ok: true }), 'ok', base);
  };
}

// Behind Cloudflare and CloudFront the socket address is the CDN edge; Cloudflare supplies the visitor.
// Only a hint for Turnstile, never a security decision.
const clientIp = (e: ContactEvent) =>
  header(e.headers, 'cf-connecting-ip') ?? e.requestContext.http.sourceIp;

const errorClass = (err: unknown) => (err instanceof Error ? err.name : 'UnknownError');
