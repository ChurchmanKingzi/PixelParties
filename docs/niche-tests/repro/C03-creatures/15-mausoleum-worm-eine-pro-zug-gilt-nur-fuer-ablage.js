'use strict';
// C03-creatures-15 · Mausoleum Worm: „You can only play 1 Mausoleum Worm per turn" gilt nur für das Platzieren aus der Ablage, nicht gegen das Spielen aus der Hand
// Kartentext: „When a Hero you control is defeated by an opponent's card or effect, you may immediately place this Creature from your discard pile into one of the defeated Hero's
//   free Support Zones, and if you do, draw until you have 8 cards in your hand. You can only play 1 "Mausoleum Worm" per turn."
// Skript: HOPT-Stempel `hoptUsed['mausoleum-worm:<pi>'] = gs.turn` nur im Ablage-Weg (`discardHooks.onHeroDefeatFinal`); die Hand-Beschwörung kennt weder Stempel noch Sperre.
// Aufbau: Sitz 0 am Zug; Worm in Hand UND in der Ablage; Fall A: erst Worm von der Hand spielen, dann fällt im selben Zug ein Held von Sitz 0 durch eine Gegnerquelle
//   (z. B. Surprise des Gegners im eigenen Zug) ⇒ zweiter Worm aus der Ablage. Fall B: umgekehrte Reihenfolge (Heldentod ⇒ Worm aus der Ablage, danach zweiter Worm von der Hand).
// Erwartung (Lesart „play" = jede Beschwörung): höchstens ein Mausoleum Worm je Zug kommt aufs Brett (Fall A: zweite Platzierung bleibt aus; Fall B: Handspiel abgelehnt).
// Beobachtet: In beiden Reihenfolgen kommen zwei Mausoleum Worms im selben Zug aufs Brett (Fall A: Rückfrage erscheint; Fall B: `t.play` gelingt).
// Ursache: cards/effects/mausoleum-worm.js: Stempel nur im Ablage-Haken; kein Spielgate für die Hand (vgl. Grave Worm: „…this way").
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const W = 'Mausoleum Worm';
  const wuermer = (t) => t.inst(c => c.name === W && c.zone === 'support').length;
  const zone = (t) => t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  {
    R.section('Fall A: Hand zuerst, dann Heldentod im selben Zug');
    const t = await H.fresh({ hand: [[W], []], discard: [[W], []], deckSize: 30 });
    zone(t);
    t.setAbilities(0, 2, [Array(3).fill('Summoning Magic'), [], []]);
    await t.play(0, W, { hero: 2, slot: 0, noGrant: true });
    t.hero(0, 1).hp = 50;
    await t.run(() => t.engine.actionDealDamage({ name: 'Fireball', owner: 1 }, t.hero(0, 1), 100, 'spell'));
    R.note('Rückfragen', t.prompts.map(p => p.d.title));
    R.check('höchstens 1 Mausoleum Worm je Zug auf dem Brett', wuermer(t) <= 1, wuermer(t));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    R.section('Fall B: Heldentod zuerst, dann zweiter Worm von der Hand');
    const t = await H.fresh({ hand: [[W], []], discard: [[W], []], deckSize: 30 });
    zone(t);
    t.setAbilities(0, 2, [Array(3).fill('Summoning Magic'), [], []]);
    t.hero(0, 1).hp = 50;
    await t.run(() => t.engine.actionDealDamage({ name: 'Fireball', owner: 1 }, t.hero(0, 1), 100, 'spell'));
    const r = await t.play(0, W, { hero: 2, slot: 0, noGrant: true });
    R.note('Handspiel', r);
    R.check('höchstens 1 Mausoleum Worm je Zug auf dem Brett', wuermer(t) <= 1, wuermer(t));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
