import { describe, it, expect } from 'vitest';
import { composeAutoReply, composeOwnerEmail, toSesInput } from '../../lambda/contact/src/email';

const config = {
  ownerEmails: ['owner@example.com', 'shop@example.com'],
  fromAddress: 'quotes@stitchesncolorstudio.com',
  fromName: 'Stitches-n-Color Studio',
  shopPhone: '(314) 921-7075',
  shopHours: 'Monday–Friday, 9 AM – 4 PM',
};

const req = {
  name: 'Jeff Grenard',
  email: 'jeff@customer.test',
  phone: '314-555-0100',
  service: 'Machine Embroidery',
  qty: '24 polos',
  message: 'Left-chest logo, navy polos, due June 1',
};

describe('owner notification', () => {
  const m = composeOwnerEmail(req, config);

  it('goes to the configured owners from the shop address', () => {
    expect(m.to).toEqual(config.ownerEmails);
    expect(m.from).toEqual({ name: config.fromName, address: config.fromAddress });
  });

  it('replies straight to the customer', () => {
    expect(m.replyTo).toEqual(['jeff@customer.test']);
  });

  it('has a subject with the service and customer name', () => {
    expect(m.subject).toBe('Quote request: Machine Embroidery — Jeff Grenard');
  });

  it('carries every submitted field in both text and html', () => {
    for (const v of Object.values(req)) {
      expect(m.text).toContain(v);
      expect(m.html).toContain(v);
    }
  });

  it('strips CR/LF and control characters from header values', () => {
    const hostile = composeOwnerEmail(
      { ...req, name: 'Bob\r\nBcc: victim@example.com', service: 'Digitizing\u0000\u0007' },
      config,
    );
    expect([...hostile.subject].every((ch) => ch.charCodeAt(0) > 0x1f)).toBe(true);
    expect(hostile.subject).toBe('Quote request: Digitizing — Bob Bcc: victim@example.com');
    expect(Object.keys(hostile).sort()).toEqual([
      'from',
      'html',
      'replyTo',
      'subject',
      'text',
      'to',
    ]);
    expect(hostile.replyTo).toHaveLength(1);
  });

  it('never lets a hostile reply-to value carry a second address through a header', () => {
    const hostile = composeOwnerEmail(
      { ...req, email: 'a@example.com\r\nBcc: x@example.com' },
      config,
    );
    expect(hostile.replyTo).toEqual(['a@example.com Bcc: x@example.com']);
    expect(hostile.replyTo[0]).not.toMatch(/[\r\n]/);
  });

  it('escapes every interpolated value in the html body', () => {
    const x = composeOwnerEmail(
      { ...req, message: '<script>alert(1)</script> & "quotes"', name: '<b>Eve</b>' },
      config,
    );
    expect(x.html).not.toContain('<script>');
    expect(x.html).not.toContain('<b>Eve</b>');
    expect(x.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;');
    expect(x.html).toContain('&lt;b&gt;Eve&lt;/b&gt;');
  });

  it('keeps the raw text in the plain-text part (text/plain is not interpreted)', () => {
    const x = composeOwnerEmail({ ...req, message: '<b>hi</b>' }, config);
    expect(x.text).toContain('<b>hi</b>');
  });
});

describe('customer auto-reply', () => {
  const secretProse = 'SECRET-PROSE-123 please wire money to account 9';
  const r = composeAutoReply({ ...req, message: secretProse }, config);

  it('goes to the customer and replies to the shop', () => {
    expect(r.to).toEqual(['jeff@customer.test']);
    expect(r.replyTo).toEqual(config.ownerEmails);
    expect(r.from.address).toBe(config.fromAddress);
  });

  it('thanks the customer and states hours and phone', () => {
    expect(r.text).toContain(config.shopHours);
    expect(r.text).toContain(config.shopPhone);
    expect(r.html).toContain(config.shopHours);
    expect(r.html).toContain(config.shopPhone);
  });

  it('echoes only the service and quantity', () => {
    expect(r.text).toContain('Machine Embroidery');
    expect(r.text).toContain('24 polos');
  });

  it('never includes the free-text message, the name or the phone', () => {
    for (const part of [r.text, r.html, r.subject]) {
      expect(part).not.toContain('SECRET-PROSE-123');
      expect(part).not.toContain('wire money');
      expect(part).not.toContain('Jeff Grenard');
      expect(part).not.toContain('314-555-0100');
    }
  });

  it('escapes the quantity it does echo', () => {
    const x = composeAutoReply({ ...req, qty: '<img src=x onerror=1>' }, config);
    expect(x.html).not.toContain('<img');
    expect(x.html).toContain('&lt;img');
  });

  it('omits the quantity line when none was given', () => {
    const x = composeAutoReply({ ...req, qty: '' }, config);
    expect(x.text).not.toMatch(/quantity/i);
  });
});

describe('toSesInput', () => {
  const email = composeOwnerEmail(req, config);
  const input = toSesInput(email, 'sncs');

  it('quotes the display name so the hyphens and any quotes are safe', () => {
    expect(input.FromEmailAddress).toBe(
      '"Stitches-n-Color Studio" <quotes@stitchesncolorstudio.com>',
    );
    const odd = toSesInput(
      { ...email, from: { name: 'A "B" \\ C', address: 'q@example.com' } },
      'sncs',
    );
    expect(odd.FromEmailAddress).toBe('"A \\"B\\" \\\\ C" <q@example.com>');
  });

  it('maps recipients, reply-to, subject, both bodies and the configuration set', () => {
    expect(input.Destination).toEqual({ ToAddresses: config.ownerEmails });
    expect(input.ReplyToAddresses).toEqual(['jeff@customer.test']);
    expect(input.Content?.Simple?.Subject?.Data).toBe(email.subject);
    expect(input.Content?.Simple?.Body?.Text?.Data).toBe(email.text);
    expect(input.Content?.Simple?.Body?.Html?.Data).toBe(email.html);
    expect(input.ConfigurationSetName).toBe('sncs');
  });

  it('declares UTF-8 so the en dash in the subject survives', () => {
    expect(input.Content?.Simple?.Subject?.Charset).toBe('UTF-8');
    expect(input.Content?.Simple?.Body?.Text?.Charset).toBe('UTF-8');
    expect(input.Content?.Simple?.Body?.Html?.Charset).toBe('UTF-8');
  });
});
