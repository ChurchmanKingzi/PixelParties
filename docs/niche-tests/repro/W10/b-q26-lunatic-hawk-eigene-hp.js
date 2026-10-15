'use strict';
// W10b · Q26 (A04-cute-22) · Lunatic Hawk Stufe 3: der Hawk verdoppelt seine EIGENEN HP bei der eigenen Beschwörung nicht (Absicherung, keine Codeänderung)
//
// Kartentext: „3+: The current and max HP of all Creatures you summon are doubled."
// ENTSCHIEDEN (Al, Welle 10, Q26): „Nein, das sollte nicht direkt ihn selbst zählen." → andere beschworene Kreaturen werden verdoppelt (auch ein späterer
//   zweiter Hawk durch den ersten), der Hawk selbst bei seiner eigenen Beschwörung nicht.
// Aufbau: drei verschiedene Lunatic Cycles auf dem Brett (Stufe 3). Geprüft: (a) erster Hawk 100 HP; (b) zweiter Hawk (vom ersten verdoppelt) 200 HP;
//   (c) eine weitere Kreatur (Cute Bunny, 20 HP) wird auf 40 verdoppelt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const CYC = ['Lunatic Cycle - New Moon', 'Lunatic Cycle - Crescent Moon', 'Lunatic Cycle - Half Moon'];
  const t = await H.fresh({ hand: [['Lunatic Hawk', 'Lunatic Hawk', 'Cute Bunny'], []], deck: [Array(6).fill(H.INERT.creature), []] });
  CYC.forEach((c, i) => t.put(1, 2, i, c));
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
  await t.play(0, 'Lunatic Hawk', { hero: 0, noGrant: true, slot: 0 });
  const hp1 = t.inst(c => c.name === 'Lunatic Hawk' && c.zone === 'support')[0].counters.maxHp ?? 100;
  R.check('(a) erster Hawk: eigene Beschwörung verdoppelt nicht (100 HP)', hp1 === 100, hp1);
  await t.play(0, 'Cute Bunny', { hero: 0, noGrant: true, slot: 2 });
  const bunny = t.inst(c => c.name === 'Cute Bunny' && c.zone === 'support')[0];
  const bhp = bunny ? (bunny.counters.maxHp ?? null) : null;
  R.check('(c) Cute Bunny (20 HP) wird vom Hawk auf 40 verdoppelt', bhp === 40, bhp);
  await t.play(0, 'Lunatic Hawk', { hero: 0, noGrant: true, slot: 1 });
  const hawks = t.inst(c => c.name === 'Lunatic Hawk' && c.zone === 'support').sort((a, b) => a.zoneSlot - b.zoneSlot);
  const maxHp = hawks.map(h => h.counters.maxHp ?? 100);
  R.note('maxHp der beiden Hawks', maxHp);
  R.check('(a) erster Hawk bleibt bei 100', maxHp[0] === 100, maxHp);
  R.check('(b) zweiter Hawk wird vom ersten verdoppelt (200)', maxHp[1] === 200, maxHp);
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
