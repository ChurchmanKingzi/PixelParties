'use strict';
// Erzeugt die Pixel-Raster aller Emojis/Symbole des Spiels (→ glyphen.json), Eingabe: zeichen.json (siehe scan.js).
//   node scripts/pixel-emoji/extract.js
// Quelle je Zeichen: 1) ein EINFARBIGES handgezeichnetes Sprite des Spiels (farbige Sprites ersetzt die Automatik, siehe unten) (PP_PX_ICONS / PP_PX_ZEICHEN → PP_PX_SPRITES in app-shared.jsx), sonst
// 2) das System-Emoji (Chromium, Noto Color Emoji), per Flaechenmittel auf ein 16x16-Raster verkleinert, auf wenige Farben reduziert
// (Median-Cut), mit dunkler Kontur. Reine Text-Symbole (✓ ★ → …) werden einfarbig (folgen der Textfarbe) im 14x14-Raster abgelegt.
// Handarbeit hat Vorrang: Eintraege in `handarbeit.json` (gleiche Form wie ein Sprite) ersetzen die Automatik.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const ROOT = path.join(__dirname, '..', '..');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const PORT = parseInt(process.env.PE_PORT || '3992', 10);
const BASE = `http://127.0.0.1:${PORT}`;

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', PP_DEMO_RECORD: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const an = (d) => { out += d.toString(); if (out.includes('running on http')) resolve(child); };
    child.stdout.on('data', an); child.stderr.on('data', an);
    child.on('exit', (c) => reject(new Error('Server beendet (' + c + '):\n' + out.slice(-1500))));
    setTimeout(() => reject(new Error('Server-Start Timeout')), 90000);
  });
}

// ── laeuft IM BROWSER ────────────────────────────────────────────────────────────────────────────────────────
function imBrowser(zeichen) {
  const NF = 16, NS = 14;                     // Raster: farbige Emojis / einfarbige Symbole
  const SCHRIFT = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji","DejaVu Sans",sans-serif';
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const ohneVs = (z) => z.replace(/️/g, '');
  const spriteFuer = (z) => {
    const k = [z, ohneVs(z), ohneVs(z) + '️'];
    for (const kk of k) if (PP_PX_ICONS[kk] && PP_PX_SPRITES[PP_PX_ICONS[kk]]) return PP_PX_SPRITES[PP_PX_ICONS[kk]];
    for (const kk of k) if (PP_PX_ZEICHEN[kk] && PP_PX_SPRITES[PP_PX_ZEICHEN[kk]]) return PP_PX_SPRITES[PP_PX_ZEICHEN[kk]];
    return null;
  };
  const GR = 160, S = 100;
  const rendern = (z) => {
    const c = document.createElement('canvas'); c.width = GR; c.height = GR;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `${S}px ${SCHRIFT}`;
    x.fillText(z, GR / 2, GR / 2 + S * 0.04);
    return x.getImageData(0, 0, GR, GR);
  };
  const tofu = rendern('\u{10FFFF}').data;
  const gleich = (a, b) => { for (let i = 3; i < a.length; i += 4) if ((a[i] > 128) !== (b[i] > 128)) return false; return true; };
  const hatFarbe = (d) => { for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) > 30) return true; return false; };
  const bbox = (d) => {
    let x0 = GR, y0 = GR, x1 = -1, y1 = -1;
    for (let y = 0; y < GR; y++) for (let x = 0; x < GR; x++) if (d[(y * GR + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  };
  const medianCut = (farben, k) => {
    let kisten = [farben.slice()];
    while (kisten.length < k) {
      let bi = -1, bs = 0;
      kisten.forEach((kk, i) => { if (kk.length < 2) return; for (let ch = 0; ch < 3; ch++) { const v = kk.map(c => c[ch]); const sp = Math.max(...v) - Math.min(...v); if (sp * kk.length > bs) { bs = sp * kk.length; bi = i; } } });
      if (bi < 0) break;
      const kk = kisten[bi]; let kanal = 0, bsp = -1;
      for (let ch = 0; ch < 3; ch++) { const v = kk.map(c => c[ch]); const sp = Math.max(...v) - Math.min(...v); if (sp > bsp) { bsp = sp; kanal = ch; } }
      kk.sort((a, b) => a[kanal] - b[kanal]);
      const m = kk.length >> 1; kisten.splice(bi, 1, kk.slice(0, m), kk.slice(m));
    }
    return kisten.map(kk => [0, 1, 2].map(ch => kk.reduce((s, c) => s + c[ch], 0) / kk.length));
  };
  const buchstaben = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const ergebnis = {};
  const protokoll = { sprite: [], farbe: [], mono: [], leer: [] };
  for (const z of zeichen) {
    const sp = spriteFuer(z);
    const alsSprite = () => {
      ergebnis[z] = sp.mono ? { mono: true, z: sp.z.map(r => r.replace(/\+/g, '#').replace(/[^#]/g, '.')) } : { pal: sp.pal, z: sp.z.slice() };
      protokoll.sprite.push(z);
    };
    // Einfarbige Sprites (✦ ★ ♪ …) bleiben. Farbige Sprites ersetzt die AUTOMATISCHE Rasterung des System-Emojis (Als Entscheidung 23.10.: sieht besser aus) —
    // ausser das Zeichen hat gar kein Farb-Emoji (dann ist das Sprite die einzige bunte Fassung).
    if (sp && sp.mono) { alsSprite(); continue; }
    const roh = rendern(z);
    const d = roh.data;
    if (gleich(d, tofu) || !bbox(d)) { if (sp) alsSprite(); else protokoll.leer.push(z); continue; }
    const bunt = hatFarbe(d) || /️/.test(z) || /^\p{Emoji_Presentation}/u.test(z);
    if (sp && !bunt) { alsSprite(); continue; }
    const bb = bbox(d);
    const N = bunt ? NF : NS, rand = bunt ? 1 : 0, inn = N - 2 * rand;
    // Abbildung Bild-px → Zellen: Farb-Emojis passen in den Innenbereich (volle Groesse), Symbole bleiben im natuerlichen Massstab zur Schrift
    let f, ox, oy;
    if (bunt) {
      const gr = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
      f = inn / gr; ox = rand + (inn - (bb.x1 - bb.x0) * f) / 2 - bb.x0 * f; oy = rand + (inn - (bb.y1 - bb.y0) * f) / 2 - bb.y0 * f;
    } else {
      f = (inn / S) * 0.9; const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
      ox = N / 2 - cx * f; oy = N / 2 - cy * f;
    }
    // Flaechenmittel: je Zelle Deckung und Farbe (premultiplied)
    const zellen = [];
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
      const sx0 = (cx - ox) / f, sx1 = (cx + 1 - ox) / f, sy0 = (cy - oy) / f, sy1 = (cy + 1 - oy) / f;
      let a = 0, r = 0, g = 0, b = 0, n = 0;
      for (let y = Math.max(0, Math.floor(sy0)); y < Math.min(GR, Math.ceil(sy1)); y++) for (let x = Math.max(0, Math.floor(sx0)); x < Math.min(GR, Math.ceil(sx1)); x++) {
        const i = (y * GR + x) * 4; const al = d[i + 3] / 255; a += al; r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; n++;
      }
      const dk = n ? a / n : 0;
      zellen.push({ cx, cy, dk, farbe: a > 0 ? [r / a, g / a, b / a] : [0, 0, 0] });
    }
    if (!bunt) {
      const raster = Array.from({ length: N }, () => Array(N).fill('.'));
      let any = false;
      for (const c of zellen) if (c.dk >= 0.32) { raster[c.cy][c.cx] = '#'; any = true; }
      if (!any) { protokoll.leer.push(z); continue; }
      ergebnis[z] = { mono: true, z: raster.map(r => r.join('')) };
      protokoll.mono.push(z); continue;
    }
    const gedeckt = zellen.filter(c => c.dk >= 0.45);
    if (!gedeckt.length) { protokoll.leer.push(z); continue; }
    const pal = medianCut(gedeckt.map(c => c.farbe), 6);
    const naechste = (fa) => { let bi = 0, bd = 1e9; pal.forEach((p, i) => { const dd = (p[0] - fa[0]) ** 2 + (p[1] - fa[1]) ** 2 + (p[2] - fa[2]) ** 2; if (dd < bd) { bd = dd; bi = i; } }); return bi; };
    const raster = Array.from({ length: N }, () => Array(N).fill('.'));
    for (const c of gedeckt) raster[c.cy][c.cx] = buchstaben[naechste(c.farbe)];
    const KONTUR = 'Z';
    const voll = (x, y) => x >= 0 && y >= 0 && x < N && y < N && raster[y][x] !== '.' && raster[y][x] !== KONTUR;
    const neu = raster.map(r => r.slice());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (raster[y][x] === '.' && (voll(x + 1, y) || voll(x - 1, y) || voll(x, y + 1) || voll(x, y - 1))) neu[y][x] = KONTUR;
    const palMap = { Z: '#180e1a' };
    pal.forEach((p, i) => { palMap[buchstaben[i]] = hex(p[0], p[1], p[2]); });
    ergebnis[z] = { pal: palMap, z: neu.map(r => r.join('')), stil: !!sp };    // `stil`: das Zeichen hatte ein handgezeichnetes Sprite → Handzeichner-Schattierung (stil.js)
    protokoll.farbe.push(z);
  }
  return { ergebnis, protokoll };
}

(async () => {
  const zeichen = JSON.parse(fs.readFileSync(path.join(__dirname, 'zeichen.json'), 'utf8'));
  const hand = fs.existsSync(path.join(__dirname, 'handarbeit.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'handarbeit.json'), 'utf8')) : {};
  const srv = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const toolsDir = process.env.PE_REACT_DIR || '/tmp/st-tools/node_modules';
    if (fs.existsSync(path.join(toolsDir, 'react/umd'))) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto(BASE + '/');
    await page.waitForFunction(() => typeof PP_PX_SPRITES !== 'undefined' && typeof PP_PX_ICONS !== 'undefined', null, { timeout: 30000 });
    const { ergebnis, protokoll } = await page.evaluate(`(${imBrowser.toString()})(${JSON.stringify(zeichen)})`);
    // Zeichen mit und ohne Variantenselektor teilen sich EIN Glyph (gleicher Codepunkt): Farbfassung vor Einfarbfassung.
    // Handzeichner-Stil (stil.js): FORM aus dem System-Emoji, Schattierung/Licht/Dithering wie beim handgezeichneten Sprite. Standard: ALLE Farb-Emojis;
    // PE_STIL=sprites beschraenkt ihn auf Zeichen, die frueher ein handgezeichnetes Sprite hatten, PE_STIL=aus schaltet ihn ab.
    const { stilisiere } = require('./stil');
    const modus = process.env.PE_STIL || 'alle';
    for (const [z, g] of Object.entries(ergebnis)) {
      if (!g.mono && g.pal && g.pal.Z && modus !== 'aus' && (g.stil || modus === 'alle')) Object.assign(g, stilisiere(g));
      delete g.stil;
    }
    const nachCp = {};
    for (const [z, g] of Object.entries(ergebnis)) {
      const cp = z.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      const alt = nachCp[cp];
      if (!alt || (alt.mono && !g.mono) || (alt.mono === g.mono && /️/.test(z))) nachCp[cp] = { ...g, zeichen: z };
    }
    for (const [z, g] of Object.entries(hand)) nachCp[z.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')] = { ...g, zeichen: z };
    const sortiert = Object.fromEntries(Object.entries(nachCp).sort((a, b) => parseInt(a[0], 16) - parseInt(b[0], 16)));
    fs.writeFileSync(path.join(__dirname, 'glyphen.json'), JSON.stringify(sortiert, null, 0) + '\n', 'utf8');
    console.log(`Sprites ${protokoll.sprite.length}, Farb-Emoji ${protokoll.farbe.length}, einfarbig ${protokoll.mono.length}, nicht darstellbar ${protokoll.leer.length}`);
    if (protokoll.leer.length) console.log('Nicht darstellbar (bleiben System-Text):', protokoll.leer.join(' '));
    console.log(Object.keys(sortiert).length + ' Glyphen → scripts/pixel-emoji/glyphen.json');
  } finally { await browser.close(); srv.kill(); }
})().catch(e => { console.error(e); process.exit(2); });
