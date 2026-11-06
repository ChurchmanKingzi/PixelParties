// ═══════════════════════════════════════════
//  CARD EFFECT: "The Sun Sword"
//  Artifact (Equipment, 14 Gold)
//
//  1) Equipped Hero gains +20 ATK.
//  2) ALL targets the player controls become
//     immune to being Frozen (hero status +
//     creature counter). New creatures auto-get it.
//  3) On equip, thaw all frozen targets the
//     player controls (no immune grant on thaw).
//  4) When the equipped Hero hits any target with
//     an Attack and it's not Burn-immune or already
//     Burned, Burn it.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const ATK_BONUS = 20;

// ─── HELPERS ─────────────────────────────

/**
 * ★ W16e (F03-02): Frost-Immunitaet als Dauerzustand, nicht als Momentstempel. „ALL targets the player controls cannot be Frozen"
 * gilt fuer das, was ein Sun-Sword-Besitzer JETZT kontrolliert. Der Stempel (`freeze_immune`, wird von vielen Karten direkt gelesen —
 * W7a/W8-Muster „Stempel-Abgleich") wird deshalb bei jedem Ereignis abgeglichen, das den Kreis aendert: Anlegen/Abgang, neue Kreatur,
 * Kontrollwechsel (`onTakeControl`), Wiederbelebung (`onHeroRevive`), Zugwechsel (Rueckgabe gestohlener Kreaturen). Helden/Kreaturen,
 * die kein Sun-Sword-Besitzer kontrolliert, verlieren NUR den Sun-Sword-Stempel; fremde Quellen (Broghan, Heart of Ice, SnowItAll)
 * bleiben unberuehrt. Tote Helden tragen keinen Stempel (Status werden beim Tod geleert) — die Wiederbelebung stempelt neu.
 * `ausserId` = die gerade abgehende Sun Sword (zaehlt nicht mehr).
 */
function abgleichen(engine, ausserId) {
  const aktiv = new Set();
  for (const c of engine.cardInstances) {
    if (c.name !== 'The Sun Sword' || c.zone !== 'support' || c.faceDown || c.id === ausserId) continue;
    aktiv.add(c.controller ?? c.owner);
  }
  // Heroes — Kontrolle statt Seite (Styx 28.9.)
  for (let p = 0; p < (engine.gs.players || []).length; p++) {
    const heroes = engine.gs.players[p]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const hero = heroes[hi];
      if (!hero?.name) continue;
      const soll = hero.hp > 0 && aktiv.has(engine.heroSideOf(p, hero));
      if (soll) {
        if (!hero.statuses) hero.statuses = {};
        if (!hero.statuses.freeze_immune) hero.statuses.freeze_immune = { source: 'The Sun Sword' };
        if (!hero.buffs) hero.buffs = {};
        if (!hero.buffs.freeze_immune) hero.buffs.freeze_immune = { source: 'The Sun Sword' };
      } else {
        if (hero.statuses?.freeze_immune?.source === 'The Sun Sword') delete hero.statuses.freeze_immune;
        if (hero.buffs?.freeze_immune?.source === 'The Sun Sword') delete hero.buffs.freeze_immune;
      }
    }
  }
  // Creatures only (not Equipment Artifacts)
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (!inst.counters) inst.counters = {};
    const soll = aktiv.has(inst.controller ?? inst.owner);
    const buff = inst.counters.buffs?.freeze_immune;
    if (soll) {
      if (buff?.source === 'The Sun Sword') continue;
      // Eigene Immunitaet der Kreatur (SnowItAll …) merken: sie bleibt, wenn das Schwert geht.
      const nativ = !!inst.counters.freeze_immune && !buff;
      inst.counters.freeze_immune = 1;
      if (!inst.counters.buffs) inst.counters.buffs = {};
      if (!buff) inst.counters.buffs.freeze_immune = { source: 'The Sun Sword', nativ };
    } else if (buff?.source === 'The Sun Sword') {
      if (!buff.nativ) delete inst.counters.freeze_immune;
      delete inst.counters.buffs.freeze_immune;
    }
  }
}

function applyFreezeImmunity(engine /*, pi */) { abgleichen(engine); }

/**
 * Thaw all frozen targets the player controls.
 * Heroes: remove frozen status. Creatures: remove frozen counter.
 * Does NOT grant immune status (unlike natural thaw at turn end).
 */
async function thawAll(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;

  // Heroes — Kontrolle statt Seite (Styx 28.9.): „Thaw all Frozen targets you control"
  for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
    if (!hero?.name || hero.hp <= 0 || !hero.statuses?.frozen) continue;
    delete hero.statuses.frozen;
    engine._broadcastEvent('play_zone_animation', { type: 'thaw', owner: physOwner, heroIdx: hi, zoneSlot: -1 });
    engine.log('thaw', { target: hero.name, by: 'The Sun Sword' });
  }

  // Creatures
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi || inst.zone !== 'support' || !inst.counters.frozen) continue;
    delete inst.counters.frozen;
    engine._broadcastEvent('play_zone_animation', { type: 'thaw', owner: pi, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
    engine.log('thaw', { target: inst.name, by: 'The Sun Sword' });
  }
}

/**
 * Check if the player controls an active Sun Sword.
 * Optionally exclude a specific card ID (the one currently being removed).
 */
function hasSunSword(engine, pi, excludeId) {
  return engine.cardInstances.some(c =>
    c.owner === pi && c.zone === 'support' && c.name === 'The Sun Sword' && c.id !== excludeId
  );
}

// ─── CARD MODULE ─────────────────────────

module.exports = {

  /**
   * „Equip this card to a Hero you control." — Seitenbindung, siehe
   * `equipOwnSideOnly` in CARD_API.md. Ohne die Fahne gilt die
   * Hausvorgabe „Ausruestung darf an beide Seiten" (Al, 5.9.: der
   * Kartentext ist bindend).
   */
  equipOwnSideOnly: true,
  activeIn: ['support'],

  hooks: {
    /**
     * On equip: +20 ATK, freeze immunity to all, thaw all frozen.
     */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      ctx.grantAtk(ATK_BONUS);
      applyFreezeImmunity(engine, pi);
      await thawAll(engine, pi);
      engine.sync();
    },

    /**
     * Game start: apply for pre-equipped Sun Swords (Bill, etc.).
     */
    onGameStart: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const hero = ctx.attachedHero;
      if (!hero?.name) return;
      if (ctx.card.counters.atkGranted > 0) return; // Already applied
      ctx.grantAtk(ATK_BONUS);
      applyFreezeImmunity(engine, pi);
      // No thaw needed at game start — nothing is frozen yet
      engine.sync();
    },

    /**
     * On removal: revoke ATK, remove freeze immunity (if no other Sun Sword active).
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if ((ctx.fromOwner !== ctx.cardOwner && ctx.fromOwner !== ctx.cardHeroOwner) || ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;   // Styx 28.9.: Brettseite
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      ctx.revokeAtk();

      // Frost-Immunitaet abgleichen (ohne die abgehende Sun Sword); andere Sun Swords halten ihren Kreis.
      abgleichen(engine, ctx.card.id);
      engine.sync();
    },

    /**
     * When a creature enters any support zone (summon, move, steal), reconcile the freeze immunity
     * (W16e: nach Kontrolle, nicht nach Zone — „targets you control").
     */
    onCardEnterZone: (ctx) => {
      if (ctx.toZone !== 'support') return;
      abgleichen(ctx._engine);
    },

    /** W16e (F03-02): Kontrollwechsel (Diebstahl, Charme, dauerhafte Uebernahme) aendert den Kreis. */
    onTakeControl: (ctx) => { abgleichen(ctx._engine); },

    /** W16e (F03-02): wiederbelebter Held — der Tod hat die Status geleert, jetzt neu stempeln. */
    onHeroRevive: (ctx) => { abgleichen(ctx._engine); },

    /** W16e (F03-02): Zugwechsel gibt gestohlene Kreaturen/Helden zurueck — Kreis neu abgleichen. */
    onTurnStart: (ctx) => { abgleichen(ctx._engine); },
    onTurnEnd: (ctx) => { abgleichen(ctx._engine); },

    /**
     * After the equipped Hero deals Attack damage to a target,
     * Burn it if not already Burned and not Burn-immune.
     */
    afterDamage: async (ctx) => {
      if (ctx.type !== 'attack') return;

      // Source must be this hero
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      // Styx 28.9.: „dieser Held" = Brettseite + Index (geliehener Held).
      if (!ctx._engine.quelleIstHeld(ctx.source, ctx.cardHeroOwner ?? ctx.cardOwner, ctx.cardHeroIdx)) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const target = ctx.target;
      if (!target) return; // No amount check — burn applies on any hit, even 0 damage (Ghuanjun cap)

      // Target is a hero (has statuses)
      if (target.hp !== undefined && target.statuses) {
        // 23.10. Tearing Mountain: kein Schutz (`burn_immune`, `immune` …) verhindert Burn.
        if (target.statuses.burned) return;
        if (!engine.statusSchutzAufgehoben?.('burned', target) && (target.statuses.burn_immune || target.statuses.immune)) return;

        // Find which player/hero this target belongs to
        for (let tpi = 0; tpi < engine.playerCount(); tpi++) {
          const tps = engine.gs.players[tpi];
          for (let thi = 0; thi < (tps.heroes || []).length; thi++) {
            if (tps.heroes[thi] === target && target.hp > 0) {
              // Auftritt links am Feld (Als Regel 21.8.: beim Burn).
              await engine.announceHookActivation('The Sun Sword',
                ctx.cardOwner, { source: ctx.source });
              await engine.addHeroStatus(tpi, thi, 'burned', {
                appliedBy: pi,
                animationType: 'flame_strike',
              });
              return;
            }
          }
        }
      }
    },

    /**
     * After creature damage batch: burn creatures hit by this hero's attacks.
     */
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.entries) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      for (const e of ctx.entries) {
        if (e.type !== 'attack') continue;
        if ((e.source?.heroIdx ?? -1) !== heroIdx) continue;
        // Styx 28.9.: „dieser Held" = Brettseite + Index (geliehener Held).
        if (!engine.quelleIstHeld(e.source, ctx.cardHeroOwner ?? pi, heroIdx)) continue;
        // Full negation reactions (Idej Projection, Spectral Armor
        // zero-cap, Anti Magic void, future similar) set `e.cancelled`
        // on the entry. "Negate that damage AND all associated
        // effects" extends to equipment-added on-hit riders — skip
        // the burn apply when the hit didn't actually land.
        if (e.cancelled) continue;
        if (e.amount <= 0) continue;

        const inst = e.inst;
        if (!inst || inst.zone !== 'support') continue;
        if (inst.counters.burned) continue;

        // Animation plays unconditionally — visual feedback for the
        // hit even when the burn fizzles on a Cardinal-immune target.
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: inst.owner,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
        // Auftritt links am Feld (Als Regel 21.8.: beim Burn).
        await engine.announceHookActivation('The Sun Sword',
          ctx.cardOwner, { source: ctx.source });
        const applied = await engine.applyCreatureStatus(inst, 'burned', {
          sourceOwner: pi,
          source: 'The Sun Sword',
        });
        if (applied) engine.log('burn_applied', { target: inst.name, by: 'The Sun Sword' });
      }
    },
  },
};
