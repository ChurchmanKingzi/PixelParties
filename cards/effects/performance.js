// ═══════════════════════════════════════════
//  CARD EFFECT: "Performance"
//  Ability — attaches on top of ANY existing
//  Ability with level <3. Increases that
//  Ability's level by 1. Visually transforms
//  into a copy of the Ability below it.
//  When played: the Hero takes 50 damage.
//
//  Performance copies the ability below it,
//  so it delegates to the copied ability's
//  onPlay and onCardLeaveZone hooks. This
//  makes stat bonuses (Fighting ATK, Toughness
//  HP, etc.) apply and reverse correctly.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

module.exports = {
  activeIn: ['ability'],

  // When stacked on an ability, Performance counts as that ability's
  // spell school for spell-school requirement checks.
  isWildcardAbility: true,

  cpuMeta: {
    // CPU ability-placement bias: prefer Heroes that already have a
    // Divinity stack (1-2 deep — full Lv3 zones aren't legal for
    // Performance per its customPlacement gate). When such heroes
    // exist, the planner restricts Performance placements to them
    // and snaps the slot to the matching Divinity zone. Falls
    // through (no bias) when no qualifying Hero exists.
    cpuPlacementBias(engine, pi) {
      const ps = engine.gs.players[pi];
      const heroes = ps.heroes || [];
      const allowedHeroes = new Set();
      const slotByHero = new Map();
      for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (ps.abilityGivenThisTurn?.[hi]) continue;
        const abZones = ps.abilityZones?.[hi] || [];
        for (let z = 0; z < 3; z++) {
          const zoneArr = abZones[z] || [];
          if (zoneArr.length === 0 || zoneArr.length >= 3) continue;
          if (zoneArr[0] !== 'Divinity') continue;
          allowedHeroes.add(hi);
          slotByHero.set(hi, z);
          break;
        }
      }
      if (allowedHeroes.size === 0) return null;
      return { allowedHeroes, slotByHero };
    },
  },

  // Custom placement rules — overrides standard ability placement.
  // Performance can ONLY go onto occupied ability zones with <3 cards.
  // It CANNOT go into empty zones, and it works on ANY ability type.
  customPlacement: {
    /**
     * Check if this card can be placed in a specific zone.
     * @param {Array} zone - The ability zone array (e.g. ["Destruction Magic", "Destruction Magic"])
     * @returns {boolean}
     */
    canPlace: (zone) => {
      return zone.length > 0 && zone.length < 3;
    },
  },

  hooks: {
    onPlay: async (ctx) => {
      // Deal 50 damage to the hero this was attached to
      const hero = ctx.attachedHero;
      if (hero) {
        await ctx.dealDamage(hero, 50);
      }

      // Performance copies the ability below it — delegate to that ability's onPlay.
      // This makes Performance trigger stat bonuses (Fighting ATK, Toughness HP, etc.)
      // just like a real copy of that ability would.
      const ps = ctx.players[ctx.cardOwner];
      const zone = (ps.abilityZones[ctx.cardHeroIdx] || [])[ctx.card.zoneSlot] || [];
      if (zone.length < 2) return; // No ability below (shouldn't happen with customPlacement)
      // ── Kopierziel auflösen: erste NICHT-Performance-Karte im Slot ──
      // zone[0] kann selbst 'Performance' sein (z. B. wenn ein Effekt die
      // Basis-Ability aus dem Slot entfernt hat und die Performances
      // nachgerutscht sind). Naiv zone[0] zu laden hieße dann: Performance
      // delegiert an ihr eigenes onPlay → Endlos-Rekursion mit 50 Schaden
      // pro Ebene, bis der Damage-Cap der Engine zieht (live beobachtet,
      // Stack: performance.js:89 → :89 → :89 …). Regelrichtig ist ohnehin:
      // Performance kopiert die zugrundeliegende ECHTE Ability — eine
      // andere Performance ist selbst nur Kopie.
      const baseAbilityName = zone.find(n => n !== 'Performance');
      if (!baseAbilityName) return; // Slot besteht nur aus Performances → nichts zu kopieren
      ctx.card.counters.copiedAbility = baseAbilityName; // Remember for onCardLeaveZone

      // ── Rekursionsguard (Sicherheitsnetz) ──
      // Schützt zusätzlich gegen INDIREKTE Delegations-Zyklen (Ability A
      // delegiert an B, B zurück an A) über den geteilten Hook-Kontext.
      ctx._performanceDelegationDepth = (ctx._performanceDelegationDepth || 0) + 1;
      try {
        if (ctx._performanceDelegationDepth > 3) {
          console.warn(`[Performance] Delegations-Tiefe > 3 (→ "${baseAbilityName}") — Rekursionsguard bricht ab`);
          return;
        }
        const baseScript = loadCardEffect(baseAbilityName);
        if (baseScript?.hooks?.onPlay) {
          await baseScript.hooks.onPlay(ctx);
        }
      } finally {
        ctx._performanceDelegationDepth--;
      }
    },

    onCardLeaveZone: async (ctx) => {
      // Only react when an ability card leaves (not creatures dying in support zones)
      if (ctx.fromZone !== 'ability') return;
      // When Performance leaves, reverse the copied ability's effects.
      // Delegate to the copied ability's onCardLeaveZone hook so that
      // stat bonuses (Fighting ATK, Toughness HP, etc.) are properly removed.
      const copiedAbility = ctx.card.counters.copiedAbility;
      if (!copiedAbility) return;
      // Altbestände können 'Performance' als copiedAbility tragen (vor dem
      // Auflösungs-Fix gespeichert) — Selbst-Delegation hier genauso
      // rekursiv wie in onPlay, daher identischer Guard.
      if (copiedAbility === 'Performance') return;
      ctx._performanceDelegationDepth = (ctx._performanceDelegationDepth || 0) + 1;
      try {
        if (ctx._performanceDelegationDepth > 3) {
          console.warn(`[Performance] Delegations-Tiefe > 3 (leaveZone → "${copiedAbility}") — Rekursionsguard bricht ab`);
          return;
        }
        const baseScript = loadCardEffect(copiedAbility);
        if (baseScript?.hooks?.onCardLeaveZone) {
          await baseScript.hooks.onCardLeaveZone(ctx);
        }
      } finally {
        ctx._performanceDelegationDepth--;
      }
    },
  },
};
