'use client';

import { useLayoutEffect, useRef } from 'react';

export default function AboutBio({ sentences }: { sentences: readonly string[] }) {
  const container = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;

    let frame = 0;
    let measuredWidth = 0;
    let disposed = false;

    const fitText = () => {
      // Measure at the preferred size before fitting the longest sentence.
      element.style.removeProperty('--about-bio-font-size');
      measuredWidth = element.clientWidth;
      const availableWidth = measuredWidth - 2;
      if (availableWidth <= 0) return;

      const longestLine = Math.max(0, ...Array.from(element.querySelectorAll('p > span'))
        .map(line => line.getBoundingClientRect().width));

      if (longestLine > availableWidth) {
        const fontSize = parseFloat(getComputedStyle(element).fontSize);
        element.style.setProperty('--about-bio-font-size', `${fontSize * availableWidth / longestLine}px`);
      }
    };

    const scheduleFit = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitText);
    };

    const observer = new ResizeObserver(() => {
      // A font-size change also changes height; only refit when width changes.
      if (element.clientWidth !== measuredWidth) scheduleFit();
    });
    observer.observe(element);
    fitText();
    void document.fonts.ready.then(scheduleFit);
    window.addEventListener('resize', scheduleFit);

    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleFit);
    };
  }, [sentences]);

  return (
    <div className="space-about-bio" ref={container}>
      {sentences.map(sentence => <p key={sentence}><span>{sentence}</span></p>)}
    </div>
  );
}
