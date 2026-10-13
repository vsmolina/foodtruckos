'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Square Web Payments SDK card field. Card numbers go straight from the
// iframe to Square; we only ever see the one-time token.

type SquareCardInstance = {
  attach: (selector: string | HTMLElement) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message: string }> }>;
  destroy: () => Promise<boolean>;
};
type SquarePayments = { card: (opts?: Record<string, unknown>) => Promise<SquareCardInstance> };
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments };
  }
}

export type SquareCardHandle = { tokenize: () => Promise<string> };

const SDK = {
  sandbox: 'https://sandbox.web.squarecdn.com/v1/square.js',
  production: 'https://web.squarecdn.com/v1/square.js',
};

function loadSdk(env: 'sandbox' | 'production'): Promise<void> {
  if (window.Square) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK[env]}"]`);
  return new Promise((resolve, reject) => {
    const s = existing ?? document.createElement('script');
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('Square SDK failed to load')));
    if (!existing) {
      s.src = SDK[env];
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

export const SquareCard = forwardRef<SquareCardHandle, { appId: string; locationId: string; env: 'sandbox' | 'production' }>(
  function SquareCard({ appId, locationId, env }, ref) {
    const box = useRef<HTMLDivElement>(null);
    const card = useRef<SquareCardInstance | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          await loadSdk(env);
          if (cancelled || !window.Square || !box.current) return;
          const c = await window.Square.payments(appId, locationId).card({
            style: {
              input: { fontSize: '17px', color: '#14110e' },
              '.input-container': { borderColor: '#14110e', borderWidth: '2px', borderRadius: '3px' },
              '.input-container.is-focus': { borderColor: '#2d5bd7' },
              '.message-text': { color: '#14110e' },
            },
          });
          if (cancelled) {
            await c.destroy();
            return;
          }
          await c.attach(box.current);
          card.current = c;
          setStatus('ready');
        } catch (err) {
          console.error(err);
          if (!cancelled) setStatus('error');
        }
      })();
      return () => {
        cancelled = true;
        void card.current?.destroy();
        card.current = null;
      };
    }, [appId, locationId, env]);

    useImperativeHandle(ref, () => ({
      async tokenize() {
        if (!card.current) throw new Error('The card form isn’t ready yet.');
        const r = await card.current.tokenize();
        if (r.status === 'OK' && r.token) return r.token;
        throw new Error(r.errors?.[0]?.message ?? 'Check your card details.');
      },
    }));

    return (
      <div data-card-state={status}>
        <div ref={box} className="min-h-[90px]" />
        {status === 'loading' ? <p className="text-sm text-[#5e5248]">Loading secure card form…</p> : null}
        {status === 'error' ? (
          <p role="alert" className="text-sm font-bold text-[#b3261e]">
            ✕ The card form didn’t load. Check your signal and reload, or order at the window.
          </p>
        ) : null}
      </div>
    );
  },
);
