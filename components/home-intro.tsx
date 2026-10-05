'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function HomeIntro({ background, children }: { background: string; children: ReactNode }) {
  const image = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let frame: number | undefined;
    // A cached image can finish loading before React attaches onLoad.
    if (image.current?.complete) {
      frame = requestAnimationFrame(() => {
        setImageFailed(image.current?.naturalWidth === 0);
        setReady(true);
      });
    }
    // Keep the profile accessible even if a background request stalls.
    const timeout = window.setTimeout(() => setReady(true), 4000);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div className={`home-scene${ready ? ' is-ready' : ''}`}>
      <div className="home-backdrop" aria-hidden="true">
        <img
          ref={image}
          className="home-background-image"
          src={background}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
          hidden={imageFailed}
          onLoad={() => setReady(true)}
          onError={() => { setImageFailed(true); setReady(true); }}
        />
      </div>
      {children}
      <noscript>
        <style>{'.home-panel{opacity:1!important;transform:none!important}.home-background-image{filter:blur(var(--home-background-blur)) brightness(.38);transform:scale(var(--home-background-zoom))}'}</style>
      </noscript>
    </div>
  );
}
