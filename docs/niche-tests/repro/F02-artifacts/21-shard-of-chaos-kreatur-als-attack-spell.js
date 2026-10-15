'use strict';
// F02-21 · Shard of Chaos behandelt Kreaturen wie Attack/Spell („Action") – UMGESTELLT in Welle 12 auf die neue Regel (Q100, Al: „Ergänze Attack/Spell/Creature im Text. Ein Topf.")
//   vorher prüfte dieses Repro die wörtliche Alt-Lesart (kein Tausch Kreatur → Zauber); jetzt gilt: Kreaturen bleiben im selben Topf wie Attack/Spell, der Tausch Bird → Fireball ist KORREKT.
// Kartentext: „Delete up to 3 cards from your hand. Then, choose the same number of cards of the same type (Ability, Attack/Spell, Artifact, Potion, Hero) from your discard pile and add them to your hand. Delete this card."
// Skriptkopf shard-of-chaos.js: „Attack/Spell/Creature count as one type („Action")." (Kartentext enthält Creature nicht in der Typliste.)
// Aufbau: Sitz 0: Hand [Shard of Chaos, Bird (Creature)], Ablage [Fireball (Spell)].
// Schritte: Shard spielen, die Kreatur „Bird" zum Löschen wählen, in der Galerie „Fireball" nehmen.
// Erwartet (neue Regel, Kartentext „Attack/Spell/Creature"): Bird wird gelöscht, Fireball kommt auf die Hand. (Alte Lesart war: kein Tausch Kreatur → Zauber.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Shard of Chaos', 'Bird'], []], gold: [100, 100], discard: [['Fireball'], []] });
  t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [{ handIndex: t.pile(0, 'hand').indexOf('Bird') }] }), once: true });
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ selectedCards: ['Fireball'], cardName: 'Fireball' }) });
  const r = await t.play(0, 'Shard of Chaos');
  const getauscht = t.pile(0, 'deletedPile').includes('Bird') && t.pile(0, 'hand').includes('Fireball');
  R.check('Kreatur „Bird" lässt sich gegen einen Spell aus der Ablage tauschen (ein Topf Attack/Spell/Creature)', getauscht, { r, hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile'), disc: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
