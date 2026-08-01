// ═══════════════════════════════════════════
//  CARD EFFECT: "Heal"
//  Spell (Support Magic Lv1, Normal)
//  Choose any target (Hero or Creature, either
//  side) and heal it for 150/200/300 HP based
//  on the caster's total Support Magic level
//  (including Performance stacked on Support
//  Magic).
//
//  HP is capped at max HP unless Nao is the
//  caster — then overheal is allowed when
//  the target's HP <= max HP.
//
//  Animation: green laser beam rises up from
//  caster, then orbital-strikes down onto the
//  target with green sparkles on impact.
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  includesHealing: true,
  // Heal scales with the caster's Support Magic level (150/200/300).
  // The CPU's ability-stacking scoring reads `cpuMeta.scalesWithSchool`
  // to keep Support Magic worth stacking even when no card in the deck
  // strictly requires it at the higher level.
  cpuMeta: { scalesWithSchool: 'Support Magic' },
  // ── CPU: Nutzlos-Play-Veto (cpuPlayVeto-Vertrag) ──────────────────
  // Heal für 0 ist ein verschwendeter Zauber. Der Play wird aus der
  // CPU-Enumeration genommen, wenn ALLE folgenden Nutzenquellen fehlen:
  //  (a) ein eigenes lebendes Ziel mit HP-Defizit (Held oder Kreatur),
  //  (b) Nao als Caster (Overheal erlaubt → füttert afterHeal-Trigger
  //      wie Lifeforce Howitzer, echter Effekt trotz voller HP),
  //  (c) ein GEGNER-Held mit healReversed (Overheal Shock): Heilung
  //      wird dort zu Schaden — Heal ist dann ein Damage-Spell,
  //  (d) beim Additional-/Frei-Zauber-Pfad: Friendship ≥ 2 am Caster
  //      (der Draw-Rider hängt am Additional-Action-Grant; reguläre
  //      Action-Plays bekommen ihn NIE, dort zählt (d) nicht).
  cpuPlayVeto(engine, pi, heroIdx, ctx2) {
    const gs = engine.gs;
    const ps = gs?.players?.[pi];
    if (!ps) return false;
    const caster = ps.heroes?.[heroIdx];
    // (b) Nao-Overheal ist KEIN Freifahrtschein: Die Engine erlaubt
    // Overheal nur auf Ziele mit hp <= maxHp (Helden) bzw.
    // currentHp <= baseHp (Kreaturen) — ein bereits over-healtes Ziel
    // (hp > maxHp) bekommt auch von Nao NICHTS. Deshalb kein
    // Pauschal-Return, sondern ein laxeres Zielkriterium unten.
    const naoCaster = (caster?.baseName || caster?.name || '').startsWith('Nao');
    // (d) Friendship-Draw beim Additional-Pfad
    if (ctx2?.additional) {
      for (const slot of (ps.abilityZones?.[heroIdx] || [])) {
        if (slot && slot[0] === 'Friendship' && slot.length >= 2) return false;
      }
    }
    // (a) heilbares eigenes Ziel? Ohne Nao: echtes HP-Defizit nötig.
    // Mit Nao: hp <= maxHp genügt (Overheal ab Voll-HP ist echter
    // Effekt — HP-Puffer + afterHeal-Trigger wie Lifeforce Howitzer).
    for (const hh of (ps.heroes || [])) {
      if (!hh?.name || hh.hp <= 0) continue;
      const max = hh.maxHp || hh.hp;
      if (naoCaster ? hh.hp <= max : hh.hp < max) return false;
    }
    for (const inst of (engine.cardInstances || [])) {
      if (inst.owner !== pi || inst.zone !== 'support') continue;
      const cur = inst.counters?.currentHp;
      const max = inst.counters?.maxHp;
      const base = inst.counters?.baseHp ?? max;
      if (typeof cur !== 'number' || typeof max !== 'number' || cur <= 0) continue;
      if (naoCaster ? cur <= base : cur < max) return false;
    }
    // (c) healReversed-Gegner (Heilung = Schaden)
    const oi = pi === 0 ? 1 : 0;
    for (const hh of (gs.players?.[oi]?.heroes || [])) {
      if (hh?.name && hh.hp > 0 && hh.statuses?.healReversed) return false;
    }
    return true; // keine Nutzenquelle → Play verwerfen
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Calculate Support Magic level on this hero
      const abZones = ps.abilityZones[heroIdx] || [[], [], []];
      const smLevel = engine.countAbilitiesForSchool('Support Magic', abZones);
      const healAmount = smLevel >= 3 ? 300 : smLevel >= 2 ? 200 : 150;

      // Prompt: select any target (hero or creature, either side)
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'support_spell',
        // CPU-Vertrag (Als Heal-Burn-Befund): markiert den Prompt als
        // HEILUNG, damit der Ziel-Picker Gegner ohne healReversed
        // aussortieren kann — "Gegner heilen → gewinnen" wurde sonst
        // ohne den Overheal-Shock-Kontext gelernt.
        isHealing: true,
        title: 'Heal',
        description: `Heal a target for ${healAmount} HP. (Support Magic Lv${smLevel})`,
        confirmLabel: `💚 Heal! (${healAmount})`,
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!target) return; // Cancelled

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

      // ── Phase 1: Green beam rises from caster ──
      engine._broadcastEvent('play_heal_beam', {
        phase: 'rise',
        sourceOwner: ctx.cardHeroOwner,
        sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner,
        targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
      });

      await engine._delay(500); // Beam rises off screen

      // ── Phase 2: Beam strikes down onto target ──
      engine._broadcastEvent('play_heal_beam', {
        phase: 'strike',
        sourceOwner: ctx.cardHeroOwner,
        sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner,
        targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
      });

      await engine._delay(350); // Beam arrives + sparkle delay

      // ── Phase 3: Heal sparkle impact ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle',
        owner: tgtOwner,
        heroIdx: tgtHeroIdx,
        zoneSlot: tgtZoneSlot,
      });

      await engine._delay(200);

      // ── Apply healing (turn-1-immune targets are unaffected by opponent heals) ──
      const isImmune = gs.firstTurnProtectedPlayer != null && tgtOwner === gs.firstTurnProtectedPlayer && tgtOwner !== pi;
      if (isImmune) {
        engine.log('heal_blocked', { target: target.cardName, reason: 'shielded' });
      } else if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.healHero(tgtHero, healAmount);
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await ctx.healCreature(inst, healAmount);
        }
      }

      engine.log('heal_spell', {
        player: ps.username,
        hero: hero.name,
        target: target.cardName,
        amount: healAmount,
        smLevel,
      });
      engine.sync();
    },
  },
};
