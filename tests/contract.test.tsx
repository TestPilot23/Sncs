import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Contact } from '../src/pages/Contact';
import { createHandler } from '../lambda/contact/src/handler';
import type { ComposedEmail } from '../lambda/contact/src/email';

// The two halves of the feature meet here: whatever the real form puts on the wire must be exactly
// what the real handler accepts, and both must agree on what counts as valid.
vi.mock('../src/components/Turnstile', () => ({
  Turnstile: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken('tok')}>
      Solve captcha
    </button>
  ),
}));

const config = {
  ownerEmails: ['owner@example.com'],
  fromAddress: 'quotes@stitchesncolorstudio.com',
  fromName: 'Stitches-n-Color Studio',
  shopPhone: '(314) 921-7075',
  shopHours: 'Monday–Friday, 9 AM – 4 PM',
  maxBodyBytes: 16 * 1024,
};

let sent: ComposedEmail[];
const handler = () =>
  createHandler({
    config,
    send: async (m) => void sent.push(m),
    verifyTurnstile: async () => true,
    log: () => {},
  });

const callHandler = (body: unknown) =>
  handler()({
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    requestContext: { requestId: 'r', http: { sourceIp: '203.0.113.9' } },
  });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  sent = [];
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

interface Sample {
  label: string;
  name: string;
  email: string;
  service: string;
  message: string;
  accept: boolean;
}
const base = {
  name: 'Jeff Grenard',
  email: 'jeff@customer.test',
  service: 'Heat Transfers',
  message: 'Player names and numbers on 20 jerseys',
};
const samples: Sample[] = [
  { label: 'a complete valid request', ...base, accept: true },
  { label: 'a missing name', ...base, name: '', accept: false },
  { label: 'a malformed email', ...base, email: 'jeff@', accept: false },
  { label: 'no service chosen', ...base, service: '', accept: false },
  { label: 'a whitespace-only message', ...base, message: '   ', accept: false },
];

async function fill(user: ReturnType<typeof userEvent.setup>, s: Sample) {
  if (s.name) await user.type(screen.getByLabelText(/^name/i), s.name);
  if (s.email) await user.type(screen.getByLabelText(/^email/i), s.email);
  if (s.service) await user.selectOptions(screen.getByLabelText(/^service/i), s.service);
  if (s.message) await user.type(screen.getByLabelText(/project details/i), s.message);
  await user.click(screen.getByRole('button', { name: /solve captcha/i }));
  await user.click(screen.getByRole('button', { name: /send my request/i }));
}

describe('form ⇄ handler contract', () => {
  it('the exact request the form sends is accepted and delivered by the handler', async () => {
    const user = userEvent.setup();
    render(<Contact />);
    await fill(user, samples[0]);
    await screen.findByText(/thanks — we got it/i);

    const sentBody = fetchMock.mock.calls[0][1].body as string;
    const res = await callHandler(sentBody);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(JSON.parse(sentBody)).sort()).toEqual(
      ['email', 'message', 'name', 'phone', 'qty', 'service', 'turnstileToken', 'website'].sort(),
    );
    expect(sent[0].replyTo).toEqual([base.email]);
    const lines = sent[0].text.split('\n');
    expect(lines).toContain(`Name: ${base.name}`);
    expect(lines).toContain(`Email: ${base.email}`);
    expect(lines).toContain(`Service: ${base.service}`);
    expect(lines).toContain(`Project details: ${base.message}`);
    expect(sent[0].subject).toBe(`Quote request: ${base.service} — ${base.name}`);
    expect(sent[1].to).toEqual([base.email]);
  });

  it.each(samples)('the form and the handler agree on $label', async (s) => {
    const user = userEvent.setup();
    render(<Contact />);
    await fill(user, s);

    const formSent = fetchMock.mock.calls.length === 1;
    const res = await callHandler({
      name: s.name,
      email: s.email,
      service: s.service,
      message: s.message,
      turnstileToken: 'tok',
    });
    expect(formSent).toBe(s.accept);
    expect(res.statusCode === 200).toBe(s.accept);
  });
});
