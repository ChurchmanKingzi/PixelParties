'use strict';
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: PIXELART-ANIMATIONEN  (W86z, Al: „ALLE Animationen im Spiel sind Pixelart")
//
//  Liest den QUELLTEXT der Animationen und zählt je Einheit die schlimmsten Muster, die keine Pixelart sind:
//
//    blur          Weichzeichner: box-/text-shadow mit Unschärfe, filter: blur()/drop-shadow(), backdrop-filter
//    verlauf       Farbverläufe, die KEIN Pixelierer anfasst: in CSS-Keyframes, in Einheiten mit `data-pp-px="aus"`, auf Canvas
//                  (createLinear-/RadialGradient). (Verläufe in Registry-Animationen ohne `aus` pixeliert der Pixelierer zur Laufzeit.)
//    drehung       rotate()/skew()/`rotate:` — Drehungen von Hand. Die Pipeline (public/pixel-anim.js) dreht Blattelemente zur Laufzeit als
//                  Pixel-Sprite; wer das geprüft hat (Messung), vermerkt es in derselben Zeile:  pp-ok: drehung
//    mischmodus    mix-blend-mode / mixBlendMode (Farbmischung mit dem Hintergrund, nie Pixelart)
//    systemglyphe  Canvas-`fillText(` und SVG-`<text` (System-Schrift statt Pixel-Emoji-Schrift)
//
//  Einheiten:  reg:<Schlüssel> (ANIM_REGISTRY in app-board.jsx) · kf:<Name> (@keyframes in public/style*.css, nicht retro)
//              jsxkf:<Datei>:<Name> (@keyframes in JSX-Vorlagen) · area:<Szene> (…Overlay-Komponenten in app-areas.jsx)
//
//  RATCHET wie scripts/check-no-splice.js: `scripts/pixel-anim-baseline.json` hält je Einheit und Muster den bekannten Stand.
//  Gemeldet wird jede Einheit, die ein Muster NEU oder MEHR hat. Jede Umstellung senkt die Zahl — danach `--update`, und der Stand
//  kann nie wieder steigen. Neue Animationen kommen mit 0 in jedem Muster.
//
//  Ausnahme je Zeile (nur nach Prüfung per Messung!):  Kommentar `pp-ok: <muster>[, <muster>]` in derselben Zeile.
//  Einheiten, die ihre Pixelart selbst malen, tragen `data-pp-px="aus"` — dort fasst kein Pixelierer etwas an, also zählt dort alles.
//
//  Aufruf:
//    node scripts/check-pixel-anim.js             Ratchet prüfen (Exit 1 bei Verstoß)
//    node scripts/check-pixel-anim.js --all       Stand je Muster und die schlimmsten Einheiten listen
//    node scripts/check-pixel-anim.js --unit reg:explosion   Fundstellen einer Einheit zeigen
//    node scripts/check-pixel-anim.js --update    Baseline auf den Ist-Stand setzen
//  Als Modul: require('./check-pixel-anim').pruefe({ wurzel })
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(__dirname, 'pixel-anim-baseline.json');
const MUSTER = ['blur', 'verlauf', 'drehung', 'mischmodus', 'systemglyphe'];

// ── Zeilenmuster ──────────────────────────────────────────────
const RE_SCHATTEN = /(box-shadow|boxShadow|text-shadow|textShadow)\s*[:=]\s*[`'"]?([^;\n}]*)/g;
const RE_SCHEIN_ANDERS = /(--[\w-]*(?:schatten|shadow|glow|schein)[\w-]*)\s*:\s*([^;\n}]*)/gi;
function hatUnschaerfe(wert) {
  // je Schatten (Komma auf oberster Ebene): dritte Länge > 0 = Unschärfe.  `0 0 0 2px` (hart) bleibt erlaubt.
  const teile = []; let d = 0, cur = '';
  for (const ch of wert) { if (ch === '(') d++; else if (ch === ')') d--; if (ch === ',' && d === 0) { teile.push(cur); cur = ''; } else cur += ch; }
  teile.push(cur);
  return teile.some(t => {
    const nums = (t.replace(/rgba?\([^)]*\)|hsla?\([^)]*\)|var\([^)]*\)|\$\{[^}]*\}/g, '').match(/-?\d*\.?\d+(?:px|em|rem)?(?=[\s,;)]|$)/g) || []).map(parseFloat);
    return nums.length >= 3 && nums[2] > 0;
  });
}
const RE_FILTER_BLUR = /(?:^|[^\w-])(?:-webkit-)?(?:filter|backdrop-filter|backdropFilter)\s*[:=][^;\n}]*?(?:blur|drop-shadow)\s*\(|(?:^|[^\w-])backdrop-?[Ff]ilter\s*[:=]\s*[`'"]?\s*[a-z]/;
const RE_FILTER_IN_WERT = /\b(?:blur|drop-shadow)\(/;
const RE_VERLAUF = /\b(?:repeating-)?(?:radial|linear|conic)-gradient\(|createLinearGradient\(|createRadialGradient\(|createConicGradient\(/;
const RE_DREHUNG = /\b(?:rotate|rotateX|rotateY|rotateZ|rotate3d|skew|skewX|skewY)\s*\(|(?:^|[\s;{'"`])rotate\s*:/;
const RE_MISCH = /mix-blend-mode|mixBlendMode/;
const RE_SYSTEM = /\bfillText\s*\(|<text[\s>]/;

function entkommentieren(zeile) {
  // Zeilenkommentar abtrennen (// nicht in URLs), Blockkommentar-Reste unberücksichtigt
  const m = /(^|[\s;,{(])\/\/(?!\/)/.exec(zeile);
  return m ? { code: zeile.slice(0, m.index + m[1].length), kommentar: zeile.slice(m.index) } : { code: zeile, kommentar: '' };
}
function okMuster(zeile) {
  const m = /pp-ok\s*:\s*([\w ,-]+)/.exec(zeile);
  return m ? new Set(m[1].split(/[,\s]+/).filter(Boolean)) : new Set();
}

/** Zeile → { muster: Anzahl } (eine Zeile zählt je Muster höchstens einmal je Fundstelle-Gruppe). */
function zeileZaehlen(zeile, inKeyframesOderAus) {
  const { code } = entkommentieren(zeile);
  if (!code.trim() || /^\s*(\*|\/\*)/.test(code)) return null;
  const ok = okMuster(zeile);
  const r = {};
  let blur = 0;
  for (const m of code.matchAll(RE_SCHATTEN)) if (hatUnschaerfe(m[2])) blur++;
  for (const m of code.matchAll(RE_SCHEIN_ANDERS)) if (hatUnschaerfe(m[2])) blur++;
  if (RE_FILTER_BLUR.test(code) || (/\bfilter\b/.test(code) && RE_FILTER_IN_WERT.test(code))) blur++;
  if (blur && !ok.has('blur')) r.blur = blur;
  if (RE_VERLAUF.test(code) && inKeyframesOderAus && !ok.has('verlauf')) r.verlauf = (code.match(new RegExp(RE_VERLAUF.source, 'g')) || []).length;
  if (RE_DREHUNG.test(code) && !ok.has('drehung')) {
    // Vierteldrehungen (0/90/180/270 Grad als Zahlenliteral) sind verlustfrei und zaehlen nicht.
    let n = 0;
    for (const m of code.matchAll(new RegExp(RE_DREHUNG.source, 'g'))) {
      const rest = code.slice(m.index + m[0].length);
      const arg = /^\s*(-?\d*\.?\d+)\s*(deg|turn)?\s*\)/.exec(rest) || /^\s*(-?\d*\.?\d+)\s*(deg|turn)?\s*[;,'"`}]/.exec(rest);
      if (arg) { const grad = parseFloat(arg[1]) * (arg[2] === 'turn' ? 360 : 1); if (Math.abs(grad / 90 - Math.round(grad / 90)) < 1e-9) continue; }
      n++;
    }
    if (n) r.drehung = n;
  }
  if (RE_MISCH.test(code) && !ok.has('mischmodus')) r.mischmodus = 1;
  if (RE_SYSTEM.test(code) && !ok.has('systemglyphe')) r.systemglyphe = 1;
  return Object.keys(r).length ? r : null;
}

// ── Einheiten finden ──────────────────────────────────────────
function lesen(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function registryEinheiten(zeilen) {
  const start = zeilen.findIndex(l => l.startsWith('const ANIM_REGISTRY = {'));
  if (start < 0) return [];
  let ende = -1;
  for (let i = start + 1; i < zeilen.length; i++) if (zeilen[i] === '};') { ende = i; break; }
  const eintraege = [];
  for (let i = start + 1; i < ende; i++) { const m = /^  ([a-zA-Z_0-9]+): /.exec(zeilen[i]); if (m) eintraege.push({ id: 'reg:' + m[1], von: i, bis: ende - 1 }); }
  eintraege.forEach((e, k) => { if (k + 1 < eintraege.length) e.bis = eintraege[k + 1].von - 1; });
  return eintraege.map(e => Object.assign(e, { datei: 'public/app-board.jsx', art: 'reg' }));
}

function areaEinheiten(zeilen) {
  const kopf = [];
  zeilen.forEach((l, i) => { const m = /^(?:function ([A-Za-z0-9_]*Overlay)\(|const ([A-Za-z0-9_]*Overlay) = React\.memo\()/.exec(l); if (m) kopf.push({ id: 'area:' + (m[1] || m[2]), von: i }); });
  kopf.forEach((e, k) => {
    let bis = zeilen.length - 1;
    for (let i = e.von + 1; i < zeilen.length; i++) { if (/^(function|const|let|var|class) /.test(zeilen[i]) || /^\/\/ ═{10}/.test(zeilen[i])) { bis = i - 1; break; } }
    e.bis = bis; e.datei = 'public/app-areas.jsx'; e.art = 'area';
  });
  return kopf;
}

/** @keyframes-Blöcke (CSS-Datei oder JSX-Text): { name, von, bis } in Zeilen. */
function keyframesEinheiten(text, datei, praefix) {
  const out = [];
  const zeilen = text.split('\n');
  const offs = [0]; for (let k = 0; k < text.length; k++) if (text.charCodeAt(k) === 10) offs.push(k + 1);
  const zeileVon = (pos) => { let a = 0, b = offs.length - 1; while (a < b) { const m = (a + b + 1) >> 1; if (offs[m] <= pos) a = m; else b = m - 1; } return a; };
  for (const m of text.matchAll(/@(?:-webkit-)?keyframes\s+([\w${}.-]+)\s*\{/g)) {
    let d = 1, j = m.index + m[0].length;
    while (j < text.length && d > 0) { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++; }
    out.push({ id: praefix + m[1], von: zeileVon(m.index), bis: zeileVon(j - 1), datei, art: 'kf' });
  }
  return { zeilen, einheiten: out };
}

/** Alle Einheiten mit ihren Fundstellen. @returns {{ einheiten: Map<string,{counts:object, funde:object[]}> }} */
function sammeln() {
  const einheiten = new Map();
  const add = (e, zeilen, inKf) => {
    const aus = e.art === 'area' || e.art === 'reg' ? /data-pp-px="aus"/.test(zeilen.slice(e.von, e.bis + 1).join('\n')) : false;
    const counts = {}, funde = [];
    for (let i = e.von; i <= e.bis; i++) {
      const r = zeileZaehlen(zeilen[i], inKf || aus || e.art === 'area');
      if (!r) continue;
      for (const [k, v] of Object.entries(r)) { counts[k] = (counts[k] || 0) + v; funde.push({ zeile: i + 1, muster: k, text: zeilen[i].trim().slice(0, 140) }); }
    }
    if (einheiten.has(e.id)) {                                    // doppelte Namen (z. B. gleiche Keyframes in zwei Dateien): zusammenzählen
      const alt = einheiten.get(e.id);
      for (const [k, v] of Object.entries(counts)) alt.counts[k] = (alt.counts[k] || 0) + v;
      alt.funde.push(...funde.map(f => Object.assign({ datei: e.datei }, f)));
    } else einheiten.set(e.id, { counts, funde: funde.map(f => Object.assign({ datei: e.datei }, f)), datei: e.datei, aus });
  };
  const board = lesen('public/app-board.jsx').split('\n');
  for (const e of registryEinheiten(board)) add(e, board, false);
  const areas = lesen('public/app-areas.jsx').split('\n');
  for (const e of areaEinheiten(areas)) add(e, areas, false);
  for (const css of ['public/style.css', 'public/style-skilltest.css']) {
    const t = lesen(css);
    const { zeilen, einheiten: ks } = keyframesEinheiten(t, css, 'kf:');
    for (const e of ks) add(e, zeilen, true);
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'public')).filter(f => /^app-.*\.jsx$/.test(f))) {
    const t = lesen('public/' + f);
    const { zeilen, einheiten: ks } = keyframesEinheiten(t, 'public/' + f, 'jsxkf:' + f.replace(/\.jsx$/, '') + ':');
    // Keyframes in JSX stehen oft INNERHALB einer Registry-/Area-Einheit und zaehlen dort schon mit; hier nur die ausserhalb dieser Spannen.
    const belegt = new Set();
    if (f === 'app-board.jsx') for (const e of registryEinheiten(zeilen)) for (let i = e.von; i <= e.bis; i++) belegt.add(i);
    if (f === 'app-areas.jsx') for (const e of areaEinheiten(zeilen)) for (let i = e.von; i <= e.bis; i++) belegt.add(i);
    for (const e of ks) if (!belegt.has(e.von)) add(e, zeilen, true);
  }
  return einheiten;
}

function summe(einheiten) {
  const s = {}; for (const m of MUSTER) s[m] = 0;
  for (const u of einheiten.values()) for (const [k, v] of Object.entries(u.counts)) s[k] = (s[k] || 0) + v;
  return s;
}

/**
 * @param {{ einheiten?: Map, baseline?: object }} [o]
 * @returns {{ verstoesse: {id:string, muster:string, ist:number, bekannt:number}[], besser: number, einheiten: Map, ist: object }}
 */
function pruefe(o) {
  o = o || {};
  const einheiten = o.einheiten || sammeln();
  let baseline = o.baseline;
  if (!baseline) { try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch { baseline = {}; } }
  const verstoesse = []; let besser = 0;
  for (const [id, u] of einheiten) {
    const bekannt = baseline[id] || {};
    for (const [k, v] of Object.entries(u.counts)) {
      const b = bekannt[k] || 0;
      if (v > b) verstoesse.push({ id, muster: k, ist: v, bekannt: b });
      else if (v < b) besser += b - v;
    }
  }
  for (const [id, b] of Object.entries(baseline)) {                // Einheiten, die es nicht mehr gibt / ganz sauber sind
    const u = einheiten.get(id);
    for (const [k, v] of Object.entries(b)) if (!u || !(u.counts[k] > 0)) besser += v;
  }
  return { verstoesse, besser, einheiten, ist: baseline };
}

function baselineSchreiben(einheiten) {
  const out = {};
  for (const id of [...einheiten.keys()].sort()) {
    const c = einheiten.get(id).counts;
    if (Object.keys(c).length) out[id] = Object.fromEntries(Object.keys(c).sort().map(k => [k, c[k]]));
  }
  fs.writeFileSync(BASELINE, JSON.stringify(out, null, 1) + '\n', 'utf8');
  return out;
}

module.exports = { pruefe, sammeln, summe, zeileZaehlen, hatUnschaerfe, MUSTER, BASELINE };

if (require.main === module) {
  const args = process.argv.slice(2);
  const t0 = Date.now();
  const einheiten = sammeln();
  if (args.includes('--update')) {
    const b = baselineSchreiben(einheiten);
    const s = summe(einheiten);
    console.log(`[check-pixel-anim] Baseline gesetzt: ${Object.keys(b).length} Einheit(en) — ` + MUSTER.map(m => `${m} ${s[m] || 0}`).join(', ') + '.');
    process.exit(0);
  }
  const ui = args.indexOf('--unit');
  if (ui >= 0) {
    const u = einheiten.get(args[ui + 1]);
    if (!u) { console.error('Einheit nicht gefunden: ' + args[ui + 1]); process.exit(2); }
    console.log(`${args[ui + 1]}  (${u.datei})  ${JSON.stringify(u.counts)}${u.aus ? '  [data-pp-px="aus"]' : ''}`);
    for (const f of u.funde) console.log(`  ${f.datei}:${f.zeile}  [${f.muster}]  ${f.text}`);
    process.exit(0);
  }
  const r = pruefe({ einheiten });
  const s = summe(einheiten);
  if (args.includes('--all')) {
    console.log('Stand: ' + MUSTER.map(m => `${m} ${s[m] || 0}`).join(', ') + `  (${einheiten.size} Einheiten, ${Date.now() - t0} ms)`);
    const rang = [...einheiten.entries()].map(([id, u]) => [id, Object.values(u.counts).reduce((a, b) => a + b, 0), u.counts]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 30);
    for (const [id, n, c] of rang) console.log(`  ${String(n).padStart(4)}  ${id}  ${JSON.stringify(c)}`);
  }
  if (r.verstoesse.length) {
    console.error('[check-pixel-anim] NEUE Nicht-Pixelart-Muster in Animationen (gegen scripts/pixel-anim-baseline.json):');
    for (const v of r.verstoesse.slice(0, 60)) console.error(`   ${v.id}: ${v.muster} ${v.bekannt} -> ${v.ist}`);
    if (r.verstoesse.length > 60) console.error(`   … und ${r.verstoesse.length - 60} weitere`);
    console.error('   → Fundstellen: node scripts/check-pixel-anim.js --unit <Einheit>.  Pixelart statt Weichzeichner/Verlauf/Drehung bauen');
    console.error('     (cards/effects/CARD_API.md, Abschnitt „Welle 86 / W86z – Pixelart-Pipeline"), oder geprüfte Stelle mit  pp-ok: <muster>  markieren.');
    process.exit(1);
  }
  console.log('[check-pixel-anim] ok — ' + MUSTER.map(m => `${m} ${s[m] || 0}`).join(', ')
    + (r.besser ? `  (${r.besser} Fundstelle(n) unter der Baseline: mit --update festschreiben)` : '') + ` — ${Date.now() - t0} ms.`);
}
