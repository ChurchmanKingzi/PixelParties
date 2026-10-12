'use strict';
// A05-skeletons-01 · Burning Fuse erfasst auch Bomblebees, die DIESEN Zug beschworen wurden
// Kartentext (Burning Fuse): „Activate the effects of all "Bomblebee" Creatures you control that were not summoned this turn
//   as if a target your opponent controls was defeated, even if their effects were already activated this turn. Defeat all
//   affected "Bomblebee" Creatures afterwards."
// Erwartung: Eine Bomblebee, die in diesem Zug beschworen wurde, wird weder ausgelöst noch besiegt.
// Beobachtet: Sie feuert (bypassHopt) und wird besiegt. Ursache: burning-fuse.js `eligibleBomblebees()` ruft
//   `findOwnBomblebees(engine, pi)` ohne `{ excludeSummonedThisTurn: true }` (der Kopfkommentar behauptet das Gegenteil).
// Hinweis: Auf dem reaktiven Weg (Gegner betritt Action Phase) fällt das kaum auf, weil die eigenen Bees dann aus einem früheren
//   Zug stammen; es greift auf dem proaktiven Weg (`proactivePlay`/`inherentAction`), der im eigenen Zug ohnehin vom Text abweicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Burning Fuse'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const alt = t.put(0, 0, 0, 'Bomblebee'); alt.turnPlayed = 1;
  const frisch = t.put(0, 0, 1, 'Dive Bomblebee'); frisch.turnPlayed = t.gs.turn;   // diesen Zug beschworen
  t.put(1, 0, 0, H.INERT.big); t.put(1, 1, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  await t.play(0, 'Burning Fuse', { hero: 0, phase: 3 });
  const z = t.gs.players[0].supportZones[0];
  R.check('alte Bomblebee wurde besiegt (Kontrolle: Fuse lief)', z[0].length === 0, z);
  R.check('diese Runde beschworene Dive Bomblebee bleibt unberührt', z[1].length === 1, z);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
