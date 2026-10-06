import type { SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import type { ContactFields } from '../../../src/shared/contact';

export interface MailConfig {
  ownerEmails: string[];
  fromAddress: string;
  fromName: string;
  shopPhone: string;
  shopHours: string;
}

export interface ComposedEmail {
  from: { name: string; address: string };
  to: string[];
  replyTo: string[];
  subject: string;
  text: string;
  html: string;
}

/** Control characters (CR/LF included) become one space, so a value can never start a new header. */
const isControl = (c: number) =>
  c <= 0x1f || c === 0x7f || c === 0x85 || c === 0x2028 || c === 0x2029;

const clean = (s: string) => {
  let out = '';
  let gap = false;
  for (const ch of s) {
    if (isControl(ch.codePointAt(0) ?? 0)) {
      gap = true;
      continue;
    }
    if (gap && out) out += ' ';
    gap = false;
    out += ch;
  }
  return out.trim();
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const htmlText = (s: string) => escapeHtml(s).replace(/\r?\n/g, '<br>');

const from = (c: MailConfig) => ({ name: c.fromName, address: c.fromAddress });

export function composeOwnerEmail(r: ContactFields, c: MailConfig): ComposedEmail {
  const rows: [string, string][] = [
    ['Name', r.name],
    ['Email', r.email],
    ['Phone', r.phone],
    ['Service', r.service],
    ['Estimated quantity', r.qty],
    ['Project details', r.message],
  ];
  const shown = rows.filter(([, v]) => v);
  return {
    from: from(c),
    to: c.ownerEmails,
    replyTo: [clean(r.email)],
    subject: `Quote request: ${clean(r.service)} — ${clean(r.name)}`,
    text: shown.map(([k, v]) => `${k}: ${v}`).join('\n'),
    html: `<h2>New quote request</h2><table>${shown
      .map(([k, v]) => `<tr><th align="left" valign="top">${k}</th><td>${htmlText(v)}</td></tr>`)
      .join('')}</table>`,
  };
}

/** Fixed template. It deliberately omits the free-text message, name and phone: anyone can make the
 *  form mail an arbitrary address, so no attacker-chosen prose may appear in what we send. */
export function composeAutoReply(r: ContactFields, c: MailConfig): ComposedEmail {
  const qtyText = r.qty ? `\nEstimated amount: ${r.qty}` : '';
  const qtyHtml = r.qty ? `<br>Estimated amount: ${htmlText(r.qty)}` : '';
  return {
    from: from(c),
    to: [clean(r.email)],
    replyTo: c.ownerEmails,
    subject: `We received your quote request — ${c.fromName}`,
    text: [
      'Hi there,',
      '',
      `Thanks for reaching out to ${c.fromName}. We got your request and will get back to you with a friendly, no-pressure quote, usually within one business day.`,
      '',
      `Service: ${r.service}${qtyText}`,
      '',
      `Hours: ${c.shopHours}`,
      `Phone: ${c.shopPhone}`,
      '',
      'Just reply to this email if you want to add anything.',
    ].join('\n'),
    html: `<p>Hi there,</p><p>Thanks for reaching out to ${escapeHtml(c.fromName)}. We got your request and will get back to you with a friendly, no-pressure quote, usually within one business day.</p><p>Service: ${htmlText(r.service)}${qtyHtml}</p><p>Hours: ${escapeHtml(c.shopHours)}<br>Phone: ${escapeHtml(c.shopPhone)}</p><p>Just reply to this email if you want to add anything.</p>`,
  };
}

const quoteName = (n: string) => `"${n.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export function toSesInput(m: ComposedEmail, configurationSetName: string): SendEmailCommandInput {
  const part = (Data: string) => ({ Data, Charset: 'UTF-8' });
  return {
    FromEmailAddress: `${quoteName(m.from.name)} <${m.from.address}>`,
    Destination: { ToAddresses: m.to },
    ReplyToAddresses: m.replyTo,
    ConfigurationSetName: configurationSetName,
    Content: {
      Simple: {
        Subject: part(m.subject),
        Body: { Text: part(m.text), Html: part(m.html) },
      },
    },
  };
}
