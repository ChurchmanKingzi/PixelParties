// A08-02 · Cool Presents zahlt trotz Rusting Crystal den Grundpreis (Anzeige 8 je Karte, Abbuchung 4 je Karte)
//
// Kartentext Cool Presents: „Add any number of cards with different names from your hand to your opponent's hand.
//   This Artifact's Cost is multiplied by the number of cards you give your opponent." (Kosten 4)
// Kartentext Rusting Crystal: „While this card is in your hand, the Costs of all your other Artifacts are doubled."
//
// Erwartung: Mit Rusting Crystal auf der Hand kostet Cool Presents 8 Gold je verschenkter Karte (3 Karten = 24 Gold).
// Beobachtet: Der Zielwähler bekommt die verdoppelten Kosten (goldCost 8, maxTotal = floor(24/8) = 3, „dynamicCostPerTarget 8"),
//   `resolve` rechnet aber mit dem Grundpreis aus cards.json (`cool-presents.js:122`: `engine._getCardDB()[CARD_NAME]?.cost`) und bucht
//   nur 12 Gold ab. Anzeige und Abbuchung widersprechen sich, und die Verdopplung greift bei Cool Presents nie.
// Aufruf: node docs/niche-tests/repro/A08-pacman/02-cool-presents-ignoriert-rusting-crystal.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, F = H.INERT.filler, A = H.INERT.artifact;
  async function lauf(mitRusting) {
    const t = await H.fresh({ gold: [24, 100], hand: [[], []] });
    t.engine.handZugangSync(0, 'Cool Presents');
    if (mitRusting) t.engine.handZugangSync(0, 'Rusting Crystal');
    for (const n of [F, A, D]) t.engine.handZugangSync(0, n);
    await t.play(0, 'Cool Presents', { noAutoConfirm: true });   // öffnet die Zielwahl (Potion-Targeting); Auswahl von Hand
    const pt = t.gs.potionTargeting;
    const ids = pt.validTargets.filter(v => [F, A, D].includes(v.cardName)).map(v => v.id);
    const g0 = t.gs.players[0].gold;
    await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: ids }));
    R.check((mitRusting ? 'mit' : 'ohne') + ' Rusting: keine Engine-Fehler, 3 Karten beim Gegner', t.errors.length === 0 && t.pile(1, 'hand').length === 3, { err: t.errors, hand1: t.pile(1, 'hand') });
    return { bezahlt: g0 - t.gs.players[0].gold, angezeigt: pt.goldCost };
  }
  const a = await lauf(false);
  const b = await lauf(true);
  R.check('ohne Rusting Crystal: 3 Karten = 12 Gold', a.bezahlt === 12, a);
  R.check('mit Rusting Crystal: Kosten verdoppelt → 3 Karten = 24 Gold (angezeigt: 8 je Karte)', b.bezahlt === 24, b);
  R.finish();
})();
