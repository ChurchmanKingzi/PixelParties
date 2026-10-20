'use strict';
// Rendert eine Karte mit dem Spiel-eigenen Renderer (public/card-render.js) als 750x1050-PNG.
// Aufruf: node render-card.js "<Kartenname>" <ausgabe.png>
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW_MODULE || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());

const ROOT = path.resolve(__dirname, '..', '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };

function startServer() {
  const dirs = [['/data/', path.join(ROOT, 'data')], ['/', path.join(ROOT, 'public')]];
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    for (const [prefix, dir] of dirs) {
      if (!url.startsWith(prefix)) continue;
      const f = path.join(dir, url.slice(prefix.length));
      if (f.startsWith(dir) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        return fs.createReadStream(f).pipe(res);
      }
    }
    res.writeHead(404); res.end();
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function renderCards(names) {
  const srv = await startServer();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf-8'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.goto(base + '/does-not-exist.html').catch(() => {});
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ url: base + '/card-render.js' });
  const out = {};
  for (const name of names) {
    const card = cards.find(c => c.name === name);
    if (!card) throw new Error('Karte nicht gefunden: ' + name);
    out[name] = await page.evaluate(async ({ card, base }) => {
      if (!window.__init) {
        await CardRender.init({ base: base + '/cardgen/' });
        await CardRender.loadMeta(base + '/data/card-render.json');
        window.__init = true;
      }
      const cv = await CardRender.renderCard(card);
      return cv ? cv.toDataURL('image/png') : null;
    }, { card, base });
  }
  await browser.close();
  srv.close();
  return out;
}

module.exports = { renderCards };

if (require.main === module) {
  const [name, file] = process.argv.slice(2);
  renderCards([name]).then(o => {
    const d = o[name];
    if (!d) throw new Error('keine Kunst für ' + name);
    fs.writeFileSync(file, Buffer.from(d.split(',')[1], 'base64'));
    console.log('geschrieben', file);
  }).catch(e => { console.error(e); process.exit(1); });
}
