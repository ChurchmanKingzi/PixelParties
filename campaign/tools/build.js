#!/usr/bin/env node
// Baut die Kampagne: campaign/src/**/*.pps  ->  campaign/dist/scenes/*.js (+ dist/decks/*.txt)
// und prüft dabei alles, was sich ohne Spielen prüfen lässt.
//
//   node campaign/tools/build.js              bauen + prüfen
//   node campaign/tools/build.js --check      nur prüfen, nichts schreiben
//   node campaign/tools/build.js --deploy DIR kopiert dist/{scenes,decks} nach DIR/{scenes,decks}
//                                             (z. B. public/campaign — ersetzt dort die Prototyp-Szenen!)
//
// Quellen: campaign/src/*.pps (Szenen, Orte, Ereignisse), src/world.json, src/names.json, src/aliases.json
// Kanon:   campaign/bible/ (aus dem alten KI-Artefakt)   Spoiler: campaign/spoilers/
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./pps');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const DEPLOY = args.includes('--deploy') ? args[args.indexOf('--deploy') + 1] : null;

const readJson = (rel, dflt) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch (e) { if (dflt !== undefined) return dflt; throw e; } };
const walk = (d, ext, acc = []) => { if (!fs.existsSync(d)) return acc; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, ext, acc); else if (p.endsWith(ext)) acc.push(p); } return acc.sort(); };

const errors = [], warnings = [];
const warn = (m) => warnings.push(m);
const fail = (m) => errors.push(m);

// ── Kanon laden ──
const castIds = new Set(fs.readdirSync(path.join(ROOT, 'bible/cast')).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => f.slice(0, -5)));
const castData = Object.fromEntries([...castIds].map(id => [id, readJson(`bible/cast/${id}.json`)]));
const placeIds = new Set(fs.readdirSync(path.join(ROOT, 'bible/places')).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => f.slice(0, -5)));
const placeData = Object.fromEntries([...placeIds].map(id => [id, readJson(`bible/places/${id}.json`)]));
const deckIds = new Set(fs.readdirSync(path.join(ROOT, 'bible/decks')).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => f.slice(0, -5)));
const names = readJson('src/names.json', {});
const aliases = readJson('src/aliases.json', {});
const worldCfg = readJson('src/world.json', { start: { location: 'ferry_deck', day: 1, time: '08:00', deck: 'rowan' } });
const pool = readJson('spoilers/host-pool.json');
const EXTRA_SPEAKERS = new Set(['rowan']);
const startDeck = worldCfg.start.deck;

// ── Umgebung für den Compiler ──
const allCtx = new Map();
const env = {
  pool: pool.pool, pron: pool.pronouns, words: 0, decks: new Set(), warn,
  alias: (id) => aliases[id] || '???',
  ctxFor: (id) => { const c = { cast: new Set(), places: new Set(), bgs: new Set(), reads: new Set(), sets: new Set(), sceneRefs: new Set(), duels: new Set(), hostCond: false, pickhost: false }; allCtx.set(id, c); return c; },
  pickHostSrc: () => `(s)=>{ if (s.vars.host) return; const pool=${JSON.stringify(pool.pool)}, anchor=${JSON.stringify(pool.anchor)}, prior=${JSON.stringify(pool.prior)}, room=${JSON.stringify(pool.roommates)};
    let fit=pool.filter(id=>!s.flags['unfit_'+id]); if(!fit.length) fit=[anchor];
    const w=fit.map(id=>prior[id]*(1+Math.max(0,s.vars['aff_'+id]||0)/20+(room.includes(id)?1.5:0)+(s.flags['seen_'+id]?1:0)));
    if (s.vars.host_roll==null) s.vars.host_roll=Math.random();
    let t=s.vars.host_roll*w.reduce((a,b)=>a+b,0), pick=fit[fit.length-1];
    for (let i=0;i<fit.length;i++){ t-=w[i]; if(t<0){ pick=fit[i]; break; } }
    s.vars.host=pick; }`
};

// ── Quellen einlesen ──
env.decks.add(startDeck);
const sceneDefs = [];       // {head, steps, file}
const placeOv = {};         // ort -> Überschreibungen
const events = [];
const srcFiles = walk(path.join(ROOT, 'src'), '.pps');

function parsePlaceProps(node, file) {
  const o = placeOv[node.id] || (placeOv[node.id] = { objects: [], actions: [] });
  for (const c of node.children) {
    const [main, when] = P.splitWhen(c.text);
    const sp = main.indexOf(' '), key = sp < 0 ? main : main.slice(0, sp), rest = sp < 0 ? '' : main.slice(sp + 1).trim();
    const kv = P.parseKV(rest);
    const ctx = allCtx.get('@world') || env.ctxFor('@world');
    const wcond = when ? P.condToJs(when, ctx) : undefined;
    switch (key) {
      case 'travel': o.travel = Number(rest); break;
      case 'travelFrom': o.travelFrom = Object.fromEntries(rest.split(/\s+/).map(x => x.split('=')).map(([k, v]) => [k, Number(v)])); break;
      case 'known': o.known = true; break;
      case 'lockedText': o.lockedText = rest.replace(/^"|"$/g, ''); break;
      case 'closedText': o.closedText = rest.replace(/^"|"$/g, ''); break;
      case 'when': o.when = P.condToJs(rest, ctx); break;
      case 'onArrive': o.onArrive = (o.onArrive || []).concat([{ scene: kv.pos[0], once: !kv.flags.has('repeat'), when: wcond }]); ctx.sceneRefs.add(kv.pos[0]); break;
      case 'object': o.objects.push({ id: kv.pos[0], sprite: kv.kv.sprite, x: kv.kv.x && Number(kv.kv.x), y: kv.kv.y && Number(kv.kv.y), h: kv.kv.h && Number(kv.kv.h), label: kv.kv.label, scene: kv.kv.scene, flip: kv.flags.has('flip') || undefined, alert: kv.kv.alert ? P.condToJs(kv.kv.alert, ctx) : (kv.flags.has('alert') || undefined), when: wcond }); if (kv.kv.scene) ctx.sceneRefs.add(kv.kv.scene); break;
      case 'action': o.actions.push({ id: kv.pos[0], label: kv.pos[1], scene: kv.kv.scene, text: kv.kv.text, flag: kv.kv.flag, time: kv.kv.time && Number(kv.kv.time), when: wcond }); if (kv.kv.scene) ctx.sceneRefs.add(kv.kv.scene); break;
      default: fail(`${file}:${c.line}: @place ${node.id}: unbekannte Eigenschaft "${key}"`);
    }
  }
}

for (const f of srcFiles) {
  const rel = path.relative(ROOT, f);
  try {
    const L = readLines(f);
    let i = 0;
    while (i < L.length) {
      const l = L[i];
      if (l.ind !== 0) throw new Error(`${rel}:${l.line}: Zeile außerhalb von @scene/@place/@event`);
      let j = i + 1; while (j < L.length && L[j].ind > 0) j++;
      const chunk = L.slice(i + 1, j).map(x => ({ ...x, ind: x.ind - 1 }));
      if (l.text.startsWith('@scene ')) {
        const head = P.parseSceneHead(l.text);
        const [nodes] = P.parseBlock(chunk, 0, 0);
        const steps = P.compileScene(head, nodes, env);
        if (head.when) head.whenJs = P.condToJs(head.when, allCtx.get(head.id));
        sceneDefs.push({ head, steps, file: rel });
      } else if (l.text.startsWith('@place ')) {
        parsePlaceProps({ id: l.text.slice(7).trim(), children: chunk }, rel);
      } else if (l.text.startsWith('@event ')) {
        const [main, when] = P.splitWhen(l.text.slice(7)); const kv = P.parseKV(main);
        const ctx = env.ctxFor('@event:' + kv.pos[0]);
        events.push({ id: kv.pos[0], scene: kv.kv.scene, at: kv.kv.at, day: kv.kv.day && Number(kv.kv.day), from: kv.kv.from, to: kv.kv.to, once: !kv.flags.has('repeat'), when: when ? P.condToJs(when, ctx) : undefined });
        if (kv.kv.at) ctx.places.add(kv.kv.at); ctx.sceneRefs.add(kv.kv.scene);
      } else throw new Error(`${rel}:${l.line}: unbekannte Deklaration "${l.text.slice(0, 30)}"`);
      i = j;
    }
  } catch (e) { fail(e.message); }
}
function readLines(f) { return P.readLines(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f)); }

// ── Prüfungen ──
const sceneIds = new Map();
for (const s of sceneDefs) { if (sceneIds.has(s.head.id)) fail(`Szene "${s.head.id}" doppelt definiert (${sceneIds.get(s.head.id)} und ${s.file})`); sceneIds.set(s.head.id, s.file); }
const referencedScenes = new Set(); if (worldCfg.dayEnd && worldCfg.dayEnd.scene) referencedScenes.add(worldCfg.dayEnd.scene); const setFlags = new Set(); const readFlags = new Map(); const unfitSetters = new Map();
for (const [id, c] of allCtx) {
  for (const r of c.sceneRefs) { referencedScenes.add(r); if (!sceneIds.has(r)) fail(`${id}: verweist auf unbekannte Szene "${r}"`); }
  for (const p of c.places) if (!placeIds.has(p)) fail(`${id}: unbekannter Ort "${p}"`);
  for (const p of c.bgs) if (!placeData[p] && !/^[a-z0-9_]+$/.test(p)) fail(`${id}: Hintergrund "${p}" ungültig`);
  for (const p of c.cast) if (!castIds.has(p) && !EXTRA_SPEAKERS.has(p)) fail(`${id}: unbekannte Figur "${p}"`);
  for (const f of c.sets) { setFlags.add(f); const m = f.match(/^unfit_(\w+)$/); if (m) { (unfitSetters.get(id) || unfitSetters.set(id, new Set()).get(id)).add(m[1]); } }
  for (const f of c.reads) if (!readFlags.has(f)) readFlags.set(f, id);
  for (const d of c.duels) { /* Duell-Ids sind frei */ }
}
for (const s of sceneDefs) { // @flag unfit_* werden über steps erfasst
  const walkSteps = (list) => { for (const st of list) { if (st.flag && /^unfit_/.test(st.flag)) (unfitSetters.get(s.head.id) || unfitSetters.set(s.head.id, new Set()).get(s.head.id)).add(st.flag.slice(5)); if (st.onWin) walkSteps(st.onWin); if (st.onLose) walkSteps(st.onLose); } };
  walkSteps(s.steps);
}
for (const [sc, set] of unfitSetters) {
  if (set.has(pool.anchor)) fail(`Szene ${sc}: setzt unfit_${pool.anchor} — der Anker darf nie verhindert werden`);
  if (pool.pool.every(p => set.has(p))) fail(`Szene ${sc}: sperrt alle Host-Kandidaten gleichzeitig`);
}
for (const s of sceneDefs) {
  const c = allCtx.get(s.head.id);
  if (c.hostCond && !s.head.host) fail(`Szene ${s.head.id}: Host-Bedingung ohne Kopfwort host`);
  if (c.pickhost && s.head.day != null) { /* reserviert */ }
  if (!referencedScenes.has(s.head.id) && !s.head.entry && !/^(talk_|entry_)/.test(s.head.id)) warn(`Szene ${s.head.id} (${s.file}) wird von nirgends aufgerufen`);
}
for (const [f, where] of readFlags) {
  if (setFlags.has(f) || /^met_|^host_decided$|^unfit_|^seen_/.test(f)) continue;
  const dueToDuel = false;
  warn(`Flag "${f}" wird gelesen (${where}), aber nirgends gesetzt`);
}
for (const e of events) if (!sceneIds.has(e.scene)) fail(`Ereignis ${e.id}: unbekannte Szene "${e.scene}"`);
for (const d of env.decks) if (!deckIds.has(d)) fail(`Duell-Deck "${d}" fehlt in bible/decks`);

// ── Welt erzeugen ──
const palette = ['#ffe14d', '#c98b5a', '#b08b3a', '#7ee081', '#c58bff', '#6cc0ff', '#ff8fa3', '#8fe3d6', '#f2a65a', '#a9b4ff'];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const cast = { rowan: { name: 'Rowan', portrait: null, color: '#00f0ff' } };
for (const id of castIds) { const c = castData[id]; cast[id] = { name: names[id] || c.firstName || c.name, portrait: id, sprite: id, color: palette[hash(id) % palette.length] }; }
const locations = {};
for (const id of placeIds) {
  const p = placeData[id], ov = placeOv[id] || { objects: [], actions: [] };
  locations[id] = { name: p.name, background: p.bg, known: ov.known || (id === worldCfg.start.location) || undefined, travel: ov.travel, travelFrom: ov.travelFrom, lockedText: ov.lockedText, closedText: ov.closedText, when: ov.when, onArrive: ov.onArrive && ov.onArrive.length ? ov.onArrive : undefined, objects: ov.objects.length ? ov.objects : undefined, actions: ov.actions.length ? ov.actions : undefined };
}
for (const id of Object.keys(placeOv)) if (!placeIds.has(id)) fail(`@place ${id}: Ort fehlt in bible/places`);
const dayEnd = worldCfg.dayEnd;
const world = { title: 'Pixel Academy', assets: { spriteUnit: 10, avatarUnit: 10 }, start: worldCfg.start, music: worldCfg.music || 'menu', defaultTravel: worldCfg.defaultTravel != null ? worldCfg.defaultTravel : 8, dayEnd, cast, locations, events };

// ── Ausgabe ──
const header = (src) => `// GENERIERT von campaign/tools/build.js aus ${src} — nicht von Hand ändern.\n`;
const files = [];
files.push({ name: 'scenes/00-world.js', body: header('campaign/src/*.pps, bible/, src/world.json') + `world(${P.ser(world)});\n` });
const byFile = new Map();
for (const s of sceneDefs) (byFile.get(s.file) || byFile.set(s.file, []).get(s.file)).push(s);
let idx = 10;
for (const [file, list] of byFile) {
  const base = path.basename(file, '.pps');
  const body = header(file) + list.map(s => {
    const def = { once: s.head.once || undefined, when: s.head.whenJs, background: s.head.bg, music: s.head.music, time: s.head.time, steps: s.steps };
    return `scene(${JSON.stringify(s.head.id)}, ${P.ser(def)});\n`;
  }).join('\n');
  files.push({ name: `scenes/${String(idx).padStart(2, '0')}-${base}.js`, body }); idx += 1;
}
for (const d of env.decks) {
  const D = readJson(`bible/decks/${d}.json`);
  const list = (a) => (a || []).map(([n, c]) => `${n}x ${c}`).join('\n');
  files.push({ name: `decks/${d}.txt`, body: `=== PIXEL PARTIES DECK ===\nName: ${D.name}\nCover: ${D.heroes[0]}\n\n== HEROES ==\n${D.heroes.join('\n')}\n\n== MAIN DECK ==\n${list(D.main)}\n\n== POTION DECK ==\n${list(D.potions)}\n\n== SIDE DECK ==\n` });
}

const nScenes = sceneDefs.length, nSteps = sceneDefs.reduce((a, s) => a + s.steps.length, 0);
console.log(`Szenen: ${nScenes} · Schritte: ${nSteps} · Wörter (Rede/Erzählung/Optionen): ${env.words} · Ereignisse: ${events.length} · Orte mit Zusätzen: ${Object.keys(placeOv).length}`);
for (const w of warnings) console.log('  warn  ' + w);
for (const e of errors) console.log('  FEHLER ' + e);
if (errors.length) { console.log(`\n${errors.length} Fehler — nichts geschrieben.`); process.exit(1); }
if (CHECK) { console.log('Prüfung ok.'); process.exit(0); }

const out = path.join(ROOT, 'dist');
fs.rmSync(out, { recursive: true, force: true });
for (const f of files) { const p = path.join(out, f.name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.body, { encoding: 'utf8' }); }
console.log(`dist/: ${files.length} Dateien geschrieben.`);
if (DEPLOY) {
  for (const f of files) { const p = path.join(DEPLOY, f.name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.body, { encoding: 'utf8' }); }
  console.log('Deployt nach ' + DEPLOY);
}
