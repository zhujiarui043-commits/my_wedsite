'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { type Post, imageUrl, isFeaturedPhoto } from '@/lib/post-shared';
import { toggleFeaturedPhoto } from '@/lib/featured-photo-client';
import { galleryAsset } from '@/lib/seed-gallery';
import StudioImage, { useStudioImage } from './studio-image';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';

const today = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export default function StudioPosts({ kind, initialPosts, onPostsChange }: { kind: Post['kind']; initialPosts: Post[]; onPostsChange?: (posts: Post[]) => void }) {
  const [posts, setPosts] = useState(initialPosts.filter(post => post.kind === kind));
  const [editing, setEditing] = useState<Post | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState<Post | null>(null);
  const [dirty, setDirty] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const image = useStudioImage();
  const note = kind === 'journal';
  useEffect(() => { setPosts(initialPosts.filter(post => post.kind === kind)); }, [initialPosts, kind]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function reset() { setEditing(null); setVersion(value => value + 1); image.setFile(null); image.setPreview(''); image.setRemoved(false); setDirty(false); setError(''); }
  function edit(post: Post) {
    if (dirty && !window.confirm('Discard the unsaved changes in this editor?')) return;
    setEditing(post); setVersion(value => value + 1); image.setFile(null); image.setPreview(imageUrl(post)); image.setRemoved(false); setError(''); setStatus(''); setDirty(false);
    form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const body = new FormData(form.current!); body.set('kind', kind);
      if (!note) body.set('featured', String(body.get('featured') === 'on'));
      if (editing) body.set('id', editing.id);
      if (image.file) body.set('image', image.file);
      if (image.removed) body.set('remove_image', 'true');
      const result = await fetch('/api/posts', { method: editing ? 'PATCH' : 'POST', body });
      const data = await result.json(); if (!result.ok) throw new Error(data.error || 'Could not publish. Please try again.');
      const nextPosts = [data.post, ...posts.filter(post => post.id !== data.post.id)].sort((a, b) => b.taken_at.localeCompare(a.taken_at));
      setPosts(nextPosts); onPostsChange?.(nextPosts);
      reset(); setStatus('Published. Refresh the website to see your update.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not publish. Please try again.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setError('');
    try {
      const result = await fetch('/api/posts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleting.id }) });
      const data = await result.json(); if (!result.ok) throw new Error(data.error || 'Could not delete.');
      const nextPosts = posts.filter(post => post.id !== deleting.id);
      setPosts(nextPosts); onPostsChange?.(nextPosts);
      if (editing?.id === deleting.id) reset(); setDeleting(null); setStatus('Entry deleted.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete.'); }
    finally { setBusy(false); }
  }
  async function feature(post: Post) {
    if (busy) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const updated = await toggleFeaturedPhoto(post);
      const nextPosts = posts.map(item => item.id === updated.id ? updated : item);
      setPosts(nextPosts); onPostsChange?.(nextPosts);
      setStatus(`${updated.title} ${isFeaturedPhoto(updated) ? 'added to' : 'removed from'} the planet. Refresh Gallery to see the update.`);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not update the planet selection.'); }
    finally { setBusy(false); }
  }
  return <div className="studio-layout">
    <section className="editor"><div className="editor-heading"><h2>{editing ? 'Edit' : 'New'} {note ? 'note' : 'photograph'}</h2><button className="text-button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard the unsaved changes?')) { reset(); setStatus(''); } }}>Clear editor</button></div>
      <form ref={form} key={version} onSubmit={save} onChange={() => setDirty(true)}>
        <label className="field">Title<input name="title" defaultValue={editing?.title || ''} placeholder={note ? 'Give your note a title' : 'Name this photograph'} maxLength={100} required disabled={busy} /></label>
        <div className="field-row"><label className="field">Date<input type="date" name="taken_at" defaultValue={editing?.taken_at || today()} required disabled={busy} /></label><label className="field">{note ? 'Topic / location' : 'Location'}<input name="location" defaultValue={editing?.location || ''} maxLength={100} disabled={busy} /></label></div>
        <label className="field">{note ? 'Text' : 'Caption (optional)'}<textarea name="body" rows={note ? 10 : 4} defaultValue={editing?.body || ''} maxLength={20000} required={note} disabled={busy} placeholder="Write here…" /></label>
        <StudioImage image={image} optional={note} disabled={busy} onChange={() => setDirty(true)} onError={setError} />
        {!note && <label className="studio-feature-choice"><input type="checkbox" name="featured" defaultChecked={!!editing && isFeaturedPhoto(editing)} disabled={busy} />Show on photo planet</label>}
        {error && <p className="form-error" role="alert">{error}</p>}{status && <p className="studio-status" role="status">{status}</p>}
        <button className="publish-button" disabled={busy} type="submit">{busy ? 'Publishing…' : editing ? 'Save changes' : note ? 'Publish note' : 'Save photograph'}</button>
      </form>
    </section>
    <aside className="published"><div className="editor-heading"><h2>{note ? 'Published' : 'Photo library'}</h2><span>{posts.length} {note ? 'notes' : 'photographs'}</span></div>
      {!note && <p className="studio-field-hint">{posts.filter(isFeaturedPhoto).length} featured on the planet. Changing this selection keeps the photograph in its albums.</p>}
      {!posts.length ? <div className="empty-posts"><Plus size={24} /><h3>{note ? 'Your first note starts here' : 'Your first photograph starts here'}</h3><p>Published content appears on the website.</p></div> : posts.map(post => <article className="manage-post" key={post.id}>
        {post.image_key ? <img src={galleryAsset(post.image_key)?.thumbnail || imageUrl(post)} alt={post.title} loading="lazy" decoding="async" /> : <span className="text-thumbnail">Aa</span>}
        <div><small>{post.taken_at}</small><h3>{post.title}</h3>
          {!note && <label className="studio-feature-choice"><input type="checkbox" checked={isFeaturedPhoto(post)} disabled={busy || editing?.id === post.id} onChange={() => { void feature(post); }} aria-label={`Feature ${post.title} on planet`} />Show on photo planet</label>}
          <div className="post-actions">
          <button disabled={busy} onClick={() => edit(post)} aria-label={`Edit ${post.title}`}><Pencil size={14} />Edit</button>
          <a href={note ? `/notes/${post.id}` : '/gallery'} target="_blank" rel="noreferrer" aria-label={`View ${post.title}`}><ArrowUpRight size={14} />View</a>
          <button disabled={busy} onClick={() => setDeleting(post)} aria-label={`Delete ${post.title}`}><Trash2 size={14} />Delete</button>
        </div></div>
      </article>)}
    </aside>
    <AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle><AlertDialogDescription>This entry and its photo will be permanently deleted from your website.</AlertDialogDescription><div className="confirm-actions"><AlertDialogCancel disabled={busy}>Keep</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); remove(); }}>{busy ? 'Deleting…' : 'Delete entry'}</AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </div>;
}
