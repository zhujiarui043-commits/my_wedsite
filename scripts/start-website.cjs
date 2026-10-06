const path = require('node:path');
const root = path.resolve(__dirname, '..');
process.env.HOSTNAME = '127.0.0.1';
process.env.PORT = process.argv[2] || process.env.PORT || '3000';
process.env.JERRY_DATA_DIR = path.resolve(process.env.JERRY_DATA_DIR || path.join(root, 'data'));
require(path.join(root, '.next', 'standalone', 'server.js'));
