'use strict';
// UI-Test (echtes Chromium, OHNE Server): Token-Zerfall (W6, Al 14.10.2026: „Das optische Token-Fliegen muss weg, stattdessen sollen sie desintegrieren").
// Lädt den ECHTEN Quelltext von `tokenZerfallSpielen` samt Helfern (`flugMass` … `makeFlightTiltLayer`) aus `public/app-board.jsx` in eine nackte Seite mit einer
// Attrappen-Support-Zone und prüft: Pixelraster erscheint, zerfällt (Pixelzahl sinkt auf 0), die Kopie räumt sich auf, die Zone wird nicht angefasst;
// `_playAnimations=false` → nichts; `prefers-reduced-motion` → nur Ausblenden, kein Canvas; fremdes (verschmutztes) Bild → Rückfall auf Farbpalette.
// Lauf:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=/opt/node-tools/node_modules node scripts/skilltest-e2e/ui-token-zerfall.js [--shots <Ordner>]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const quelle = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'app-board.jsx'), 'utf8');
const a = quelle.indexOf('function flugMass(ort) {');
const eEnde = 'window.tokenZerfallSpielen = tokenZerfallSpielen;';
const e = quelle.indexOf(eEnde);
if (a < 0 || e < 0) { console.log('Quelltext nicht gefunden'); process.exit(1); }
const code = quelle.slice(a, e + eEnde.length);
const sh = process.argv.indexOf('--shots');
const shotDir = sh > 0 ? process.argv[sh + 1] : null;
let fails = 0;
const check = (n, c, i) => { console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  ' + JSON.stringify(i))); if (!c) fails++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SEITE = `<!doctype html><html><head><style>
  :root { --board-scale: 1.6; }
  body { margin: 0; background: #1b2a1b; width: 900px; height: 600px; position: relative; }
  .zone { position: absolute; left: 300px; top: 200px; width: calc(68px * var(--board-scale)); height: calc(94px * var(--board-scale)); background: rgba(255,255,255,.08); }
  .board-card { position: absolute; left: calc(2px * var(--board-scale)); top: calc(2px * var(--board-scale)); width: calc(64px * var(--board-scale)); height: calc(90px * var(--board-scale)); background: #333; }
</style></head><body>
<div class="zone" data-support-zone data-support-owner="opp" data-support-hero="0" data-support-slot="1"><div class="board-card"></div></div>
</body></html>`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const mkSeite = async (opts = {}) => {
      const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, reducedMotion: opts.reduziert ? 'reduce' : 'no-preference' });
      const page = await ctx.newPage();
      const pageerrors = [];
      page.on('pageerror', (x) => pageerrors.push(x.message));
      await page.setContent(SEITE);
      await page.evaluate(() => {
        const PP_BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
        window.ppBayer = function (x, y) { return (PP_BAYER4[y & 3][x & 3] + 0.5) / 16; };
        window.ppBayer = window.ppBayer;
      });
      await page.addScriptTag({ content: 'var ppBayer = window.ppBayer;' });
      await page.addScriptTag({ content: code });
      // Kartenbild: bunter Verlauf als data:-URL (nicht verschmutzt) bzw. fremde Herkunft (verschmutzt → Palette)
      await page.evaluate((fremd) => {
        const c = document.createElement('canvas'); c.width = 128; c.height = 180;
        const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 128, 180); g.addColorStop(0, '#e8c040'); g.addColorStop(0.5, '#c03020'); g.addColorStop(1, '#2040a0');
        x.fillStyle = g; x.fillRect(0, 0, 128, 180);
        x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText('TOKEN', 18, 90);
        window.__bild = c.toDataURL('image/png');
        window.cardImageUrl = () => window.__bild;
      });
      return { ctx, page, pageerrors };
    };
    const zaehle = (page) => page.evaluate(() => {
      const cv = document.querySelector('.token-zerfall canvas');
      if (!cv) return -1;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    });

    // 1 · Normalfall
    {
      const { ctx, page, pageerrors } = await mkSeite();
      const ms = await page.evaluate(() => tokenZerfallSpielen(document.querySelector('[data-support-zone]'), 'Mummy Token'));
      check('Rückgabe = Dauer in ms (> 0)', ms > 0, ms);
      await sleep(120);
      const n0 = await zaehle(page);
      check('Pixelraster ist da (Canvas mit Pixeln)', n0 > 200, n0);
      const info = await page.evaluate(() => { const k = document.querySelector('.token-zerfall'); const r = k.getBoundingClientRect(); return { cls: k.className, w: Math.round(r.width), h: Math.round(r.height), eltern: k.parentElement.tagName }; });
      check('Kopie hat Kartengröße am Bildschirm (64×1.6 = 102 px breit)', Math.abs(info.w - 102) <= 3 && info.h > info.w, info);
      if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, 'zerfall-120ms.png') }); }
      await sleep(330);
      const n1 = await zaehle(page);
      if (shotDir) await page.screenshot({ path: path.join(shotDir, 'zerfall-450ms.png') });
      await sleep(250);
      if (shotDir) await page.screenshot({ path: path.join(shotDir, 'zerfall-700ms.png') });
      await sleep(900);
      const n2 = await zaehle(page);
      check('Raster zerfällt (Pixel bleiben nicht gleich, am Ende keine Kopie mehr)', n1 !== n0 && n2 === -1, { n0, n1, n2 });
      const rest = await page.evaluate(() => document.querySelectorAll('.token-zerfall').length);
      check('Kopie hat sich aufgeräumt', rest === 0, rest);
      check('Zone selbst unverändert (Karte nicht entfernt)', await page.evaluate(() => !!document.querySelector('[data-support-zone] .board-card')), null);
      check('keine Seitenfehler', pageerrors.length === 0, pageerrors);
      await ctx.close();
    }
    // 2 · Animationen aus
    {
      const { ctx, page } = await mkSeite();
      const ms = await page.evaluate(() => { window._playAnimations = false; return tokenZerfallSpielen(document.querySelector('[data-support-zone]'), 'X'); });
      check('_playAnimations=false: nichts gespielt', ms === 0 && await page.evaluate(() => document.querySelectorAll('.token-zerfall').length) === 0, ms);
      await ctx.close();
    }
    // 3 · reduzierte Bewegung
    {
      const { ctx, page } = await mkSeite({ reduziert: true });
      const ms = await page.evaluate(() => tokenZerfallSpielen(document.querySelector('[data-support-zone]'), 'X'));
      await sleep(60);
      const st = await page.evaluate(() => ({ canvas: document.querySelectorAll('.token-zerfall canvas').length, kopie: document.querySelectorAll('.token-zerfall').length }));
      check('prefers-reduced-motion: kurzes Ausblenden, kein Pixel-Canvas', ms > 0 && ms < 600 && st.canvas === 0 && st.kopie === 1, { ms, st });
      await sleep(600);
      check('prefers-reduced-motion: Kopie weg', await page.evaluate(() => document.querySelectorAll('.token-zerfall').length) === 0, null);
      await ctx.close();
    }
    // 4 · Geneigte Brettebene
    {
      const { ctx, page, pageerrors } = await mkSeite();
      await page.evaluate(() => {
        const p = document.createElement('div'); p.className = 'board-plane'; p.style.cssText = 'position:absolute;inset:0;transform:perspective(900px) rotateX(35deg);';
        const z = document.querySelector('[data-support-zone]'); document.body.appendChild(p); p.appendChild(z);
      });
      const ms = await page.evaluate(() => tokenZerfallSpielen(document.querySelector('[data-support-zone]'), 'X'));
      await sleep(150);
      const tr = await page.evaluate(() => { const k = document.querySelector('.token-zerfall'); const l = k && k.firstElementChild; return l ? getComputedStyle(l).transform : null; });
      check('geneigte Ebene: Kopie trägt dieselbe Neigung (matrix3d)', ms > 0 && typeof tr === 'string' && tr.startsWith('matrix3d'), tr);
      if (shotDir) await page.screenshot({ path: path.join(shotDir, 'zerfall-geneigt.png') });
      check('geneigt: keine Seitenfehler', pageerrors.length === 0, pageerrors);
      await ctx.close();
    }
    // 5 · Bild nicht lesbar (fremde Herkunft / nicht ladbar) → Farbpalette
    {
      const { ctx, page, pageerrors } = await mkSeite();
      await page.evaluate(() => { window.cardImageUrl = () => 'http://127.0.0.1:9/gibts-nicht.png'; });
      const ms = await page.evaluate(() => tokenZerfallSpielen(document.querySelector('[data-support-zone]'), 'X'));
      await sleep(250);
      const n = await zaehle(page);
      check('Bild nicht ladbar: Zerfall läuft mit Farbpalette', ms > 0 && n > 200, { ms, n });
      check('Rückfall: keine Seitenfehler', pageerrors.length === 0, pageerrors);
      await ctx.close();
    }
    // 6 · Zone fehlt
    {
      const { ctx, page } = await mkSeite();
      const ms = await page.evaluate(() => tokenZerfallSpielen(null, 'X'));
      check('ohne Zone: 0 und kein Fehler', ms === 0, ms);
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(fails ? `\n${fails} Prüfung(en) FEHLGESCHLAGEN` : '\nAlles bestanden');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
