'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Images, Plus, Star, Upload } from 'lucide-react';
import { albumUrl, type Album } from '@/lib/album-shared';
import { imageUrl, isFeaturedPhoto, type Post } from '@/lib/post-shared';
import { toggleFeaturedPhoto } from '@/lib/featured-photo-client';
import { galleryAsset } from '@/lib/seed-gallery';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';

const thumbnail = (photo: Post) => galleryAsset(photo.image_key)?.thumbnail || imageUrl(photo);

export default function StudioAlbums({ initialAlbums, photos, onPhotosChange }: { initialAlbums: Album[]; photos: Post[]; onPhotosChange: (photos: Post[]) => void }) {
  const [albums, setAlbums] = useState(initialAlbums), [editing, setEditing] = useState<Album | null>(null);
  const [name, setName] = useState(''), [photoIds, setPhotoIds] = useState<string[]>([]), [cover, setCover] = useState('');
  const [search, setSearch] = useState(''), [selectedOnly, setSelectedOnly] = useState(false);
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState<Album | null>(null);
  const input = useRef<HTMLInputElement>(null), editor = useRef<HTMLFormElement>(null);
  const available = photos.filter(photo => photo.kind === 'photo' && photo.image_key);
  const byId = new Map(available.map(photo => [photo.id, photo]));
  const selected = photoIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const coverPhoto = cover ? byId.get(cover) : null;
  const shown = available.filter(photo => (!selectedOnly || photoIds.includes(photo.id)) && `${photo.title} ${photo.location}`.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => {
    const ids = new Set(photos.filter(photo => photo.kind === 'photo' && photo.image_key).map(photo => photo.id));
    setPhotoIds(previous => previous.filter(id => ids.has(id))); setCover(previous => ids.has(previous) ? previous : '');
  }, [photos]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  function open(album: Album | null) {
    if (busy || (dirty && !window.confirm('Discard the unsaved album changes?'))) return;
    setEditing(album); setName(album?.name ?? ''); setPhotoIds(album?.photoIds.filter(id => byId.has(id)) ?? []);
    setCover(album?.coverPhotoId && byId.has(album.coverPhotoId) ? album.coverPhotoId : '');
    setDirty(false); setError(''); setStatus(''); setSearch(''); setSelectedOnly(!!album);
    editor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function toggle(photo: Post) {
    setPhotoIds(previous => previous.includes(photo.id) ? previous.filter(id => id !== photo.id) : [...previous, photo.id]);
    if (cover === photo.id) setCover(''); setDirty(true); setError(''); setStatus('');
  }
  async function feature(photo: Post) {
    if (busy) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const updated = await toggleFeaturedPhoto(photo);
      onPhotosChange(photos.map(item => item.id === updated.id ? updated : item));
      setStatus(`${updated.title} ${isFeaturedPhoto(updated) ? 'added to' : 'removed from'} the planet. Its albums and likes are preserved.`);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not update the planet selection.'); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    if (selected.length && !cover) { setError('Choose a cover photograph before saving.'); return; }
    setBusy(true); setError(''); setStatus('');
    try {
      const response = await fetch('/api/albums', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(editing ? { id: editing.id } : {}), name, photoIds: selected.map(photo => photo.id), coverPhotoId: cover || null }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not save your album.');
      setAlbums(previous => [data.album, ...previous.filter(album => album.id !== data.album.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setEditing(data.album); setName(data.album.name); setPhotoIds(data.album.photoIds); setCover(data.album.coverPhotoId || ''); setDirty(false); setStatus('Album saved. Refresh Gallery to see your changes.');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not save your album.'); }
    finally { setBusy(false); }
  }
  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    const chosen = Array.from(files);
    if (chosen.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024)) { setError('Choose JPG, PNG, or WebP photographs up to 12 MB each.'); if (input.current) input.current.value = ''; return; }
    setBusy(true); setDirty(true); setError(''); let added = 0, nextPhotos = photos;
    try {
      for (const file of chosen) {
        setStatus(`Uploading photograph ${added + 1} of ${chosen.length}…`);
        const body = new FormData(); body.set('kind', 'photo'); body.set('title', file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Untitled photograph'); body.set('taken_at', new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())); body.set('image', file);
        const response = await fetch('/api/posts', { method: 'POST', body });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not upload this photograph.');
        nextPhotos = [data.post, ...nextPhotos]; onPhotosChange(nextPhotos);
        setPhotoIds(previous => [...previous, data.post.id]); added++;
      }
      setSelectedOnly(true); setSearch(''); setStatus(`${added} ${added === 1 ? 'photograph uploaded' : 'photographs uploaded'}. Choose a cover and save the album. Use the stars to feature your favorites on the planet.`);
    } catch (problem) { setStatus(added ? `${added} uploaded ${added === 1 ? 'photograph is' : 'photographs are'} saved in your photo library.` : ''); setError(problem instanceof Error ? problem.message : 'Could not upload your photographs.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function removeAlbum() {
    if (!deleting || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/albums', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleting.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not delete the album.');
      setAlbums(previous => previous.filter(album => album.id !== deleting.id));
      if (editing?.id === deleting.id) { setEditing(null); setName(''); setPhotoIds([]); setCover(''); setDirty(false); }
      setDeleting(null); setStatus('Album deleted. Its photographs and planet selections are preserved.');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not delete the album.'); }
    finally { setBusy(false); }
  }
  return <div className="studio-albums-layout">
    <aside className="studio-album-list"><div className="editor-heading"><h2>Your albums</h2><button className="studio-album-new" type="button" disabled={busy} onClick={() => open(null)}><Plus size={15} />New album</button></div>
      {!albums.length && <p className="studio-field-hint">Name your first collection and choose its cover.</p>}
      {albums.map(album => {
        const image = album.coverPhotoId ? byId.get(album.coverPhotoId) : null;
        const count = album.photoIds.filter(id => byId.has(id)).length;
        return <button className="studio-album-item" key={album.id} type="button" disabled={busy} aria-pressed={editing?.id === album.id} onClick={() => open(album)}>{image ? <img src={thumbnail(image)} alt="" loading="lazy" /> : <span><Images size={20} /></span>}<span><strong>{album.name}</strong><small>{count} {count === 1 ? 'photograph' : 'photographs'}{!image ? ' · Choose a cover' : ''}</small></span></button>;
      })}
    </aside>
    <section className="editor studio-album-editor"><div className="editor-heading"><h2>{editing ? 'Edit album' : 'Create an album'}</h2>{editing && <a className="studio-album-view" href={albumUrl(editing)} target="_blank" rel="noreferrer">View album<ArrowUpRight size={14} /></a>}</div>
      <form ref={editor} onSubmit={save}>
        <label className="field">Album name<input name="album_name" value={name} onChange={event => { setName(event.target.value); setDirty(true); setStatus(''); }} maxLength={100} required disabled={busy} placeholder="Name your collection" /></label>
        <div className="studio-album-cover-choice"><div><label className="field">Cover photograph<select value={cover} disabled={busy || !selected.length} onChange={event => { setCover(event.target.value); setDirty(true); setError(''); setStatus(''); }}><option value="">Choose a cover</option>{selected.map(photo => <option value={photo.id} key={photo.id}>{photo.title}</option>)}</select></label><p className="studio-field-hint">Select photographs below, then choose one as the cover. Removing an album photograph preserves its planet selection and likes.</p></div>{coverPhoto ? <img className="studio-album-cover-preview" src={thumbnail(coverPhoto)} alt="Album cover preview" /> : <div className="studio-album-cover-preview studio-album-cover-empty"><Images size={24} /><span>Choose your cover</span></div>}</div>
        <div className="studio-album-picker-heading"><h3>Photographs <span>{selected.length} selected</span></h3><input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose photos for album" disabled={busy} onChange={event => { void upload(event.target.files); }} /><button className="studio-album-upload" type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} />Upload photos</button></div>
        <p className="studio-field-hint">Save the album to keep your photographs and cover. Click a star to add or remove a planet highlight immediately; likes are shared in every view.</p>
        <div className="studio-album-picker-controls"><input type="search" aria-label="Search photographs" placeholder="Search photographs…" value={search} onChange={event => setSearch(event.target.value)} disabled={busy} /><button type="button" aria-pressed={selectedOnly} disabled={busy} onClick={() => setSelectedOnly(value => !value)}>{selectedOnly ? 'Show all photographs' : 'Show selected only'}</button></div>
        <div className="studio-album-picker" aria-label="Select album photographs">{shown.map(photo => <div className="studio-album-photo-card" key={photo.id}><label className={`studio-album-photo${photoIds.includes(photo.id) ? ' is-selected' : ''}`}><input type="checkbox" checked={photoIds.includes(photo.id)} disabled={busy} onChange={() => toggle(photo)} aria-label={`Include ${photo.title}`} /><img src={thumbnail(photo)} alt="" loading="lazy" decoding="async" /><span>{photo.title}</span>{cover === photo.id && <small>Cover</small>}</label><button className="studio-feature-button" type="button" aria-pressed={isFeaturedPhoto(photo)} aria-label={`Feature ${photo.title} on planet`} disabled={busy} onClick={() => { void feature(photo); }}><Star size={13} fill={isFeaturedPhoto(photo) ? 'currentColor' : 'none'} />{isFeaturedPhoto(photo) ? 'On planet' : 'Feature'}</button></div>)}{!shown.length && <p className="studio-field-hint">{selectedOnly ? 'No photographs selected yet.' : 'No matching photographs.'}</p>}</div>
        {error && <p className="form-error" role="alert">{error}</p>}{status && <p className="studio-status" role="status">{status}</p>}
        <div className="studio-album-save"><button className="publish-button" type="submit" disabled={busy}>{busy ? 'Working…' : editing ? 'Save album' : 'Create album'}</button>{editing && <button className="studio-album-delete" type="button" disabled={busy} onClick={() => setDeleting(editing)}>Delete album</button>}</div>
      </form>
    </section>
    <AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle><AlertDialogDescription>The album will be removed. Its photographs, planet selections, likes, and other albums will be preserved.</AlertDialogDescription><div className="confirm-actions"><AlertDialogCancel disabled={busy}>Keep album</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void removeAlbum(); }}>{busy ? 'Deleting…' : 'Delete album'}</AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </div>;
}
