export const GUESTBOOK_PATH = '/api/guestbook';
export const GUESTBOOK_COOKIE = 'jerry_guestbook_visitor';
export type GuestbookMessage = { id: string; parentId: string | null; nickname: string; body: string; createdAt: string; likes: number };
export type GuestbookState = { messages: GuestbookMessage[]; liked: string[] };
