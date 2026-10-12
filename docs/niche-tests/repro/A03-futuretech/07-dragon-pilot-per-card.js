'use strict';
// A03-futuretech-07 · Steam Dwarf Dragon Pilot: löst bei einem Abwurf von 3 Karten dreimal aus (je Karte statt je Vorgang)
//
// Kartentext: „Up to 3 times per turn, when you discard 1 or more cards from your hand, choose a target and deal 100 damage to it.“
// Konvention (CARD_API.md ~7486, „Ziehvorgang-Kennung“): Effekte mit „… 1 or more cards“ antworten je VORGANG genau einmal.
// Erwartung: Ein einziger Abwurf von 3 Handkarten (ein Vorgang) bietet EINEN Feuerball an (100 Schaden), zwei Auslöser bleiben für den Zug.
// Beobachtet: Drei Rückfragen, drei Feuerbälle (300 Schaden), alle drei Zugladungen sind mit einem Vorgang verbraucht.
// Ursache: cards/effects/steam-dwarf-dragon-pilot.js (`hooks.onDiscard`, Z. 311 ff.) hängt an `ON_DISCARD`, das die Engine je KARTE feuert
//   (_engine.js ~11447 `actionDiscardCardsAnimated`, ~16467 `actionPromptForceDiscard`); es gibt keine Vorgangs-Kennung wie bei `onDraw` (`_drawBatch`).
//   Die Steam-Engine-Passive (+50 HP) sind durch ihr HOPT je Instanz geschützt, der Pilot nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'Fireball', 'Fireball'], []] });
  const p = t.put(0, 0, 1, 'Steam Dwarf Dragon Pilot'); p.turnPlayed = 1;
  t.targetFn = (valid) => [valid.find(v => v.owner === 1).id];
  await t.run(() => t.engine.actionPromptForceDiscard(0, 3, { source: 'Test', selfInflicted: true }));      // EIN Abwurfvorgang, 3 Karten
  const fragen = t.prompts.filter(x => /fireball for/i.test(x.d.message || '')).length;
  R.check('ein Abwurf von 3 Karten = eine Rückfrage des Dragon Pilot', fragen === 1, { fragen });
  R.check('100 Schaden (nicht 300)', t.hp(1, 0) === 700, t.hp(1, 0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
