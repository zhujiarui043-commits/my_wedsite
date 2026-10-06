const fs = require('node:fs/promises');
const path = require('node:path');
async function main() {
  const root = path.resolve(__dirname, '..');
  const standalone = path.join(root, '.next', 'standalone');
  await fs.cp(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
  await fs.cp(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
