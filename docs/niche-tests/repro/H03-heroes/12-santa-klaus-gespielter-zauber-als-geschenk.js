'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-12 · Santa Klaus: der soeben gewirkte Zauber steht noch in der Hand und wird als Geschenkkarte angeboten
//
//  Karte: Santa Klaus (`cards/effects/santa-klaus.js`, `hooks.afterSpellResolved`)
//  Kartentext: „Whenever this Hero uses an Attack or Spell, you must add 2 cards from your hand to your opponent's hand."
//  Skriptkopf: der Preis wird aus der Hand bezahlt; `canPlayCard` verlangt bei Hand-Herkunft DREI Karten, „weil die Karte zum Pruefzeitpunkt noch
//  mit drin liegt und nicht als Reserve zaehlt" – also sind die 2 Geschenke Reserve-Karten, nicht der gespielte Zauber.
//  Server: `afterSpellResolved` feuert, solange der Zauber noch in `ps.hand` liegt (`ps._resolvingCard`, Splice erst danach, server.js ~8650); die
//  Wisdom-Kosten nehmen ihn deshalb ausdruecklich aus (server.js ~8571: „Der Zauber liegt hier noch in der Hand — er ist vom Abwurf ausgenommen").
//  Erwartung: Der gespielte Fireball wird NICHT zur Wahl gestellt; er landet in der Ablage; der Gegner erhaelt zwei andere Karten.
//  Beobachtung (✗): `eligibleIndices` enthaelt alle Handkarten inkl. des laufenden Zaubers. Wird er gewaehlt, bekommt der Gegner den gespielten Zauber
//  auf die Hand, die Ablage bleibt leer und Santa behaelt eine Reservekarte (der Preis sinkt faktisch auf 1 Karte).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/12-santa-klaus-gespielter-zauber-als-geschenk.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const SANTA = 'Santa Klaus';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[SANTA, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 600, hand: [['Fireball', 'Heal', 'Heal'], []] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const angeboten = [];
  // Wie ein Mensch, der den (noch sichtbaren) Fireball als Geschenk waehlt, solange er in der Hand liegt:
  t.script.push({ match: d => d.type === 'pickHandCard', answer: (d) => {
    const hand = t.gs.players[0].hand;
    angeboten.push(d.eligibleIndices.map(i => hand[i]));
    const i = hand.indexOf('Fireball');
    return { handIndex: (i >= 0 && d.eligibleIndices.includes(i)) ? i : d.eligibleIndices[0] };
  } });
  const r = await t.play(0, 'Fireball', { hero: 0 });
  R.note('Ergebnis', { r, angeboten, hand0: t.pile(0, 'hand'), hand1: t.pile(1, 'hand'), ablage0: t.pile(0, 'discardPile') });
  R.check('der laufende Fireball wird nicht als Geschenkkarte angeboten', !angeboten.some(a => a.includes('Fireball')), angeboten);
  R.check('der gespielte Fireball liegt in der Ablage', t.pile(0, 'discardPile').includes('Fireball'), t.pile(0, 'discardPile'));
  R.check('der Gegner hat zwei andere Karten bekommen (2 Heal)', t.pile(1, 'hand').filter(c => c === 'Heal').length === 2 && !t.pile(1, 'hand').includes('Fireball'), t.pile(1, 'hand'));
  R.check('Santa hat nach dem Preis keine Reservekarte mehr (3 Karten: Zauber + 2 Geschenke)', t.pile(0, 'hand').length === 0, t.pile(0, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
