'use client';

import { useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Headphones, Moon, Music2, Repeat2, Sparkles, Star } from 'lucide-react';
import type { ListeningReport } from '@/lib/music-reports';

function ListeningTrend({ reports, selectedId }: { reports: ListeningReport[]; selectedId: string }) {
  const maximum = Math.max(...reports.map(report => report.songCount), 1);
  const points = reports.map((report, index) => ({ report, x: reports.length === 1 ? 150 : 30 + index * 240 / (reports.length - 1), y: 85 - report.songCount / maximum * 58 }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  return <figure className="music-trend">
    <svg viewBox="0 0 300 120" role="img" aria-label={`Songs listened to by month: ${reports.map(report => `${report.month} ${report.year}, ${report.songCount} songs`).join('; ')}.`}>
      <path className="music-trend-baseline" d="M 16 88 H 284" />
      <path className="music-trend-line" d={path} />
      {points.map(({ report, x, y }) => <g className={report.id === selectedId ? 'is-selected' : ''} key={report.id}>
        <circle className="music-trend-halo" cx={x} cy={y} r="8" />
        <circle className="music-trend-dot" cx={x} cy={y} r="3.5" />
        <text className="music-trend-count" x={x} y={y - 13} textAnchor="middle">{report.songCount}</text>
        <text className="music-trend-month" x={x} y="112" textAnchor="middle">{report.month.slice(0, 3)}</text>
      </g>)}
    </svg>
    <figcaption>Reported months</figcaption>
  </figure>;
}

export default function MusicReports({ reports }: { reports: ListeningReport[] }) {
  const [selectedId, setSelectedId] = useState(reports[reports.length - 1].id);
  const report = reports.find(item => item.id === selectedId)!;
  const ranking = useRef<HTMLDivElement>(null);
  const favorite = report.tracks[0];
  const ChangeIcon = (report.changePercent ?? 0) < 0 ? ArrowDownRight : ArrowUpRight;
  function selectMonth(id: string) {
    setSelectedId(id);
    // A newly selected month starts at its first ranked song.
    if (ranking.current) ranking.current.scrollTop = 0;
  }
  return <section className="music-reports" aria-labelledby="listening-heading">
    <header className="music-report-header">
      <p className="music-eyebrow">LISTENING DIARY</p>
      <div className="music-report-heading"><h2 id="listening-heading">{report.month} <span>{report.year}</span></h2><Headphones size={21} strokeWidth={1.4} aria-hidden="true" /></div>
      <nav className="music-months" aria-label="Monthly listening reports">{reports.map(item => <button key={item.id} type="button" aria-pressed={item.id === selectedId} onClick={() => selectMonth(item.id)}>{item.month} {item.year}</button>)}</nav>
    </header>

    <div className="music-report-body" key={report.id}>
      <section className="music-summary" aria-label={`${report.month} listening summary`}>
        <div className="music-summary-count"><p>Songs listened to</p><strong>{report.songCount}</strong>{report.changePercent !== undefined && report.comparedWith && <span className="music-month-change"><ChangeIcon size={14} aria-hidden="true" />{Math.abs(report.changePercent)}% {report.changePercent < 0 ? 'fewer' : 'more'} than {report.comparedWith}</span>}</div>
        <ListeningTrend reports={reports} selectedId={selectedId} />
      </section>

      <aside className="music-lyric-insight" aria-label="Lyric spotlight"><div><p className="music-eyebrow">LYRIC SPOTLIGHT</p><strong>“{report.lyricWord}”</strong></div><p>{report.lyricInsight}</p></aside>

      <div className="music-highlights">
        {report.lateNight && <section className="music-highlight"><p><Moon size={15} aria-hidden="true" />Late-night listening</p><strong>{report.lateNight.time}<span>{report.lateNight.period}</span></strong><small>{report.lateNight.date}</small></section>}
        <section className="music-highlight music-favorite"><p><Music2 size={15} aria-hidden="true" />Most played</p><strong>{favorite.title}</strong><small>{favorite.plays} plays · {favorite.artist}</small></section>
        {report.onRepeat && <section className="music-highlight music-favorite"><p><Repeat2 size={15} aria-hidden="true" />On repeat</p><strong>{report.onRepeat.title}</strong><small>{report.onRepeat.plays} plays on {report.onRepeat.date}<br />{report.onRepeat.artist}</small></section>}
        {report.firstListen && <section className="music-highlight music-favorite"><p><Sparkles size={15} aria-hidden="true" />First listen</p><strong>{report.firstListen.artist}</strong><small>{report.firstListen.date}</small></section>}
        {report.favorites !== undefined && <section className="music-highlight"><p><Star size={15} aria-hidden="true" />New favorites</p><strong>{report.favorites}<span>{report.favorites === 1 ? 'song' : 'songs'}</span></strong></section>}
      </div>

      <section className="music-ranking" aria-labelledby="top-tracks-heading">
        <div className="music-ranking-heading"><h3 id="top-tracks-heading">Top tracks</h3><span>{report.tracks.length} tracks</span></div>
        <div className="music-ranking-scroll" ref={ranking} tabIndex={0} role="region" aria-label={`${report.month} ${report.year} top tracks`} aria-describedby="music-scroll-hint">
          <ol>{report.tracks.map((track, index) => <li key={track.id}>
            <span className={`music-rank${index < 3 ? ' is-top' : ''}`} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span className={`music-record${track.artist.startsWith('The Weeknd') ? ' music-record-weeknd' : ''}`} aria-hidden="true"><i /></span>
            <div className="music-track-copy"><h4>{track.title}{track.version && <span> ({track.version})</span>}</h4><p>{track.artist}</p></div>
            <div className="music-track-plays"><strong>{track.plays}</strong><span>{track.plays === 1 ? 'play' : 'plays'}</span></div>
          </li>)}</ol>
        </div>
        <p className="music-scroll-hint" id="music-scroll-hint">Scroll to explore the full ranking.</p>
      </section>
    </div>
  </section>;
}
