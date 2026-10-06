import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const dataRoot = path.resolve(process.env.JERRY_DATA_DIR || path.join(process.cwd(), 'data'));

export async function writeContentFile(name: string, value: unknown) {
  await mkdir(dataRoot, { recursive: true });
  const file = path.join(dataRoot, name);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
    for (let attempt = 0; ; attempt++) {
      try { await rename(temporary, file); break; }
      catch (error) {
        // Windows scanners/readers can briefly prevent an atomic replacement.
        const code = (error as NodeJS.ErrnoException).code;
        if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(code || '') || attempt >= 5) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.min(40 * 2 ** attempt, 200)));
      }
    }
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
