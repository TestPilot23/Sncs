import { useEffect, useRef } from 'react';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoad: Promise<void> | undefined;

function loadScript(): Promise<void> {
  scriptLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoad = undefined; // allow a retry on the next mount
      reject(new Error('turnstile_script_failed'));
    };
    document.head.appendChild(s);
  });
  return scriptLoad;
}

/** Cloudflare Turnstile. Reports the solved token, or '' when it expires or errors. */
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(onToken);
  useEffect(() => {
    latest.current = onToken;
  });

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | undefined;
    loadScript()
      .then(() => {
        if (cancelled || !host.current || !window.turnstile) return;
        widgetId = window.turnstile.render(host.current, {
          sitekey: siteKey,
          callback: (t: string) => latest.current(t),
          'expired-callback': () => latest.current(''),
          'error-callback': () => latest.current(''),
        });
      })
      .catch(() => latest.current(''));
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey]);

  return <div ref={host} className="turnstile" />;
}
