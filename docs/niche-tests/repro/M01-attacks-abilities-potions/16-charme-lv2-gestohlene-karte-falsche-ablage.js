'use strict';
// M01-16 · Charme Lv2: die gestohlene Handkarte landet beim Abwerfen/Spielen in der Ablage des DIEBES statt des Besitzers
// Regel (CARD_API.md ~Z. 4252-4264, „Herkunft (v692/v693) — ALLGEMEINE REGEL (Al 1.9.)"): jeder Effekt, der eine Karte in eine fremde Hand legt, markiert sie (`_tagHandCardOrigin`);
// Abwerfen/Spielen/Mulligan/Rückmischen lesen das – die Karte kehrt in Ablage bzw. Deck des URSPRÜNGLICHEN Besitzers zurück. Ausdrücklich genannt: „… Infiltration (alle Stufen) …, Charme, …".
// Kartentext Charme 2): „You may once per turn make your opponent add a card from their hand to yours."
// Aufbau: Seed 1234, Zug 5, Main Phase 1; Sitz 0 Held 0: Charme Lv2; Sitz 1 Hand [Fireball]. Kontrolle: Infiltration Lv1 holt Fireball vom Gegner-Deck.
// Erwartet: nach Abwerfen bzw. Spielen liegt Fireball in der Ablage von Sitz 1 (Besitzer). Beobachtet bei Charme Lv2: in der Ablage von Sitz 0; Infiltration korrekt.
// Ursache: `charme.js` `_activateLv2` (~Z. 520-530) setzt nur `handZugangSync(..., {ohneInstanz:true})` und `_moveHandInstanceOwner`, ruft aber nicht `_tagHandCardOrigin`;
// `actionPromptForceDiscard` & Co. lesen die Herkunft über den Platz (`_handOriginals`, `_handCardPileOwner`), die Instanz ist da schon entfernt.
const H = require('../../lib/h.js');
const free = (t, seat, hi, zi) => { t.gs.activePlayer = seat; t.phase(2); return t.run(() => t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: zi })); };
(async () => {
  const R = H.runner();
  const cases = [
    ['Charme Lv2', ['Charme', 'Charme'], { hand: [['ZZ Filler'], ['Fireball']] }],
    ['Infiltration Lv1 (Kontrolle)', ['Infiltration'], { hand: [['ZZ Filler'], []], deck: [Array(10).fill('ZZ Dummy'), ['Fireball', 'Heal', 'Heal']] }],
  ];
  for (const [label, abil, setup] of cases) {
    for (const via of ['abwerfen', 'spielen']) {
      const t = await H.fresh({ ...setup, abilities: { 0: { 0: [abil, [], []] } } });
      await free(t, 0, 0, 0);
      if (!t.pile(0, 'hand').includes('Fireball')) { R.check(`${label}/${via}: Fireball wurde genommen`, false, t.pile(0, 'hand')); continue; }
      if (via === 'abwerfen') {
        t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'Fireball', handIndex: t.pile(0, 'hand').indexOf('Fireball') }) });
        await t.run(() => t.engine.actionPromptForceDiscard(0, 1, { title: 'Test', selfInflicted: true }));
      } else {
        t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
        await t.play(0, 'Fireball', { hero: 0 });
      }
      const d0 = t.pile(0, 'discardPile'), d1 = t.pile(1, 'discardPile');
      R.note(`${label}/${via}: Ablage Sitz 0 (Dieb) = ${JSON.stringify(d0)}, Ablage Sitz 1 (Besitzer) = ${JSON.stringify(d1)}`);
      R.check(`${label}/${via}: Fireball in der Ablage des Besitzers (Sitz 1)`, d1.includes('Fireball') && !d0.includes('Fireball'), { d0, d1 });
      R.check(`${label}/${via}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})();
