'use strict';
// S01-26 · Divine Gift of Sacrifice: wird der Zauber negiert, entfällt das Opfer („to play this card")
// Kartentext: „Sacrifice a Hero originally controlled by you to play this card. Choose another Hero you control and increase its current and max HP by the max HP of the sacrificed Hero."
// Lesart A (Kosten): „to play this card" nennt das Opfer als KOSTEN des Ausspielens – es ist beim Verlassen der Hand fällig, auch wenn ein Gegenzug den Zauber danach negiert (vgl. Ruling v1031 bei den Divine Gifts: „… unabhängig davon, ob ein Gegenzug sie später negiert").
// Lesart B (Skript): Opfer und Wahl liegen im `onPlay` (divine-gift-of-sacrifice.js `doSacrifice`); ein negierter Zauber führt `onPlay` nie aus ⇒ kein Opfer.
// Aufbau: Sitz 0 spielt Divine Gift of Sacrifice, Sitz 1 antwortet mit Silence (negiert).
// Beobachtet: Lesart B (alle Helden unversehrt, keine Opferwahl geöffnet, Silence verbraucht).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of Sacrifice'], ['Silence']], abilities: { 0: { 0: [['Decay Magic'], [], []] } } });
  t.grantFor(1, 0, 'Silence'); t.policy.confirm = true;
  t.targetFn = (v) => [v[0].id];
  await t.play(0, 'Divine Gift of Sacrifice', { hero: 0 });
  R.check('Silence hat den Zauber negiert (Silence nicht mehr auf der Hand)', !t.pile(1, 'hand').includes('Silence'));
  const gefallen = t.gs.players[0].heroes.filter(h => h.hp <= 0).length;
  R.check('Lesart A: das Opfer ist bezahlt, ein Held ist gefallen', gefallen === 1, { gefallen, hp: t.gs.players[0].heroes.map(h => h.hp) });
  R.finish();
})();
