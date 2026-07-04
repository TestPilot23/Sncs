import { useEffect } from 'react';

/* Scroll-reveal: base state is visible; arming + animation happen via rAF only,
   so environments that never paint a frame simply show the visible base state. */
export function useReveals(dep: unknown): void {
  useEffect(() => {
    let raf = 0;
    const reveal = () => {
      const vh = window.innerHeight || 800;
      document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
        if (!el.classList.contains('armed')) el.classList.add('armed');
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.94 && r.bottom > 0) el.classList.add('in');
      });
    };
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          reveal();
        });
    };
    requestAnimationFrame(() => {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('armed'));
      reveal();
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [dep]);
}
