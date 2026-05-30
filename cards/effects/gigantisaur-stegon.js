// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Stegon"
//  Creature (Normal, Lv3, Summoning Magic) — Gigantisaurs
//  HP 500
//
//  ① UNIQUENESS — shared archetype rule.
//
//  ② RECOIL (HOPT) — once per turn, when a
//    Gigantisaur Creature YOU control takes
//    damage from an Attack, Spell, or Creature
//    effect, you may discard 1 card → deal the
//    same damage to the attacker as recoil.
// ═══════════════════════════════════════════

const {
  gigantisaursCanSummon, isGigantisaurCreature,
} = require('./_gigantisaurs-shared');

const CARD_NAME = 'Gigantisaur Stegon';
const HOPT_KEY = 'stegon-recoil';
// Damage-type allow-list for the trigger. Matches Fireshield's
// "Attack/Spell/Creature effect" carve-out: rejects status ticks,
// burn/poison residuals, artifact triggers, and 'other' generic.
const TRIGGER_TYPES = new Set([
  'attack', 'spell', 'destruction_spell', 'support_spell',
  'creature_effect',
]);

module.exports = {
  activeIn: ['support'],
  canSummon: gigantisaursCanSummon,

  hooks: {
    /**
     * Recoil trigger. Iterates the batch entries: for each entry
     * that damaged an own Gigantisaur via a qualifying source type,
     * offer the controller a discard-to-recoil prompt. Only ONE
     * recoil per turn (shared across Stegons via the per-controller
     * HOPT).
     */
    afterCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (inst.counters?.negated || inst.counters?.nulled) return;

      const pi = ctx.cardOwner;
      const gs = engine.gs;
      const ps = gs.players[pi];
      if (!ps) return;

      // Per-controller HOPT — one Stegon recoil per turn, shared
      // across however many Stegons are on the controller's side.
      const hoptKey = `${HOPT_KEY}:${pi}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      const entries = Array.isArray(ctx.entries) ? ctx.entries : [];
      for (const e of entries) {
        if (!e || !e.inst || !(e.amount > 0)) continue;
        // Full negation (Spectral Armor zero-cap, Anti Magic void,
        // future damage-cancellation reactions on the Gigantisaur
        // owner's side) → the Gigantisaur didn't actually take
        // damage, so no recoil should fire.
        if (e.cancelled) continue;
        // Damaged Creature is owned by us AND is a Gigantisaur.
        const target = e.inst;
        if ((target.controller ?? target.owner) !== pi) continue;
        if (!isGigantisaurCreature(target.name, engine)) continue;
        // Damage type qualifies.
        const type = e.type || 'normal';
        if (!TRIGGER_TYPES.has(type)) continue;

        const src = e.source;
        if (!src) continue;
        // Attacker side — exclude self-hits (recoil shouldn't fire
        // on a Gigantisaur that damaged itself somehow).
        const srcOwner = src.owner ?? src.controller;
        if (srcOwner == null || srcOwner === pi) continue;

        // Identify the attacker — Creature source via `cardInstance`
        // wrapper (matches Fireshield's pattern) or Hero source via
        // `(owner, heroIdx)`.
        const srcInstHint = src.cardInstance
          || (src.zone === 'support' ? src : null);
        let attackerKind = null;
        let attackerInst = null;
        let attackerHero = null;
        if (srcInstHint) {
          const liveInst = engine.cardInstances.find(c => c.id === srcInstHint.id);
          if (!liveInst || liveInst.zone !== 'support') continue;
          attackerKind = 'creature';
          attackerInst = liveInst;
        } else {
          const srcHeroIdx = src.heroIdx ?? -1;
          if (srcHeroIdx < 0) continue;
          const h = gs.players[srcOwner]?.heroes?.[srcHeroIdx];
          if (!h?.name || h.hp <= 0) continue;
          attackerKind = 'hero';
          attackerHero = h;
        }

        // Need ≥1 hand card to pay the discard cost — silently
        // skip otherwise (don't prompt for an impossible cost).
        if ((ps.hand?.length || 0) < 1) return;

        const recoilAmount = e.amount;
        const attackerLabel = attackerKind === 'hero'
          ? attackerHero.name
          : attackerInst?.name;
        const confirmed = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: `${target.name} took ${recoilAmount} damage from ${attackerLabel || 'the attacker'}. Discard 1 card to recoil that damage back?`,
          showCard: CARD_NAME,
          confirmLabel: `🦕 Recoil! (${recoilAmount})`,
          cancelLabel: 'No',
          cancellable: true,
        });
        if (!confirmed) return;

        // Pay the discard cost. If it fails (race), bail.
        const handBefore = ps.hand.length;
        await engine.actionPromptForceDiscard(pi, 1, {
          title: CARD_NAME,
          source: CARD_NAME,
          selfInflicted: true,
        });
        if (ps.hand.length >= handBefore) return;

        // Claim the HOPT.
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[hoptKey] = gs.turn;

        // Apply the recoil.
        const recoilSource = { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx };
        if (attackerKind === 'hero') {
          await engine.actionDealDamage(
            recoilSource, attackerHero, recoilAmount, 'other',
            { _skipReactionCheck: true },
          );
        } else if (attackerInst) {
          await engine.actionDealCreatureDamage(
            recoilSource, attackerInst, recoilAmount, 'other',
            { sourceOwner: pi, canBeNegated: true },
          );
        }

        engine.log('stegon_recoil', {
          player: ps.username, target: target.name,
          attacker: attackerLabel, amount: recoilAmount,
        });
        engine.sync();
        return; // One recoil per turn — bail out of the batch loop.
      }
    },
  },
};
