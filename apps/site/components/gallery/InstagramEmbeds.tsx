'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

export type EmbedPost = { id: string; permalink: string; html: string };

const SCRIPT_ID = 'instagram-embed-js';

// The owner's latest posts as Instagram's own embeds. Instagram's script loads
// only when the section comes near the screen, so the rest of the page never
// waits on it. The HTML is Instagram's blockquote (from oEmbed or the standard
// markup, built on the server); embed.js swaps each one for the rendered post,
// which is why it goes in via innerHTML: React must not own those nodes.
export function InstagramEmbeds({ posts }: { posts: EmbedPost[] }) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const load = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
        return;
      }
      if (document.getElementById(SCRIPT_ID)) return;
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://www.instagram.com/embed.js';
      s.async = true;
      document.body.appendChild(s);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <ul
      ref={ref}
      aria-label="Latest Instagram posts"
      className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0"
    >
      {posts.map((p) => (
        <li
          key={p.id}
          className="w-[326px] shrink-0 snap-center overflow-hidden rounded-sm border-[length:var(--line)] border-outline bg-white shadow-hard lg:w-auto [&_.instagram-media]:!m-0 [&_.instagram-media]:!min-w-0 [&_.instagram-media]:!w-full [&_.instagram-media]:!rounded-none [&_.instagram-media]:!border-0 [&_iframe]:!min-w-0 [&_iframe]:!w-full"
          dangerouslySetInnerHTML={{ __html: p.html }}
        />
      ))}
    </ul>
  );
}
