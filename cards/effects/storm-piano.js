// ═══════════════════════════════════════════
//  CARD EFFECT: "Storm Piano"
//  Artifact / Equipment (Cost 4)
//
//  „When this Artifact equipped to a Hero you control is sent to the
//   discard pile, prevent any damage the previously equipped Hero would
//   take until the end of your next turn. You can only activate this
//   effect of "Storm Piano" once per turn. A Hero can only be equipped
//   with 1 "Storm Piano" per game."
//
//  · Ausloeser wie bei den Geschwistern (`_orchestra-shared`).
//  · Der Schutz ist der neue positive Heldenstatus `damage_proof`
//    (v628): `_actionDealDamageImpl` blockt jeden normalen Schaden,
//    True Damage laeuft vorbei (Carris-Lesart: die Ausnahme steht nur
//    dort ausdruecklich im Text). Ablauf am Zugende des Besitzers,
//    sofern das nicht der Zug ist, in dem der Schutz entstand
//    (`armedTurn`) — also „until the end of your next turn".
//  · „1 Storm Piano per game" je Held: Gate `canEquipToHero` (Engine-
//    Vertrag `canEquipCardToHero`) liest den Heldenmerker
//    `_stormPianoEquipped`, der beim Ausruesten (`onPlay` in der Support
//    Zone) gesetzt wird. Ein Held, der einmal eines trug, bekommt nie
//    wieder eines — auch nicht ueber das Orchester.
// ═══════════════════════════════════════════

const { instrumentDiscardTrigger } = require('./_orchestra-shared');

const CARD_NAME = 'Storm Piano';

module.exports = {
  isEquip: true,
  activeIn: ['support'],
  bypassDeadHeroFilter: true,

  canEquipToHero(gs, pi, heroIdx) {
    return !gs.players[pi]?.heroes?.[heroIdx]?._stormPianoEquipped;
  },

  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id || inst.zone !== 'support') return;
      const hero = ctx._engine.gs.players[inst.controller ?? inst.owner]?.heroes?.[inst.heroIdx];
      if (hero) hero._stormPianoEquipped = true;
    },
    onCardLeaveZone: async (ctx) => {
      const fired = instrumentDiscardTrigger(ctx, CARD_NAME, 'storm-piano');
      if (!fired) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const { pi, heroIdx } = fired;
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) { engine.log('storm_piano', { player: gs.players[pi]?.username, hero: hero?.name || null, applied: false }); return; }
      await engine.addHeroStatus(pi, heroIdx, 'damage_proof', { armedTurn: gs.turn, source: CARD_NAME });
      engine._broadcastEvent('play_zone_animation', { type: 'shield_bubble', owner: pi, heroIdx, zoneSlot: -1 });
      engine.log('storm_piano', { player: gs.players[pi]?.username, hero: hero.name, applied: true });
      engine.sync();
    },
  },
};
