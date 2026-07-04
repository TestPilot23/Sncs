import { Ic } from '../components/icons';
import { Peek } from '../components/Peek';
import { Head, SubHero, CtaBand } from '../components/blocks';
import { SVC_DETAIL, STEPS } from '../data/content';

export function Services() {
  return (
    <main className="page">
      <SubHero
        eyebrow="Our Services"
        title="Custom apparel, done four ways"
        sub="Everything happens in-house at our Florissant studio — so we control the quality from your first sketch to the final stitch."
      />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ display: 'grid', gap: 30 }}>
          {SVC_DETAIL.map((s, i) => {
            const Icon = Ic[s.icon];
            return (
              <div
                className="card reveal"
                key={s.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: 'clamp(20px,4vw,40px)',
                  alignItems: 'center',
                  padding: 'clamp(26px,4vw,40px)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 14,
                    minWidth: 120,
                  }}
                >
                  <div
                    className="ico"
                    style={{ background: s.hue, width: 78, height: 78, borderRadius: 22 }}
                  >
                    <Icon width={38} height={38} />
                  </div>
                  <span className="script" style={{ fontSize: '1.45rem', color: s.hue }}>
                    {s.tag}
                  </span>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.8rem' }}>{s.title}</h3>
                  <p className="lead" style={{ margin: '10px 0 0', fontSize: '1.05rem' }}>
                    {s.desc}
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                      gap: '8px 22px',
                      marginTop: 18,
                    }}
                  >
                    {s.points.map((p, k) => (
                      <div
                        key={k}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          fontWeight: 600,
                          fontSize: '.96rem',
                        }}
                      >
                        <span
                          className="ck"
                          style={{
                            flex: 'none',
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'color-mix(in srgb,' + s.hue + ' 18%,#fff)',
                            color: s.hue,
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <Ic.check width={13} height={13} />
                        </span>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
                {i === 0 && <Peek w={92} flip style={{ right: -10, bottom: -8 }} />}
              </div>
            );
          })}
        </div>
      </section>

      {/* PROCESS */}
      <section className="section bg-soft">
        <div className="wrap">
          <Head
            center
            eyebrow="How it works"
            title="From idea to finished gear in four easy steps"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 22,
            }}
          >
            {STEPS.map(([t, d], i) => (
              <div className={`reveal d${i + 1}`} key={i} style={{ position: 'relative' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: '3rem',
                    fontWeight: 600,
                    color: 'color-mix(in srgb,var(--accent) 60%,#fff)',
                    lineHeight: 1,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{ fontSize: '1.3rem', margin: '8px 0 8px' }}>{t}</h3>
                <p style={{ color: 'var(--muted)' }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </main>
  );
}
