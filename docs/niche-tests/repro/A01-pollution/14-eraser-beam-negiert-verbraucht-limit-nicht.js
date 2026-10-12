'use strict';
// A01-pollution-14 · Eraser Beam: in der Kette negiert → 3 Tokens bezahlt, aber das „1 pro Spiel“-Limit nicht verbraucht
// Kartentext: „Place 3 Pollution Tokens into your free Support Zones to use this Spell. … You can only play 1 „Eraser Beam“ per game.“
// Absicht laut Skript (eraser-beam.js, onPlay): „Mark the once-per-game key now so even a same-turn negation still consumes the game-long charge.“
// Erwartung: ein negierter (aber gespielter) Eraser Beam verbraucht die Spielladung, wie ein nach der Zielwahl negierter (Anti Magic Shield) – sonst bezahlt man die
//   Kosten und darf die Karte trotzdem später noch einmal spielen.
// Beobachtet: Silence (Kette, vor `onPlay`) negiert Eraser Beam: 3 Tokens liegen (Kosten bezahlt), Karte in der Ablage, `_oncePerGameUsed` leer. Eine zweite Eraser Beam ist
//   zwei Züge später voll spielbar. Der Stempel steht nur in `onPlay` und läuft bei einer Kettennegation nie.
// Ursache: cards/effects/eraser-beam.js – `ps._oncePerGameUsed.add('eraserBeam')` nur in `onPlay`; die Kosten laufen dagegen in `payActivationCost` (vor der Kette).
// Aufruf: node docs/niche-tests/repro/A01-pollution/14-eraser-beam-negiert-verbraucht-limit-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Eraser Beam', 'Eraser Beam'], ['Silence']] });
  t.grantFor(1, 0, 'Silence');
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  t.policy.confirm = true;                       // der Gegner spielt Silence
  await t.play(0, 'Eraser Beam', { hero: 0 });
  R.check('Eraser Beam wurde negiert: Gegner-Held unverletzt, Karte in der Ablage, Kosten (3 Tokens) bezahlt', t.hp(1, 0) === 800 && t.pile(0, 'discardPile').includes('Eraser Beam') && tokens(t, 0) === 3, { hp: t.hp(1, 0), ablage: t.pile(0, 'discardPile'), tokens: tokens(t, 0) });
  R.check('das Limit „1 Eraser Beam pro Spiel“ ist verbraucht', !!(t.gs.players[0]._oncePerGameUsed && t.gs.players[0]._oncePerGameUsed.has('eraserBeam')), t.gs.players[0]._oncePerGameUsed && [...t.gs.players[0]._oncePerGameUsed]);
  t.policy.confirm = false;
  await t.endTurn(); await t.endTurn();           // Sitz 1 und wieder Sitz 0
  // 3 freie Zonen sicherstellen (ein Token-Abbau ist hier nicht Thema)
  const ps = t.gs.players[0];
  t.inst(c => c.name === 'Pollution Token' && c.owner === 0).forEach(c => { ps.supportZones[c.heroIdx][c.zoneSlot] = []; t.engine._untrackCard(c.id); });
  const r2 = await t.play(0, 'Eraser Beam', { hero: 0 });
  R.check('zweite Eraser Beam ist NICHT mehr spielbar', r2 === false || t.pile(0, 'hand').includes('Eraser Beam'), { r2, hp: t.hp(1, 0), hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
