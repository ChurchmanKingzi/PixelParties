// ═══════════════════════════════════════════
//  CARD EFFECT: "Ghuanjun, the Undead Martial Artist"
//  Uses generic bonusActions system for the combo.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['hero'],

  // Accept Ghuanjun's combo prompt when the CPU controls him. The outer CPU
  // turn driver has a loop that keeps firing Action-Phase plays while
  // bonusActions.remaining > 0 and a legal Attack exists in hand, so opting
  // into combo is always safe: the driver will run as many follow-up Attacks
  // as it can and cleanly advance when it runs out.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData.type !== 'confirm') return undefined;
    // The combo prompt uses confirmLabel '⚔️ Combo!' — match on that.
    if (/combo/i.test(promptData.confirmLabel || '')) {
      return { confirmed: true };
    }
    return undefined;
  },

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
    if (!hasCardType(cardData, 'Attack')) return true;
    const used = hero.ghuanjunAttacksUsed || [];
    return !used.includes(cardData.name);
  },

  hooks: {
    // Reset per-turn attack tracking at the start of each turn
    onTurnStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (hero) {
        hero.ghuanjunAttacksUsed = [];
        hero._ghuanjunComboUsed = false;
      }
    },

    // Remove Ghuanjun's immortal buffs at the END of the owner's turn.
    // The buff also carries expiresBeforeStatusDamage as a safety net
    // in case Ghuanjun dies mid-turn (dead heroes' hooks don't fire).
    onTurnEnd: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      let expired = false;

      // Remove from heroes
      for (let tpi = 0; tpi < 2; tpi++) {
        const ps = gs.players[tpi];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (hero?.buffs?.immortal?.source === 'Ghuanjun') {
            await engine.actionRemoveBuff(hero, tpi, hi, 'immortal');
            expired = true;
          }
        }
      }

      // Remove from creatures
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support' || !inst.counters?.buffs?.immortal) continue;
        if (inst.counters.buffs.immortal.source !== 'Ghuanjun') continue;
        await engine.actionRemoveCreatureBuff(inst, 'immortal');
        expired = true;
      }

      if (expired) engine.sync();
    },

    onActionUsed: async (ctx) => {
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner; // Effective controller (auto-resolved)
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[ctx.cardOriginalOwner]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      if (ctx.playerIdx !== pi) return;
      if (ctx.actionType !== 'attack') return;

      const ps = gs.players[pi];

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
        gerrymanderEligible: true, // True "you may" — opt-in combo with downside.
      });
      if (!wantsCombo) return;

      hero._ghuanjunComboUsed = true;
      ps.bonusActions = { heroIdx, remaining: 2, allowedTypes: ['Attack'] };
      ps.comboLockHeroIdx = heroIdx;

      // Flash Ghuanjun to indicate combo activation
      engine._broadcastEvent('play_zone_animation', { type: 'electric_strike', owner: ctx.cardOriginalOwner, heroIdx, zoneSlot: -1 });
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
      const hero = ctx.players[ctx.cardOriginalOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;
      if (!hero.ghuanjunAttacksUsed) hero.ghuanjunAttacksUsed = [];
      if (!hero.ghuanjunAttacksUsed.includes(ctx.playedCardName)) hero.ghuanjunAttacksUsed.push(ctx.playedCardName);
    },

    // Flag Ghuanjun's Attacks to cap damage at target HP - 1 (prevents kills)
    // Uses setFlag so the cap applies AFTER all other modifiers (Sacred Hammer, etc.)
    // Also enforces base ATK damage: only corrects Attacks that declare usesHeroAtk
    // (i.e. attacks that deal hero.atk damage). Attacks that already use baseAtk
    // (Strong Ox, Tiger Kick, Venom Snake) don't set the flag and are left alone.
    beforeDamage: (ctx) => {
      if (ctx.type !== 'attack') return;
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (sourceOwner !== ctx.cardOwner) return;
      ctx.setFlag('capAtHPMinus1', true);

      if (ctx.source?.usesHeroAtk) {
        const hero = ctx.players?.[ctx.cardOriginalOwner]?.heroes?.[ctx.cardHeroIdx];
        if (hero && hero.baseAtk !== undefined) {
          const diff = (hero.atk || 0) - (hero.baseAtk || 0);
          if (diff !== 0) {
            ctx.modifyAmount(-diff);
          }
        }
      }
    },

    // After Attack damage to hero: apply Immortal buff with auto-expiry
    // Expires at start of opponent's turn BEFORE burn/poison fires
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
      target.buffs.immortal = {
        source: 'Ghuanjun',
        expiresAtTurn: gs.turn + 1,
        expiresForPlayer: oppIdx,
        expiresBeforeStatusDamage: true,
      };
      engine.log('immortal_applied', { target: target.name || 'Hero', by: 'Ghuanjun' });
      engine.sync();
    },

    // Flag creature damage from Ghuanjun Attacks for HP-1 cap + base ATK enforcement
    beforeCreatureDamageBatch: (ctx) => {
      if (!ctx.entries) return;
      const heroIdx = ctx.cardHeroIdx;
      const pi = ctx.cardOwner; // Effective controller (auto-resolved)
      const hero = ctx.players?.[ctx.cardOriginalOwner]?.heroes?.[heroIdx];
      for (const e of ctx.entries) {
        if (e.type !== 'attack' || e.cancelled) continue;
        if ((e.source?.heroIdx ?? -1) !== heroIdx || (e.source?.owner ?? -1) !== pi) continue;
        e.capAtHPMinus1 = true;
        // Only correct attacks that use hero.atk for damage
        if (e.source?.usesHeroAtk && hero) {
          const diff = (hero.atk || 0) - (hero.baseAtk || 0);
          if (diff !== 0) {
            e.amount = Math.max(0, e.amount - diff);
          }
        }
      }
    },

    // After creature batch: apply Immortal buff with auto-expiry
    afterCreatureDamageBatch: (ctx) => {
      if (!ctx.entries) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner; // Effective controller (auto-resolved)
      const oppIdx = pi === 0 ? 1 : 0;
      const heroIdx = ctx.cardHeroIdx;
      for (const e of ctx.entries) {
        if (e.type !== 'attack') continue;
        if ((e.source?.heroIdx ?? -1) !== heroIdx || (e.source?.owner ?? -1) !== pi) continue;
        const inst = e.inst;
        if (!inst || inst.zone !== 'support' || inst.counters?.buffs?.immortal) continue;
        if (!inst.counters.buffs) inst.counters.buffs = {};
        inst.counters.buffs.immortal = {
          source: 'Ghuanjun',
          expiresAtTurn: gs.turn + 1,
          expiresForPlayer: oppIdx,
          expiresBeforeStatusDamage: true,
        };
        engine.log('immortal_applied', { target: inst.name, by: 'Ghuanjun' });
      }
    },
  },
};
