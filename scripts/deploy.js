// Incremental deploy — only uploads changed files (MD5-based)
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const HOST = process.argv[2] || 'la';
const REMOTE = process.argv[3] || '~/tetris';
const LOCAL = 'dist';

function md5(filePath) {
  return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

function getRemoteMD5(host, filePath) {
  try {
    return execSync(`ssh ${host} "md5sum ${filePath} 2>/dev/null | cut -d' ' -f1"`, { encoding: 'utf8' }).trim();
  } catch { return ''; }
}

function walkDir(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkDir(full, base));
    else files.push({ local: full, relative: path.relative(base, full) });
  }
  return files;
}

console.log(`[deploy] Scanning ${LOCAL}...`);
const files = walkDir(LOCAL);

let uploaded = 0, skipped = 0, totalSize = 0;

execSync(`ssh ${HOST} "mkdir -p ${REMOTE}"`, { stdio: 'ignore' });

for (const { local, relative } of files) {
  const localMD5 = md5(local);
  const remotePath = `${REMOTE}/${relative}`;
  if (localMD5 === getRemoteMD5(HOST, remotePath)) { skipped++; continue; }

  execSync(`ssh ${HOST} "mkdir -p ${path.dirname(remotePath)}"`, { stdio: 'ignore' });
  const size = fs.statSync(local).size;
  process.stdout.write(`[deploy] ↑ ${relative} (${(size / 1024).toFixed(1)} KB)... `);
  execSync(`scp "${local}" ${HOST}:${remotePath}`, { stdio: 'ignore' });
  console.log('done');
  uploaded++;
  totalSize += size;
}

console.log(`\n[deploy] ${uploaded} uploaded, ${skipped} skipped (${(totalSize / 1024).toFixed(0)} KB)`);
