'use strict';
// H04-12 · Sid, the King of Thieves: die geraubten Karten landen nach dem Spielen/Abwerfen in SIDS Ablage statt in der des Gegners  [Stufe B]
//
// Kartentext: „At the start of the game, before both players draw their starting hands, look at your opponent's deck, choose up to 2 cards with
//   different names from it, and openly add them to your hand."
// CARD_API.md (~Z. 4255–4265, „ALLGEMEINE REGEL (Al 1.9.)"): „jeder Effekt, der eine Karte in eine fremde Hand legt, markiert sie mit
//   `_tagHandCardOrigin(dieb, name, besitzer)` … Abwerfen, Spielen (`_consumeHandCardOrigin` in den Server-Pfaden), Mulligan … lesen das – die Karte
//   kehrt in Ablage bzw. Deck des URSPRÜNGLICHEN Besitzers zurück. Getaggt sind: Key, Infiltration, Enigma, … **Sid** …" (und v1224: „Gestohlene Karten gehen
//   in die Ablage ihres Besitzers").
// Beobachtet: Sid setzt nur `newInst.originalOwner = oi` an der Hand-INSTANZ und ruft `_tagHandCardOrigin` nicht auf; die platzbasierte Herkunft
//   (`ps._handOriginals[slot]`) fehlt. `_consumeHandCardOrigin(pi, name, handIdx)` und `actionDiscardHandCard` lesen aber zuerst den Platz → Sids eigene Ablage.
// Folge: die Karten des Gegners liegen dauerhaft in Sids Ablage (Wiederverwendung durch Ablage-Effekte des Diebes; dem Gegner fehlen sie in seiner Ablage).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SID = 'Sid, the King of Thieves';
  async function szene() {
    const t = await H.fresh({ heroes: [[SID, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []],
      deck: [[H.INERT.creature, H.INERT.creature], ['Fireball', 'Chain Lightning', 'Icebolt', H.INERT.creature]] });
    t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === SID, answer: () => ({ selectedCards: ['Chain Lightning', 'Fireball'] }), once: true });
    await t.run(() => t.engine.runHooks('onBeforeHandDraw', {}));
    return t;
  }
  // (a) Spielen
  let t = await szene();
  R.check('Vorbereitung: Sid hat Chain Lightning und Fireball auf der Hand', t.pile(0, 'hand').length === 2 && t.pile(0, 'hand').includes('Fireball'), t.pile(0, 'hand'));
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
  await t.play(0, 'Fireball', { hero: 0, noGrant: true });
  R.check('(a) gespielter Fireball (Karte des Gegners) liegt in der Ablage des GEGNERS', t.pile(1, 'discardPile').includes('Fireball'), { d0: t.pile(0, 'discardPile'), d1: t.pile(1, 'discardPile') });
  R.check('(a) und NICHT in Sids Ablage', !t.pile(0, 'discardPile').includes('Fireball'), { d0: t.pile(0, 'discardPile') });
  // (b) Abwerfen
  t = await szene();
  await t.run(() => t.engine.actionDiscardHandCard(0, 'Chain Lightning', t.pile(0, 'hand').indexOf('Chain Lightning'), { source: 'test' }));
  R.check('(b) abgeworfene geraubte Karte liegt in der Ablage des Gegners', t.pile(1, 'discardPile').includes('Chain Lightning') && !t.pile(0, 'discardPile').includes('Chain Lightning'), { d0: t.pile(0, 'discardPile'), d1: t.pile(1, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
