'use strict';
// W72c-02 · Clone — Differenz-Sweep über ALLE Normal-Attacks und -Spells (cards.json)
//
// Für jede Karte: Welt A (ohne Clone) und Welt B (Clone beim Helden 0), gleicher Aufbau, gleiche Zielwahl. Gefordert:
//   • keine zusätzlichen Engine-Fehler / kein Hängen in Welt B,
//   • die KOPIE vermehrt die Karte nicht: Anzahl der Karte X in Welt B ≤ Welt A (die Kopie ist keine Karte),
//   • Zustandsprüfung sauber, keine Geister-Instanzen,
//   • (Hinweis) welche Karten angeboten/kopiert wurden und welche nicht — als Notiz.
const H = require('../../lib/h.js');
const fs = require('fs');
const cards = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '../../../../data/cards.json'), 'utf8'));
const KANDIDATEN = cards.filter(c => (c.cardType === 'Attack' || c.cardType === 'Spell') && c.subtype === 'Normal' && !c.banned);
process.env.CLONE_DEBUG = '1';
let _gruende = [];
const _w = process.stderr.write.bind(process.stderr);
process.stderr.write = (m, ...r) => { if (typeof m === 'string' && m.startsWith('[clone] ')) { _gruende.push(m.slice(8).trim()); return true; } return _w(m, ...r); };
const nurFilter = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;

async function welt(name, mitClone) {
  const t = await H.fresh({
    hand: [[name, 'ZZ Filler', 'ZZ Filler'], ['ZZ Filler', 'ZZ Filler']],
    discard: [['ZZ Dummy', 'ZZ Dummy Big', 'ZZ Filler'], ['ZZ Dummy']],
    deckSize: 12,
  });
  t.grantFor(0, 0, name);
  t.put(1, 0, 0, H.INERT.big); t.put(1, 1, 0, H.INERT.big); t.put(0, 1, 0, H.INERT.creature);
  if (mitClone) t.put(0, 0, 0, 'Clone');
  t.gs.players[0].heroes[0].atk = 100; t.gs.players[0].heroes[0].baseAtk = 100;
  let nachGuss = false;
  const rh = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (name, ...rest) => { if (name === 'afterSpellResolved') nachGuss = true; return rh(name, ...rest); };
  const vor = t.census();
  let r, fehler = null;
  try { r = await t.play(0, name, { hero: 0 }); } catch (e) { fehler = String(e && e.message || e); }
  const nach = t.census();
  return {
    t, r, fehler, vor, nach, get nachGuss() { return nachGuss; },
    angeboten: t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === 'Clone').length,
    errors: t.errors.slice(), hung: t.hung, audit: t.audit(),
    anz: (nach.get(name) || 0) - (vor.get(name) || 0),
  };
}

(async () => {
  const R = H.runner();
  R.section(`Sweep über ${KANDIDATEN.length} Normal-Attacks/-Spells`);
  let n = 0, kopiert = 0; const nichtAngeboten = [], schlecht = [];
  for (const c of KANDIDATEN) {
    if (nurFilter && !nurFilter.test(c.name)) continue;
    n++;
    let a, b;
    _gruende = [];
    try { a = await welt(c.name, false); b = await welt(c.name, true); }
    catch (e) { schlecht.push(`${c.name}: Aufbau warf ${e.message}`); continue; }
    const probleme = [];
    const neueErr = b.errors.filter(e => !a.errors.includes(e));
    if (neueErr.length) probleme.push('Fehler: ' + neueErr.join(' | ').slice(0, 300));
    if (b.hung && !a.hung) probleme.push('hängt in Welt B');
    if (b.fehler && !a.fehler) probleme.push('Ausnahme: ' + b.fehler);
    if (b.anz > a.anz) probleme.push(`Karte vermehrt: ${c.name} ${a.anz} → ${b.anz}`);
    const neuAudit = b.audit.filter(x => !a.audit.includes(x));
    if (neuAudit.length) probleme.push('Zustand: ' + neuAudit.join(' | ').slice(0, 300));
    if (b.angeboten > 0) kopiert++; else if (a.r === true) nichtAngeboten.push(`${c.name} [${_gruende.filter(g => !g.startsWith('afterSpellResolved')).join('/') || (a.nachGuss ? 'KEIN afterSpellResolved IN B (nur in A)' : 'auch ohne Clone kein afterSpellResolved (abgebrochen/verbraucht/negiert)')}]`);
    if (probleme.length) schlecht.push(`${c.name}: ${probleme.join(' ; ')}`);
  }
  R.check(`Sweep: ${n} Karten, ${schlecht.length} mit Auffälligkeit`, schlecht.length === 0, schlecht.slice(0, 40));
  R.note(`Kopie angeboten bei ${kopiert} Karten; nicht angeboten (gespielt, aber ohne Angebot): ${nichtAngeboten.length}: ${nichtAngeboten.join(', ')}`);
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
