import { useRef, useState, type FormEvent } from 'react';
import { Ic } from '../components/icons';
import { Btn } from '../components/Btn';
import { Peek } from '../components/Peek';
import { Head, SubHero } from '../components/blocks';
import { Turnstile } from '../components/Turnstile';
import { FAQS, SHOP_PHONE } from '../data/content';
import {
  LIMITS,
  SERVICES as SERVICE_OPTIONS,
  validateContact,
  type ContactField,
} from '../shared/contact';

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="faq">
      {FAQS.map(([q, a], i) => (
        <div className={`qa ${open === i ? 'open' : ''} reveal`} key={i}>
          <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span>{q}</span>
            <span className="plus">
              <Ic.plus width={16} height={16} />
            </span>
          </button>
          <div className="ans" style={{ maxHeight: open === i ? '240px' : '0' }}>
            <p>{a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

type Alert = 'failed' | 'verify' | null;

export function Contact() {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errs, setErrs] = useState<Partial<Record<ContactField, boolean>>>({});
  const [alert, setAlert] = useState<Alert>(null);
  const [token, setToken] = useState('');
  const [widgetKey, setWidgetKey] = useState(0);
  const inFlight = useRef(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlight.current) return;
    const fd = new FormData(e.currentTarget);
    const field = (k: string) => String(fd.get(k) ?? '');
    const result = validateContact({
      name: field('name'),
      email: field('email'),
      phone: field('phone'),
      service: field('service'),
      qty: field('qty'),
      message: field('message'),
    });
    const bad: Partial<Record<ContactField, boolean>> = {};
    if (!result.ok) result.fields.forEach((f) => f !== 'body' && (bad[f] = true));
    setErrs(bad);
    if (!result.ok) return setAlert(null);
    if (siteKey && !token) return setAlert('verify');

    inFlight.current = true;
    setSending(true);
    setAlert(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...result.value, website: field('website'), turnstileToken: token }),
      });
      if (res.ok) {
        setSent(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { fields?: string[] };
        const fields = body.fields ?? [];
        if (fields.includes('turnstileToken')) {
          setToken('');
          setWidgetKey((k) => k + 1); // fresh widget, tokens are single-use
          setAlert('verify');
        } else {
          const server: Partial<Record<ContactField, boolean>> = {};
          fields.forEach((f) => (server[f as ContactField] = true));
          setErrs(server);
          if (!fields.length) setAlert('failed');
        }
      } else {
        setAlert('failed');
      }
    } catch {
      setAlert('failed');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };
  return (
    <main className="page">
      <SubHero
        eyebrow="Get a Quote"
        title="Let's talk about your project"
        sub="Tell us what you need and we'll get back to you with a friendly, no-pressure quote — usually within one business day."
      />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap contact-grid">
          {/* FORM */}
          <div
            className="card reveal"
            style={{ padding: 'clamp(26px,4vw,40px)', position: 'relative', overflow: 'hidden' }}
          >
            {sent ? (
              <div className="form-sent">
                <div className="big">
                  <Ic.check />
                </div>
                <h3 style={{ fontSize: '1.7rem' }}>Thanks — we got it!</h3>
                <p className="lead" style={{ margin: '12px auto 0' }}>
                  We'll be in touch shortly. Stitches is already wagging his tail.
                </p>
                <div style={{ marginTop: 22 }}>
                  <Btn to="home" variant="ghost">
                    Back to home
                  </Btn>
                </div>
                <Peek w={120} wag style={{ right: 6, bottom: -6 }} />
              </div>
            ) : (
              <form className="form" onSubmit={submit} noValidate>
                <h3 style={{ fontSize: '1.5rem' }}>Request a quote</h3>
                <div className="two">
                  <div className={`field ${errs.name ? 'bad' : ''}`}>
                    <label htmlFor="cq-name">
                      Name <span className="req">*</span>
                    </label>
                    <input
                      id="cq-name"
                      name="name"
                      placeholder="Your name"
                      maxLength={LIMITS.name}
                    />
                    <span className="err">Please enter your name.</span>
                  </div>
                  <div className={`field ${errs.email ? 'bad' : ''}`}>
                    <label htmlFor="cq-email">
                      Email <span className="req">*</span>
                    </label>
                    <input
                      id="cq-email"
                      name="email"
                      type="email"
                      placeholder="you@email.com"
                      maxLength={LIMITS.email}
                    />
                    <span className="err">Enter a valid email.</span>
                  </div>
                </div>
                <div className="two">
                  <div className="field">
                    <label htmlFor="cq-phone">Phone</label>
                    <input
                      id="cq-phone"
                      name="phone"
                      placeholder="(optional)"
                      maxLength={LIMITS.phone}
                    />
                  </div>
                  <div className={`field ${errs.service ? 'bad' : ''}`}>
                    <label htmlFor="cq-service">
                      Service <span className="req">*</span>
                    </label>
                    <select id="cq-service" name="service" defaultValue="">
                      <option value="" disabled>
                        Choose one…
                      </option>
                      {SERVICE_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <span className="err">Please pick a service.</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="cq-qty">Estimated quantity</label>
                  <input
                    id="cq-qty"
                    name="qty"
                    placeholder="e.g. 24 polos"
                    maxLength={LIMITS.qty}
                  />
                </div>
                <div className={`field ${errs.message ? 'bad' : ''}`}>
                  <label htmlFor="cq-message">
                    Project details <span className="req">*</span>
                  </label>
                  <textarea
                    id="cq-message"
                    name="message"
                    placeholder="Tell us about your garments, logo, colors, deadline…"
                    maxLength={LIMITS.message}
                  ></textarea>
                  <span className="err">A few details help us quote accurately.</span>
                </div>
                <div className="hp" aria-hidden="true">
                  <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                </div>
                {siteKey && <Turnstile key={widgetKey} siteKey={siteKey} onToken={setToken} />}
                {alert && (
                  <p className="form-alert" role="alert">
                    {alert === 'verify'
                      ? 'Please complete the verification so we know you are a person, then send again.'
                      : "We couldn't send your request. Please try again, or call us at "}
                    {alert === 'failed' && (
                      <a href={`tel:${SHOP_PHONE.tel}`}>{SHOP_PHONE.display}</a>
                    )}
                    {alert === 'failed' && '.'}
                  </p>
                )}
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={sending}
                  aria-busy={sending}
                  style={{ justifyContent: 'center' }}
                >
                  {sending ? 'Sending…' : 'Send my request'} <Ic.arrow />
                </button>
              </form>
            )}
          </div>
          {/* INFO */}
          <div className="contact-info reveal d1">
            <div className="info-row">
              <div className="ico" style={{ background: 'var(--teal)' }}>
                <Ic.phone />
              </div>
              <div>
                <h4>Call us</h4>
                <p>
                  <a
                    href={`tel:${SHOP_PHONE.tel}`}
                    style={{ color: 'var(--accent-2)', fontWeight: 700 }}
                  >
                    {SHOP_PHONE.display}
                  </a>
                </p>
              </div>
            </div>
            <div className="info-row">
              <div className="ico" style={{ background: 'var(--lime-deep)' }}>
                <Ic.clock />
              </div>
              <div>
                <h4>Hours</h4>
                <p>
                  Monday–Friday, 9 AM – 4 PM
                  <br />
                  Also available by appointment
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section bg-soft">
        <div className="wrap">
          <Head center eyebrow="Good to know" title="Frequently asked questions" />
          <Faq />
        </div>
      </section>
    </main>
  );
}
