'use strict';
// A01-pollution-14 · Eraser Beam: in der Kette GANZ negiert → die 3 Tokens sind bezahlt, das „1 pro Spiel“-Limit aber NICHT verbraucht (Als Entscheidung, Welle 3)
// Kartentext: „Place 3 Pollution Tokens into your free Support Zones to use this Spell. … You can only play 1 „Eraser Beam“ per game.“
// REGEL (CARD_API.md „★ Z7b", Rusty-Touch-Muster „der Gegner zahlt trotzdem"): bezahlte Kosten bleiben bezahlt, aber eine komplett negierte Karte hat nie aufgelöst →
//   „per turn"/„per game" ist nicht verbraucht. (Alte Z7-Lesart „negiert = gespielt" gilt nicht mehr.)
// Aufbau: Silence (Kette, vor `onPlay`) negiert Eraser Beam: 3 Tokens liegen (Kosten bezahlt), Karte in der Ablage. Zwei Züge später (Tokens weggeräumt) zweite Eraser Beam.
// Exit 1 (Fehler tritt auf) = das negierte Exemplar hat das Limit gestempelt bzw. die zweite Eraser Beam ist nicht spielbar.
const H = require('../../lib/h.js');
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Eraser Beam', 'Eraser Beam'], ['Silence']] });
  t.grantFor(1, 0, 'Silence');
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  t.policy.confirm = true;                       // der Gegner spielt Silence
  await t.play(0, 'Eraser Beam', { hero: 0 });
  R.check('Voraussetzung: Eraser Beam wurde negiert: Gegner-Held unverletzt, Karte in der Ablage, Kosten (3 Tokens) bezahlt', t.hp(1, 0) === 800 && t.pile(0, 'discardPile').includes('Eraser Beam') && tokens(t, 0) === 3, { hp: t.hp(1, 0), ablage: t.pile(0, 'discardPile'), tokens: tokens(t, 0) });
  R.check('das Limit „1 Eraser Beam pro Spiel“ ist NICHT verbraucht (ganz negiert)', !(t.gs.players[0]._oncePerGameUsed && t.gs.players[0]._oncePerGameUsed.has('eraserBeam')), t.gs.players[0]._oncePerGameUsed && [...t.gs.players[0]._oncePerGameUsed]);
  t.policy.confirm = false;
  await t.endTurn(); await t.endTurn();           // Sitz 1 und wieder Sitz 0
  // 3 freie Zonen sicherstellen (ein Token-Abbau ist hier nicht Thema)
  const ps = t.gs.players[0];
  t.inst(c => c.name === 'Pollution Token' && c.owner === 0).forEach(c => { ps.supportZones[c.heroIdx][c.zoneSlot] = []; t.engine._untrackCard(c.id); });
  const r2 = await t.play(0, 'Eraser Beam', { hero: 0 });
  R.check('zweite Eraser Beam ist spielbar und wirkt', r2 === true && !t.pile(0, 'hand').includes('Eraser Beam') && t.hp(1, 0) < 800, { r2, hp: t.hp(1, 0), hand: t.pile(0, 'hand') });
  R.check('die aufgelöste zweite verbraucht das Limit', !!(ps._oncePerGameUsed && ps._oncePerGameUsed.has('eraserBeam')), ps._oncePerGameUsed && [...ps._oncePerGameUsed]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
