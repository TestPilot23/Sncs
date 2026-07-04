import { Ic, type IconName } from '../components/icons';
import { Btn } from '../components/Btn';
import { Head, SubHero, CtaBand } from '../components/blocks';

const VALUES: ReadonlyArray<[IconName, string, string, string]> = [
  [
    'heart',
    'Locally owned',
    'A real St. Louis studio you can call, visit, and build a relationship with.',
    'var(--purple)',
  ],
  [
    'spool',
    'Everything in-house',
    'Embroidery, printing, digitizing & transfers — one shop, consistent quality.',
    'var(--teal)',
  ],
  [
    'check',
    'No job too big or small',
    'Six caps or six hundred polos, you get the same care and craftsmanship.',
    'var(--lime-deep)',
  ],
  [
    'clock',
    '18+ years of know-how',
    'Since 2007 we’ve learned what makes a design last — and look great.',
    'var(--brown)',
  ],
];

export function About() {
  return (
    <main className="page">
      <SubHero
        eyebrow="Our Story"
        title="A little St. Louis studio with a big heart"
        sub="Since 2007, we've been turning logos and ideas into apparel people love to wear."
      />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap feature">
          <div
            className="feature-media reveal"
            style={{
              aspectRatio: '4/5',
              background:
                'radial-gradient(120% 120% at 30% 20%,var(--teal) 0%,var(--teal-deep) 100%)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <img
              src="/assets/stitches.png"
              alt="Stitches the dachshund"
              style={{ width: '70%', filter: 'drop-shadow(0 18px 26px rgba(0,0,0,.35))' }}
              className="wag"
            />
            <span className="ribbon">Meet Stitches</span>
          </div>
          <div className="reveal d1">
            <h2 style={{ fontSize: 'clamp(1.9rem,3.6vw,2.6rem)' }}>
              Machine embroidery at it's best — and we mean it
            </h2>
            <p className="lead" style={{ marginTop: 16 }}>
              Stitches-n-Color Studio opened its doors in 2007 with a simple belief: custom apparel
              should look fantastic, last for years, and be made by people who actually care about
              your project.
            </p>
            <p style={{ marginTop: 16, color: 'var(--muted)' }}>
              From a single embroidered cap to a full corporate uniform order, we treat every job —
              big or small — with the same attention to detail. We handle embroidery, screen
              printing, digitizing and heat transfers all under one roof, so your brand stays
              consistent across everything you order.
            </p>
            <p style={{ marginTop: 16, color: 'var(--muted)' }}>
              And keeping an eye on every project is{' '}
              <b style={{ color: 'var(--accent-2)' }}>Stitches</b>, our spirited little dachshund
              and studio mascot. Don't be surprised if he pops up where you least expect him — he
              likes to think he runs the place.
            </p>
            <div style={{ display: 'flex', gap: 14, marginTop: 26 }}>
              <Btn to="contact" variant="primary" icon>
                Start a project
              </Btn>
              <Btn to="gallery" variant="ghost">
                See our work
              </Btn>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section bg-soft">
        <div className="wrap">
          <Head center eyebrow="Why folks choose us" title="The Stitches-n-Color difference" />
          <div className="svc-grid">
            {VALUES.map(([ic, t, d, h], i) => {
              const Icon = Ic[ic];
              return (
                <div className={`card svc reveal d${(i % 4) + 1}`} key={i}>
                  <div className="ico" style={{ background: h }}>
                    <Icon />
                  </div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <CtaBand />
    </main>
  );
}
