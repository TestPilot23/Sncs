// The contact request contract, shared by the form (browser) and the handler (Lambda) so the two
// validators cannot drift. Imported by relative path; no package.

export const SERVICES = [
  'Machine Embroidery',
  'Screen Printing',
  'Digitizing',
  'Heat Transfers',
  'Not sure — help me decide',
] as const;

export const LIMITS = { name: 100, email: 254, phone: 40, qty: 100, message: 4000 } as const;
export const TURNSTILE_TOKEN_MAX = 2048;
/** Hidden form field real visitors never fill in; bots usually do. */
export const HONEYPOT_FIELD = 'website';

export interface ContactFields {
  name: string;
  email: string;
  phone: string;
  service: string;
  qty: string;
  message: string;
}

export type ContactField = keyof ContactFields;

export type ContactResult =
  { ok: true; value: ContactFields } | { ok: false; fields: (ContactField | 'body')[] };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ORDER: ContactField[] = ['name', 'email', 'phone', 'service', 'qty', 'message'];
const REQUIRED = new Set<ContactField>(['name', 'email', 'service', 'message']);

/** Validates untrusted input and returns trimmed, known fields only. */
export function validateContact(input: unknown): ContactResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, fields: ['body'] };
  }
  const raw = input as Record<string, unknown>;
  const value = {} as ContactFields;
  const bad: ContactField[] = [];

  for (const key of ORDER) {
    const v = raw[key];
    if (v !== undefined && typeof v !== 'string') {
      bad.push(key);
      continue;
    }
    const text = (v ?? '').trim();
    value[key] = text;
    if (REQUIRED.has(key) && !text) bad.push(key);
    else if (key in LIMITS && text.length > LIMITS[key as keyof typeof LIMITS]) bad.push(key);
    else if (key === 'email' && text && !EMAIL_RE.test(text)) bad.push(key);
    else if (key === 'service' && text && !(SERVICES as readonly string[]).includes(text)) {
      bad.push(key);
    }
  }
  return bad.length ? { ok: false, fields: bad } : { ok: true, value };
}
