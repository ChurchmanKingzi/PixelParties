#!/usr/bin/env node
// Zufalls-Durchspieler: lädt campaign/dist/scenes/*.js, benutzt den ECHTEN Szenen-Interpreter aus
// public/app-campaign.jsx (Bedingungen, Sprünge, Auswahl), spielt viele zufällige Durchläufe und meldet:
//   · Abstürze in Szenen · Endlosschleifen · Sackgassen (nichts mehr anklickbar) · nie erreichte Szenen
//   · ob Tag 1 abgeschlossen wird und wie oft welches Tisch-Ende (ferry_table_*) vorkommt
//
//   node campaign/tools/sim.js [Durchläufe=300] [Seed=1] [--verbose]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RUNS = Number(process.argv[2]) || 300;
let SEED = Number(process.argv[3]) || 1;
const VERBOSE = process.argv.includes('--verbose');

// ── den echten Interpreter aus der Website-Engine ziehen ──
const jsx = fs.readFileSync(path.join(ROOT, '..', 'public', 'app-campaign.jsx'), 'utf8');
function grab(name) {
  const i = jsx.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('Engine-Funktion fehlt: ' + name);
  let j = jsx.indexOf('{', i), depth = 0;
  for (let k = j; k < jsx.length; k++) { if (jsx[k] === '{') depth++; else if (jsx[k] === '}') { depth--; if (!depth) return jsx.slice(i, k + 1); } }
  throw new Error('unbalanciert: ' + name);
}
const engineSrc = ['cmpTime', 'cmpFmtTime', 'cmpDaypart', 'cmpCond', 'cmpFindLabel', 'cmpMakeRunner', 'cmpTravelCost'].map(grab).join('\n');
const factory = new Function('window', 'cmpSfx', engineSrc + '\nreturn { cmpTime, cmpCond, cmpMakeRunner, cmpTravelCost };');
const E = factory({}, () => {});

// ── Zufall ──
let rngState = SEED;
const rnd = () => { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ── Story laden (wie cmpLoadStory) ──
function loadStory() {
  const story = { world: null, scenes: {}, errors: [] };
  const defineWorld = (def) => { const prev = story.world || {}; const d = def || {}; const m = Object.assign({}, prev, d); m.locations = Object.assign({}, prev.locations || {}, d.locations || {}); m.cast = Object.assign({}, prev.cast || {}, d.cast || {}); m.events = (prev.events || []).concat(d.events || []); story.world = m; };
  const defineScene = (id, def) => { if (story.scenes[id]) story.errors.push('doppelt: ' + id); story.scenes[id] = Object.assign({ id }, def); };
  const dir = path.join(ROOT, 'dist', 'scenes');
  for (const f of fs.readdirSync(dir).sort()) {
    try { new Function('world', 'scene', 'helpers', '"use strict";\n' + fs.readFileSync(path.join(dir, f), 'utf8'))(defineWorld, defineScene, {}); }
    catch (e) { story.errors.push(f + ': ' + e.message); }
  }
  return story;
}
const story = loadStory();
if (story.errors.length) { console.log('LADEFEHLER:\n' + story.errors.join('\n')); process.exit(1); }
const W = story.world;

// ── ein Durchlauf ──
const stats = { scenesSeen: new Map(), crashes: [], loops: 0, deadEnds: [], finished: 0, tableEnds: {}, hostPicked: 0, runs: 0, linesShown: 0, choicesMade: 0 };
function newState() {
  const st = W.start, known = [];
  for (const [id, l] of Object.entries(W.locations)) if (l.known) known.push(id);
  if (known.indexOf(st.location) < 0) known.push(st.location);
  return { v: 1, day: st.day, minutes: E.cmpTime(st.time, 480), location: st.location, flags: {}, vars: {}, items: {}, coins: st.coins || 0, known, locked: {}, visited: {}, scenesDone: {}, eventsDone: {}, duels: {}, collection: {}, deck: null };
}
async function playRun() {
  let s = newState(); let steps = 0, crashed = false, ended = false;
  const mutate = (fn) => { fn(s); };
  const io = {
    state: () => s, mutate, sleep: async () => {}, popup() {},
    say: async (l) => { stats.linesShown++; if (VERBOSE) console.log('   ' + (l.speaker || '·') + ': ' + String(l.text).slice(0, 90)); },
    choose: async (c) => { stats.choicesMade++; return Math.floor(rnd() * c.options.length); },
    addTime: (m) => { s.minutes += m; while (s.minutes >= 1440) { s.minutes -= 1440; s.day++; } },
    setBg() {}, clearActors() {}, enter() {}, exit() {}, move() {}, face() {}, dim() {}, music() {}, fx: async () => {}, revealCards: async () => {},
    applyReward: async (r) => { if (r.coins) s.coins += r.coins; for (const f of r.flags || []) s.flags[f] = true; },
    duel: async () => rnd() < 0.5, deckEdit: async () => {}, gameOver: async () => { ended = true; },
    playScene: (id, nested) => playScene(id, nested), goTo: async (id, cost) => travel(id, cost, true),
  };
  const runner = E.cmpMakeRunner(io);
  async function playScene(id, nested) {
    const sc = story.scenes[id];
    if (!sc) throw new Error('Szene fehlt: ' + id);
    if (sc.once && s.scenesDone[id]) return null;
    if (!E.cmpCond(s, sc.when)) return null;
    stats.scenesSeen.set(id, (stats.scenesSeen.get(id) || 0) + 1);
    let res = null;
    try { res = await runner.runSteps(sc.steps || []); }
    catch (e) { stats.crashes.push(`Szene ${id}: ${e.message}`); crashed = true; }
    s.scenesDone[id] = true;
    if (sc.time) io.addTime(sc.time);
    if (!nested) await afterScene();
    return res;
  }
  async function afterScene() {
    const de = W.dayEnd;
    if (de && s.minutes >= E.cmpTime(de.at, 1439)) {
      if (de.scene && story.scenes[de.scene]) await playScene(de.scene, true); else { s.day++; s.minutes = E.cmpTime(de.wake, 420); }
      if (de.location) s.location = de.location;
    }
    for (const ev of W.events || []) {
      if (!ev || !ev.scene) continue;
      if (ev.once !== false && s.eventsDone[ev.id || ev.scene]) continue;
      if (ev.at && ev.at !== s.location) continue;
      if (ev.day != null && ev.day !== s.day) continue;
      if (ev.from != null && s.minutes < E.cmpTime(ev.from)) continue;
      if (ev.to != null && s.minutes >= E.cmpTime(ev.to)) continue;
      if (!E.cmpCond(s, ev.when)) continue;
      s.eventsDone[ev.id || ev.scene] = true;
      await playScene(ev.scene, true);
      break;
    }
  }
  async function travel(id, cost, fromScene) {
    const loc = W.locations[id]; if (!loc) throw new Error('Ort fehlt: ' + id);
    const c = cost != null ? cost : E.cmpTravelCost(W, s, id);
    s.location = id; s.visited[id] = (s.visited[id] || 0) + 1; if (s.known.indexOf(id) < 0) s.known.push(id);
    io.addTime(c);
    if (!fromScene) await arrive();
  }
  async function arrive() {
    await afterScene();
    const loc = W.locations[s.location] || {};
    const arr = loc.onArrive;
    if (arr) for (const a of Array.isArray(arr) ? arr : [{ scene: arr }]) { if (!E.cmpCond(s, a.when)) continue; if (a.once !== false && s.scenesDone[a.scene]) continue; await playScene(a.scene, true); break; }
  }
  try {
    await arrive();
    while (!ended && !crashed && steps++ < 400 && s.day <= 1 + 1) {
      const loc = W.locations[s.location] || {};
      const opts = [];
      for (const o of loc.objects || []) if (E.cmpCond(s, o.when) && o.scene) opts.push(() => playScene(o.scene, false));
      for (const a of loc.actions || []) if (E.cmpCond(s, a.when)) opts.push(async () => { if (a.scene) await playScene(a.scene, false); });
      for (const [fid, fsc] of Object.entries(W.followers || {})) if (s.flags['follow_' + fid]) opts.push(() => playScene(fsc, false));
      for (const id of s.known) { const l = W.locations[id]; if (!l || id === s.location || s.locked[id] || !E.cmpCond(s, l.when)) continue; opts.push(() => travel(id, undefined, false)); }
      if (!opts.length) { stats.deadEnds.push(`Tag ${s.day} ${E.cmpTime ? '' : ''}${Math.floor(s.minutes / 60)}:${String(s.minutes % 60).padStart(2, '0')} @ ${s.location}`); break; }
      // Zeit voranschieben, wenn sich nichts bewegt, sonst läuft die Uhr nie weiter
      const before = s.minutes + s.day * 1440;
      await pick(opts)();
      if (s.minutes + s.day * 1440 === before) io.addTime(5);
      if (s.minutes >= 1440) io.addTime(0);
      await afterScene();
    }
    if (steps >= 400) stats.loops++;
    if (s.flags.day1_complete) stats.finished++;
    for (const k of ['ferry_table_won', 'ferry_table_lost', 'ferry_inya_won', 'ferry_inya_lost', 'ferry_table_denied', 'ferry_table_settled']) if (s.flags[k]) stats.tableEnds[k] = (stats.tableEnds[k] || 0) + 1;
    if (s.flags.table_resolved && !['ferry_table_won', 'ferry_table_lost', 'ferry_inya_won', 'ferry_inya_lost', 'ferry_table_denied', 'ferry_table_settled'].some(k => s.flags[k])) stats.tableEnds.default_or_sided = (stats.tableEnds.default_or_sided || 0) + 1;
    if (!s.flags.table_resolved && s.flags.arrived_dock) stats.tableEnds.UNRESOLVED_BUG = (stats.tableEnds.UNRESOLVED_BUG || 0) + 1;
  } catch (e) { stats.crashes.push('Lauf: ' + e.message + (VERBOSE ? '\n' + e.stack : '')); }
  stats.runs++;
}

(async () => {
  for (let r = 0; r < RUNS; r++) { rngState = (SEED * 7919 + r * 104729) >>> 0; await playRun(); }
  const all = Object.keys(story.scenes), never = all.filter(id => !stats.scenesSeen.has(id));
  console.log(`Läufe: ${stats.runs} · Tag 1 vollständig: ${stats.finished} · Endlos/Zeitlimit: ${stats.loops} · Sackgassen: ${stats.deadEnds.length} · Abstürze: ${stats.crashes.length}`);
  console.log(`Zeilen gezeigt: ${stats.linesShown} · Entscheidungen: ${stats.choicesMade} · Tisch-Enden: ${JSON.stringify(stats.tableEnds)}`);
  console.log(`Szenen erreicht: ${stats.scenesSeen.size}/${all.length}`);
  if (never.length) console.log('Nie erreicht: ' + never.join(', '));
  const uniq = (a) => [...new Set(a)].slice(0, 12);
  if (stats.crashes.length) console.log('Abstürze:\n  ' + uniq(stats.crashes).join('\n  '));
  if (stats.deadEnds.length) console.log('Sackgassen (Beispiele):\n  ' + uniq(stats.deadEnds).join('\n  '));
  process.exit(stats.crashes.length || stats.deadEnds.length ? 1 : 0);
})();
