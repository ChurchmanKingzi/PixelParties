'use strict';
// R02-11 · Prayer unter Ziehsperre: die Abilities werden abgeworfen, gezogen wird nichts (Kosten ohne Gegenwert)
// Kartentext: „Attach this card to the user. You may once per turn discard any number of Abilities from your hand to draw the same number of cards. You may draw 1 extra card afterwards, but if you do, you cannot draw cards for the rest of the turn afterwards."
// Aufbau: Sitz 0 legt Prayer an Held 0 (Hand danach: Fighting, Fighting, Toughness). Variante A: keine Sperre (Kontrolle). Variante B: `ps.drawLocked = true` (wie Sacred Jewel / MOE Shield / Prayers eigene Sperre).
//   Der Klick-Effekt wird aktiviert, die 3 Abilities werden für den Abwurf gewählt.
// Erwartet: A: 3 Abilities weg, 3 Karten gezogen (+1 Extra bei „Ja"). B: entweder ist die Aktivierung nicht möglich / der Abwurf wird nicht angeboten („draw the same number of cards" ist nicht erfüllbar),
//   oder – falls es erlaubt sein soll – die Frage an Al s. u.
// Beobachtet: B: Prayer lässt sich aktivieren, die 3 Abilities wandern in die Ablage, die Hand schrumpft von 3 auf 0, es wird nichts gezogen.
// Ursache: `prayer.js` (onEquipEffect) prüft `ps.drawLocked` nur für die Extra-Karte („Ist der Zieh-Lock schon gesetzt, entfällt die Nachfrage"), nicht vor dem Abwurf.
// ★ ENTSCHIEDEN (Regel von Al, Welle 3 / D1): unter einer Zieh-Sperre bleibt eine Aktivierung spielbar, solange NICHT der komplette Effekt nur Ziehen ist
//   (Abwerfen, Zurückmischen, Löschen aus der Ablage … sind eigenständig – „es gibt Decks, die abwerfen wollen“); gesperrt sind nur reine Zieher.
//   Prayer („discard Abilities to draw the same number“) = Mischeffekt: unter drawLocked bleibt der Abwurf möglich (gezogen wird nichts).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const gesperrt of [false, true]) {
    const t = await H.fresh({ hand: [['Prayer', 'Fighting', 'Fighting', 'Toughness'], []], hp: 800, phase: 2 });
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return [(h || valid[0]).id]; };
    await t.play(0, 'Prayer', { hero: 0, phase: 3 }); t.phase(2);
    if (gesperrt) t.gs.players[0].drawLocked = true;
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
    t.policy.confirm = false;   // keine Extra-Karte
    const hand0 = t.pile(0, 'hand').length;
    const r = await t.activateEquip(0, 0, 0);
    const abgeworfen = t.pile(0, 'discardPile').filter(c => c === 'Fighting' || c === 'Toughness').length;
    const hand1 = t.pile(0, 'hand').length;
    if (!gesperrt) R.check('A (ohne Sperre): 3 Abilities abgeworfen, 3 Karten gezogen', abgeworfen === 3 && hand1 === hand0 - 3 + 3, { r, abgeworfen, hand: [hand0, hand1] });
    else R.check('B (Ziehsperre): Mischeffekt bleibt aktivierbar – die 3 Abilities werden abgeworfen, nichts gezogen', abgeworfen === 3 && hand1 === hand0 - 3, { r, abgeworfen, hand: [hand0, hand1] });
    R.check(`${gesperrt ? 'B' : 'A'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
