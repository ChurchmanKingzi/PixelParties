// ═══════════════════════════════════════════
//  CARD EFFECT: "Diamond, the Keeper of Peace"
//  Hero — Two passive effects:
//
//  1) Creatures you control with original level 0
//     are completely immune to status effect damage
//     (Burn, Poison ticks).
//
//  2) When any Creature(s) you control would take
//     damage from an opponent's card or effect,
//     prompt: "Protect [name]?" (or "Protect your
//     Creatures?" for multiple).
//     YES → Negate the damage (unless un-negatable),
//           deal 30 × affected creature count to
//           Diamond. This CAN kill Diamond.
//     NO  → Damage proceeds normally.
//
//  Damage negation: if canBeNegated is false,
//  Diamond still takes the 30× self-damage but
//  the creature damage is NOT prevented.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * beforeCreatureDamageBatch — fires before a batch of creatures takes damage.
     * Diamond intercepts to:
     *   Effect 1: Cancel status damage for original-Lv0 creatures (silent, no prompt).
     *   Effect 2: Prompt to protect creatures from opponent damage.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.attachedHero;
      if (!hero || hero.hp <= 0) return;

      const entries = ctx.entries;
      if (!entries || entries.length === 0) return;

      // ── Effect 1: Status damage immunity for original-Lv0 creatures ──
      for (const e of entries) {
        if (e.cancelled) continue;
        if (e.inst.owner !== pi) continue;
        if (!e.isStatusDamage) continue;
        if (e.originalLevel !== 0) continue;
        // This creature has original level 0 and is taking status damage → immune
        e.cancelled = true;
        engine.log('diamond_status_immune', { creature: e.inst.name, type: e.type, hero: hero.name });
      }

      // ── Effect 2: Protection prompt for opponent-sourced creature damage ──
      // Collect entries where the source is the opponent
      const oppIdx = pi === 0 ? 1 : 0;
      const opponentEntries = entries.filter(e =>
        !e.cancelled &&
        e.inst.owner === pi &&
        e.sourceOwner === oppIdx &&
        e.originalLevel === 0
      );

      if (opponentEntries.length === 0) return;

      // HOPT check (soft, per hero instance)
      const hoptKey = `diamond-protect:${pi}:${heroIdx}`;
      if (engine.gs.hoptUsed?.[hoptKey] === engine.gs.turn) return;

      // Build prompt message
      const creatureNames = [...new Set(opponentEntries.map(e => e.inst.name))];
      const selfDamage = 30 * opponentEntries.length;
      const protectLabel = creatureNames.length === 1
        ? `Protect ${creatureNames[0]}?`
        : 'Protect your Creatures?';

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Diamond, the Keeper of Peace',
        message: `${protectLabel}\nDiamond takes ${selfDamage} damage (30 × ${opponentEntries.length}).`,
        confirmLabel: `🛡️ Protect! (${selfDamage} dmg to Diamond)`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in self-damage protect.
      });

      if (!confirmed || confirmed.cancelled) return;

      // Claim HOPT
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      engine.gs.hoptUsed[hoptKey] = engine.gs.turn;

      // Cancel negatable entries — un-negatable ones still proceed
      let negatedCount = 0;
      for (const e of opponentEntries) {
        if (e.canBeNegated !== false) {
          e.cancelled = true;
          negatedCount++;
          engine.log('diamond_protect', { creature: e.inst.name, amount: e.amount, negated: true });
        } else {
          engine.log('diamond_protect_failed', { creature: e.inst.name, amount: e.amount, reason: 'cannot_be_negated' });
        }
      }

      // Diamond takes 30 × total affected creatures (even those that couldn't be negated)
      engine.log('diamond_self_damage', { hero: hero.name, amount: selfDamage, protectedCount: opponentEntries.length, negatedCount });

      // Play shield animation on Diamond
      engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', owner: ctx.cardHeroOwner, heroIdx, zoneSlot: -1 });

      // Deal damage to Diamond (type 'other', can kill)
      await engine.actionDealDamage({ name: 'Diamond, the Keeper of Peace' }, hero, selfDamage, 'other');
      engine.sync();
    },
  },
};
