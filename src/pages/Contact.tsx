import { useState, type FormEvent } from 'react';
import { Ic } from '../components/icons';
import { Btn } from '../components/Btn';
import { Peek } from '../components/Peek';
import { Head, SubHero } from '../components/blocks';
import { FAQS } from '../data/content';

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

const REQUIRED_FIELDS = ['name', 'email', 'service', 'message'] as const;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function Contact() {
  const [sent, setSent] = useState(false);
  const [errs, setErrs] = useState<Record<string, boolean>>({});
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next: Record<string, boolean> = {};
    REQUIRED_FIELDS.forEach((k) => {
      if (!String(fd.get(k) || '').trim()) next[k] = true;
    });
    const em = String(fd.get('email') || '');
    if (em && !EMAIL_RE.test(em)) next.email = true;
    setErrs(next);
    if (Object.keys(next).length === 0) {
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
                    <input id="cq-name" name="name" placeholder="Your name" />
                    <span className="err">Please enter your name.</span>
                  </div>
                  <div className={`field ${errs.email ? 'bad' : ''}`}>
                    <label htmlFor="cq-email">
                      Email <span className="req">*</span>
                    </label>
                    <input id="cq-email" name="email" type="email" placeholder="you@email.com" />
                    <span className="err">Enter a valid email.</span>
                  </div>
                </div>
                <div className="two">
                  <div className="field">
                    <label htmlFor="cq-phone">Phone</label>
                    <input id="cq-phone" name="phone" placeholder="(optional)" />
                  </div>
                  <div className={`field ${errs.service ? 'bad' : ''}`}>
                    <label htmlFor="cq-service">
                      Service <span className="req">*</span>
                    </label>
                    <select id="cq-service" name="service" defaultValue="">
                      <option value="" disabled>
                        Choose one…
                      </option>
                      <option>Machine Embroidery</option>
                      <option>Screen Printing</option>
                      <option>Digitizing</option>
                      <option>Heat Transfers</option>
                      <option>Not sure — help me decide</option>
                    </select>
                    <span className="err">Please pick a service.</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="cq-qty">Estimated quantity</label>
                  <input id="cq-qty" name="qty" placeholder="e.g. 24 polos" />
                </div>
                <div className={`field ${errs.message ? 'bad' : ''}`}>
                  <label htmlFor="cq-message">
                    Project details <span className="req">*</span>
                  </label>
                  <textarea
                    id="cq-message"
                    name="message"
                    placeholder="Tell us about your garments, logo, colors, deadline…"
                  ></textarea>
                  <span className="err">A few details help us quote accurately.</span>
                </div>
                <button
                  className="btn btn-primary"
                  type="submit"
                  style={{ justifyContent: 'center' }}
                >
                  Send my request <Ic.arrow />
                </button>
                <p style={{ fontSize: '.82rem', color: 'var(--muted)', textAlign: 'center' }}>
                  This is a demo form — submissions aren't stored.
                </p>
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
                  <a href="tel:13149217075" style={{ color: 'var(--accent-2)', fontWeight: 700 }}>
                    (314) 921-7075
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
