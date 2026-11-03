#!/usr/bin/env node
'use strict';
// Backt die „Pixel-Hart"-Umwandlung der Stylesheets VOR: public/style.css → public/style.hart.css (und style-skilltest).
//
//   node scripts/hart/build-css.js            backen (braucht Playwright + Chromium und die gebauten Bundles in public/dist: `node scripts/build.js`)
//   node scripts/hart/build-css.js --pruefen  nur prüfen, ob die gebackene Fassung zu den Quellen passt (Exit 1 = veraltet), ohne Browser
//
// WARUM: pixel-hart.js schrieb beim Laden jedes Spiels ~6500 Regeln um (weiche Schatten/Blur/Verläufe/Alpha → harte Ringe, Dither, Pixelbilder; ~100 ms Desktop, mehrfach auf dem Handy).
// Das Ergebnis hängt nur von den Quellen ab — also einmal im Build rechnen, nicht bei jedem Spieler. Zur Laufzeit überspringt pixel-hart.js gebackene Blätter (`.pp-hart-gebacken`),
// und `index.html` lädt im Normalmodus `style.hart.css`. Weiterhin zur Laufzeit: Inline-Stile aus Komponenten und nachträglich eingehängte <style> (billig, gecacht).
//
// VERFAHREN (verlustfrei gegenüber dem Quelltext): Die Quelle wird mit einem eigenen Scanner in Regeln/Deklarationen mit Textpositionen zerlegt. Jede Regel läuft einzeln durch die ECHTE
// Pipeline im Browser (Chromium-CSSOM + PPPixelHart + pxHintergrund aus dem Spiel-Bundle); nur die DEKLARATIONEN, die sich dabei ändern, werden im Quelltext ersetzt (oder ans Regelende
// angehängt). Alles andere (Firefox-/Safari-Eigenheiten, Kommentare, Reihenfolge) bleibt unberührt. Danach prüft das Skript die Fassung gegen die Referenz (Laufzeit-Pipeline über das ganze
// Blatt, Regel für Regel, Eigenschaft für Eigenschaft) — jede Abweichung bricht ab.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const PUB = path.join(ROOT, 'public');
const DATEIEN = ['style.css', 'style-skilltest.css'];
const MARKE = '.pp-hart-gebacken';

/** Hash der Eingaben, von denen die gebackene Fassung abhängt. */
function eingabeHash(datei) {
  const h = crypto.createHash('sha256');
  for (const p of [path.join(PUB, datei), path.join(PUB, 'pixel-hart.js'), path.join(ROOT, 'data', 'palette.json')]) h.update(fs.readFileSync(p));
  return h.digest('hex').slice(0, 16);
}
function kopfHash(text) { const m = /^\/\* PP-HART-GEBACKEN ([0-9a-f]{16}) /.exec(text); return m ? m[1] : null; }
function veraltet() {
  const res = [];
  for (const f of DATEIEN) {
    const ziel = path.join(PUB, f.replace(/\.css$/, '.hart.css'));
    if (!fs.existsSync(ziel)) { res.push(f + ': style.hart.css fehlt'); continue; }
    const k = kopfHash(fs.readFileSync(ziel, 'utf8'));
    if (k !== eingabeHash(f)) res.push(f + ': gebackene Fassung veraltet (Quelle, pixel-hart.js oder Palette geändert)');
  }
  return res;
}

// ── Scanner ──────────────────────────────────────────────────────────────
function scanner(t) {
  const n = t.length;
  let i = 0;
  const ws = () => {
    for (;;) {
      while (i < n && /\s/.test(t[i])) i++;
      if (t[i] === '/' && t[i + 1] === '*') { const j = t.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; } else break;
    }
  };
  /** Bis zum nächsten `{`, `;` oder `}` auf oberster Ebene lesen (Klammern, Strings, Kommentare beachten). */
  const bis = () => {
    let d = 0;
    while (i < n) {
      const c = t[i];
      if (c === '"' || c === "'") { const q = c; i++; while (i < n && t[i] !== q) { if (t[i] === '\\') i++; i++; } i++; continue; }
      if (c === '/' && t[i + 1] === '*') { const j = t.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue; }
      if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--;
      else if (d <= 0 && (c === '{' || c === ';' || c === '}')) return c;
      i++;
    }
    return '';
  };
  const decls = () => {            // i steht hinter `{`; liest bis zur passenden `}`; Ergebnis { decls, ende (Index der `}`), verschachtelt }
    const res = []; let verschachtelt = false;
    for (;;) {
      ws();
      if (i >= n) return { decls: res, ende: n, verschachtelt };
      if (t[i] === '}') return { decls: res, ende: i, verschachtelt };
      const s = i, c = bis();
      if (c === '{') { verschachtelt = true; // verschachtelte Regel: überspringen (komplett)
        let d = 0; for (; i < n; i++) { if (t[i] === '{') d++; else if (t[i] === '}') { d--; if (d === 0) { i++; break; } } } continue; }
      let e = i; while (e > s && /\s/.test(t[e - 1])) e--;
      const seg = t.slice(s, e), k = seg.indexOf(':');
      if (k > 0) {
        const name = seg.slice(0, k).trim(); let val = seg.slice(k + 1), imp = false;
        const m = /\s*!\s*important\s*$/i.exec(val); if (m) { imp = true; val = val.slice(0, m.index); }
        res.push({ name: name.startsWith('--') ? name : name.toLowerCase(), s, e, val: val.trim(), imp });
      }
      if (c === ';') i++;
    }
  };
  const regeln = (out, tief) => {  // Regeln auf oberster Ebene bzw. im Inneren eines Containers (@media …)
    for (;;) {
      ws();
      if (i >= n) return;
      if (t[i] === '}') { if (tief) { i++; return; } i++; continue; }
      const s = i;
      if (t[i] === '@') {
        const m = /^@([\w-]+)/.exec(t.slice(i, i + 40)), name = m ? m[1].toLowerCase() : '';
        const c = bis();
        if (c === ';') { i++; continue; }
        if (c !== '{') return;
        i++;
        if (/^(?:-\w+-)?keyframes$/.test(name)) {
          const steps = [];
          for (;;) { ws(); if (i >= n) break; if (t[i] === '}') { i++; break; }
          const ss = i, c2 = bis(); if (c2 !== '{') break; i++; const d = decls(); steps.push({ s: ss, ...d }); i = d.ende + 1; }
          out.push({ kind: 'kf', s, e: i, steps });
        } else if (/^(?:media|supports|layer|container|document|-moz-document)$/.test(name)) {
          regeln(out, true);
        } else {                                  // @font-face, @page, @property, @counter-style …: unberührt
          const d = decls(); i = d.ende + 1;
        }
        continue;
      }
      const c = bis();
      if (c !== '{') { if (c === ';') i++; else if (c === '}') { i++; } else return; continue; }
      i++;
      const d = decls();
      i = d.ende + 1;
      if (!d.verschachtelt) out.push({ kind: 'rule', s, e: i, ...d });
    }
  };
  const out = [];
  regeln(out, false);
  return out;
}

// ── Seite: echte Pipeline ────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon' };
function statischerServer() {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
      const f = path.join(PUB, p);
      if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => ok(srv));
  });
}

/** Im Browser: Einheiten (Regel-/Keyframes-Text) einzeln durch die Pipeline schicken und die Änderungen zurückgeben. */
function seiteBacken(einheiten) {
  const snap = (st) => { const m = {}; for (let i = 0; i < st.length; i++) { const nm = st[i]; m[nm] = [st.getPropertyValue(nm), st.getPropertyPriority(nm)]; } return m; };
  const diff = (a, b) => { const ch = {}, weg = []; for (const k in b) if (!a[k] || a[k][0] !== b[k][0] || a[k][1] !== b[k][1]) ch[k] = b[k]; for (const k in a) if (!b[k]) weg.push(k); return { ch, weg }; };
  const H = window.PPPixelHart;
  return einheiten.map((e) => {
    try {
      const sh = new CSSStyleSheet(); sh.replaceSync(e.text);
      if (!sh.cssRules.length) return { fort: true };
      if (e.kind === 'rule') {
        const r = sh.cssRules[0]; if (!r.style) return { fort: true };
        const a = snap(r.style); H.blatt(sh); return diff(a, snap(r.style));
      }
      const r = sh.cssRules[0]; if (!r.cssRules) return { fort: true };
      const a = [...r.cssRules].map((k) => snap(k.style)); H.blatt(sh);
      return { steps: [...r.cssRules].map((k, j) => diff(a[j], snap(k.style))) };
    } catch (er) { return { fehler: String(er && er.message || er) }; }
  });
}

/** Im Browser: gebackenes Blatt gegen die Referenz (Laufzeit-Pipeline über das ganze Blatt) prüfen. */
function seitePruefen(quelle, gebacken) {
  const H = window.PPPixelHart;
  const ref = new CSSStyleSheet(); ref.replaceSync(quelle); H.blatt(ref);
  const bak = new CSSStyleSheet(); bak.replaceSync(gebacken);
  const fehler = []; let geprueft = 0;
  const snap = (st) => { const m = {}; for (let i = 0; i < st.length; i++) { const nm = st[i]; m[nm] = st.getPropertyValue(nm) + '|' + st.getPropertyPriority(nm); } return m; };
  const gleich = (a, b, pfad) => {
    if (a.length !== b.length) { fehler.push(pfad + ': Regelanzahl ' + a.length + ' ≠ ' + b.length); return; }
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i], p = pfad + '/' + i;
      if (x.type !== y.type) { fehler.push(p + ': Typ'); continue; }
      if (x.style && y.style) {
        geprueft++;
        const sx = snap(x.style), sy = snap(y.style);
        const ks = new Set([...Object.keys(sx), ...Object.keys(sy)]);
        for (const k of ks) if (sx[k] !== sy[k]) { fehler.push(p + ' ' + (x.selectorText || x.keyText) + ' { ' + k + ': ' + String(sx[k]).slice(0, 80) + ' ≠ ' + String(sy[k]).slice(0, 80) + ' }'); break; }
      }
      if (x.cssRules && y.cssRules) gleich(x.cssRules, y.cssRules, p);
    }
  };
  gleich(Array.from(ref.cssRules), Array.from(bak.cssRules).slice(1), '');   // die erste gebackene Regel ist die Marke
  return { fehler: fehler.slice(0, 30), anzahl: fehler.length, geprueft };
}

async function backen() {
  let pw; try { pw = require('playwright'); } catch (e) { throw new Error('Playwright fehlt (npm i -D playwright oder globale Installation): ' + e.message); }
  const srv = await statischerServer();
  const port = srv.address().port;
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', () => {});
    await page.route(/^(?!http:\/\/127\.0\.0\.1)/, (r) => r.abort());       // keine fremden Anfragen
    await page.addInitScript(() => { try { localStorage.setItem('pp-retro', '0'); } catch (e) { /* ohne */ } });
    await page.goto('http://127.0.0.1:' + port + '/index.html?hart=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.PPPixelHart && typeof window.pxHintergrund === 'function', null, { timeout: 60000 });
    await page.waitForTimeout(500);
    for (const f of DATEIEN) {
      const t0 = Date.now();
      const quelle = fs.readFileSync(path.join(PUB, f), 'utf8');
      const units = scanner(quelle);
      const liste = units.map((u) => ({ kind: u.kind, text: quelle.slice(u.s, u.e) }));
      const ergebnisse = [];
      for (let o = 0; o < liste.length; o += 400) ergebnisse.push(...await page.evaluate(`(${seiteBacken.toString()})(${JSON.stringify(liste.slice(o, o + 400))})`));
      if (process.env.HART_DEBUG) console.log('  Einheiten', units.length, 'weg', ergebnisse.filter((r) => r && r.fort).length, 'Fehler', ergebnisse.filter((r) => r && r.fehler).length, 'mit Änderung', ergebnisse.filter((r) => r && r.ch && Object.keys(r.ch).length).length, JSON.stringify(ergebnisse.find((r) => r && r.fehler)));
      // Änderungen in den Text einarbeiten
      const edits = []; let geaendert = 0, angehaengt = 0, ersetzt = 0, weggefallen = 0, fehler = 0;
      const anwenden = (decls, bodyEnde, d) => {
        const namen = Object.keys(d.ch);
        if (!namen.length && !(d.weg && d.weg.length)) return;
        if (d.weg && d.weg.length) { weggefallen += d.weg.length; for (const k of d.weg) { const s = decls.filter((x) => x.name === k).pop(); if (s) edits.push({ pos: s.s, del: s.e - s.s, ins: k + ': unset' + (s.imp ? ' !important' : '') }); } }
        let anhang = '';
        for (const k of namen) {
          const [val, prio] = d.ch[k], vorh = decls.filter((x) => x.name === k).pop();
          const zeile = k + ': ' + val + (prio ? ' !important' : '');
          if (vorh) { edits.push({ pos: vorh.s, del: vorh.e - vorh.s, ins: zeile }); ersetzt++; }
          else { anhang += ' ' + zeile + ';'; angehaengt++; }
        }
        if (anhang) {
          let p = bodyEnde - 1; while (p >= 0 && /\s/.test(quelle[p])) p--;
          const sem = quelle[p] === ';' || quelle[p] === '{' ? '' : ';';
          edits.push({ pos: p + 1, del: 0, ins: sem + anhang });
        }
        geaendert++;
      };
      units.forEach((u, idx) => {
        const r = ergebnisse[idx];
        if (!r || r.fort) return;
        if (r.fehler) { fehler++; console.warn('  Fehler bei', quelle.slice(u.s, u.s + 60).replace(/\s+/g, ' '), '→', r.fehler); return; }
        if (u.kind === 'rule') anwenden(u.decls, u.ende, r);
        else if (r.steps) u.steps.forEach((st, j) => { if (r.steps[j]) anwenden(st.decls, st.ende, r.steps[j]); });
      });
      edits.sort((a, b) => a.pos - b.pos || (a.del ? -1 : 1));
      let aus = '', pos = 0;
      for (const e of edits) { aus += quelle.slice(pos, e.pos) + e.ins; pos = e.pos + e.del; }
      aus += quelle.slice(pos);
      const kopf = '/* PP-HART-GEBACKEN ' + eingabeHash(f) + ' — ERZEUGT von scripts/hart/build-css.js aus ' + f + ' (pixel-hart.js vorab angewandt) — nicht von Hand ändern. */\n' + MARKE + ' { --pp-hart: 1; }\n';
      const text = kopf + aus;
      // Prüfung gegen die Referenz
      const pr = await page.evaluate(`(${seitePruefen.toString()})(${JSON.stringify(quelle)}, ${JSON.stringify(text)})`);
      console.log(f, '→', f.replace(/\.css$/, '.hart.css'), (quelle.length / 1024).toFixed(0) + ' kB →', (text.length / 1024).toFixed(0) + ' kB;', geaendert, 'Regeln geändert (', ersetzt, 'ersetzt,', angehaengt, 'angehängt,', weggefallen, 'entfernt ),', pr.geprueft, 'Regeln geprüft,', pr.anzahl, 'Abweichungen,', (Date.now() - t0) + ' ms');
      if (pr.anzahl || fehler) { for (const m of pr.fehler) console.error('   ', m); throw new Error('Abweichungen zwischen gebackener Fassung und Laufzeit-Pipeline — nichts geschrieben.'); }
      fs.writeFileSync(path.join(PUB, f.replace(/\.css$/, '.hart.css')), text, 'utf8');
    }
  } finally { await browser.close(); srv.close(); }
}

if (require.main === module) {
  if (process.argv.includes('--pruefen')) {
    const v = veraltet();
    if (v.length) { console.error(v.join('\n') + '\n→ node scripts/hart/build-css.js'); process.exit(1); }
    console.log('style.hart.css ist aktuell.');
  } else backen().catch((e) => { console.error(e.message || e); process.exit(1); });
}
module.exports = { scanner, eingabeHash, kopfHash, veraltet, DATEIEN, MARKE };
