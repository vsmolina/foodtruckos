'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

// Official Instagram blockquote embeds, loaded only when the visitor asks:
// no third-party script (or tracking) on page load, and nothing heavy on a
// weak signal.
export function InstagramEmbeds({ urls }: { urls: string[] }) {
  const [load, setLoad] = useState(false);

  useEffect(() => {
    if (!load) return;
    if (window.instgrm) {
      window.instgrm.Embeds.process();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://www.instagram.com/embed.js';
    s.async = true;
    document.body.appendChild(s);
  }, [load]);

  if (!load) {
    return (
      <Button type="button" variant="paper" onClick={() => setLoad(true)}>
        Load Instagram posts
      </Button>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {urls.map((url) => (
        <blockquote
          key={url}
          className="instagram-media"
          data-instgrm-permalink={url}
          data-instgrm-version="14"
          style={{ margin: 0, minWidth: 0, width: '100%', background: 'var(--paper)' }}
        >
          <a href={url} rel="noopener">
            View on Instagram
          </a>
        </blockquote>
      ))}
    </div>
  );
}
