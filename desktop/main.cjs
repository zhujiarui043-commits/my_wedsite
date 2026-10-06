const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');

app.setName('Jerry Studio');
app.setAppUserModelId('com.jerryzhu.studio');
let window, server, origin, contentDirectory, logFile;
let serverError = '';
let stopping = false;
function appendLog(message) { if (logFile) fs.appendFile(logFile, `${new Date().toISOString()} ${message}\n`).catch(() => undefined); }

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
}
async function startWebsite() {
  const resources = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..', 'dist-desktop', 'development');
  const website = path.join(resources, 'website');
  const config = JSON.parse(await fs.readFile(path.join(resources, 'content-directory.json'), 'utf8'));
  contentDirectory = config.path;
  // This build uses the existing site's data folder. Never silently switch databases.
  if (!path.isAbsolute(contentDirectory)) throw new Error('The content folder must be an absolute path.');
  await fs.mkdir(contentDirectory, { recursive: true });
  logFile = path.join(app.getPath('userData'), 'studio.log');
  const port = await freePort(); origin = `http://127.0.0.1:${port}`;
  const environment = { ...process.env, ELECTRON_RUN_AS_NODE: '1', HOSTNAME: '127.0.0.1', PORT: String(port), JERRY_DATA_DIR: contentDirectory, NODE_ENV: 'production' };
  delete environment.NODE_OPTIONS;
  server = spawn(process.execPath, [path.join(website, 'server.js')], { cwd: website, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', bytes => appendLog(bytes.toString()));
  server.stderr.on('data', bytes => { serverError = (serverError + bytes.toString()).slice(-3000); appendLog(bytes.toString()); });
  server.on('error', error => { serverError = error.message; appendLog(error.message); });
  server.on('exit', code => {
    if (!stopping && window) { dialog.showErrorBox('Jerry Studio stopped', 'Please reopen the app. Your published content is safe in the content folder.'); app.quit(); }
    appendLog(`Website process exited: ${code}`);
  });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error(serverError || 'The website could not start.');
    try {
      const result = await fetch(`${origin}/api/destinations`, { signal: AbortSignal.timeout(1500) });
      await result.arrayBuffer();
      if (result.ok) { appendLog(`Ready: ${origin} | Content: ${contentDirectory}`); return; }
    } catch { /* The local server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(serverError || 'The website took too long to start.');
}
function safeWebsiteAddress(address) {
  try { return new URL(address).origin === origin; } catch { return false; }
}
async function backup() {
  const chosen = await dialog.showOpenDialog(window, { title: 'Choose a backup location', properties: ['openDirectory', 'createDirectory'] });
  if (chosen.canceled) return;
  const target = path.join(chosen.filePaths[0], `Jerry-Studio-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const relative = path.relative(contentDirectory, target);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) { await dialog.showMessageBox(window, { message: 'Choose a folder outside your content folder.' }); return; }
  try {
    await fs.cp(contentDirectory, target, { recursive: true, errorOnExist: true, force: false });
    await dialog.showMessageBox(window, { message: 'Backup saved', detail: target });
  } catch (error) { dialog.showErrorBox('Could not save the backup', error.message); }
}
async function createWindow() {
  window = new BrowserWindow({ width: 1320, height: 930, minWidth: 800, minHeight: 650, title: 'Jerry Studio', backgroundColor: '#f5f5f1', show: false,
    icon: path.join(__dirname, 'icon.png'), webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"] } });
  });
  window.webContents.on('will-navigate', (event, address) => { if (!safeWebsiteAddress(address)) event.preventDefault(); });
  window.webContents.on('will-redirect', (event, address) => { if (!safeWebsiteAddress(address)) event.preventDefault(); });
  window.webContents.setWindowOpenHandler(({ url }) => { if (safeWebsiteAddress(url)) shell.openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(window, { type: 'question', buttons: ['Keep writing', 'Discard and close'], defaultId: 0, cancelId: 0, message: 'You have unpublished changes.' });
    if (choice === 1) event.preventDefault();
  });
  window.webContents.on('page-title-updated', event => { event.preventDefault(); window.setTitle('Jerry Studio'); });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'View website', click: () => shell.openExternal(origin) },
      { label: 'Open content folder', click: () => shell.openPath(contentDirectory) },
      { label: 'Back up content…', click: backup },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
    { label: 'Help', submenu: [{ label: 'About Jerry Studio', click: () => dialog.showMessageBox(window, { message: 'Jerry Studio · 0.1.0', detail: 'Manage Notes, Gallery, and Journey.\nPublishing updates the website on this computer.\n\nContent folder:\n' + contentDirectory }) }] },
  ]));
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = null; });
  await window.loadURL(`${origin}/studio`);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => { await startWebsite(); await createWindow(); }).catch(error => {
    appendLog(error.stack || error.message); dialog.showErrorBox('Could not open Jerry Studio', error.message); app.quit();
  });
  app.on('activate', () => { if (!window && origin) createWindow(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('will-quit', () => { stopping = true; server?.kill(); });
}
