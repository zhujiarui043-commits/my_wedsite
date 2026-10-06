import { createHash } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataRoot, writeContentFile } from './content-storage';
import { ContentError } from './content-error';
import { GUESTBOOK_COOKIE, type GuestbookState } from './guestbook-shared';

type StoredMessage = { id: string; parentId: string | null; nickname: string; body: string; createdAt: string; authorHash: string };
type Book = { version: 1; messages: StoredMessage[]; votes: Record<string, string[]> };
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hashPattern = /^[a-f0-9]{64}$/;
const visitorHash = (visitor: string) => createHash('sha256').update(visitor).digest('hex');

export function guestbookVisitor(request: Request) {
  const value = request.headers.get('cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith(`${GUESTBOOK_COOKIE}=`))?.slice(GUESTBOOK_COOKIE.length + 1);
  return value && idPattern.test(value) ? value : null;
}
async function readBook(): Promise<Book> {
  try {
    const book = JSON.parse(await readFile(path.join(dataRoot, 'guestbook.json'), 'utf8')) as Book;
    if (book.version !== 1 || !Array.isArray(book.messages) || !book.votes || typeof book.votes !== 'object' || Array.isArray(book.votes)) throw new Error('Invalid Guestbook data');
    if (book.messages.some(message => !idPattern.test(message.id) || (message.parentId !== null && !idPattern.test(message.parentId)) || typeof message.nickname !== 'string' || typeof message.body !== 'string' || !Number.isFinite(Date.parse(message.createdAt)) || !hashPattern.test(message.authorHash))) throw new Error('Invalid Guestbook messages');
    if (Object.entries(book.votes).some(([id, voters]) => !idPattern.test(id) || !Array.isArray(voters) || voters.some(hash => !hashPattern.test(hash)))) throw new Error('Invalid Guestbook votes');
    return book;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, messages: [], votes: {} };
    throw error;
  }
}
function publicState(book: Book, visitor?: string): GuestbookState {
  const hash = visitor ? visitorHash(visitor) : null;
  return {
    messages: book.messages.map(({ authorHash: _, ...message }) => ({ ...message, likes: new Set(book.votes[message.id] || []).size })),
    liked: hash ? book.messages.filter(message => book.votes[message.id]?.includes(hash)).map(message => message.id) : [],
  };
}
export async function guestbookState(visitor?: string) { return publicState(await readBook(), visitor); }

// Serialize writes across the development site, desktop app, and shared preview.
async function locked<T>(operation: () => Promise<T>) {
  await mkdir(dataRoot, { recursive: true });
  const filename = path.join(dataRoot, 'guestbook.lock');
  for (let attempt = 0; attempt < 120; attempt++) {
    let lock;
    try { lock = await open(filename, 'wx'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try { if (Date.now() - (await stat(filename)).mtimeMs > 60000) await unlink(filename); }
      catch (problem) { if ((problem as NodeJS.ErrnoException).code !== 'ENOENT') throw problem; }
      await new Promise(resolve => setTimeout(resolve, 50)); continue;
    }
    try { return await operation(); }
    finally { await lock.close(); await unlink(filename).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  throw new ContentError('The guestbook is busy. Please try again.', 503);
}
export async function updateGuestbook(input: unknown, visitor: string) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ContentError('Check your message.');
  const value = input as Record<string, unknown>;
  if (typeof value.id !== 'string' || !idPattern.test(value.id)) throw new ContentError('Check your message.');
  const id = value.id;
  return locked(async () => {
    const book = await readBook(), hash = visitorHash(visitor);
    if (value.action === 'like') {
      if (Object.keys(value).some(key => !['action', 'id', 'liked'].includes(key)) || typeof value.liked !== 'boolean') throw new ContentError('Send a valid like request.');
      if (!book.messages.some(message => message.id === id)) throw new ContentError('This message is no longer available.', 404);
      const voters = new Set(book.votes[id] || []);
      if (value.liked) voters.add(hash); else voters.delete(hash);
      if (voters.size) book.votes[id] = [...voters]; else delete book.votes[id];
    } else if (value.action === 'message') {
      if (Object.keys(value).some(key => !['action', 'id', 'nickname', 'body', 'parentId'].includes(key)) || typeof value.nickname !== 'string' || typeof value.body !== 'string' || !value.nickname.trim() || value.nickname.trim().length > 40 || !value.body.trim() || value.body.trim().length > 2000 || (value.parentId !== null && (typeof value.parentId !== 'string' || !idPattern.test(value.parentId)))) throw new ContentError('Enter a nickname up to 40 characters and a message up to 2,000 characters.');
      const nickname = value.nickname.trim(), body = value.body.trim().replace(/\r\n?/g, '\n'), parentId = value.parentId as string | null;
      const existing = book.messages.find(message => message.id === id);
      if (existing) {
        if (existing.authorHash !== hash || existing.nickname !== nickname || existing.body !== body || existing.parentId !== parentId) throw new ContentError('This message has already been submitted.', 409);
        return publicState(book, visitor);
      }
      if (parentId && !book.messages.some(message => message.id === parentId && message.parentId === null)) throw new ContentError('The original message is no longer available.', 404);
      if (book.messages.filter(message => message.authorHash === hash && Date.now() - Date.parse(message.createdAt) < 60000).length >= 5) throw new ContentError('Please wait a minute before leaving another message.', 429);
      if (book.messages.length >= 5000) throw new ContentError('The guestbook is full. Please try again later.', 503);
      book.messages.push({ id, nickname, body, parentId, createdAt: new Date().toISOString(), authorHash: hash });
    } else throw new ContentError('Choose a valid guestbook action.');
    await writeContentFile('guestbook.json', book);
    return publicState(book, visitor);
  });
}
