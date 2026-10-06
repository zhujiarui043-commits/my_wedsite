export function localEditorGuard(req: Request, write = true) {
  try {
    const host = req.headers.get('host');
    if (!host) throw new Error();
    const address = new URL(`http://${host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)) throw new Error();
    if (write && req.headers.get('origin') !== address.origin) throw new Error();
    return null;
  } catch {
    return Response.json({ error: 'Open Jerry Studio on this computer to edit your website.' }, { status: 403 });
  }
}
