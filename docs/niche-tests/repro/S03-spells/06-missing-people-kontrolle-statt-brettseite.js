'use strict';
// S03-06 · Missing People: legt die Zielliste nach Brettseite statt Kontrolle an – gestohlene eigene Kreatur wird zum Leerlauf
// Kartentext: „Choose a Creature your opponent controls and place it at the bottom of their deck."
// Skript: `spellPlayCondition` zählt nach KONTROLLE (`gegnerCreatures`: controller === Gegner); `promptDamageTarget({ side: 'enemy' })` listet aber nur die
//   physische Spalte des Gegners (`_engine.js` ~4880 `addCreatures(opponentsOf(pi))`, `physicalSide`).
// Aufbau: Meine einzige Kreatur (Sitz 0, Held 0, Slot 0) wird vom Gegner gestohlen (`actionStealCreature(1, inst)`); sie bleibt physisch bei mir.
// Erwartet: Missing People ist spielbar (der Gegner kontrolliert ja eine Kreatur) UND die Kreatur ist wählbar → sie geht unten in MEIN Deck.
//   (Alternativ: dann darf die Karte nicht spielbar sein.)
// Beobachtet: Server lässt das Spielen zu, es erscheint KEINE Zielwahl, die Karte landet in der Ablage, die Aktion ist verbraucht, nichts passiert.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Missing People'], []], deckSize: 5 });
  const x = t.put(0, 0, 0, 'ZZ Dummy');
  await t.engine.actionStealCreature(1, x); await H.sleep(80);
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip'); return v ? [v.id] : null; };
  const spielbar = !!t.engine.validateActionPlay(0, 'Missing People', 0, 0, ['Spell', 'Attack'], {});
  const r = await t.play(0, 'Missing People', { hero: 0 });
  const verpufft = r === true && t.targets.length === 0 && t.pile(0, 'discardPile').includes('Missing People') && !!t.zone(0, 0, 0);
  R.check('NICHT (spielbar UND wirkungslos verbraucht): entweder Ziel wählbar oder Karte nicht spielbar', !(spielbar && verpufft), { spielbar, r, zielwahlen: t.targets.length, ablage: t.pile(0, 'discardPile'), kreatur: t.zone(0, 0, 0) });
  R.check('die gestohlene Kreatur ging unten in das Deck ihres Besitzers (Sitz 0)', t.pile(0, 'mainDeck').slice(-1)[0] === 'ZZ Dummy' && !t.zone(0, 0, 0), { deckEnde: t.pile(0, 'mainDeck').slice(-1), zone: t.zone(0, 0, 0) });
  R.finish();
})();
