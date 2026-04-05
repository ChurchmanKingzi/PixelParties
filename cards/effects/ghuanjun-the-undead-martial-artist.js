// ═══════════════════════════════════════════
//  CARD EFFECT: "Ghuanjun, the Undead Martial Artist"
//  Uses generic bonusActions system for the combo.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  canPlayCard: (gs, pi, heroIdx, cardData, engine) => {
    const ps = gs.players[pi];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero) return true;
    // During active bonus actions: only allowed types
    if (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0) {
      const allowed = ps.bonusActions.allowedTypes || [];
      if (allowed.length > 0 && !allowed.includes(cardData.cardType)) return false;
    }
    // Duplicate Attack ban (always active for Ghuanjun)
    if (cardData.cardType !== 'Attack') return true;
    const used = hero.ghuanjunAttacksUsed || [];
    return !used.includes(cardData.name);
  },

  hooks: {
    onActionUsed: async (ctx) => {
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.actionType !== 'attack') return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Track Attack name (duplicate ban)
      if (!hero.ghuanjunAttacksUsed) hero.ghuanjunAttacksUsed = [];
      if (!hero.ghuanjunAttacksUsed.includes(ctx.playedCardName)) {
        hero.ghuanjunAttacksUsed.push(ctx.playedCardName);
      }

      if (gs.currentPhase !== 3) return;

      // ── BONUS ACTION CONTINUATION ──
      if (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0) {
        ps.bonusActions.remaining--;
        if (ps.bonusActions.remaining > 0) gs._preventPhaseAdvance = true;
        engine.sync();
        return;
      }

      // ── COMBO INITIATION ──
      if (hero._ghuanjunComboUsed) return;
      const otherHeroesActed = (ps.heroesActedThisTurn || []).some(hi => hi !== heroIdx);
      if (otherHeroesActed) return;

      const wantsCombo = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Ghuanjun, the Undead Martial Artist',
        message: 'Perform a combo with Ghuanjun? (2 additional Attacks, but no other Hero can act this turn)',
        confirmLabel: '⚔️ Combo!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!wantsCombo) return;

      hero._ghuanjunComboUsed = true;
      ps.bonusActions = { heroIdx, remaining: 2, allowedTypes: ['Attack'] };
      ps.comboLockHeroIdx = heroIdx;

      // Flash Ghuanjun to indicate combo activation
      engine._broadcastEvent('play_zone_animation', { type: 'electric_strike', owner: pi, heroIdx, zoneSlot: -1 });
      await engine._delay(300);

      const oppIdx = pi === 0 ? 1 : 0;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (hi === heroIdx) continue;
        const otherHero = ps.heroes[hi];
        if (!otherHero?.name) continue;
        if (!otherHero.buffs) otherHero.buffs = {};
        otherHero.buffs.combo_locked = {
          source: 'Ghuanjun', expiresAtTurn: gs.turn + 1, expiresForPlayer: oppIdx,
        };
      }

      gs._preventPhaseAdvance = true;
      engine.log('ghuanjun_combo', { player: ps.username, hero: hero.name });
      engine.sync();
    },

    onAdditionalActionUsed: (ctx) => {
      if (ctx.heroIdx !== ctx.cardHeroIdx || ctx.playerIdx !== ctx.cardOwner || ctx.actionType !== 'attack') return;
      const hero = ctx.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;
      if (!hero.ghuanjunAttacksUsed) hero.ghuanjunAttacksUsed = [];
      if (!hero.ghuanjunAttacksUsed.includes(ctx.playedCardName)) hero.ghuanjunAttacksUsed.push(ctx.playedCardName);
    },

    // Flag Ghuanjun's Attacks to cap damage at target HP - 1 (prevents kills)
    // Uses setFlag so the cap applies AFTER all other modifiers (Sacred Hammer, etc.)
    beforeDamage: (ctx) => {
      if (ctx.type !== 'attack') return;
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (sourceOwner !== ctx.cardOwner) return;
      ctx.setFlag('capAtHPMinus1', true);
    },

    // After Attack damage to hero: apply Immortal buff for other sources
    afterDamage: async (ctx) => {
      if (ctx.type !== 'attack') return;
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (sourceOwner !== ctx.cardOwner) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      if (target.buffs?.immortal) return;
      if (!target.buffs) target.buffs = {};
      target.buffs.immortal = { source: 'Ghuanjun', expiresAtTurn: gs.turn + 1, expiresForPlayer: oppIdx };
      engine.log('immortal_applied', { target: target.name || 'Hero', by: 'Ghuanjun' });
      engine.sync();
    },

    // Flag creature damage from Ghuanjun Attacks for HP-1 cap
    beforeCreatureDamageBatch: (ctx) => {
      if (!ctx.entries) return;
      const heroIdx = ctx.cardHeroIdx;
      const pi = ctx.cardOwner;
      for (const e of ctx.entries) {
        if (e.type !== 'attack' || e.cancelled) continue;
        if ((e.source?.heroIdx ?? -1) !== heroIdx || (e.source?.owner ?? -1) !== pi) continue;
        e.capAtHPMinus1 = true;
      }
    },

    // After creature batch: apply Immortal buff
    afterCreatureDamageBatch: (ctx) => {
      if (!ctx.entries) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const heroIdx = ctx.cardHeroIdx;
      for (const e of ctx.entries) {
        if (e.type !== 'attack') continue;
        if ((e.source?.heroIdx ?? -1) !== heroIdx || (e.source?.owner ?? -1) !== pi) continue;
        const inst = e.inst;
        if (!inst || inst.zone !== 'support' || inst.counters?.buffs?.immortal) continue;
        if (!inst.counters.buffs) inst.counters.buffs = {};
        inst.counters.buffs.immortal = { source: 'Ghuanjun', expiresAtTurn: gs.turn + 1, expiresForPlayer: oppIdx };
        engine.log('immortal_applied', { target: inst.name, by: 'Ghuanjun' });
      }
    },
  },
};
