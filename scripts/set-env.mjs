#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, '.env.local');

function parseDotEnv(text) {
  const out = {};
  (text || '').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!m) return;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  });
  return out;
}

function serializeDotEnv(obj) {
  const keys = Object.keys(obj).sort();
  return keys.map(k => `${k}=${obj[k]}`).join('\n') + '\n';
}

function toEnvKey(k) {
  // Support THEME.backgroundHex -> THEME_BACKGROUNDHEX
  if (k.includes('.')) {
    const [pfx, rest] = k.split('.', 2);
    return `${pfx}_${rest.replace(/[^a-zA-Z0-9]/g, '')}`.toUpperCase();
  }
  return k.toUpperCase();
}

function printUsage() {
  console.log('Usage:');
  console.log('  node scripts/set-env.mjs KEY=VALUE [KEY=VALUE ...]');
  console.log('  node scripts/set-env.mjs --print');
  console.log('Examples:');
  console.log('  node scripts/set-env.mjs MODE=text MEMORY_ENABLED=false DEV_MODE=true');
  console.log('  node scripts/set-env.mjs THEME.backgroundHex=#000000 AVATAR_URL=/models/avatar.glb');
}

async function main() {
  const args = process.argv.slice(2);
  const printOnly = args.includes('--print');

  let cur = {};
  if (fs.existsSync(ENV_FILE)) {
    cur = parseDotEnv(fs.readFileSync(ENV_FILE, 'utf8'));
  }

  if (printOnly || args.length === 0) {
    console.log(`# ${ENV_FILE}`);
    const text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
    console.log(text);
    if (!printOnly && args.length === 0) printUsage();
    process.exit(0);
  }

  const updates = {};
  for (const a of args) {
    if (!a.includes('=')) continue;
    const [kRaw, ...rest] = a.split('=');
    const v = rest.join('=');
    if (!kRaw) continue;
    const k = toEnvKey(kRaw.trim());
    updates[k] = v.trim();
  }

  const next = { ...cur, ...updates };
  fs.writeFileSync(ENV_FILE, serializeDotEnv(next), 'utf8');
  console.log(`Wrote ${ENV_FILE}`);
  Object.keys(updates).forEach(k => console.log(`  ${k}=${updates[k]}`));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});






