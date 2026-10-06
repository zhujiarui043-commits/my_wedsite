'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { Destination } from '@/lib/destination-shared';
import StudioImage, { useStudioImage } from './studio-image';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';

export default function StudioJourney({ initialDestinations }: { initialDestinations: Destination[] }) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [editing, setEditing] = useState<Destination | null>(null), [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState(''), [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState<Destination | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const image = useStudioImage();
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function reset() { setEditing(null); setVersion(value => value + 1); setDirty(false); setError(''); image.setFile(null); image.setPreview(''); image.setRemoved(false); }
  function edit(destination: Destination) {
    if (dirty && !window.confirm('Discard the unsaved changes in this editor?')) return;
    setEditing(destination); setVersion(value => value + 1); setDirty(false); setError(''); setStatus(''); image.setFile(null); image.setPreview(destination.image_key ? `/api/images/${destination.image_key}` : ''); image.setRemoved(false);
    form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setStatus('');
    try {
      const body = new FormData(form.current!);
      if (editing) body.set('slug', editing.slug);
      if (image.file) body.set('image', image.file);
      if (image.removed) body.set('remove_image', 'true');
      const result = await fetch('/api/destinations', { method: editing ? 'PATCH' : 'POST', body });
      const data = await result.json(); if (!result.ok) throw new Error(data.error || 'Could not publish.');
      setDestinations(previous => editing ? previous.map(destination => destination.slug === editing.slug ? data.destination : destination) : [...previous, data.destination]);
      reset(); setStatus('Published. Refresh Journey to see your update.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not publish.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setError('');
    try {
      const result = await fetch('/api/destinations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: deleting.slug }) });
      const data = await result.json(); if (!result.ok) throw new Error(data.error || 'Could not delete.');
      setDestinations(previous => previous.filter(destination => destination.slug !== deleting.slug));
      if (editing?.slug === deleting.slug) reset(); setDeleting(null); setStatus('Destination deleted.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete.'); }
    finally { setBusy(false); }
  }
  return <div className="studio-layout"><section className="editor"><div className="editor-heading"><h2>{editing ? 'Edit destination' : 'New destination'}</h2><button className="text-button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard the unsaved changes?')) { reset(); setStatus(''); } }}>Clear editor</button></div>
    <form key={version} ref={form} onSubmit={save} onChange={() => setDirty(true)}>
      <label className="field">Place name<input name="name" defaultValue={editing?.name || ''} maxLength={100} required disabled={busy} placeholder="e.g. Chengdu" /></label>
      <label className="field">Parent location (optional)<input name="region" defaultValue={editing?.region || ''} maxLength={100} disabled={busy} placeholder="e.g. Sichuan" /></label>
      <label className="field">Page address<input name="slug" defaultValue={editing?.slug || ''} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" required disabled={busy || !!editing} placeholder="e.g. chengdu" /><small className="studio-field-hint">Lowercase English letters, numbers, and hyphens. This becomes /journey/your-address.</small></label>
      <label className="field">Travel journal (optional)<textarea name="body" rows={7} defaultValue={editing?.paragraphs.join('\n\n') || ''} maxLength={20000} disabled={busy} placeholder="Write about this place…" /></label>
      <StudioImage image={image} optional disabled={busy} onChange={() => setDirty(true)} onError={setError} />
      <div className="studio-coordinates"><label className="field">Country<select name="country" defaultValue={editing?.country || 'CHN'} disabled={busy}><option value="CHN">China</option><option value="JPN">Japan</option><option value="KOR">South Korea</option></select></label>
        <div className="field-row"><label className="field">Longitude<input name="longitude" type="number" step="any" min={-180} max={180} defaultValue={editing?.longitude ?? ''} disabled={busy} placeholder="e.g. 104.0665" /></label><label className="field">Latitude<input name="latitude" type="number" step="any" min={-90} max={90} defaultValue={editing?.latitude ?? ''} disabled={busy} placeholder="e.g. 30.5723" /></label></div>
        <p className="studio-field-hint">Coordinates are optional. Fill in both to add a red dot within the current China–Korea–Japan map.</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}{status && <p className="studio-status" role="status">{status}</p>}
      <button className="publish-button" disabled={busy} type="submit">{busy ? 'Publishing…' : editing ? 'Save changes' : 'Publish destination'}</button>
    </form></section>
    <aside className="published"><div className="editor-heading"><h2>Destinations</h2><span>{destinations.length} places</span></div>
      {!destinations.length && <p className="studio-field-hint">Add a destination to start a travel journal.</p>}
      {destinations.map(destination => <article key={destination.slug} className="manage-post">
        {destination.image_key ? <img src={`/api/images/${destination.image_key}`} alt={destination.name} /> : <span className="text-thumbnail"><MapPin size={25} /></span>}
        <div><small>{destination.region || 'Travel journal'}</small><h3>{destination.name}</h3><div className="post-actions"><button onClick={() => edit(destination)} disabled={busy} aria-label={`Edit ${destination.name}`}><Pencil size={14} />Edit</button><a href={`/journey/${destination.slug}`} target="_blank" rel="noreferrer" aria-label={`View ${destination.name}`}><ArrowUpRight size={14} />View</a><button onClick={() => setDeleting(destination)} disabled={busy} aria-label={`Delete ${destination.name}`}><Trash2 size={14} />Delete</button></div></div>
      </article>)}
    </aside>
    <AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle><AlertDialogDescription>This destination page and its uploaded photo will be permanently deleted. Original map cities remain on the map.</AlertDialogDescription><div className="confirm-actions"><AlertDialogCancel disabled={busy}>Keep</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); remove(); }}>{busy ? 'Deleting…' : 'Delete destination'}</AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </div>;
}
