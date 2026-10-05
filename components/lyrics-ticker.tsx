'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const PIXELS_PER_SECOND = 40;

export default function LyricsTicker({ lyrics }: { lyrics: string[] }) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const initialized = useRef(false);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialized.current || lyrics.length === 0) return;
    // Shuffle after hydration, once per visit, including in development Strict Mode.
    const frame = window.requestAnimationFrame(() => {
      initialized.current = true;
      const shuffled = [...lyrics];
      for (let index = shuffled.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
      }
      setSequence(shuffled);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lyrics]);

  useEffect(() => {
    if (sequence.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      if (track.current) {
        // Two identical groups make the loop seamless; travel one group per cycle.
        setDuration(Math.max(10, track.current.getBoundingClientRect().width / 2 / PIXELS_PER_SECOND));
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sequence]);

  if (sequence.length === 0) return null;

  return (
    <aside
      className={`home-lyrics${duration === null ? '' : ' is-measured'}`}
      aria-label="Random lyrics"
      tabIndex={0}
      style={{ '--home-lyric-duration': `${duration ?? 20}s` } as CSSProperties}
    >
      <div className="home-lyrics-window">
        <div ref={track} className="home-lyrics-track" lang="zh-Hant">
          {[0, 1].map(copy => (
            <div className="home-lyrics-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
              {sequence.map((lyric, index) => <p className="home-lyric" key={index}>{lyric}</p>)}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
