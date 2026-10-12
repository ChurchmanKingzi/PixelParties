'use strict';
// A03-futuretech-09 · Future Tech Gun: Attack-Bonus rechnet nach einer Prototypes-Umbenennung nicht nach (Angriff trifft mit altem Wert)
//
// Kartentext Gun: „Increase the equipped Hero's Attack stat by 40 times the number of "Future Tech Gun" cards in your discard pile.“
// Kartentext Prototypes: „While this card is in your discard pile, you may once per turn change its name to that of any other card until the end of this turn.“
// Erwartung: Liegt 1 Gun in der Ablage, und Prototypes wird zu „Future Tech Gun“, zählen 2 Gun → ATK 40 + 80 = 120; ein Attack danach trifft mit 120.
// Beobachtet: `zaehleInAblage` liefert 2, aber `hero.atk` bleibt 80; der folgende Attack richtet nur 80 an. Der Bonus springt erst NACH der Aktion auf 120.
// Ursache: cards/effects/future-tech-gun.js:85-105 (`hooks`) rechnet nur an Hooks nach (onPlay, afterSpellResolved, onAnyActionResolved, onDiscard, onMill,
//   onCreatureDeath, onTurnStart). Prototypes' `onDiscardEffect` (future-tech-prototypes.js:119-155) und ein Alias-Ablauf lösen keinen davon aus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const PR = 'Future Tech Prototypes', GUN = 'Future Tech Gun';
  const t = await H.fresh({ hand: [['Attack'], []], discard: [[PR, GUN], []] });
  await t.play(0, GUN, { hero: 0 });                                                  // aus der Hand ausrüsten; 1 Gun bleibt in der Ablage → ATK 40 + 40 = 80
  await t.run(() => t.engine.runHooks('onTurnStart', { turn: t.gs.turn, activePlayer: 0 }));
  R.check('Ausgangslage ATK 80', t.hero(0, 0).atk === 80, t.hero(0, 0).atk);
  // Prototypes in der Ablage zu „Future Tech Gun“ machen (wie server.js doActivateDiscardEffect)
  t.gs.activePlayer = 0; t.gs.currentPhase = 2;
  const e = t.engine.getActivatableDiscardCards(0).find(x => x.cardName === PR);
  const inst = t.engine.cardInstances.find(c => c.id === e.instId);
  t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: GUN }), once: true });
  await t.run(() => H.loadCardEffect(PR).onDiscardEffect(t.engine, 0, inst));
  R.check('2 Gun zählen in der Ablage (1 echte + Prototypes)', require('../../../../cards/effects/_future-tech-shared.js').zaehleInAblage(t.gs, 0, GUN) === 2);
  R.check('Hero-ATK sofort 120 (40 + 2 × 40)', t.hero(0, 0).atk === 120, t.hero(0, 0).atk);
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const hp0 = t.hp(1, 0);
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Attack richtet 120 Schaden an', hp0 - t.hp(1, 0) === 120, { schaden: hp0 - t.hp(1, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
