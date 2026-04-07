import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const entries = [
  'index.html',
  'css',
  'js',
  'docs',
  'README.md',
  'render.yaml',
  'serve.py',
];

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  for (const entry of entries) {
    const from = path.join(rootDir, entry);
    const to = path.join(distDir, entry);
    await cp(from, to, { recursive: true });
  }

  console.log(`Build estatico listo en ${distDir}`);
}

build().catch(err => {
  console.error('Build fallido:', err);
  process.exitCode = 1;
});
