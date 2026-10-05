import { Bike, MapPin, Music2, Sparkles } from 'lucide-react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import localFont from 'next/font/local';
import HomeIntro from '@/components/home-intro';
import HomeWelcome from '@/components/home-welcome';
import LyricsTicker from '@/components/lyrics-ticker';
import SocialLogos from '@/components/social-logos';
import { profile } from '@/lib/profile';
import './home.css';

const monteCarlo = localFont({
  src: './fonts/montecarlo/MonteCarlo-Regular.ttf',
  weight: '400',
  style: 'normal',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

export default async function HomePage() {
  const personality = [profile.mbti, profile.zodiac].filter(Boolean).join(' · ');
  const lyrics = (await readFile(join(process.cwd(), 'lyric.txt'), 'utf8'))
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  return (
    <HomeIntro background={profile.background}>
      <main className="home-panel" aria-label="Jerry Zhu's personal homepage">
        <aside className="home-profile" aria-labelledby="profile-name">
          <div className="home-avatar">
            {profile.photo ? (
              <img src={profile.photo} alt={`${profile.name}'s avatar`} width={208} height={208} />
            ) : (
              <span className="home-initials" role="img" aria-label="Jerry Zhu's avatar placeholder">
                {profile.initials}
              </span>
            )}
          </div>

          <h1 id="profile-name" className={monteCarlo.className}>{profile.name}</h1>
          <p className="home-affiliation">
            <span>{profile.role}</span>
            <span>{profile.major}</span>
            <span className="home-university">
              <img className="home-university-crest" src="/icons/fudan.svg" alt="" aria-hidden="true" width={28} height={28} />
              {profile.university}
            </span>
          </p>

          <div className="home-details">
            {personality && <p><Sparkles aria-hidden="true" /><span>{personality}</span></p>}
            <p><Bike aria-hidden="true" /><span>{profile.interests}</span></p>
            <p><MapPin aria-hidden="true" /><span>{profile.location}</span></p>
            <p><Music2 aria-hidden="true" /><span>{profile.music}</span></p>
          </div>

          <SocialLogos />
        </aside>
        <HomeWelcome />
      </main>
      <LyricsTicker lyrics={lyrics} />
    </HomeIntro>
  );
}
