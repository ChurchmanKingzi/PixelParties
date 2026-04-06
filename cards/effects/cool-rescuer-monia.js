// ═══════════════════════════════════════════
//  CARD EFFECT: "Cool Rescuer Monia"
//  Hero (400 HP, 40 ATK, Charme + Fighting)
//
//  Once per turn: when creatures would be
//  affected by a card/effect, Monia's player
//  may discard 1 card to negate all creature
//  effects from that card/effect.
//
//  Hooks into beforeCreatureDamageBatch to
//  intercept creature damage. Future: also
//  intercept status, healing, control changes.
// ═══════════════════════════════════════════

module.exports = {
  heroEffect: true,
  activeIn: ['hero'],

  hooks: {
    onGameStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const heroIdx = ctx.cardHeroIdx;
      const flagKey = `${ctx.cardOriginalOwner}-${heroIdx}`;
      if (!gs.heroFlags) gs.heroFlags = {};
      if (!gs.heroFlags[flagKey]) gs.heroFlags[flagKey] = {};
      gs.heroFlags[flagKey].moniaProtection = true;
    },

    onTurnStart: async (ctx) => {
      // Reset once-per-turn at the start of EVERY turn (not just Monia's)
      const engine = ctx._engine;
      const gs = engine.gs;
      const heroIdx = ctx.cardHeroIdx;
      const flagKey = `${ctx.cardOriginalOwner}-${heroIdx}`;
      if (gs.heroFlags?.[flagKey]) {
        gs.heroFlags[flagKey].moniaUsedThisTurn = false;
      }
    },

    /**
     * Before creature damage batch: intercept and offer protection.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const entries = ctx.entries;
      if (!entries || entries.length === 0) return;

      const pi = ctx.cardOwner; // Effective controller (auto-resolved for charmed heroes)
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[ctx.cardOriginalOwner]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const flagKey = `${ctx.cardOriginalOwner}-${heroIdx}`;
      const flags = gs.heroFlags?.[flagKey];
      if (!flags?.moniaProtection) return;
      if (flags.moniaUsedThisTurn) return;

      // If shield is already active from an earlier batch in the same resolution, auto-apply
      if (gs._moniaShieldActive != null) {
        for (const e of entries) {
          if (!e.cancelled && !e.isStatusDamage && e.canBeNegated !== false && e.inst.owner === gs._moniaShieldActive) {
            e.cancelled = true;
          }
        }
        return;
      }

      // Must have 1+ cards in controller's hand
      const ps = gs.players[pi];
      if (!ps || (ps.hand || []).length === 0) return;

      // Find eligible entries (not cancelled, not status damage, negatable)
      const eligible = entries.filter(e =>
        !e.cancelled && !e.isStatusDamage && e.canBeNegated !== false
      );
      if (eligible.length === 0) return;

      // Determine affected creature owners
      const affectedOwners = new Set(eligible.map(e => e.inst.owner));

      // Build prompt options (no "Cancel" — the panel has its own cancel button)
      let options;
      const ownerLabel = (idx) => idx === pi ? 'your' : (gs.players[idx]?.username || 'Player') + "'s";

      if (affectedOwners.size === 2) {
        options = [
          { id: 'save-0', label: `🛡️ Save ${ownerLabel(0)} Creatures (discard 1)` },
          { id: 'save-1', label: `🛡️ Save ${ownerLabel(1)} Creatures (discard 1)` },
        ];
      } else {
        const ownerIdx = [...affectedOwners][0];
        const singleCreature = eligible.length === 1;
        const desc = singleCreature
          ? `Protect ${eligible[0].inst.name}`
          : `Save ${ownerLabel(ownerIdx)} Creatures`;
        options = [
          { id: `save-${ownerIdx}`, label: `🛡️ ${desc} (discard 1)` },
        ];
      }

      // Show prompt to Monia's player
      const result = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: `${hero.name} — Cool Rescue!`,
        description: 'Creatures are in danger! Discard 1 card to protect them.',
        options,
        cancellable: true,
      });

      if (!result || !result.optionId || result.cancelled) return;

      // Determine which owner to protect
      const match = result.optionId.match(/^save-(\d+)$/);
      if (!match) return;
      const protectOwner = parseInt(match[1]);

      // Mark as used this turn
      flags.moniaUsedThisTurn = true;

      // Set shield active for subsequent batches in this resolution
      gs._moniaShieldActive = protectOwner;

      // Cancel eligible entries for the protected owner
      for (const e of eligible) {
        if (e.inst.owner === protectOwner) {
          e.cancelled = true;
        }
      }

      engine.log('monia_protect', {
        player: ps.username, hero: hero.name,
        protectedOwner: gs.players[protectOwner]?.username,
        creaturesProtected: eligible.filter(e => e.inst.owner === protectOwner).map(e => e.inst.name),
      });

      // ── Animation: Monia rams into each protected creature ──
      const protectedCreatures = eligible.filter(e => e.inst.owner === protectOwner);
      for (const e of protectedCreatures) {
        engine._broadcastEvent('play_ram_animation', {
          sourceOwner: ctx.cardOriginalOwner, sourceHeroIdx: heroIdx,
          targetOwner: e.inst.owner, targetHeroIdx: e.inst.heroIdx,
          targetZoneSlot: e.inst.zoneSlot,
          cardName: hero.name, duration: 600,
          trailType: 'fire_stars',
        });
        await engine._delay(250);
      }
      await engine._delay(400);

      // ── Discard 1 card ──
      if (ps.hand.length > 0) {
        await engine.actionDiscardCards(pi, 1);
      }

      engine.sync();
    },

    /**
     * Generic creature protection for non-damage effects (destroy, heal, move, status).
     */
    beforeCreatureAffected: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const creature = ctx.creature;
      if (!creature) return;

      const pi = ctx.cardOwner; // Effective controller (auto-resolved for charmed heroes)
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[ctx.cardOriginalOwner]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const flagKey = `${ctx.cardOriginalOwner}-${heroIdx}`;
      const flags = gs.heroFlags?.[flagKey];
      if (!flags?.moniaProtection) return;
      if (flags.moniaUsedThisTurn) return;

      // If shield is already active, auto-apply
      if (gs._moniaShieldActive != null) {
        if (creature.owner === gs._moniaShieldActive) {
          ctx.cancelled = true;
        }
        return;
      }

      const ps = gs.players[pi];
      if (!ps || (ps.hand || []).length === 0) return;

      const creatureName = creature.name || 'Creature';
      const ownerLabel = creature.owner === pi ? 'your' : (gs.players[creature.owner]?.username || 'Player') + "'s";

      const options = [
        { id: `save-${creature.owner}`, label: `🛡️ Protect ${creatureName} (discard 1)` },
      ];

      const result = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: `${hero.name} — Cool Rescue!`,
        description: `${ownerLabel.charAt(0).toUpperCase() + ownerLabel.slice(1)} ${creatureName} is in danger!`,
        options,
        cancellable: true,
      });

      if (!result || !result.optionId || result.cancelled) return;

      const match = result.optionId.match(/^save-(\d+)$/);
      if (!match) return;
      const protectOwner = parseInt(match[1]);

      flags.moniaUsedThisTurn = true;
      gs._moniaShieldActive = protectOwner;
      ctx.cancelled = true;

      engine.log('monia_protect', {
        player: ps.username, hero: hero.name,
        protectedCreature: creatureName, effectType: ctx.effectType,
      });

      // Animation: Monia rams into creature
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardOriginalOwner, sourceHeroIdx: heroIdx,
        targetOwner: creature.owner, targetHeroIdx: creature.heroIdx,
        targetZoneSlot: creature.zoneSlot,
        cardName: hero.name, duration: 600,
        trailType: 'fire_stars',
      });
      await engine._delay(500);

      // Discard 1 card
      if (ps.hand.length > 0) {
        await engine.actionDiscardCards(pi, 1);
      }

      engine.sync();
    },

    /**
     * After spell resolves: clear the shield-active flag.
     */
    afterSpellResolved: async (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._moniaShieldActive != null) {
        delete gs._moniaShieldActive;
      }
    },
  },
};
