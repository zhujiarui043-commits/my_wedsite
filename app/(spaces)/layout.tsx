import type { ReactNode } from 'react';
import { profile } from '@/lib/profile';
import './spaces.css';

export default function SpacesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-scene">
      <div className="space-backdrop" aria-hidden="true">
        <img src={profile.background} alt="" />
      </div>
      {children}
    </div>
  );
}
