import type { MouseEvent } from 'react';
import { Ic } from './icons';
import { Peek } from './Peek';
import { NAV } from '../data/content';
import { hashFor, navigate, type Route } from '../hooks/useHashRoute';

export function Footer() {
  const go = (r: Route) => (e: MouseEvent) => {
    e.preventDefault();
    navigate(r);
    window.scrollTo(0, 0);
  };
  return (
    <footer className="footer">
      <Peek className="foot-peek" w={96} flip wag />
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <img src="/assets/logo-script.png" alt="Stitches-n-Color" className="foot-logo" />
            <p>
              Machine embroidery at it's best — proudly serving the Saint Louis community since
              2007. No job too big or too small.
            </p>
          </div>
          <div className="foot-col">
            <h5>Explore</h5>
            <ul>
              {NAV.map(([r, l]) => (
                <li key={r}>
                  <a href={hashFor(r)} onClick={go(r)}>
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="foot-col">
            <h5>Services</h5>
            <ul>
              <li>
                <a href="#/services" onClick={go('services')}>
                  Machine Embroidery
                </a>
              </li>
              <li>
                <a href="#/services" onClick={go('services')}>
                  Screen Printing
                </a>
              </li>
              <li>
                <a href="#/services" onClick={go('services')}>
                  Digitizing
                </a>
              </li>
              <li>
                <a href="#/services" onClick={go('services')}>
                  Heat Transfers
                </a>
              </li>
            </ul>
          </div>
          <div className="foot-col">
            <h5>Visit the Studio</h5>
            <ul>
              <li>
                1905 Saint Catherine
                <br />
                Florissant, MO 63033
              </li>
              <li>
                <a href="tel:13149217075">(314) 921-7075</a>
              </li>
              <li>
                Mon–Fri, 9–4
                <br />
                <span style={{ opacity: 0.7 }}>& by appointment</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>
            © {new Date().getFullYear()} Stitches-n-Color Embroidery Studio. All rights reserved.
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Sewn with pride <Ic.heart width={14} height={14} style={{ color: 'var(--accent)' }} />{' '}
            in St. Louis
          </span>
        </div>
      </div>
    </footer>
  );
}
