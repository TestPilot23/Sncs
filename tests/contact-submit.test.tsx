import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Contact } from '../src/pages/Contact';

// Stand-in for the Cloudflare widget: a button that "solves" it, so tests control the token.
vi.mock('../src/components/Turnstile', () => ({
  Turnstile: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken('tok-solved')}>
      Solve captcha
    </button>
  ),
}));

type FetchReply = { ok: boolean; status: number; json: () => Promise<unknown> };
const reply = (status: number, body: unknown): FetchReply => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
  fetchMock = vi.fn(async () => reply(200, { ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function fillValid(user: ReturnType<typeof userEvent.setup>, solve = true) {
  await user.type(screen.getByLabelText(/^name/i), 'Jeff Grenard');
  await user.type(screen.getByLabelText(/^email/i), 'jeff@customer.test');
  await user.type(screen.getByLabelText(/^phone/i), '314-555-0100');
  await user.selectOptions(screen.getByLabelText(/^service/i), 'Screen Printing');
  await user.type(screen.getByLabelText(/estimated quantity/i), '24 hoodies');
  await user.type(screen.getByLabelText(/project details/i), 'Spring league hoodies');
  if (solve) await user.click(screen.getByRole('button', { name: /solve captcha/i }));
}
const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /send my request/i }));

describe('Contact form submission', () => {
  it('posts the request as JSON to /api/contact on the same origin', async () => {
    const user = userEvent.setup();
    render(<Contact />);
    await fillValid(user);
    await submit(user);
    expect(await screen.findByText(/thanks — we got it/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/contact');
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Jeff Grenard',
      email: 'jeff@customer.test',
      phone: '314-555-0100',
      service: 'Screen Printing',
      qty: '24 hoodies',
      message: 'Spring league hoodies',
      website: '',
      turnstileToken: 'tok-solved',
    });
  });

  it('disables the button while the request is in flight', async () => {
    let resolve!: (r: FetchReply) => void;
    fetchMock.mockImplementation(() => new Promise<FetchReply>((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<Contact />);
    await fillValid(user);
    await submit(user);
    const button = screen.getByRole('button', { name: /sending/i });
    expect(button).toBeDisabled();
    resolve(reply(200, { ok: true }));
    expect(await screen.findByText(/thanks — we got it/i)).toBeInTheDocument();
  });

  it('sends only one request when submit is activated twice quickly', async () => {
    fetchMock.mockImplementation(
      () => new Promise<FetchReply>((r) => setTimeout(() => r(reply(200, { ok: true })), 30)),
    );
    const user = userEvent.setup();
    render(<Contact />);
    await fillValid(user);
    const button = screen.getByRole('button', { name: /send my request/i });
    await user.dblClick(button);
    await screen.findByText(/thanks — we got it/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the form open and marks the field when the server rejects one', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'invalid', fields: ['email'] }));
    const user = userEvent.setup();
    render(<Contact />);
    await fillValid(user);
    await submit(user);
    await waitFor(() =>
      expect(screen.getByLabelText(/^email/i).closest('.field')).toHaveClass('bad'),
    );
    expect(screen.queryByText(/thanks — we got it/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toHaveValue('Jeff Grenard');
    expect(screen.getByRole('button', { name: /send my request/i })).toBeEnabled();
  });

  it.each([
    [
      'a delivery failure (502)',
      () => fetchMock.mockResolvedValue(reply(502, { error: 'delivery_failed' })),
    ],
    ['a network failure', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
  ])(
    'shows an error with a tap-to-call number after %s, keeping the input',
    async (_n, arrange) => {
      arrange();
      const user = userEvent.setup();
      render(<Contact />);
      await fillValid(user);
      await submit(user);
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/couldn.t send/i);
      const phone = screen.getAllByRole('link', { name: /\(314\) 921-7075/ });
      expect(phone.some((a) => a.getAttribute('href') === 'tel:13149217075')).toBe(true);
      expect(screen.queryByText(/thanks — we got it/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/project details/i)).toHaveValue('Spring league hoodies');
      expect(screen.getByRole('button', { name: /send my request/i })).toBeEnabled();
    },
  );

  it('asks for verification instead of sending when the widget has not been solved', async () => {
    const user = userEvent.setup();
    render(<Contact />);
    await fillValid(user, false);
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/verif/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks the visitor to retry verification when the server rejects the token', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'invalid', fields: ['turnstileToken'] }));
    const user = userEvent.setup();
    render(<Contact />);
    await fillValid(user);
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/verif/i);
    expect(screen.queryByText(/thanks — we got it/i)).not.toBeInTheDocument();
  });

  it('includes a honeypot field that is hidden from people and assistive tech', async () => {
    render(<Contact />);
    const honey = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honey).not.toBeNull();
    expect(honey.tabIndex).toBe(-1);
    expect(honey.autocomplete).toBe('off');
    expect(honey.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByLabelText(/website/i)).not.toBeInTheDocument();
  });

  it('no longer claims to be a demo form', () => {
    render(<Contact />);
    expect(screen.queryByText(/demo form/i)).not.toBeInTheDocument();
  });
});

describe('without a Turnstile site key (local dev)', () => {
  it('renders no widget and still submits', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const user = userEvent.setup();
    render(<Contact />);
    expect(screen.queryByRole('button', { name: /solve captcha/i })).not.toBeInTheDocument();
    await fillValid(user, false);
    await submit(user);
    expect(await screen.findByText(/thanks — we got it/i)).toBeInTheDocument();
  });
});
