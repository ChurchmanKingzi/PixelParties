'use strict';
// A04-cute-22 (C) · Lunatic Hawk, Stufe 3: Hawk verdoppelt seine EIGENEN HP bei der Beschwörung nicht (ein zweiter Hawk dagegen schon)
//
// Kartentext (Lunatic Hawk): "This Creature gains the following effects depending on the number of different 'Lunatic Cycle' cards on the board: …
//   3+: The current and max HP of all Creatures you summon are doubled."
// Beobachtet (3 verschiedene Cycles auf dem Brett): der erste Hawk bleibt bei 100 HP (`onCardEnterZone` ignoriert den eigenen Eintritt: "ignore our own entry"),
//   ein später beschworener zweiter Hawk wird vom ersten auf 200 verdoppelt; eine Cute Bunny (20) → 40 ✓.
// Frage an Al: Soll Hawk bei der eigenen Beschwörung (Stufe 3 liegt schon) selbst verdoppelt werden – ja oder nein?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const CYC = ['Lunatic Cycle - New Moon', 'Lunatic Cycle - Crescent Moon', 'Lunatic Cycle - Half Moon'];
  const t = await H.fresh({ hand: [['Lunatic Hawk', 'Lunatic Hawk'], []], deck: [Array(6).fill(H.INERT.creature), []] });
  CYC.forEach((c, i) => t.put(1, 2, i, c));
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
  await t.play(0, 'Lunatic Hawk', { hero: 0, noGrant: true, slot: 0 });
  await t.play(0, 'Lunatic Hawk', { hero: 0, noGrant: true, slot: 1 });
  const hawks = t.inst(c => c.name === 'Lunatic Hawk' && c.zone === 'support').sort((a, b) => a.zoneSlot - b.zoneSlot);
  const maxHp = hawks.map(h => h.counters.maxHp ?? 100);
  R.note('maxHp der beiden Hawks (erster, zweiter)', maxHp);
  R.check('beide Hawks haben gleich viele HP', maxHp[0] === maxHp[1], maxHp);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
