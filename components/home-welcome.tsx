'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { spaces } from '@/lib/spaces';
import { greetingForHour, welcomeStrokes, type Greeting } from '@/lib/welcome';

export default function HomeWelcome() {
  const [greeting, setGreeting] = useState<Greeting | null>(null);

  useEffect(() => {
    // Choose once on entry, using the visitor's clock rather than server time.
    const entryGreeting = greetingForHour(new Date().getHours());
    const frame = requestAnimationFrame(() => setGreeting(entryGreeting));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="home-welcome" aria-labelledby="welcome-message">
      <div className="home-welcome-content">
        <h2 id="welcome-message" className="home-welcome-heading">
          <span className="sr-only">
            {greeting ? `Good ${greeting}. Welcome to My Space!` : 'Welcome to My Space!'}
          </span>
          {greeting && (
            <svg className="home-welcome-writing" viewBox="0 0 300 174" aria-hidden="true" focusable="false">
              {welcomeStrokes(greeting).map(stroke => (
                <path
                  key={stroke.id}
                  className="home-welcome-stroke"
                  d={stroke.d}
                  transform={stroke.transform}
                  pathLength={1}
                  style={{
                    '--home-stroke-delay': `${stroke.delay}ms`,
                    '--home-stroke-duration': `${stroke.duration}ms`,
                  } as CSSProperties}
                />
              ))}
            </svg>
          )}
          <noscript>
            <span className="home-welcome-fallback" aria-hidden="true">Welcome to<br />My Space!</span>
          </noscript>
        </h2>
        <nav className="home-welcome-nav" aria-label="Explore my space">
          {spaces.map(space => (
            <Link key={space.id} href={space.href}>{space.label}</Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
