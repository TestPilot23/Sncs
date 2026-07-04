import type { MouseEvent } from 'react';
import { Ic } from '../components/icons';
import { Btn } from '../components/Btn';
import { Peek } from '../components/Peek';
import { Head, Ph } from '../components/blocks';
import { navigate } from '../hooks/useHashRoute';
import { SERVICES, TESTIMONIALS } from '../data/content';

export function Home() {
  const goServices = (e: MouseEvent) => {
    e.preventDefault();
    navigate('services');
  };
  return (
    <main className="page">
      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow reveal">Saint Louis · Since 2007</span>
            <h1 className="reveal d1" style={{ marginTop: 14 }}>
              Machine embroidery{' '}
              <span className="hl">
                at it's best
                <svg viewBox="0 0 300 14" preserveAspectRatio="none">
                  <path
                    d="M2 9C60 3 120 3 150 7s90 4 148-3"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="lead reveal d2">
              Custom embroidered apparel and corporate logo wear, stitched with pride right here in
              St. Louis. From a single cap to a full company order — no job is too big or too small.
            </p>
            <div className="hero-cta reveal d3">
              <Btn to="contact" variant="primary" icon>
                Request a Quote
              </Btn>
              <Btn to="gallery" variant="ghost">
                See Our Work
              </Btn>
            </div>
            <div className="hero-trust reveal d4">
              <div className="ti">
                <b>18+</b>
                <span>
                  years
                  <br />
                  in business
                </span>
              </div>
              <div className="sep"></div>
              <div className="ti">
                <Ic.heart width={22} height={22} style={{ color: 'var(--accent)' }} />
                <span>
                  Locally owned
                  <br />& operated
                </span>
              </div>
            </div>
          </div>
          <div className="hero-art reveal d2">
            <div className="hero-blob"></div>
            <img
              className="hero-dog"
              src="/assets/stitches.png"
              alt="Stitches, the Stitches-n-Color dachshund mascot"
            />
          </div>
        </div>
      </section>

      {/* SERVICES PREVIEW */}
      <section className="section" style={{ position: 'relative' }}>
        <div className="wrap">
          <Head
            center
            eyebrow="What we do"
            title="One studio, every custom finish"
            sub="Whatever your idea, we have the equipment and the experience to make it look sharp and last."
          />
          <div className="svc-grid">
            {SERVICES.map((s, i) => {
              const Icon = Ic[s.icon];
              return (
                <div
                  className={`card svc reveal d${(i % 4) + 1}`}
                  key={s.key}
                  style={{ position: 'relative' }}
                >
                  <div className="ico" style={{ background: s.hue }}>
                    <Icon />
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                  <a className="more" href="#/services" onClick={goServices}>
                    Learn more <Ic.arrow width={14} height={14} />
                  </a>
                  {i === 1 && <Peek w={86} flip style={{ right: -14, bottom: -6, zIndex: 1 }} />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* QUALITY FEATURE */}
      <section className="section bg-soft">
        <div className="wrap">
          <div className="feature">
            <div className="feature-media reveal">
              <span className="ribbon">Sewn with pride</span>
              <img
                src="/assets/embroidery-detail.jpg"
                alt="Close-up of Stitches-n-Color embroidery on a polo"
              />
            </div>
            <div className="reveal d1">
              <span className="eyebrow">Quality you can feel</span>
              <h2 style={{ marginTop: 14, fontSize: 'clamp(1.9rem,3.6vw,2.8rem)' }}>
                Every stitch, dialed in by hand
              </h2>
              <p className="lead" style={{ marginTop: 16 }}>
                We don't just hit "go." Our team digitizes, tests and adjusts each design so your
                logo looks as good on a cap as it does on a jacket.
              </p>
              <ul className="checklist">
                {[
                  'Free design consultation on every order',
                  'In-house digitizing for clean, accurate logos',
                  'Color-matched threads to your brand',
                  'Built to survive years of washing and wear',
                ].map((t, i) => (
                  <li key={i}>
                    <span className="ck">
                      <Ic.check />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY PREVIEW */}
      <section className="section">
        <div className="wrap">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: 18,
            }}
          >
            <Head
              eyebrow="Recent work"
              title="A few things we've stitched up"
              sub="Corporate logo wear, team gear, and one-off custom pieces."
            />
            <Btn to="gallery" variant="ghost" icon>
              View full gallery
            </Btn>
          </div>
          <div className="gal-grid" style={{ marginTop: 10 }}>
            <Ph label="corporate-polos.jpg" hue="teal" cap="Embroidered corporate polos" />
            <Ph label="logo-caps.jpg" hue="purple" cap="Logo caps · color-matched" />
            <Ph label="team-hoodies.jpg" hue="lime" cap="Screen-printed team hoodies" />
            <Ph label="canvas-totes.jpg" hue="brown" cap="Custom canvas totes" />
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section bg-soft" style={{ position: 'relative' }}>
        <div className="wrap">
          <Head center eyebrow="Kind words" title="St. Louis trusts us with their brand" />
          <div className="tst-grid">
            {TESTIMONIALS.map((t, i) => (
              <div className={`card tst reveal d${(i % 3) + 1}`} key={i}>
                <div className="stars">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Ic.star key={k} />
                  ))}
                </div>
                <blockquote>“{t.q}”</blockquote>
                <div className="who">
                  <span className="av" style={{ background: t.hue }}>
                    {t.i}
                  </span>
                  <div>
                    <b>{t.n}</b>
                    <span>{t.r}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="section">
        <div className="wrap">
          <div className="cta-band reveal">
            <span className="eyebrow center" style={{ color: '#fff' }}>
              Ready when you are
            </span>
            <h2 style={{ marginTop: 14 }}>Let's put your logo on something great</h2>
            <p>
              Send us your idea and quantity — we'll get you a friendly, no-pressure quote. Stitches
              will be waiting.
            </p>
            <div className="hero-cta">
              <Btn to="contact" variant="accent" icon>
                Request a Quote
              </Btn>
              <a className="btn btn-white" href="tel:13149217075">
                <Ic.phone /> (314) 921-7075
              </a>
            </div>
            <Peek className="dog-trouble" w={150} wag flip />
          </div>
        </div>
      </section>
    </main>
  );
}
