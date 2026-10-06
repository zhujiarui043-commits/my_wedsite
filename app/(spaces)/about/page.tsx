import type { Metadata } from 'next';
import AboutBio from '@/components/about-bio';
import SpacePage from '@/components/space-page';

export const metadata: Metadata = { title: 'About | Jerry Zhu' };

const introduction = [
  'I’m Jerry, or Zhu Jiarui in Chinese.',
  'I’m 19, from Yancheng, Jiangsu, and currently based in Shanghai.',
  'I major in Computer Science and Technology and am interested in deep learning and LLMs.',
  'I enjoy cycling, badminton, hiking, and piano, and I’m an Eason Chan fan.',
  'I’m in the Odyssey phase of my life.',
];

export default function AboutPage() {
  return (
    <SpacePage
      spaceId="about"
      media={
        <figure className="space-photo space-photo-portrait">
          <img
            src="/about-portrait.webp"
            alt="A mirror selfie wearing glasses and a black shirt."
            width={1086}
            height={1448}
            decoding="async"
          />
        </figure>
      }
    >
      <AboutBio sentences={introduction} />
    </SpacePage>
  );
}
