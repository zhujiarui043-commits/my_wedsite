import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jerry Zhu · Personal Homepage',
  description: 'Jerry Zhu, a sophomore Computer Science undergraduate at Fudan University. Exploring deep learning, music, and everyday moments.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
