// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Projection"
//  Spell / Attachment (Magic Arts, Lv0)
//
//  "This Spell has no effect when you play it from your hand. This
//   Spell can only be attached to an "Idej" Hero by its own effect.
//   When the attached Hero would take any damage, you may discard
//   this card from that Hero to negate that damage and all associated
//   effects to that Hero."
//
//  Wiring:
//   • No `onPlay` — played from hand it simply resolves with no effect
//     and goes to discard. It is only ever ATTACHED (into a Support
//     Zone slot of an Idej Hero) by the Idej Lords' start-of-game
//     effect or by Idej Projector.
//   • While attached (`activeIn: ['support']`), a `beforeDamage` hook
//     watches its host Hero. When the host would take damage, the
//     controller may discard this Projection to fully negate the hit
//     — cancelling the damage event in `beforeDamage` is the engine's
//     "damage AND associated effects" negation lever (the Homerun! /
//     Sculpture Guards pattern).
//   • The confirm prompt shows the card whose effect would be negated
//     (the damage source), and a green-hologram "absorb" burst plays
//     on the Projection's slot when it eats the hit.
//   • A per-damage-event flag de-dupes the prompt so a Hero holding
//     several Projections is only asked once per incoming hit.
// ═══════════════════════════════════════════

const { discardAttachedIdejCard } = require('./_idej-shared');

const CARD_NAME = 'Idej Projection';

module.exports = {
  // Only relevant while attached in a Support Zone — inert in hand
  // (it has no play-effect) and elsewhere.
  activeIn: ['support'],

  hooks: {
    beforeDamage: async (ctx) => {
      if (ctx.cancelled) return;
      if (ctx.cardZone !== 'support') return;       // only while attached
      const hero = ctx.attachedHero;
      if (!hero) return;
      if (ctx.target !== hero) return;              // the host Hero must be the target
      if (!(ctx.amount > 0)) return;                // "would take any damage"

      // One prompt per damage event, even if the Hero holds several
      // Idej Projections. The flag survives across every beforeDamage
      // hook for this event (ctx.setFlag contract).
      if (ctx._idejProjectionAsked) return;
      ctx.setFlag('_idejProjectionAsked', true);

      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;

      // Show the card whose effect would be negated — the damage
      // SOURCE — rather than the Projection itself. Falls back to the
      // Projection when the source isn't a real card (status ticks).
      const srcName = ctx.source?.name || ctx.source?.cardInstance?.name || null;
      const sourceIsCard = !!(srcName && engine._getCardDB()[srcName]);
      const showCardName = sourceIsCard ? srcName : CARD_NAME;
      const fromText = sourceIsCard ? ` from ${srcName}` : '';

      const ok = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${hero.name || 'Your Hero'} would take ${ctx.amount} damage${fromText}. `
          + 'Discard Idej Projection from it to negate that damage and all associated effects?',
        showCard: showCardName,
        confirmLabel: '🛡️ Negate!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!ok) return;

      // Green-hologram absorb burst on the Projection's own slot — it
      // "ate" the hit in the Hero's place — then it flies to discard.
      engine._broadcastEvent('play_zone_animation', {
        type: 'idej_projection_absorb',
        owner: ctx.card.owner,
        heroIdx: ctx.card.heroIdx,
        zoneSlot: ctx.card.zoneSlot,
        duration: 1000,
      });
      await engine._delay(600);

      // Discard this Projection from its host Hero (self-paid cost).
      await discardAttachedIdejCard(engine, ctx.card);

      // Negate the damage AND its associated effects on this Hero —
      // cancelling the damage event in beforeDamage is the engine's
      // full-negation lever (Homerun! / Sculpture Guards pattern).
      ctx.cancelled = true;
      engine.log('idej_projection_negate', {
        player: engine.gs.players[pi]?.username,
        hero: hero.name, amount: ctx.amount, negated: srcName,
      });
      engine.sync();
    },
  },
};
