'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Heart, MessageCircle, Send, X } from 'lucide-react';
import { GUESTBOOK_PATH, type GuestbookMessage, type GuestbookState } from '@/lib/guestbook-shared';

type MessageInput = { action: 'message'; id: string; nickname: string; body: string; parentId: string | null };
type Mutation = MessageInput | { action: 'like'; id: string; liked: boolean };
const dateFormat = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' });
const date = (value: string) => dateFormat.format(new Date(value));
function unchanged(previous: GuestbookState, next: GuestbookState) {
  return previous.liked.length === next.liked.length && previous.liked.every((id, index) => id === next.liked[index])
    && previous.messages.length === next.messages.length && previous.messages.every((message, index) => {
      const other = next.messages[index];
      return message.id === other.id && message.parentId === other.parentId && message.nickname === other.nickname
        && message.body === other.body && message.createdAt === other.createdAt && message.likes === other.likes;
    });
}

function MessageComposer({ nickname, onNickname, onSend, ready, busy, parentId = null, onCancel }: {
  nickname: string; onNickname: (name: string) => void; onSend: (input: MessageInput) => Promise<void>; ready: boolean; busy: boolean; parentId?: string | null; onCancel?: () => void;
}) {
  const [body, setBody] = useState(''), [error, setError] = useState('');
  const requestId = useRef<string | null>(null), fieldsId = useId();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!ready || busy) return;
    requestId.current ??= crypto.randomUUID(); setError('');
    try { await onSend({ action: 'message', id: requestId.current, nickname, body, parentId }); setBody(''); requestId.current = null; }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not send your message. Please try again.'); }
  }
  return <form className="guestbook-composer" onSubmit={submit}>
    <label htmlFor={`${fieldsId}-nickname`}>Nickname</label>
    <input id={`${fieldsId}-nickname`} name="nickname" value={nickname} onChange={event => onNickname(event.target.value)} placeholder="What should I call you?" autoComplete="nickname" maxLength={40} required disabled={busy} />
    <label htmlFor={`${fieldsId}-message`}>{parentId ? 'Your reply' : 'Your message'}</label>
    <textarea id={`${fieldsId}-message`} name="message" value={body} onChange={event => { setBody(event.target.value); setError(''); }} placeholder={parentId ? 'Join the conversation…' : 'Leave a thought, a story, or a little hello…'} rows={4} maxLength={2000} required disabled={busy} />
    {error && <p className="guestbook-error" role="alert">{error}</p>}
    <div className="guestbook-composer-footer"><span>{body.length.toLocaleString('en')} / 2,000</span><div>{onCancel && <button className="guestbook-cancel" type="button" onClick={onCancel} disabled={busy}><X size={15} aria-hidden="true" />Cancel</button>}<button className="guestbook-send" type="submit" disabled={!ready || busy || !nickname.trim() || !body.trim()}><Send size={15} aria-hidden="true" />{busy ? 'Sending…' : parentId ? 'Send reply' : 'Leave a message'}</button></div></div>
  </form>;
}

export default function Guestbook({ initialState = { messages: [], liked: [] } }: { initialState?: GuestbookState }) {
  const [state, setState] = useState(initialState), [nickname, setNickname] = useState('');
  const [ready, setReady] = useState(false), [pending, setPending] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null), [shown, setShown] = useState(20), [expanded, setExpanded] = useState(new Set<string>());
  const busy = useRef(false), revision = useRef(0), active = useRef(false), refresh = useRef<(() => void) | null>(null);
  const liked = useMemo(() => new Set(state.liked), [state.liked]);
  const { roots, repliesByParent } = useMemo(() => {
    const roots: GuestbookMessage[] = [], repliesByParent = new Map<string, GuestbookMessage[]>();
    for (const message of state.messages) {
      if (!message.parentId) roots.push(message);
      else {
        const replies = repliesByParent.get(message.parentId) ?? [];
        replies.push(message); repliesByParent.set(message.parentId, replies);
      }
    }
    return { roots: roots.reverse(), repliesByParent };
  }, [state.messages]);
  useEffect(() => {
    active.current = true;
    let cancelled = false, request: AbortController | null = null, reloadAgain = false;
    try { setNickname(localStorage.getItem('jerry_guestbook_nickname') || ''); } catch { /* The form also works without local storage. */ }
    async function reload() {
      if (document.hidden || busy.current) return;
      if (request) { reloadAgain = true; return; }
      const abort = new AbortController(); request = abort;
      const before = revision.current;
      try {
        const response = await fetch(GUESTBOOK_PATH, { cache: 'no-store', credentials: 'same-origin', signal: abort.signal });
        if (!response.ok) throw new Error('Could not load the guestbook. Please try again.');
        const next = await response.json() as GuestbookState;
        if (!cancelled && before === revision.current) { setState(previous => unchanged(previous, next) ? previous : next); setReady(true); setError(''); }
      } catch (problem) { if (!cancelled && !abort.signal.aborted && before === revision.current) setError(problem instanceof Error ? problem.message : 'Could not load the guestbook.'); }
      finally {
        request = null;
        if (reloadAgain && !cancelled) { reloadAgain = false; void reload(); }
      }
    }
    const reloadNow = () => { void reload(); };
    refresh.current = reloadNow; reloadNow();
    const interval = window.setInterval(reloadNow, 20000);
    window.addEventListener('focus', reloadNow); document.addEventListener('visibilitychange', reloadNow);
    return () => { cancelled = true; request?.abort(); active.current = false; refresh.current = null; window.clearInterval(interval); window.removeEventListener('focus', reloadNow); document.removeEventListener('visibilitychange', reloadNow); };
  }, []);
  function chooseNickname(value: string) {
    setNickname(value);
    try { localStorage.setItem('jerry_guestbook_nickname', value); } catch { /* Remembering a nickname is optional. */ }
  }
  async function mutate(input: Mutation) {
    if (busy.current) throw new Error('Please wait for the current action to finish.');
    busy.current = true; revision.current++; setPending(input.id); setError(''); setNotice('');
    try {
      const response = await fetch(GUESTBOOK_PATH, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save. Please try again.');
      if (active.current) setState(result as GuestbookState);
    } finally { busy.current = false; if (active.current) setPending(''); }
  }
  async function send(input: MessageInput) {
    await mutate(input);
    setNotice(input.parentId ? 'Your reply has been posted.' : 'Your message has been posted. Thank you for stopping by!');
    if (input.parentId) { setExpanded(previous => new Set([...previous, input.parentId!])); setReplyId(null); }
  }
  async function like(message: GuestbookMessage) {
    try { await mutate({ action: 'like', id: message.id, liked: !liked.has(message.id) }); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not save your like.'); }
  }
  const renderMessage = (message: GuestbookMessage, reply = false) => <article className={`guestbook-message${reply ? ' guestbook-reply' : ''}`} key={message.id}>
    <header><span className="guestbook-avatar" aria-hidden="true">{Array.from(message.nickname.trim())[0]?.toUpperCase()}</span><strong>{message.nickname}</strong><time dateTime={message.createdAt}>{date(message.createdAt)}</time></header>
    <p className="guestbook-message-body">{message.body}</p>
    <div className="guestbook-actions"><button type="button" className="guestbook-like" aria-label={`${liked.has(message.id) ? 'Unlike' : 'Like'} message by ${message.nickname} (${message.likes} ${message.likes === 1 ? 'like' : 'likes'})`} aria-pressed={liked.has(message.id)} aria-busy={pending === message.id} disabled={!ready || !!pending} onClick={() => { void like(message); }}><Heart size={16} aria-hidden="true" />{message.likes}</button>{!reply && <button type="button" aria-expanded={replyId === message.id} onClick={() => setReplyId(previous => previous === message.id ? null : message.id)} disabled={!!pending}><MessageCircle size={15} aria-hidden="true" />Reply</button>}</div>
  </article>;
  return <section className="guestbook" aria-label="Guestbook messages">
    <div className="guestbook-intro"><h2>Leave a little hello.</h2><p>Choose a nickname. No account needed.</p></div>
    <MessageComposer nickname={nickname} onNickname={chooseNickname} onSend={send} ready={ready} busy={!!pending} />
    <p className="guestbook-notice" role="status">{notice}</p>
    {error && <p className="guestbook-error" role="alert">{error} <button type="button" onClick={() => refresh.current?.()}>Try again</button></p>}
    <div className="guestbook-feed-heading"><h2>Messages</h2><span>{roots.length} {roots.length === 1 ? 'message' : 'messages'}</span></div>
    {!roots.length && <p className="guestbook-empty">Be the first to leave a message.</p>}
    <div className="guestbook-feed">{roots.slice(0, shown).map(message => {
      const replies = repliesByParent.get(message.id) ?? [];
      return <div className="guestbook-thread" key={message.id}>
        {renderMessage(message)}
        {!!replies.length && <div className="guestbook-replies">{replies.length > 3 && !expanded.has(message.id) && <button className="guestbook-more" type="button" onClick={() => setExpanded(previous => new Set([...previous, message.id]))}>View all {replies.length} replies</button>}{(expanded.has(message.id) ? replies : replies.slice(-3)).map(reply => renderMessage(reply, true))}</div>}
        {replyId === message.id && <div className="guestbook-reply-composer"><p>Replying to {message.nickname}</p><MessageComposer nickname={nickname} onNickname={chooseNickname} onSend={send} ready={ready} busy={!!pending} parentId={message.id} onCancel={() => setReplyId(null)} /></div>}
      </div>;
    })}</div>
    {roots.length > shown && <button className="guestbook-more" type="button" onClick={() => setShown(previous => previous + 20)}>More messages</button>}
  </section>;
}
