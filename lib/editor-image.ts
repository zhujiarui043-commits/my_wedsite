import { bucket } from './posts';

export class ContentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function saveEditorImage(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.size) return null;
  if (value.size > 12 * 1024 * 1024) throw new ContentError('Choose a photo up to 12 MB.', 413);
  const bytes = await value.arrayBuffer();
  const a = new Uint8Array(bytes);
  const jpeg = a[0] === 255 && a[1] === 216 && a[2] === 255;
  const png = a[0] === 137 && a[1] === 80 && a[2] === 78 && a[3] === 71 && a[4] === 13 && a[5] === 10 && a[6] === 26 && a[7] === 10;
  const webp = String.fromCharCode(...a.slice(0, 4)) === 'RIFF' && String.fromCharCode(...a.slice(8, 12)) === 'WEBP';
  const type = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : null;
  if (!type || type !== value.type) throw new ContentError('Choose a JPG, PNG, or WebP photo.');
  const key = crypto.randomUUID();
  try { await bucket().put(key, bytes, { httpMetadata: { contentType: type } }); }
  catch (error) { await bucket().delete(key).catch(() => undefined); throw error; }
  return key;
}
