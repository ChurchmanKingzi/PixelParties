'use strict';
// W75 · Darion: Sweep ueber ALLE Equipment-Artifacts. Jedes Equip X liegt zusammen mit Club of Gobbo (a) im Equip-Stapel von Darion, (b) getrennt bei einem normalen Helden.
// Danach wird Club of Gobbo (der Nachbar) zerstoert. Erwartet: Held-ATK/-Max-HP/-Status und die Zaehler des uebrigen Equips sind in beiden Aufbauten gleich (die Equip-Skripte erkennen
// „ich verlasse die Zone" an Held + Platz; im Stapel haben mehrere Equips dieselben Koordinaten — `runHooks` laesst beim Abgang nur die abgehende Karte selbst zuhoeren).
// Aufruf: node docs/niche-tests/repro/W75/a-07-darion-sweep-nachbar-equip-zerstoert.js   (Exit 0 = korrekt; ca. 2 Minuten)
// Sweep: jedes Equipment X im Stapel mit "Club of Gobbo" bei Darion vs. getrennt bei einem normalen Helden.
// Nach Zerstoeren des Clubs muessen X und der Held in beiden Faellen gleich aussehen.
const H = require('../../lib/h.js');
const cards = require('../../../../data/cards.json');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper';
const eqs = cards.filter(c => c.cardType === 'Artifact' && (c.subtype || '').toLowerCase() === 'equipment' && c.name !== 'Club of Gobbo').map(c => c.name);
const only = process.argv[2] ? process.argv[2].split(',') : null;
async function run(X, darion) {
  const t = await H.fresh({ active: 0, heroes: [[darion ? D : T, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [[X, 'Club of Gobbo'], [H.INERT.filler]], gold: 500, deckSize: 30 });
  t.gs.players[0].heroes[0].atk = 40; 
  const r1 = await t.play(0, X, { hero: 0 });
  const placedX = t.inst(c => c.name === X && c.zone === 'support' && c.owner === 0)[0];
  if (!placedX) return { skip: 'X nicht gelegt' + JSON.stringify(r1) };
  const r2 = await t.play(0, 'Club of Gobbo', { hero: darion ? 0 : 0, slot: 2 });
  const club = t.inst(c => c.name === 'Club of Gobbo' && c.zone === 'support' && c.owner === 0)[0];
  if (!club) return { skip: 'Club nicht gelegt' };
  const together = placedX.zoneSlot === club.zoneSlot;
  const snap = () => ({ atk: t.gs.players[0].heroes[0].atk, mhp: t.gs.players[0].heroes[0].maxHp, st: Object.keys(t.gs.players[0].heroes[0].statuses || {}).sort().join(), x: JSON.stringify(placedX.counters || {}), n: t.errors.length });
  const before = snap();
  await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, club));
  const after = snap();
  return { together, before, after, zone: placedX.zone, errors: t.errors.slice(0, 2), audit: t.audit().slice(0, 2) };
}
(async () => {
  const R = H.runner();
  const out = [];
  for (const X of eqs) {
    if (only && !only.includes(X)) continue;
    let a, b;
    try { a = await run(X, true); b = await run(X, false); } catch (e) { out.push(`${X}: THREW ${e.message.slice(0, 100)}`); continue; }
    if (a.skip || b.skip) { out.push(`${X}: skip (${a.skip || ''} | ${b.skip || ''})`); continue; }
    const diffs = [];
    if (!a.together) diffs.push('nicht im selben Platz');
    for (const k of ['atk', 'mhp', 'st']) if (a.after[k] !== b.after[k]) diffs.push(`${k}: Darion ${a.after[k]} vs getrennt ${b.after[k]}`);
    if (a.after.x !== b.after.x) diffs.push(`counters X: ${a.after.x} vs ${b.after.x}`);
    if (a.errors.length || a.audit.length) diffs.push('fehler/audit ' + JSON.stringify([a.errors, a.audit]));
    out.push(`${X}: ${diffs.length ? 'ABWEICHUNG ' + diffs.join(' | ') : 'ok'}`);
  }
  const bad = out.filter(l => /ABWEICHUNG|THREW/.test(l));
  const ok = out.filter(l => /: ok$/.test(l)).length;
  R.check(`${ok} Equips ohne Abweichung (uebersprungen: ${out.filter(l => /skip/.test(l)).length})`, bad.length === 0, bad);
  R.finish();
})();
