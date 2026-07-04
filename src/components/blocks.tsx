import type { ReactNode } from 'react';
import { Ic } from './icons';
import { Btn } from './Btn';
import { Peek } from './Peek';

export type Hue = 'teal' | 'purple' | 'lime' | 'brown';

/* Striped placeholder gallery tile — swapped for real photos as they arrive. */
export function Ph({
  label,
  hue = 'teal',
  tall = false,
  cap,
}: {
  label: string;
  hue?: Hue;
  tall?: boolean;
  cap?: ReactNode;
}) {
  const map: Record<Hue, [string, string]> = {
    teal: ['#2e7da9', '#246287'],
    purple: ['#5e2d91', '#4a2273'],
    lime: ['#8aae1e', '#6f8f16'],
    brown: ['#6e4128', '#4d2c18'],
  };
  const [a, b] = map[hue] || map.teal;
  const bg = `repeating-linear-gradient(135deg, ${a} 0 9px, ${b} 9px 18px)`;
  return (
    <div className={`gal-item ${tall ? 'tall' : ''} reveal`}>
      <div className="ph" style={{ background: bg }}>
        <span className="lbl">{label}</span>
      </div>
      {cap && <div className="cap">{cap}</div>}
    </div>
  );
}

/* Section heading block */
export function Head({
  eyebrow,
  title,
  sub,
  center,
  light,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  center?: boolean;
  light?: boolean;
}) {
  return (
    <div className={`head-block ${center ? 'center' : ''} reveal`}>
      {eyebrow && (
        <span
          className={`eyebrow ${center ? 'center' : ''}`}
          style={light ? { color: '#fff' } : undefined}
        >
          {eyebrow}
        </span>
      )}
      <h2 style={light ? { color: '#fff' } : undefined}>{title}</h2>
      {sub && (
        <p className="lead" style={center ? { marginInline: 'auto' } : undefined}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* Centered page header used by the interior pages */
export function SubHero({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <section
      style={{
        position: 'relative',
        padding: 'clamp(48px,7vw,90px) 0 clamp(30px,4vw,50px)',
        overflow: 'hidden',
      }}
    >
      <div className="wrap" style={{ maxWidth: 840, textAlign: 'center' }}>
        <span className="eyebrow center reveal" style={{ justifyContent: 'center' }}>
          {eyebrow}
        </span>
        <h1
          className="reveal d1"
          style={{ fontSize: 'clamp(2.3rem,5vw,3.8rem)', marginTop: 14, fontWeight: 700 }}
        >
          {title}
        </h1>
        {sub && (
          <p className="lead reveal d2" style={{ marginTop: 18, marginInline: 'auto' }}>
            {sub}
          </p>
        )}
      </div>
      <Peek w={74} style={{ right: '8%', top: 0, opacity: 0.9 }} />
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="cta-band reveal">
          <span className="eyebrow center" style={{ color: '#fff' }}>
            Ready when you are
          </span>
          <h2 style={{ marginTop: 14 }}>Let's make something worth wearing</h2>
          <p>Tell us your idea and quantity — we'll send a friendly, no-pressure quote.</p>
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
  );
}
