'use strict';
// F02-21 · Shard of Chaos behandelt Kreaturen wie Attack/Spell („Action") – der Kartentext nennt nur Ability, Attack/Spell, Artifact, Potion, Hero
// Kartentext: „Delete up to 3 cards from your hand. Then, choose the same number of cards of the same type (Ability, Attack/Spell, Artifact, Potion, Hero) from your discard pile and add them to your hand. Delete this card."
// Skriptkopf shard-of-chaos.js: „Attack/Spell/Creature count as one type („Action")." (Kartentext enthält Creature nicht in der Typliste.)
// Aufbau: Sitz 0: Hand [Shard of Chaos, Bird (Creature)], Ablage [Fireball (Spell)].
// Schritte: Shard spielen, die Kreatur „Bird" zum Löschen wählen, in der Galerie „Fireball" nehmen.
// Erwartet (wörtlich): „Bird" ist keine Karte der genannten Typen und gleicht nicht dem Typ „Attack/Spell" – es sollte keinen Tausch Kreatur → Zauber geben (Frage C).
// Beobachtet: Bird wird gelöscht, Fireball kommt auf die Hand.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Shard of Chaos', 'Bird'], []], gold: [100, 100], discard: [['Fireball'], []] });
  t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [{ handIndex: t.pile(0, 'hand').indexOf('Bird') }] }), once: true });
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ selectedCards: ['Fireball'], cardName: 'Fireball' }) });
  const r = await t.play(0, 'Shard of Chaos');
  const getauscht = t.pile(0, 'deletedPile').includes('Bird') && t.pile(0, 'hand').includes('Fireball');
  R.check('Kreatur „Bird" lässt sich NICHT gegen einen Spell aus der Ablage tauschen (wörtliche Typliste)', !getauscht, { r, hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile'), disc: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
