import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const assetVersion = '20260407g';

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

  const rootIndexPath = path.join(rootDir, 'index.html');
  let distIndex = await readFile(rootIndexPath, 'utf8');
  distIndex = distIndex
    .replace('css/styles.20260407g.css', `css/styles.${assetVersion}.css`)
    .replace('js/balance.20260407g.js', `js/balance.${assetVersion}.js`)
    .replace('js/ui.20260407g.js', `js/ui.${assetVersion}.js`)
    .replace('js/credit-cards.20260407g.js', `js/credit-cards.${assetVersion}.js`);
  await writeFile(path.join(distDir, 'index.html'), distIndex, 'utf8');

  await cp(path.join(rootDir, 'css', 'styles.css'), path.join(rootDir, 'css', `styles.${assetVersion}.css`));
  await cp(path.join(rootDir, 'js', 'balance.js'), path.join(rootDir, 'js', `balance.${assetVersion}.js`));
  await cp(path.join(rootDir, 'js', 'ui.js'), path.join(rootDir, 'js', `ui.${assetVersion}.js`));
  await cp(path.join(rootDir, 'js', 'credit-cards.js'), path.join(rootDir, 'js', `credit-cards.${assetVersion}.js`));

  await cp(path.join(rootDir, 'css', 'styles.css'), path.join(distDir, 'css', `styles.${assetVersion}.css`));
  await cp(path.join(rootDir, 'js', 'balance.js'), path.join(distDir, 'js', `balance.${assetVersion}.js`));
  await cp(path.join(rootDir, 'js', 'ui.js'), path.join(distDir, 'js', `ui.${assetVersion}.js`));
  await cp(path.join(rootDir, 'js', 'credit-cards.js'), path.join(distDir, 'js', `credit-cards.${assetVersion}.js`));

  console.log(`Build estatico listo en ${distDir}`);
}

build().catch(err => {
  console.error('Build fallido:', err);
  process.exitCode = 1;
});
