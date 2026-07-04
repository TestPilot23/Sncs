import { useEffect, useState, type MouseEvent } from 'react';
import { Ic } from './icons';
import { hashFor, navigate, type Route } from '../hooks/useHashRoute';
import { NAV } from '../data/content';

export function Nav({ route }: { route: Route }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 20);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  useEffect(() => setOpen(false), [route]);
  const go = (r: Route) => (e: MouseEvent) => {
    e.preventDefault();
    navigate(r);
  };
  return (
    <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="wrap nav-inner">
        <a
          className="brand"
          href="#/"
          onClick={go('home')}
          aria-label="Stitches-n-Color Studio home"
        >
          {/* TODO: swap for logo-nav.png once the full-size original is added */}
          <img src="/assets/logo-script.png" alt="Stitches-n-Color Embroidery Studio" />
        </a>
        <button className="nav-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <Ic.x /> : <Ic.menu />}
        </button>
        <div className={`nav-scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)}></div>
        <nav className={`nav-links ${open ? 'open' : ''}`}>
          {NAV.map(([r, l]) => (
            <a
              key={r}
              href={hashFor(r)}
              onClick={go(r)}
              className={`nav-link ${route === r ? 'active' : ''}`}
            >
              {l}
            </a>
          ))}
          <a className="btn btn-primary nav-cta" href="#/contact" onClick={go('contact')}>
            Request a Quote
          </a>
        </nav>
      </div>
    </header>
  );
}
