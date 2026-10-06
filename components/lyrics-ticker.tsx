'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

const PIXELS_PER_SECOND = 40;

export default function LyricsTicker({ lyrics }: { lyrics: string[] }) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [measurements, setMeasurements] = useState<{ offset: number; distance: number; duration: number } | null>(null);
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

  useLayoutEffect(() => {
    if (sequence.length === 0) return;
    const element = track.current;
    if (!element) return;
    function measure() {
      const group = element!.firstElementChild as HTMLElement;
      const lines = group.querySelectorAll<HTMLElement>('.home-lyric');
      const gap = parseFloat(getComputedStyle(group).columnGap) || 0;
      const offset = lines[0].getBoundingClientRect().width + gap;
      const distance = lines[1].getBoundingClientRect().width + gap;
      setMeasurements({ offset, distance, duration: distance / PIXELS_PER_SECOND });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.parentElement) observer.observe(element.parentElement);
    return () => observer.disconnect();
  }, [sequence, cursor]);

  if (sequence.length === 0) return null;

  return (
    <aside
      className={`home-lyrics${measurements === null ? '' : ' is-measured'}`}
      aria-label="Random lyrics"
      tabIndex={0}
      style={{
        '--home-lyric-duration': `${measurements?.duration ?? 20}s`,
        '--home-lyric-offset': `${measurements?.offset ?? 0}px`,
        '--home-lyric-distance': `${measurements?.distance ?? 0}px`,
        '--home-lyric-delay': cursor === 0 ? 'calc(var(--home-content-delay) + var(--home-content-duration))' : '0ms',
      } as CSSProperties}
    >
      <div className="home-lyrics-window">
        <div ref={track} key={cursor} className="home-lyrics-track" lang="zh-Hant"
          onAnimationEnd={event => { if (event.target === event.currentTarget) setCursor(previous => previous + 1); }}>
          <div className="home-lyrics-group">
            {[-1, 0, 1].map(offset => <p className="home-lyric" key={offset} aria-hidden={offset !== 0 ? true : undefined}
              style={cursor === 0 && offset === -1 ? { visibility: 'hidden' } : undefined}>
              {sequence[(cursor + offset + sequence.length) % sequence.length]}
            </p>)}
          </div>
        </div>
      </div>
    </aside>
  );
}
