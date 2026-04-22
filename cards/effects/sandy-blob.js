// ═══════════════════════════════════════════
//  CARD EFFECT: "Sandy Blob"
//  Creature (Summoning Magic Lv0, Slimes) — 30 HP.
//
//  Up to 3 times per turn, when the on-summon
//  effect of a Creature you control activates,
//  you may choose a target your opponent controls
//  and deal 50 damage to it.
//
//  Implementation: listens on onCardEnterZone.
//  The engine fires this hook immediately AFTER
//  onPlay completes for every Creature placement
//  (normal summon, Deepsea bounce-place, Layn
//  ascended summon, Living Illusion, etc.), so
//  it serves as the de-facto "after on-summon
//  effect" trigger point.
//
//  Filters:
//    • Entering card must be a friendly Creature
//      (same controller as Sandy Blob — stolen
//      creatures count, since "control" in card
//      text means current controller).
//    • Entering card must ACTUALLY have an
//      onPlay hook — passive Creatures (including
//      other Sandy Blobs) don't spuriously burn
//      one of the 3 uses per turn.
//    • Sandy Blob itself must be active on the
//      board (not negated/nulled, host hero alive).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Sandy Blob';
const DISCHARGE_DAMAGE = 50;
const DISCHARGES_PER_TURN = 3;

module.exports = {
  activeIn: ['support'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx.toZone !== 'support') return;

      // Skip self-entry (Sandy Blob's own placement).
      if (entering.id === inst.id) return;

      // Only react to own-side Creatures. Use controller (current control)
      // so temporarily-stolen creatures fire the hook for whoever owns
      // the steal. ?? fallback handles legacy instances that predate the
      // controller field.
      const selfController = inst.controller ?? inst.owner;
      const enteringController = entering.controller ?? entering.owner;
      if (enteringController !== selfController) return;

      // Entering card must be a Creature with an on-summon effect. A
      // passive-only Creature (no on-summon hook) has no "on-summon
      // effect" per the card text — don't react. Two hook shapes count
      // as an on-summon effect:
      //   • `hooks.onPlay` — the standard shape (Deepsea Werewolf, most
      //     creatures with an on-summon payload).
      //   • top-level `beforeSummon` — used by Creatures that need to
      //     orchestrate their entrance around the placement itself
      //     (Dark Deepsea God runs its tribute + AoE damage here and
      //     deliberately leaves `hooks.onPlay` empty so the animation
      //     midpoint split works). Without this second check Sandy Blob
      //     silently ignored DDG even though its on-summon IS firing.
      const cardDB = engine._getCardDB();
      const cd = cardDB[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;
      if (cd.cardType === 'Token') return;
      const enteringScript = loadCardEffect(entering.name);
      const hasOnSummon = !!(enteringScript?.hooks?.onPlay)
        || typeof enteringScript?.beforeSummon === 'function';
      if (!hasOnSummon) return;

      // Sandy Blob must be live on the board.
      if (!inst || inst.zone !== 'support') return;
      if (inst.counters?.negated || inst.counters?.nulled) return;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      // Per-turn use tracking on the instance (matches Dragon Pilot
      // discharge accounting).
      if (!inst.counters) inst.counters = {};
      const turn = gs.turn || 0;
      if (inst.counters._sandyBlobDischargeTurn !== turn) {
        inst.counters._sandyBlobDischargeTurn = turn;
        inst.counters._sandyBlobDischargeUsed = 0;
      }
      if (inst.counters._sandyBlobDischargeUsed >= DISCHARGES_PER_TURN) return;

      const pi = selfController;
      const remaining = DISCHARGES_PER_TURN - inst.counters._sandyBlobDischargeUsed;

      // Single-step activation: go straight to the target picker. The
      // player either clicks an opponent target (activates) or cancels
      // (declines). No separate confirm dialogue — same pattern as
      // Deepsea Werewolf's on-summon damage pick. Counter increments
      // only after a target is locked in, so cancelling doesn't burn
      // a use.
      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero', 'creature'],
        damageType: 'creature',
        title: CARD_NAME,
        description: `${entering.name}'s on-summon effect just activated. Choose an opponent target to hit with a sand tornado for ${DISCHARGE_DAMAGE} damage, or cancel. (${remaining} use${remaining === 1 ? '' : 's'} left this turn)`,
        confirmLabel: `🌪️ Sand Tornado! (${DISCHARGE_DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      inst.counters._sandyBlobDischargeUsed =
        (inst.counters._sandyBlobDischargeUsed || 0) + 1;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

      engine._broadcastEvent('play_zone_animation', {
        type: 'sand_twister',
        owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(500);

      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, DISCHARGE_DAMAGE, 'creature');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
          target.cardInstance, DISCHARGE_DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('sandy_blob_blast', {
        player: gs.players[pi]?.username,
        trigger: entering.name,
        target: target.cardName,
        damage: DISCHARGE_DAMAGE,
        usesRemaining: DISCHARGES_PER_TURN - inst.counters._sandyBlobDischargeUsed,
      });
      engine.sync();
    },
  },
};
