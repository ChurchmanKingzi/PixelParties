'use strict';
// A01-pollution-28 · Reincarnation: „You can only revive a Hero with Reincarnation once per game“ – je HELD oder je SPIELER? (Regelfrage)
// Kartentext: „… Choose a defeated Hero and revive it, fully healing its HP, OR choose a level 4 or lower Creature … You can only revive a Hero with „Reincarnation“ once per game.“
// Skript (reincarnation.js Kopf): „Each Hero can be revived by Reincarnation AT MOST ONCE per game (tracked with an individual `hero.reincarnationRevived` flag)“.
// Wörtlich lässt sich „a Hero … once per game“ auch als Spielerlimit lesen (vgl. Eraser Beam: „You can only play 1 … per game“): ein Held-Wiederbeleben mit Reincarnation je Spiel.
// Aufbau: Sitz 0 hat zwei gefallene Helden (Held 1, Held 2) und zwei Reincarnation auf der Hand.
// Beobachtet: die erste Reincarnation belebt Held 1 wieder, die zweite (im selben Spiel, anderer Held) belebt Held 2 wieder – beide laufen durch (Flags je Held).
// Aufruf: node docs/niche-tests/repro/A01-pollution/28-reincarnation-einmal-pro-spiel-je-held-oder-je-spieler.js   (✗ = zweite Wiederbelebung geht durch; Lesart „je Spieler“ erwartet ✗)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Reincarnation', 'Reincarnation'], []] });
  t.hero(0, 1).hp = 0; t.hero(0, 2).hp = 0;
  t.targetFn = (v) => [v[0].id];
  t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Reincarnation', answer: () => ({ optionId: 'revive' }) });
  await t.play(0, 'Reincarnation', { hero: 0 });
  R.check('erste Reincarnation belebt einen Helden wieder', t.gs.players[0].heroes.filter(h => h.hp > 0).length === 2, t.gs.players[0].heroes.map(h => h.hp));
  await t.play(0, 'Reincarnation', { hero: 0 });
  R.check('zweite Reincarnation (anderer Held) belebt keinen weiteren Helden wieder – Lesart „je Spieler“', t.gs.players[0].heroes.filter(h => h.hp > 0).length === 2, t.gs.players[0].heroes.map(h => h.hp));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
