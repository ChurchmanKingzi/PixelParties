// ═══════════════════════════════════════════
//  CARD EFFECT: "Fighting"
//  Ability — Grants bonus ATK to the attached
//  Hero based on stack level.
//  Lv1: +10, Lv2: +10, Lv3: +20 (total +40).
//  On removal, subtracts the granted ATK.
//  Works for starting abilities (onGameStart).
// ═══════════════════════════════════════════

const ATK_PER_LEVEL = [10, 10, 20]; // Index 0 = 1st copy, etc.

/** Apply ATK bonus to a hero and store it on the card instance. */
function applyBonus(engine, card, hero, ownerIdx, heroIdx, copyIndex) {
  const bonus = ATK_PER_LEVEL[Math.min(copyIndex, ATK_PER_LEVEL.length - 1)];

  // Routed through the engine's canonical ATK delta helper so the
  // Curse suppression gate fires uniformly — a cursed Hero's
  // visible ATK stays at 0 and the bonus lands in the hidden
  // accumulator instead. The card-instance counter is always set
  // (the cleanse / leave-zone path will pull it from there to know
  // how much to revoke).
  engine._applyHeroAtkDelta(hero, ownerIdx, heroIdx, bonus);
  card.counters.atkGranted = bonus;

  engine.log('fighting_atk_up', { hero: hero.name, amount: bonus, copy: copyIndex + 1 });
  engine.sync();
}

module.exports = {
  activeIn: ['ability'],
  // Lizbeth/Smugbeth: Fighting is opted OUT of the engine's auto-mirror
  // because the spec wants override semantics (highest opponent
  // Fighting bonus replaces Lizbeth's own if greater, only one
  // contributing at a time), not the additive "+10 per copy" the
  // mirror would produce. Lizbeth's hero script computes the override
  // delta in its own hooks instead.
  disableLizbethMirror: true,

  cpuMeta: {
    // CPU host preference for attaching Fighting. Fighting purely
    // boosts the host Hero's ATK, so it's worth most on whichever Hero
    // hits hardest. `scoreAbilityPlacement` sums this onto the
    // placement score; for a non-school ability like Fighting the
    // other terms are ~0, so the highest-ATK eligible Hero wins (ties
    // broken at random by the caller) — covering the "no Hero has
    // Fighting yet → give it to the highest-ATK Hero" case as well as
    // stacking onto the biggest attacker.
    //
    // Thorad, Strength of Coolness gets a flat +160: his Attacks scale
    // with the Coolness Stack, which grows every turn, so his raw
    // 80 ATK badly understates his true attacking value. The bonus
    // makes him very likely to be seen as the most valuable Fighting
    // host.
    attachmentBonus(engine, pi, heroIdx) {
      const hero = engine?.gs?.players?.[pi]?.heroes?.[heroIdx];
      if (!hero?.name || (hero.hp || 0) <= 0) return 0;
      let atk = hero.atk || 0;
      if (hero.name === 'Thorad, Strength of Coolness') atk += 160;
      return atk;
    },
  },

  hooks: {
    /**
     * When played during the game, grant ATK based on zone level.
     */
    onPlay: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;

      const ps = ctx.players[ctx.cardOwner];
      const zone = (ps.abilityZones[ctx.cardHeroIdx] || [])[ctx.card.zoneSlot] || [];
      const copyIndex = zone.length - 1;

      applyBonus(ctx._engine, ctx.card, hero, ctx.cardOwner, ctx.cardHeroIdx, copyIndex);
    },

    /**
     * At game start, apply ATK bonus for starting abilities.
     */
    onGameStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;

      const engine = ctx._engine;
      const sameZone = engine.cardInstances.filter(c =>
        c.owner === ctx.cardOwner && c.zone === 'ability' &&
        c.heroIdx === ctx.cardHeroIdx && c.zoneSlot === ctx.card.zoneSlot &&
        c.name === 'Fighting'
      );
      const processedCount = sameZone.filter(c => c.counters.atkGranted > 0).length;

      applyBonus(engine, ctx.card, hero, ctx.cardOwner, ctx.cardHeroIdx, processedCount);
    },

    /**
     * When removed, subtract the stored ATK bonus.
     * Only reacts when an ABILITY zone card leaves — ignores creature/support zone departures.
     */
    onCardLeaveZone: async (ctx) => {
      // Only react when an ability card leaves (not creatures dying in support zones)
      if (ctx.fromZone !== 'ability') return;
      // Self-only: ctx.card is the LISTENING Fighting, so the
      // `atkGranted > 0` check used to wrongly revoke this hero's ATK
      // every time some OTHER ability left the board. Compare instance
      // ids so only the actually-departing Fighting decrements ATK.
      if (ctx.leavingCard && ctx.leavingCard.id !== ctx.card?.id) return;
      const engine = ctx._engine;
      const atkGranted = ctx.card.counters.atkGranted || 0;
      if (atkGranted <= 0) return;

      const hero = ctx.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!hero || !hero.name) return;

      // Same canonical-helper route as the grant path above —
      // mirrors the Curse-suppression accumulator for revoke
      // semantics. The broadcast fires inside the helper only when
      // the hero is NOT cursed (visible stat unchanged otherwise).
      engine._applyHeroAtkDelta(hero, ctx.cardOwner, ctx.cardHeroIdx, -atkGranted);

      ctx.log('fighting_atk_down', { hero: hero.name, amount: atkGranted });
      engine.sync();
    },
  },
};
