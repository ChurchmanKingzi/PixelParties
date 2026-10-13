'use strict';
// A03-futuretech-21 · Future Tech Barrage: Abbruch der Zielwahl verbraucht die Rundensperre „1 pro Zug"
//
// Kartentext: „Choose a target and deal 180 damage to it. Trigger this effect as many times as … You can only play 1 "Future Tech Barrage" per turn.“
// Regel: CARD_API.md Z. 367-390 („Abbruch heißt: nichts ist passiert") und die Konvention der Schwesterkarte Iterative Testing (iterative-testing.js Z. 90-100:
//   „VOR der Auswahl geprüft, aber erst nach der Zusage beansprucht – ein Abbruch soll den Zug nicht verbrennen").
// Erwartung: Zielwahl abbrechen -> Karte wieder auf der Hand, die Sperre ist nicht gesetzt, eine Barrage kann im selben Zug noch gespielt werden.
// Beobachtet: Nach dem Abbruch steht `gs.hoptUsed['future-tech-barrage:0'] = Zug`; jedes weitere Spielen einer Barrage in diesem Zug wird abgelehnt (`play` = false).
// Ursache: cards/effects/future-tech-barrage.js `hooks.onPlay`: `engine.claimHOPT('future-tech-barrage', pi)` steht VOR `ctx.promptDamageTarget`; der Abbruchzweig
//   (`gs._spellCancelled = true`) gibt die Sperre nicht frei.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BA = 'Future Tech Barrage';
  const t = await H.fresh({ hand: [[BA, BA], []], discard: [[BA, BA], []] });
  t.policy.cancelTargets = true;
  const r1 = await t.play(0, BA, { hero: 0 });
  R.check('Abbruch: beide Barrage noch auf der Hand', t.pile(0, 'hand').filter(n => n === BA).length === 2, { r1, hand: t.pile(0, 'hand') });
  t.policy.cancelTargets = false;
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const r2 = await t.play(0, BA, { hero: 0 });
  R.check('nach dem Abbruch ist die Barrage im selben Zug noch spielbar (2 Kopien in der Ablage = 2 Treffer à 180 -> Held 0 = 800 - 360)', t.hp(1, 0) === 440, { r2, hp: t.hp(1, 0), hopt: t.gs.hoptUsed });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
