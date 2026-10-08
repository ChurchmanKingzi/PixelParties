// Einzeldatei-Build für das Artifact: node tools/embed.mjs  (nach "vite build")
// Ergebnis: dist/artifact.html mit eingebettetem Skript, Stil und allen Grafiken (data: URIs).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf-8');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
const jsFile = html.match(/src="\.\/assets\/(index-[^"]+\.js)"/)[1];
const js = readFileSync(join(dist, 'assets', jsFile), 'utf-8').replace(/<\/script/g, '<\\/script');

const files = {};
const json = {};
for (const f of readdirSync(join(root, 'public', 'assets'))) {
  const p = join(root, 'public', 'assets', f);
  if (f.endsWith('.png')) files[f] = 'data:image/png;base64,' + readFileSync(p).toString('base64');
  else if (f.endsWith('.json')) json[f] = JSON.parse(readFileSync(p, 'utf-8'));
}
for (const f of readdirSync(join(root, 'public', 'cards'))) {
  if (f === 'back.png' || f.endsWith('.png')) files['cards/' + f] = 'data:image/png;base64,' + readFileSync(join(root, 'public', 'cards', f)).toString('base64');
}
const embed = 'window.__BB_ASSETS__=' + JSON.stringify({ files, json }) + ';';
const out = `${title}\n<meta name="description" content="Playable combat prototype of Bastion Blasters.">\n${style}\n${body}\n<script>${embed}</script>\n<script type="module">${js}</script>\n`;
writeFileSync(join(dist, 'artifact.html'), out);
console.log(`dist/artifact.html: ${(out.length / 1e6).toFixed(2)} MB (${Object.keys(files).length} images, ${Object.keys(json).length} json)`);
