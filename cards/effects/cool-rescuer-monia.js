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

  // Gerrymander redirect — when opp's Monia opens the multi-side
  // "save 0's vs save 1's" picker, our Gerrymander forces opp to
  // save OUR creatures with their discard cost. The option ids are
  // `save-${ownerIdx}` — we want save-${gerryOwnerPi}.
  cpuGerrymanderResponse(_engine, gerryOwnerPi /*, promptData */) {
    return { optionId: `save-${gerryOwnerPi}` };
  },

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
      // Clear stale shield flag (afterSpellResolved never fires in engine)
      delete gs._moniaShieldActive;
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
          if (!e.cancelled && !e.isStatusDamage && e.canBeNegated !== false
              && (e.inst.controller ?? e.inst.owner) === gs._moniaShieldActive) {
            e.cancelled = true;
          }
        }
        return;
      }

      // Must have 1+ cards in controller's hand
      const ps = gs.players[pi];
      if (!ps || (ps.hand || []).length === 0) return;

      // Find all entries that affect creatures (not cancelled, not status damage)
      const promptable = entries.filter(e => !e.cancelled && !e.isStatusDamage);
      if (promptable.length === 0) return;

      // Determine affected creature CONTROLLERS (gameplay-side, not
      // raw owner — so a cross-side-placed Creature on opp's board
      // counts under opp).
      const affectedOwners = new Set(promptable.map(e => e.inst.controller ?? e.inst.owner));

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
        const singleCreature = promptable.length === 1;
        const desc = singleCreature
          ? `Protect ${promptable[0].inst.name}`
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
        // Gerrymander only redirects when 2+ options (the multi-side
        // AOE branch where the player picks WHICH side to save).
        // Single-option branches are auto-skipped by the engine's
        // gerry gate (options.length >= 2 required).
        gerrymanderEligible: true,
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

      // Cancel ONLY negatable entries for the protected controller.
      // Unnegatable damage (Acid Vial, Ida) still goes through — Monia "wastes" the effect.
      const matchesProtect = (e) => (e.inst.controller ?? e.inst.owner) === protectOwner;
      for (const e of promptable) {
        if (matchesProtect(e) && e.canBeNegated !== false) {
          e.cancelled = true;
        }
      }

      engine.log('monia_protect', {
        player: ps.username, hero: hero.name,
        protectedOwner: gs.players[protectOwner]?.username,
        creaturesProtected: promptable.filter(matchesProtect).map(e => e.inst.name),
      });

      // ── Animation: Monia rams into each protected creature ──
      // `targetOwner` uses physical side so the ram lands on the slot
      // the player sees (cross-side-placed Creatures live on the
      // controller's board).
      const protectedCreatures = promptable.filter(matchesProtect);
      for (const e of protectedCreatures) {
        const physSide = e.inst.stolenBy != null
          ? e.inst.owner
          : (e.inst.controller ?? e.inst.owner);
        engine._broadcastEvent('play_ram_animation', {
          sourceOwner: ctx.cardOriginalOwner, sourceHeroIdx: heroIdx,
          targetOwner: physSide, targetHeroIdx: e.inst.heroIdx,
          targetZoneSlot: e.inst.zoneSlot,
          cardName: hero.name, duration: 600,
          trailType: 'fire_stars',
        });
        await engine._delay(250);
      }
      await engine._delay(400);

      // ── Discard 1 card (player chooses) ──
      if (ps.hand.length > 0) {
        await engine.actionPromptForceDiscard(pi, 1, { title: `${hero.name} — Discard 1`, source: hero.name, selfInflicted: true });
      }
    },

    /**
     * Generic creature protection for non-damage effects (destroy, heal, move, status).
     */
    beforeCreatureAffected: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const creature = ctx.creature;
      if (!creature) return;

      // Als Ruling (Demo vs Cute Commando): Monia reagiert NICHT auf
      // Effekte, mit denen eine Kreatur sich SELBST betrifft/tötet.
      // Repro: Cute Cats On-Summon-Selbst-Destroy (Mill-Motor) löste
      // den Schutz aus — Monia bezahlte eine Handkarte, um den EIGENEN
      // Effekt ihrer Seite zu blockieren. Der Selbst-Fall ist exakt
      // erkennbar: die Quelle des Effekts ist dieselbe Karten-Instanz
      // wie die betroffene Kreatur (ctx.destroyCard(inst) übergibt die
      // Instanz als source).
      if (ctx.source && (ctx.source === creature
        || (ctx.source.id != null && ctx.source.id === creature.id))) return;

      // Als Ruling (1.8., aus der eigenen Demo-Aufnahme): Monia darf
      // OPFER nicht beschützen. Ein Tribut ist eine Kosten-Zahlung des
      // eigenen Besitzers, kein fremder Zugriff — sonst ließe sich der
      // Nutzen einstreichen und der Preis zurückhalten. Im Mitschnitt
      // bot Monia an, das gerade als Tribut gewählte Greatmaw Remora zu
      // retten, NACHDEM der Sacrificial Dagger seinen Schaden schon
      // ausgeteilt hatte. Dieselbe Familie wie der Selbst-Kill-Guard
      // darüber: Monia schützt vor dem Gegner, nicht vor dem eigenen
      // Deckplan. `isSacrifice` setzt die Engine beim Bezahlen einer
      // sacrificeSpec (generischer Vertrag, gilt für jede Opfer-Karte).
      if (ctx.isSacrifice) return;

      const pi = ctx.cardOwner; // Effective controller (auto-resolved for charmed heroes)
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[ctx.cardOriginalOwner]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const flagKey = `${ctx.cardOriginalOwner}-${heroIdx}`;
      const flags = gs.heroFlags?.[flagKey];
      if (!flags?.moniaProtection) return;
      if (flags.moniaUsedThisTurn) return;

      // Side attribution uses CONTROLLER — a cross-side-placed
      // Creature counts under the side that currently controls it.
      const creatureSide = creature.controller ?? creature.owner;

      // If shield is already active, auto-apply
      if (gs._moniaShieldActive != null) {
        if (creatureSide === gs._moniaShieldActive) {
          ctx.cancelled = true;
        }
        return;
      }

      const ps = gs.players[pi];
      if (!ps || (ps.hand || []).length === 0) return;

      const creatureName = creature.name || 'Creature';
      const ownerLabel = creatureSide === pi ? 'your' : (gs.players[creatureSide]?.username || 'Player') + "'s";

      const options = [
        { id: `save-${creatureSide}`, label: `🛡️ Protect ${creatureName} (discard 1)` },
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

      // Animation: Monia rams into creature. `targetOwner` is the
      // PHYSICAL side (where the creature actually renders) so a
      // cross-side-placed Creature gets the ram on opp's slot.
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardOriginalOwner, sourceHeroIdx: heroIdx,
        targetOwner: creatureSide, targetHeroIdx: creature.heroIdx,
        targetZoneSlot: creature.zoneSlot,
        cardName: hero.name, duration: 600,
        trailType: 'fire_stars',
      });
      await engine._delay(500);

      // Discard 1 card (player chooses)
      if (ps.hand.length > 0) {
        await engine.actionPromptForceDiscard(pi, 1, { title: `${hero.name} — Discard 1`, source: hero.name, selfInflicted: true });
      }
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
