// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Terrier"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  Whenever a "Loyal" Creature you control is
//  defeated, except "Loyal Terrier", you may
//  deal 50 damage to a target your opponent
//  controls.
//
//  Wiring:
//   • Pure passive: no activation, no setup, no
//     watch window. The trigger is just an
//     `onCreatureDeath` listener that fires per
//     dying Loyal on the controller's side.
//   • Self-exclusion: Terrier's own death does
//     NOT trigger it (or any sibling Terrier).
//     Terriers die freely as fodder for OTHER
//     death-trigger sources, but the per-Terrier
//     50 damage payout is reserved for non-
//     Terrier Loyal deaths. Closes the previous
//     "every Loyal Terrier in a multi-Terrier
//     wipe each chains a 50-damage shot off
//     every other Terrier dying" runaway.
//   • Per-Terrier, per-death: two Terriers in
//     play each prompt once per non-Terrier
//     Loyal death. Each prompt is cancellable
//     so a player can decline freely without
//     burning anything.
//   • No "Activate?" confirm step — the target
//     picker IS the opt-in (cancel = decline),
//     same shape Bamboo Staff uses.
// ═══════════════════════════════════════════

const { isLoyalCreature } = require('./_loyal-shared');

const CARD_NAME = 'Loyal Terrier';
const FOLLOW_DMG = 50;

module.exports = {
  activeIn: ['support'],

  // ── CPU evaluation hints ──────────────────────────────────────────
  // Terrier is a "chain source" — when an own non-Terrier Loyal dies,
  // it deals 50 damage to an opp target. The CPU brain reads
  // `cpuMeta.chainSource` generically:
  //   • For each chain source on a side, OTHER creatures matching
  //     `triggersOn` get their slot value discounted by
  //     `valuePerTrigger` (encouraging the CPU to spend Loyals as
  //     chain fodder via Book of Doom etc.).
  //   • Chain sources themselves are NEVER discounted by other chain
  //     sources of the same kind — the eval explicitly skips applying
  //     chain bonuses to any creature that itself declares
  //     `chainSource`. Combined with `triggersOn` returning false for
  //     Terrier itself, the picture stays consistent: Terriers don't
  //     value other Terriers' deaths and never look like sacrifice
  //     fodder to a sibling Terrier.
  cpuMeta: {
    chainSource: {
      // Always armed — no setup required.
      isArmed: () => true,
      triggersOn(engine, tributeInst /*, sourceInst */) {
        // Self-exclusion mirrors the runtime hook: Terrier deaths do
        // NOT pay out a Terrier's chain.
        if (tributeInst.name === CARD_NAME) return false;
        const { isLoyalCreature } = require('./_loyal-shared');
        return isLoyalCreature(tributeInst.name, engine);
      },
      valuePerTrigger: FOLLOW_DMG,
    },
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOriginalOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // Simultaneous-death gate: when a multi-target wipe (Book of
      // Doom, AoEs, Forbidden Zone, …) takes Terrier out alongside
      // the Loyal that just died, the engine processes the dying
      // entries one at a time — so the listener could fire on a
      // sibling's death even though Terrier itself is doomed in the
      // same batch. The damage path pre-marks every lethal entry's
      // instance with `_dyingThisBatch` BEFORE applying any HP, so
      // we can detect "I'm also about to die" here and bail. Matches
      // the user's "they all die simultaneously" semantics — and
      // matches Loyal Shepherd's identical guard.
      //
      // Bone Dog exception: Bone Dog's "kill and revive" flow re-
      // summons a fresh CardInstance via summonCreatureWithHooks
      // after onCreatureDeath has fired for the dying Terrier. The
      // revived Terrier has a brand-new `counters` object — no
      // `_dyingThisBatch` flag — so it correctly fires for every
      // subsequent Loyal death in the batch. No code change needed
      // for that case; it falls out of the engine's revive path.
      if (ctx.card.counters?._dyingThisBatch) return;

      // Dying creature must be ours.
      if ((death.owner ?? death.originalOwner) !== pi) return;
      // …and a Loyal that is NOT Terrier itself ("except Loyal
      // Terrier"). Excluding Terrier here prevents the runaway where
      // every Terrier in a multi-Terrier wipe paid out a 50-damage
      // shot off every sibling Terrier's death.
      if (death.name === CARD_NAME) return;
      if (!isLoyalCreature(death.name, engine)) return;

      // Need at least one opp target. No prompt if there's nothing
      // to hit (matches the UX from Bamboo Staff / Bone Dog).
      const oi = pi === 0 ? 1 : 0;
      const oppPs = gs.players[oi];
      if (!oppPs) return;
      const hasOppTarget = (() => {
        for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
          const h = oppPs.heroes[hi];
          if (h?.name && h.hp > 0) return true;
          const sz = oppPs.supportZones?.[hi] || [];
          for (const slot of sz) if ((slot || []).length > 0) return true;
        }
        return false;
      })();
      if (!hasOppTarget) return;

      // Straight to the target picker — cancel = decline. No
      // separate "Activate?" confirmation.
      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero', 'creature'],
        damageType: 'normal',
        baseDamage: FOLLOW_DMG,
        title: CARD_NAME,
        description: `${death.name} was defeated! Choose an opponent's target to take ${FOLLOW_DMG} damage.`,
        confirmLabel: `🐾 ${FOLLOW_DMG} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'dog_bite',
        owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(420);

      const dmgSource = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx };
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.actionDealDamage(dmgSource, tgtHero, FOLLOW_DMG, 'normal');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          dmgSource, target.cardInstance, FOLLOW_DMG, 'normal',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('loyal_terrier_death_proc', {
        player: ps.username, fallen: death.name, target: target.cardName,
      });
      engine.sync();
    },
  },
};
