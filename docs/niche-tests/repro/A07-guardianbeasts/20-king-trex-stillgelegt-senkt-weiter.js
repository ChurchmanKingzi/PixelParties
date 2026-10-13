'use strict';
// A07-20 · King Trex: die Stufensenkung („levels … reduced to 0") gilt weiter, wenn Trex negiert/eingefroren/betäubt ist
//
// Kartentext King Trex: „… While you control this Creature, the levels of all "Gigantisaur" Creatures in your hand are reduced to 0."
// Konvention (B-querschnitt.md B-01…B-03 / `engine.isCreatureEffectSuppressed`): eine negierte/gefrorene/betäubte Kreatur verliert ihre
//   Dauereffekte; B-03 nennt dieselbe Klasse für `reduceCardLevel`-Kreaturen (Elven Forager).
// Erwartung: Ist King Trex stillgelegt, ist Gigantisaur Spinor (Lv 3, Summoning Magic) für einen Helden ohne Schule nicht spielbar.
// Beobachtet: Trex stempelt die Senkung einmalig in `hero.levelOverrideCards` (`_applyOverrides`, onPlay/onTurnStart); nur das Verlassen
//   des Bretts räumt auf (`onCardLeaveZone`). Negation/Frost/Betäubung/Clown-Aura ändern nichts – der Held spielt Spinor weiter ohne Stufe.
// Vermutete Ursache: `gigantisaur-king-trex.js` (`_applyOverrides` ohne Gegenstück bei Stilllegung; Stempel statt Abfrage).
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  const cd = H.DB['Gigantisaur Spinor'];
  for (const how of ['none', 'negiert', 'eingefroren', 'betäubt', 'Creepy-Clown-Aura']) {
    const t = await H.fresh({ hand: [['Gigantisaur Spinor'], []], deckSize: 10 });
    const trex = t.put(0, 0, 0, 'Gigantisaur King Trex'); trex.turnPlayed = 1;
    await t.engine.runHooks('onPlay', { _onlyCard: trex, playedCard: trex, zone: 'support', cardZone: 'support' });
    if (how === 'negiert') await t.engine.actionNegateCreature(trex, 'Test');
    else if (how === 'eingefroren') await t.engine.applyCreatureStatus(trex, 'frozen', { sourceOwner: 1 });
    else if (how === 'betäubt') await t.engine.applyCreatureStatus(trex, 'stunned', { sourceOwner: 1 });
    else if (how === 'Creepy-Clown-Aura') t.put(1, 0, 0, 'The Creepy Clown of Heaven');
    const stillgelegt = t.engine.isCreatureEffectSuppressed(trex);
    const spielbar = t.engine.heroMeetsLevelReq(0, 1, cd);          // Held 1 hat keine Schule
    if (how === 'none') R.check('Kontrolle: arbeitender Trex ⇒ Spinor ohne Stufe spielbar', spielbar === true && !stillgelegt, { spielbar, stillgelegt });
    else R.check(`Trex ${how} (stillgelegt=${stillgelegt}) ⇒ Spinor ohne Stufe NICHT spielbar`, stillgelegt && spielbar === false, { spielbar, stillgelegt });
  }
  R.finish();
})();
