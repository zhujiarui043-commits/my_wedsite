'use client';

import { useRef, useState, type SyntheticEvent } from 'react';
import { ChevronDown, ChevronUp, MicVocal, Piano } from 'lucide-react';
import type { MusicRecordingGroup } from '@/lib/music-recordings';

function RecordingGroup({ group }: { group: MusicRecordingGroup }) {
  const [open, setOpen] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  const Icon = group.id === 'piano' ? Piano : MicVocal;
  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    const section = event.currentTarget;
    if (!section.open) section.querySelectorAll('video').forEach(video => video.pause());
    setOpen(section.open);
  }
  function collapse() {
    const section = details.current;
    if (!section) return;
    section.querySelectorAll('video').forEach(video => video.pause());
    section.open = false;
    setOpen(false);
    section.querySelector('summary')?.focus({ preventScroll: true });
    section.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <details ref={details} className="music-recording-group" onToggle={handleToggle}>
    <summary className="music-recording-trigger">
      <span className="music-recording-icon"><Icon size={23} strokeWidth={1.4} aria-hidden="true" /></span>
      <span className="music-recording-label">
        <span className="music-recording-title">{group.title}</span>
        <span className="music-recording-description">{group.description}</span>
      </span>
      <ChevronDown className="music-recording-chevron" size={21} strokeWidth={1.5} aria-hidden="true" />
    </summary>
    {open && <div className="music-recording-content">
      {group.videos.length ? <div className="music-video-grid" data-kind={group.id}>
        {group.videos.map(video => <figure className="music-video" key={video.src}>
          {group.id === 'piano' && <figcaption>{video.title}</figcaption>}
          <video controls playsInline preload="none" src={video.src} poster={video.poster} aria-label={video.title}
            onPlay={event => {
              const current = event.currentTarget;
              current.closest('.music-recordings')?.querySelectorAll('video').forEach(other => { if (other !== current) other.pause(); });
            }}>
            Your browser does not support video playback.
          </video>
          {group.id !== 'piano' && <figcaption>{video.title}</figcaption>}
        </figure>)}
      </div> : <p className="music-recording-empty">{group.emptyMessage}</p>}
      <div className="music-recording-footer">
        <button className="music-recording-collapse" type="button" onClick={collapse} aria-label={`Collapse ${group.title}`}>
          <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" />Collapse
        </button>
      </div>
    </div>}
  </details>;
}

export default function MusicRecordings({ groups }: { groups: MusicRecordingGroup[] }) {
  return <section className="music-recordings" aria-label="Video recordings">
    {groups.map(group => <RecordingGroup key={group.id} group={group} />)}
  </section>;
}
