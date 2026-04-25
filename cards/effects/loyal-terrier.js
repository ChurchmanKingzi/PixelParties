// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Terrier"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  Whenever 1 or more "Loyal" Creatures you
//  control are defeated (including this one),
//  you may deal 50 damage to a target your
//  opponent controls.
//
//  Wiring:
//   • Pure passive: no activation, no setup, no
//     watch window. The trigger is just an
//     `onCreatureDeath` listener that fires per
//     dying Loyal on the controller's side.
//   • "Including this one": Terrier's own death
//     triggers it too. The engine fires
//     ON_CREATURE_DEATH after splicing the dying
//     creature out of its slot but BEFORE
//     _untrackCard, so the dying Terrier is
//     still tracked + active in 'support' when
//     the hook iterates listeners. Same window
//     Hell Fox uses to self-detect.
//   • Per-Terrier, per-death: two Terriers in
//     play each prompt once per Loyal death.
//     Each prompt is cancellable so a player can
//     decline freely without burning anything.
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
  // Terrier is a "chain source" — when an own Loyal dies, it deals 50
  // damage to an opp target. The CPU brain reads `cpuMeta.chainSource`
  // generically:
  //   • For each chain source on a side, OTHER creatures matching
  //     `triggersOn` get their slot value discounted by
  //     `valuePerTrigger` (encouraging the CPU to spend Loyals as
  //     chain fodder via Book of Doom etc.).
  //   • Chain sources themselves are NEVER discounted by other chain
  //     sources of the same kind — the eval explicitly skips applying
  //     chain bonuses to any creature that itself declares
  //     `chainSource`. The CPU still treats Terriers as precious
  //     even though `triggersOn` returns true for Terrier itself
  //     ("including this one"): the slot-preservation guard wins,
  //     which is the right call — the on-self-death trigger is a
  //     consolation when Terrier inevitably dies, not a reason to
  //     proactively kill your own.
  cpuMeta: {
    chainSource: {
      // Always armed — no setup required.
      isArmed: () => true,
      triggersOn(engine, tributeInst /*, sourceInst */) {
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

      // Dying creature must be ours.
      if ((death.owner ?? death.originalOwner) !== pi) return;
      // …and a Loyal (Terrier itself qualifies — "including this one").
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
