// A08-06 · Big Gwen Guard lässt sich nicht beschwören, solange eine Grinning Cat auf der Hand liegt – obwohl sie die Katze als Kosten abwerfen soll
//
// Kartentext Big Gwen Guard: „While you control no Creatures, you may discard 1 card from your hand that is revealed because of its own effect
//   to summon this Creature as an additional Action. While you control this Creature, ignore the effects of all cards that are revealed in your
//   hand by their own effects."
// Kartentext Grinning Cat: „When you draw or add this card to your hand, you must immediately reveal it. While this card is in your hand,
//   you cannot summon any Creatures except "Grinning Cat"."
//
// Erwartung: Die Kosten (Katze abwerfen) werden vor der Beschwörung gezahlt; danach liegt die Katze nicht mehr auf der Hand, ihre Sperre
//   ist weg → Big Gwen Guard wird beschworen (Kontrolle: Weakening Crystal als Kosten funktioniert bereits so).
// Beobachtet: `getSummonBlocked` (`_engine.js:23751-23775`) setzt Big Gwen Guard als Handkreatur auf die Sperrliste, sobald eine Katze in der Hand liegt;
//   `doPlayCreature` lehnt ab, bevor `beforeSummon` die Abwurfkosten anbietet. Die Sondervariante, die genau für „revealed cards" gedacht ist,
//   funktioniert damit gegen die einzige selbstaufdeckende Kreatur-Sperre des Archetyps nicht.
// Aufruf: node docs/niche-tests/repro/A08-pacman/06-big-gwen-guard-vs-grinning-cat.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  async function lauf(kosten) {
    const t = await H.fresh({ hand: [[], []], deck: [[F, F, F, F, F, F], [F, F, F, F, F, F]] });
    t.engine.handZugangSync(0, 'Big Gwen Guard');
    t.engine.handZugangSync(0, kosten);
    t.script.push({ match: d => d && /forceDiscard/.test(d.type), answer: () => ({ cardName: kosten, handIndex: t.pile(0, 'hand').indexOf(kosten) }) });
    const r = await t.play(0, 'Big Gwen Guard', { hero: 0, phase: 2 });
    const onBoard = t.gs.players[0].supportZones[0].some(z => z[0] === 'Big Gwen Guard');
    R.check(`keine Engine-Fehler (Kosten: ${kosten})`, t.errors.length === 0, t.errors);
    return { r, onBoard, ablage: t.pile(0, 'discardPile') };
  }
  const a = await lauf('Weakening Crystal');
  R.check('Kontrolle: Big Gwen Guard mit Weakening Crystal als Kosten beschworen', a.onBoard && a.ablage.includes('Weakening Crystal'), a);
  const b = await lauf('Grinning Cat');
  R.check('Big Gwen Guard mit Grinning Cat als Kosten beschworen', b.onBoard && b.ablage.includes('Grinning Cat'), b);
  R.finish();
})();
