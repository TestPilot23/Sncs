import { useState, type MouseEvent } from 'react';
import { Ph, SubHero, CtaBand } from '../components/blocks';
import { navigate } from '../hooks/useHashRoute';
import { GAL, FILTERS, type GalleryFilter } from '../data/content';

export function Gallery() {
  const [f, setF] = useState<GalleryFilter>('all');
  const items = GAL.filter((g) => f === 'all' || g[2] === f);
  const goContact = (e: MouseEvent) => {
    e.preventDefault();
    navigate('contact');
  };
  return (
    <main className="page">
      <SubHero
        eyebrow="Our Work"
        title="See what we can stitch for you"
        sub="A sampling of recent embroidery, prints and transfers. Drop in your own photos to make this gallery yours."
      />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="gal-filters reveal">
            {FILTERS.map(([k, l]) => (
              <button key={k} className={`chip ${f === k ? 'active' : ''}`} onClick={() => setF(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="gal-grid">
            {items.map((g, i) => (
              <Ph
                key={g[0] + i}
                label={g[0].toLowerCase().replace(/[^a-z]+/g, '-') + '.jpg'}
                hue={g[1]}
                tall={g[3]}
                cap={g[0]}
              />
            ))}
          </div>
          <p className="center" style={{ marginTop: 34, color: 'var(--muted)' }}>
            Have a project in mind?{' '}
            <a
              href="#/contact"
              onClick={goContact}
              style={{ color: 'var(--accent-2)', fontWeight: 800 }}
            >
              Request a quote →
            </a>
          </p>
        </div>
      </section>
      <CtaBand />
    </main>
  );
}
