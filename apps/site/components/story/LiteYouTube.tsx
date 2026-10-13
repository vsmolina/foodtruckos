'use client';

import { useState } from 'react';

// Click-to-load YouTube: nothing from YouTube loads until the visitor taps
// play (fast on weak signal, no third-party tracking on page load).
export function LiteYouTube({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false);
  if (play) {
    return (
      <iframe
        className="aspect-video w-full border-0"
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPlay(true)}
      className="group relative grid aspect-video w-full place-items-center bg-cover bg-center"
      style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }}
      aria-label={`Play video: ${title}`}
    >
      <span className="press shadow-hard grid h-16 w-16 place-items-center rounded-full border-[length:var(--line)] border-outline bg-chile text-on-chile group-hover:scale-105">
        <svg aria-hidden viewBox="0 0 20 20" className="ml-1 h-7 w-7">
          <path d="M5 3l12 7-12 7z" fill="currentColor" />
        </svg>
      </span>
    </button>
  );
}
