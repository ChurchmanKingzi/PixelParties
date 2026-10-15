'use strict';
// A05-skeletons-07 · Burning Fuse: (a) im eigenen Zug proaktiv spielbar, (b) Time Bomblebee ausgeschlossen (Regelfragen)
// Kartentext: „You may activate this card when your opponent enters their Action Phase. Activate the effects of all "Bomblebee" Creatures you
//   control that were not summoned this turn as if a target your opponent controls was defeated … Defeat all affected "Bomblebee" Creatures afterwards."
// ★ W10b (Al, Welle 10, Q29a/Q29b): (a) Antwort Ja – im eigenen Zug spielbar (Repro auf diese Regel umgestellt); (b) Antwort Ja, wird erfasst, erhält einen Counter und
//   wird wegen der eigenen Immunität nicht zerstört (Repro prüft den Counter; Details in W10/b-q29b).
// (a) Skript: `proactivePlay: true` + `inherentAction: true` → die Karte ist auch im eigenen Zug (Action Phase, gratis) spielbar.
//     Der Text kennt nur den Auslöser „Gegner betritt seine Action Phase".
// (b) Skript: `eligibleBomblebees` schließt „Time Bomblebee" aus (Kommentar: Counter würde mit dem Besiegen verloren gehen). Der Text sagt „all Bomblebee
//     Creatures"; eine Time Bomblebee mit Counter wäre zudem unbesiegbar („cannot … be defeated") – Fuse würde ihr dann einfach einen Counter schenken.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Burning Fuse'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const bee = t.put(0, 0, 0, 'Bomblebee'); bee.turnPlayed = 1;
  const time = t.put(0, 0, 1, 'Time Bomblebee'); time.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  const r = await t.play(0, 'Burning Fuse', { hero: 0, phase: 3 });
  R.note('(a) Burning Fuse im eigenen Zug gespielt (Text: nur wenn der Gegner seine Action Phase betritt)', { r, ablage: t.pile(0, 'discardPile') });
  R.check('(a) Al (Q29a): im eigenen Zug spielbar', r === true, r);
  R.check('(b) Wortlaut-Lesart: Time Bomblebee wird mit erfasst (erhält Counter)', (time.counters.bombCounters || 0) >= 1, time.counters);
  R.finish();
})();
