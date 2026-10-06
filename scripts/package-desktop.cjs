const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  if (process.platform !== 'win32') throw new Error('This packaging script creates the Windows build. Build the Mac distribution on macOS.');
  const root = path.resolve(__dirname, '..');
  const standalone = path.join(root, '.next', 'standalone');
  await fs.access(path.join(standalone, 'server.js'));
  const output = path.join(root, 'dist-desktop', `JerryStudio-0.1.0-win-x64-${Date.now()}`);
  await fs.mkdir(output, { recursive: true });
  await fs.cp(path.join(root, 'node_modules', 'electron', 'dist'), output, { recursive: true });
  await fs.rename(path.join(output, 'electron.exe'), path.join(output, 'Jerry Studio.exe'));
  const resources = path.join(output, 'resources');
  const website = path.join(resources, 'website');
  await fs.cp(standalone, website, { recursive: true, filter: source => {
    const relative = path.relative(standalone, source);
    return relative !== 'data' && !relative.startsWith(`data${path.sep}`) && relative !== '.env' && !relative.startsWith('.env.');
  } });
  await fs.cp(path.join(root, 'public'), path.join(website, 'public'), { recursive: true });
  await fs.cp(path.join(root, '.next', 'static'), path.join(website, '.next', 'static'), { recursive: true });
  const application = path.join(resources, 'app');
  await fs.mkdir(application, { recursive: true });
  await fs.copyFile(path.join(root, 'desktop', 'main.cjs'), path.join(application, 'main.cjs'));
  await fs.writeFile(path.join(application, 'package.json'), JSON.stringify({ name: 'jerry-studio', productName: 'Jerry Studio', version: '0.1.0', main: 'main.cjs' }, null, 2));
  await fs.writeFile(path.join(resources, 'content-directory.json'), JSON.stringify({ path: path.resolve(process.env.JERRY_DATA_DIR || path.join(root, 'data')) }, null, 2));
  const icon = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="56" fill="#253b30"/><text x="128" y="182" text-anchor="middle" font-family="Georgia" font-size="180" fill="#f5f5f1">J</text></svg>')).png().toBuffer();
  await fs.writeFile(path.join(application, 'icon.png'), icon);
  const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header[8] = 0; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(icon.length, 14); header.writeUInt32LE(22, 18);
  await fs.writeFile(path.join(application, 'icon.ico'), Buffer.concat([header, icon]));
  await fs.writeFile(path.join(output, 'Read me.txt'), 'Jerry Studio 0.1.0\r\n\r\nDouble-click Jerry Studio.exe. Keep all files in this folder together.\r\nManage Notes, Gallery, and Journey.\r\nPublished content is stored in the existing website data folder, outside this app.\r\nSee File > Open content folder and File > Back up content.\r\nThis application updates your local website. Public hosting is configured separately.\r\n');
  await fs.writeFile(path.join(root, 'dist-desktop', 'latest.json'), JSON.stringify({ directory: output, executable: path.join(output, 'Jerry Studio.exe') }, null, 2));
  console.log(`Windows app ready: ${path.join(output, 'Jerry Studio.exe')}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
