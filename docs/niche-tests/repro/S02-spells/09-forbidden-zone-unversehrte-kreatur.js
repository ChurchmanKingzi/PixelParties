'use strict';
// S02-09 · Forbidden Zone negiert eine UNVERSEHRTE Gegnerkreatur nicht (Rückfall `currentHp ?? 0`)
// Kartentext: „Inflict 50 damage to all targets your opponent controls. Heroes hit by this Spell cannot perform an Action and Creatures have
//   their effects negated until the end of your opponent's turn. This counts as a negative status effect. Delete this card."
// Aufbau: Sitz 1 beschwört per echtem Spielweg „ZZ Dummy" (200 HP, `counters = {}` – noch kein currentHp-Zähler); eine zweite Gegnerkreatur ist
//   vorbeschädigt (currentHp 150). Sitz 0 spielt Forbidden Zone.
// Erwartet: beide Kreaturen nehmen 50 Schaden UND sind negiert.
// Beobachtet: die unversehrte Kreatur nimmt 50 Schaden (200 → 150), ist aber NICHT negiert; die vorbeschädigte ist negiert.
// Ursache: `cards/effects/forbidden-zone.js` Z. 127 `hpVorher.set(…, counters?.currentHp ?? 0)` und Z. 143 `hpJetzt = counters?.currentHp ?? 0`:
//   für eine nie getroffene Kreatur ist der Vorher-Wert 0, der Nachher-Wert 150 ⇒ `!(hpJetzt < hpVorher)` ⇒ „Schaden verpufft" ⇒ keine Negierung.
//   Gleiches Muster wie C05-01 (Wire Hatchling). Richtig wäre `?? cd.hp` (gedruckte HP) bzw. Vergleich gegen den Zustand vor dem Schlag.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Forbidden Zone'], [H.INERT.creature]] });
  await t.play(1, H.INERT.creature, { hero: 0 });                     // echte Beschwörung, counters = {}
  const fresh = t.find(H.INERT.creature, 'support');
  const hurt = t.put(1, 1, 0, H.INERT.creature); hurt.counters.currentHp = 150; hurt.counters.maxHp = 200;
  t.gs.activePlayer = 0;
  const r = await t.play(0, 'Forbidden Zone', { hero: 0 });
  t.say('gespielt:', r, '| unversehrte Kreatur HP', fresh.counters.currentHp, 'negiert', fresh.counters.negated, '| vorbeschädigte HP', hurt.counters.currentHp, 'negiert', hurt.counters.negated);
  R.check('Forbidden Zone gespielt', r === true, r);
  R.check('unversehrte Kreatur: 50 Schaden', fresh.counters.currentHp === 150, fresh.counters.currentHp);
  R.check('Kontrolle: vorbeschädigte Kreatur negiert', !!hurt.counters.negated);
  R.check('unversehrte Kreatur ist negiert', !!fresh.counters.negated, fresh.counters.negated);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
