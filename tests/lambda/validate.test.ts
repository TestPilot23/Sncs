import { describe, it, expect } from 'vitest';
import { LIMITS, SERVICES, validateContact } from '../../src/shared/contact';

const valid = {
  name: 'Jeff',
  email: 'jeff@example.com',
  service: 'Screen Printing',
  message: 'Team hoodies for spring league',
};

const fieldsOf = (input: unknown) => {
  const r = validateContact(input);
  return r.ok ? [] : r.fields;
};

describe('validateContact', () => {
  it('accepts the minimum valid request and omits absent optional fields', () => {
    const r = validateContact(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ ...valid, phone: '', qty: '' });
  });

  it('trims surrounding whitespace on every field', () => {
    const r = validateContact({ ...valid, name: '  Jeff  ', phone: ' 314-555-0100 ', qty: ' 24 ' });
    expect(r.ok && r.value.name).toBe('Jeff');
    expect(r.ok && r.value.phone).toBe('314-555-0100');
    expect(r.ok && r.value.qty).toBe('24');
  });

  it.each(['name', 'email', 'service', 'message'] as const)('requires %s', (field) => {
    expect(fieldsOf({ ...valid, [field]: undefined })).toEqual([field]);
    expect(fieldsOf({ ...valid, [field]: '   ' })).toEqual([field]);
  });

  it.each(['not-an-email', 'a@b', 'a b@example.com', '@example.com', 'a@@example.com'])(
    'rejects malformed email %j',
    (email) => {
      expect(fieldsOf({ ...valid, email })).toEqual(['email']);
    },
  );

  it('rejects an email containing a line break', () => {
    expect(fieldsOf({ ...valid, email: 'a@example.com\r\nBcc: x@example.com' })).toEqual(['email']);
  });

  it('only allows the services offered on the form', () => {
    for (const service of SERVICES) expect(fieldsOf({ ...valid, service })).toEqual([]);
    expect(fieldsOf({ ...valid, service: 'Pet Grooming' })).toEqual(['service']);
  });

  it.each(Object.keys(LIMITS) as (keyof typeof LIMITS)[])(
    'enforces the length limit on %s',
    (k) => {
      const long = 'a'.repeat(LIMITS[k] + 1);
      const input =
        k === 'email' ? { ...valid, email: `${long}@example.com` } : { ...valid, [k]: long };
      expect(fieldsOf(input)).toContain(k);
    },
  );

  it('accepts a value exactly at the limit', () => {
    expect(fieldsOf({ ...valid, message: 'a'.repeat(LIMITS.message) })).toEqual([]);
  });

  it('rejects non-string values rather than coercing them', () => {
    expect(fieldsOf({ ...valid, name: 123 })).toEqual(['name']);
    expect(fieldsOf({ ...valid, message: ['x'] })).toEqual(['message']);
    expect(fieldsOf({ ...valid, phone: {} })).toEqual(['phone']);
  });

  it('reports every bad field at once', () => {
    expect(fieldsOf({})).toEqual(['name', 'email', 'service', 'message']);
  });

  it('rejects a body that is not an object', () => {
    for (const bad of [null, undefined, 'x', 42, [], true]) expect(fieldsOf(bad)).toEqual(['body']);
  });

  it('drops unknown keys instead of passing them through', () => {
    const r = validateContact({ ...valid, bcc: 'x@example.com', __proto__: { admin: true } });
    expect(r.ok && Object.keys(r.value).sort()).toEqual(
      ['email', 'message', 'name', 'phone', 'qty', 'service'].sort(),
    );
  });
});
