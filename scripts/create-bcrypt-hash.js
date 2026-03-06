#!/usr/bin/env node
// Usage: node create-bcrypt-hash.js <key>
const bcrypt = require('bcryptjs');
const key = process.argv[2];
if (!key) {
  console.error('Usage: node create-bcrypt-hash.js <key>');
  process.exit(1);
}
const hash = bcrypt.hashSync(key, 10);
console.log(hash);