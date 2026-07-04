import { useEffect, useRef, useState, type CSSProperties } from 'react';

export const DOG = '/assets/stitches.png';

interface PeekProps {
  style?: CSSProperties;
  className?: string;
  flip?: boolean;
  wag?: boolean;
  w?: number;
}

/* Stitches mascot peeker — visible by default; pop animation arms via rAF
   once the element scrolls into view. */
export function Peek({ style, className = '', flip = false, wag = false, w = 110 }: PeekProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const cleanup = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    const check = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || 800) * 0.98 && r.bottom > 0) {
        setArmed(true);
        cleanup();
      }
    };
    raf = requestAnimationFrame(check);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cleanup();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`peek ${armed ? 'from-behind' : ''} ${className}`}
      style={{ width: w, ...style }}
    >
      <img
        src={DOG}
        alt=""
        className={wag ? 'wag' : ''}
        style={{ transform: flip ? 'scaleX(-1)' : 'none' }}
      />
    </div>
  );
}
