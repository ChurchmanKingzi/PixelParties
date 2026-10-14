'use strict';
// A01-pollution-03 · Mass Multiplication: Abbruch der Kartenwahl lässt den Pollution Token liegen
// Kartentext: „Place 1 Pollution Token into your free Support Zone to play this card. Delete a card from your hand or discard pile and
//   add up to 3 copies of it from your deck to your hand.“
// Regel (cards/effects/CARD_API.md, „ZIELENDE KARTEN SIND IMMER ABBRECHBAR“, Als Regel 23.9.): „Abbruch heißt: nichts ist passiert. Die Karte
//   bleibt auf der Hand, die Aktion wird erstattet.“ Kosten, die bei einem Abbruch liegen bleiben, gibt es dort nur als Ausnahme mit Kommentar
//   (Cold Coffin/Eraser Beam: Kosten VOR der Kette über payActivationCost, danach ist die Zielwahl nicht mehr abbrechbar).
// Beobachtet: Mass Multiplication setzt den Token in onPlay VOR der Galerie, die einen Abbrechen-Knopf hat (cancellable: true). Wer abbricht,
//   bekommt die Karte zurück auf die Hand, behält aber den Token auf dem Brett (Handlimit −1 inklusive). Mehrfaches Abbrechen/Wiederspielen
//   füllt das Brett mit Tokens.
// Ursache: cards/effects/mass-multiplication.js – `placePollutionTokens(...)` steht vor `promptGeneric(cardGallery, cancellable: true)`.
// ★ W4b (Al, Welle 4): der Token ist Kostenpunkt und wird VOR dem Reaktionsfenster bezahlt (`payActivationCost`, wie Cold Coffin/Eraser Beam) und bleibt bei
//   Negation liegen. Damit gilt die Cold-Coffin-Ausnahme: danach ist die Kartenwahl NICHT mehr abbrechbar (kein Abbrechen-Knopf, `cancellable: false`) —
//   Abbruch kann es nicht mehr geben. Das Repro misst jetzt: entweder die Galerie ist nicht abbrechbar, oder (alter Weg) ein Abbruch lässt keinen Token liegen.
// Aufruf: node docs/niche-tests/repro/A01-pollution/03-mass-multiplication-abbruch-laesst-token.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Mass Multiplication', 'Fireball'], []], deck: [['Fireball', 'Fireball', 'Fireball', 'Fireball', H.INERT.creature, H.INERT.creature], []] });
  let abbrechbar = null;
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Mass Multiplication', answer: (d) => { abbrechbar = d.cancellable !== false; return abbrechbar ? { cancelled: true } : { cardName: 'Fireball', source: 'hand' }; } });   // Abbrechen-Knopf, falls angeboten
  const r = await t.play(0, 'Mass Multiplication', { hero: 0 });
  R.check('die Kartenwahl wurde gezeigt', abbrechbar !== null, { abbrechbar, r });
  if (abbrechbar) {   // alter Weg: Abbruch möglich → dann muss die Karte zurück auf die Hand UND ohne Token
    R.check('Karte bleibt auf der Hand (Abbruch)', r === true && t.pile(0, 'hand').includes('Mass Multiplication') && t.pile(0, 'hand').includes('Fireball'), t.pile(0, 'hand'));
    R.check('Abbruch = nichts ist passiert: kein Pollution Token auf dem Brett', tokens(t, 0) === 0, tokens(t, 0));
  } else {
    R.check('Kosten bezahlt (Token liegt) und Kartenwahl nicht abbrechbar', tokens(t, 0) === 1, tokens(t, 0));
  }
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
