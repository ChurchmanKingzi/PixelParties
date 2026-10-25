'use strict';
// W71b-05 · Cool Rescuer Monia: HEILEN, WERTE (HP/Max-HP) und STATUS-ENTFERNEN auf Kreaturen öffnen das Fenster
//
// „affected by a card or effect" schließt wohltuende Effekte ein: Heilung (`actionHealCreature`, schon vorher), Max-HP-Gewinn (Life Serum), „Reduce HP to 1" (Phoenix Bombardment),
// HP-Tausch (Voodoo Curse) und das Heilen von Status (Beer, Juice, Cure …: `cleanseCreatureStatusesGefragt`). Vorher fragten die HP-/Max-HP-Schreiber und das Entfernen von Status nie.
// Aufruf: node docs/niche-tests/repro/W71/b-05-….js   (Exit 0 = korrekt; auf dem Stand vor W71b rot)
const S = require('../../lib/monia-sweep.js');
const { H } = S;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

const kreVon = (t, V) => t.engine.cardInstances.filter(c => c.zone === 'support' && (c.controller ?? c.owner) === V && c.name === 'ZZ Dummy Big');

const DEFS = [
  { name: 'Life Serum', hand: ['Life Serum'], ablage: 0, ziel: 'eigen', spiel: (t, W, h) => t.play(W, 'Life Serum', { hero: h }) },
  { name: 'Healing Potion', hand: ['Healing Potion'], ablage: 0, ziel: 'eigen', vorbereitung: async (t, W, V) => { for (const c of kreVon(t, V)) { c.counters.currentHp = 500; c.counters.maxHp = 1000; } }, spiel: (t, W, h) => t.play(W, 'Healing Potion', { hero: h }) },
  { name: 'Phoenix Bombardment', hand: ['Phoenix Bombardment'], ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Phoenix Bombardment', { hero: h }) },
  { name: 'Voodoo Curse', hand: ['Voodoo Curse'], ziel: 'gegner', vorbereitung: async (t, W, V) => { const k = kreVon(t, V); k[0].counters.currentHp = 400; k[0].counters.maxHp = 700; }, spiel: (t, W, h) => t.play(W, 'Voodoo Curse', { hero: h }) },
  { name: 'Beer', hand: ['Beer'], ziel: 'eigen', skript: [{ match: d => d && d.type === 'statusSelect', answer: () => ({ selectedStatuses: ['burned'] }) }], ablage: 1, vorbereitung: async (t, W, V) => { for (const c of kreVon(t, V)) { c.counters.burned = 1; c.counters.burnedAppliedBy = 0; } }, spiel: (t, W, h) => t.play(W, 'Beer', { hero: h }) },
];

(async () => {
  const R = H.runner();
  await S.tabelle(R, DEFS);
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
