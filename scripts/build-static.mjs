import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Copia la app tal cual a dist/. No renombra ni pisa archivos fuente:
// el cache-busting se hace con el ?v= de cada <script>/<link> en index.html.
const entries = [
  'index.html',
  'manifest.json',
  'css',
  'js',
  'brand',
];

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  for (const entry of entries) {
    await cp(path.join(rootDir, entry), path.join(distDir, entry), { recursive: true });
  }

  console.log(`Build estatico listo en ${distDir}`);
}

build().catch(err => {
  console.error('Build fallido:', err);
  process.exitCode = 1;
});
