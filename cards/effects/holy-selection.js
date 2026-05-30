// ═══════════════════════════════════════════
//  CARD EFFECT: "Holy Selection"
//  Spell (Destruction Magic + Support Magic Lv 1)
//  — Normal.
//
//  "Deal 200 damage to all Heroes with the
//   Necromancy Ability and Creatures that were
//   summoned by the effect of Necromancy."
//
//  Filtered AoE — auto-fans out across the
//  matching subset on BOTH sides of the board.
//  No player picking. Matches the "full AoE"
//  convention for surprise gating: `_isAoeCheck`
//  is stamped on the source for the consolidated
//  surprise window, so per-target surprises
//  (Booby Trap / Flooding / Frost Rune / Mountain
//  Tear River, …) don't fire — same rule
//  Cataclysm and Flame Avalanche follow.
//
//  ── Necromancy detection ──
//  Heroes:    `abilityZones[heroIdx][slot][0] ===
//             'Necromancy'` (the slot's BASE
//             ability) for any of the Hero's
//             ability zones.
//  Creatures: `inst.counters._summonedByNecromancy
//             === true` — stamped at summon time
//             by necromancy.js's onFreeActivate
//             (right after the `_trackCard` call,
//             alongside the `_letheLevelBonus`
//             stamp). The flag is per-instance
//             and permanent; a destroyed Creature
//             that gets re-summoned by a non-
//             Necromancy effect comes back
//             without the flag, matching "the
//             current body was Necromancy-summoned"
//             semantics.
//
//  ── Ida override ──
//  Like every multi-hit Destruction Spell, Ida,
//  the Adept of Destruction converts Holy
//  Selection to a single-target Spell — same rule
//  as Fireball / Explosion / Pyroblast. We honour
//  this manually here because the filter logic
//  (Necromancy-stamp + Necromancy-Hero) can't be
//  expressed through `ctx.aoeHit`'s built-in Ida
//  branch (which uses an unfiltered
//  `promptDamageTarget`). Single-target mode
//  opens a `promptDamageTarget` whose `condition`
//  callback restricts the picker to the SAME
//  filtered target set, so the player can't aim
//  Ida-mode Holy Selection at something the AoE
//  version wouldn't have hit.
// ═══════════════════════════════════════════

const CARD_NAME = 'Holy Selection';
const DAMAGE = 200;

/** True iff `heroIdx` on `ps` has at least one ability zone whose
 *  base card is Necromancy. Performance copies stacked on top of
 *  Necromancy still count (Performance is "treated as the base") —
 *  what matters is the base. */
function _heroHasNecromancy(ps, heroIdx) {
  const abZones = ps.abilityZones?.[heroIdx] || [];
  for (const slot of abZones) {
    if (slot && slot.length > 0 && slot[0] === 'Necromancy') return true;
  }
  return false;
}

/** Collect both target lists in one pass. */
function _collectTargets(engine, gs) {
  const heroTargets = [];
  const creatureTargets = [];
  for (let tpi = 0; tpi < 2; tpi++) {
    const ps = gs.players[tpi];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (_heroHasNecromancy(ps, hi)) {
        heroTargets.push({
          owner: tpi, heroIdx: hi, hero,
          id: `hero-${tpi}-${hi}`,
        });
      }
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (!inst.counters?._summonedByNecromancy) continue;
    const owner = inst.controller ?? inst.owner;
    creatureTargets.push({
      inst, owner,
      heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      id: `equip-${owner}-${inst.heroIdx}-${inst.zoneSlot}`,
    });
  }
  return { heroTargets, creatureTargets };
}

module.exports = {
  /**
   * Greys out in hand when no Hero on either side has a Necromancy
   * ability AND no on-board Creature carries the
   * `_summonedByNecromancy` stamp. Spell would do nothing in that
   * state — matches the Cure-style "no eligible target" gate.
   */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true; // optimistic fallback
    const { heroTargets, creatureTargets } = _collectTargets(engine, gs);
    return (heroTargets.length + creatureTargets.length) > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Re-collect at resolve time — a chained Necromancy / cleanse /
      // destroy between the play gate and onPlay can change the set.
      const { heroTargets, creatureTargets } = _collectTargets(engine, gs);
      if (heroTargets.length === 0 && creatureTargets.length === 0) {
        engine.log('holy_selection_fizzle', {
          player: ps.username, reason: 'no_targets',
        });
        return;
      }

      const source = {
        name: CARD_NAME, owner: pi, heroIdx, controller: pi,
      };

      // ── Ida override ──
      // The performing Hero's `forcesSingleTarget` flag (set by
      // Ida, the Adept of Destruction) converts every Destruction
      // Spell multi-target hit to single-target. Apply the same
      // conversion here when the cast would otherwise hit 2+
      // targets. Flag is keyed to the Hero PERFORMING the cast —
      // use cardHeroOwner (board side), not cardOwner (caster).
      // Diverges only under Love Shot, where the caster casts
      // through an opp-side Hero.
      const casterFlags = gs.heroFlags?.[`${ctx.cardHeroOwner}-${heroIdx}`];
      const idaForcesSingle = !!casterFlags?.forcesSingleTarget;
      const totalTargets = heroTargets.length + creatureTargets.length;

      if (idaForcesSingle && totalTargets > 1) {
        // Restrict the picker to the same filtered target set the
        // multi-hit version would have hit. `condition` runs in
        // `promptDamageTarget`'s eligibility loop.
        const validIds = new Set();
        for (const t of heroTargets) validIds.add(t.id);
        for (const t of creatureTargets) validIds.add(t.id);

        const picked = await ctx.promptDamageTarget({
          side: 'any',
          types: ['hero', 'creature'],
          damageType: 'destruction_spell',
          baseDamage: DAMAGE,
          title: CARD_NAME,
          description: `Ida focuses — deal ${DAMAGE} damage to a single eligible target.`,
          confirmLabel: `✨ ${DAMAGE} Damage!`,
          confirmClass: 'btn-danger',
          cancellable: false,
          condition: (t) => validIds.has(t.id),
        });

        if (!picked) {
          gs._spellCancelled = true;
          return;
        }

        // Single-target animation + damage. `promptDamageTarget`
        // already ran the surprise + post-target reaction windows on
        // the picked target, so the damage path skips them.
        engine._broadcastEvent('play_zone_animation', {
          type: 'sun_beam', owner: picked.owner,
          heroIdx: picked.heroIdx,
          zoneSlot: picked.type === 'hero' ? -1 : picked.slotIdx,
          duration: 1200,
        });
        await engine._delay(650);

        if (picked.type === 'hero') {
          const hero = gs.players[picked.owner]?.heroes?.[picked.heroIdx];
          if (hero?.name && hero.hp > 0) {
            await engine.actionDealDamage(source, hero, DAMAGE, 'destruction_spell', {
              _skipReactionCheck: true,
            });
          }
        } else if (picked.cardInstance) {
          await engine.actionDealCreatureDamage(
            source, picked.cardInstance, DAMAGE, 'destruction_spell',
            { sourceOwner: pi, _skipReactionCheck: true },
          );
        }

        engine.log('holy_selection_ida', {
          player: ps.username, target: picked.cardName,
        });
        engine.sync();
        return;
      }

      // ── AoE-fanout branch ──
      // Surprise window (consolidated). `_isAoeCheck` stamped on the
      // source CardInstance gates per-target Surprises (Booby Trap,
      // Flooding, Mountain Tear River, …) so they DON'T fire — same
      // convention `actionAoeHit` uses for full-AoE Spells.
      if (heroTargets.length > 0) {
        const surpriseList = heroTargets.map(t => ({
          type: 'hero', owner: t.owner, heroIdx: t.heroIdx,
          cardName: t.hero.name,
        }));
        if (ctx.card) ctx.card._isAoeCheck = true;
        const surpriseResult = await engine._checkSurpriseWindow(
          surpriseList, ctx.card, { damageType: 'destruction_spell' },
        );
        if (ctx.card) delete ctx.card._isAoeCheck;
        if (surpriseResult?.effectNegated) {
          gs._spellNegatedByEffect = true;
          engine.log('holy_selection_negated', {
            player: ps.username, reason: 'surprise',
          });
          engine.sync();
          return;
        }
        // Mark the heroes as already-surprise-checked so the per-
        // target `actionDealDamage` below doesn't re-open the window.
        if (!gs._surpriseCheckedHeroes) gs._surpriseCheckedHeroes = new Set();
        for (const t of surpriseList) {
          gs._surpriseCheckedHeroes.add(`${t.owner}-${t.heroIdx}`);
        }
      }

      // Pre-damage post-target reaction window — Storm Ring /
      // Invisibility Cloak full-negate path. Covers BOTH heroes and
      // creatures.
      {
        const allTargets = [
          ...heroTargets.map(t => ({
            type: 'hero', owner: t.owner, heroIdx: t.heroIdx,
            cardName: t.hero.name,
          })),
          ...creatureTargets.map(t => ({
            type: 'creature', owner: t.owner, heroIdx: t.heroIdx,
            slotIdx: t.slotIdx, cardName: t.inst.name,
          })),
        ];
        const _negR = await engine.preDamageMultiTargetWindow(source, allTargets);
        if (_negR?.effectNegated) {
          engine.log('holy_selection_negated', {
            player: ps.username, reason: 'post_target',
          });
          return;
        }
      }

      // ── Animation — staggered sun-beam on every target ──
      // Beams stagger ~70 ms each so the volley reads as a sequence
      // rather than one flash. Wait out the tail before damage so the
      // beam tail is still landing when HP numbers flicker.
      const BEAM_DUR = 1200;
      const STAGGER = 70;
      const allForAnim = [
        ...heroTargets.map(t => ({
          owner: t.owner, heroIdx: t.heroIdx, zoneSlot: -1,
        })),
        ...creatureTargets.map(t => ({
          owner: t.owner, heroIdx: t.heroIdx, zoneSlot: t.slotIdx,
        })),
      ];
      for (let i = 0; i < allForAnim.length; i++) {
        const a = allForAnim[i];
        engine._broadcastEvent('play_zone_animation', {
          type: 'sun_beam', owner: a.owner,
          heroIdx: a.heroIdx, zoneSlot: a.zoneSlot,
          duration: BEAM_DUR,
        });
        if (i < allForAnim.length - 1) await engine._delay(STAGGER);
      }
      await engine._delay(Math.max(600 - STAGGER * (allForAnim.length - 1), 200));

      // ── Damage pass ──
      // Heroes first (sequential — afterDamage hooks fire cleanly),
      // creatures second. `_skipReactionCheck: true` on every call so
      // the spell doesn't open nested counter windows — Surprise +
      // post-target windows already ran above.
      for (const t of heroTargets) {
        const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
        if (!hero?.name || hero.hp <= 0) continue;
        await engine.actionDealDamage(source, hero, DAMAGE, 'destruction_spell', {
          _skipReactionCheck: true,
        });
      }
      for (const t of creatureTargets) {
        if (t.inst.zone !== 'support') continue;
        await engine.actionDealCreatureDamage(
          source, t.inst, DAMAGE, 'destruction_spell',
          { sourceOwner: pi, _skipReactionCheck: true },
        );
      }

      engine.log('holy_selection_resolved', {
        player: ps.username,
        heroes: heroTargets.length,
        creatures: creatureTargets.length,
      });
      engine.sync();
    },
  },
};
