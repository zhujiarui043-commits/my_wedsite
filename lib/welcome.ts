import glyphData from './handwriting/glyphs.json';

export type Greeting = 'morning' | 'afternoon' | 'night';

type Glyph = {
  advance: number;
  strokes: { d: string; length: number }[];
};

const glyphs: Record<string, Glyph> = glyphData;

export function greetingForHour(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

export function welcomeStrokes(greeting: Greeting) {
  const lines = [
    { text: `Good ${greeting}`, scale: 1, top: 12 },
    { text: 'Welcome to', scale: 1.25, top: 58 },
    { text: 'My Space!', scale: 1.5, top: 110 },
  ];
  const strokes: {
    id: string;
    d: string;
    transform: string;
    delay: number;
    duration: number;
  }[] = [];
  let elapsed = 0;

  lines.forEach(({ text, scale, top }, lineIndex) => {
    const width = [...text].reduce((total, character) =>
      total + (character === ' ' ? 12 : glyphs[character].advance), 0);
    const left = (300 - width * scale) / 2;
    let advance = 0;

    [...text].forEach((character, characterIndex) => {
      if (character === ' ') {
        advance += 12;
        elapsed += 110;
        return;
      }

      const glyph = glyphs[character];
      glyph.strokes.forEach(({ d, length }, strokeIndex) => {
        // Longer pen movements take longer; a brief pause lifts the pen.
        const duration = Math.max(45, length * scale * 2.5);
        strokes.push({
          id: `${lineIndex}-${characterIndex}-${strokeIndex}`,
          d,
          transform: `translate(${left + advance * scale}, ${top}) scale(${scale})`,
          delay: Math.round(elapsed),
          duration: Math.round(duration),
        });
        elapsed += duration + 18;
      });

      advance += glyph.advance;
      elapsed += 22;
    });
    elapsed += 180;
  });

  return strokes;
}
