// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Zeal"
//  Spell (Support Magic Lv 1) — Normal.
//
//  Remove any number of negative status effects
//  from any number of targets (Heroes and/or
//  Support-Zone Creatures) on EITHER side of the
//  board — your own targets and the opponent's.
//  The targeting flow mirrors Beer: pick targets
//  first, then step through each picked target
//  and choose which statuses to remove. Beer's
//  gold cost is not paid (Spell, not Artifact).
//
//  If the total number of statuses removed across
//  every target is 3+, draw 2 cards. The threshold
//  counts each (target, status) removal separately
//  — cleansing Burn from three different Heroes
//  counts as 3, not 1.
//
//  Per the standard cleanse contract, statuses with
//  `cleansable: false` (e.g. negated, nulled) are
//  filtered out by `cleanseHeroStatuses` /
//  `cleanseCreatureStatuses` — they never appear
//  in the picker and don't contribute to the
//  threshold even if a misbehaving caller passes
//  them in.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getCleansableStatuses } = require('./_hooks');

const CARD_NAME = 'Divine Zeal';
const DRAW_THRESHOLD = 3;
const DRAW_COUNT = 2;

/**
 * Status effects on a single target that the player may select for
 * removal. Heroes: globally-cleansable negative statuses currently
 * present. Creatures: the instance-aware key set, which also surfaces
 * per-instance-cleansable negations (Unwanted Audience) on top of the
 * globals.
 */
function getTargetStatuses(target, engine) {
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.statuses) return [];
    return Object.keys(hero.statuses)
      .filter(k => STATUS_EFFECTS[k]?.negative && STATUS_EFFECTS[k]?.cleansable !== false)
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  if (target.type === 'equip') {
    const inst = target.cardInstance || engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support'
      && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return [];
    return engine.getCleansableCreatureStatusKeys(inst)
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  return [];
}

/**
 * Targets on EITHER side that currently carry 1+ cleansable status —
 * Heroes via the standard `getHeroTargets` (alive only) and Creatures
 * via `getCreatureTargets` (every Support Zone, Artifact-Creature
 * hybrids included). Same shape Cure uses for its both-side picker.
 */
function getValidTargets(gs, engine) {
  if (!engine) return [];
  const negKeys = getCleansableStatuses();
  const targets = [];
  for (let p = 0; p < 2; p++) {
    for (const t of engine.getHeroTargets(p)) {
      const hero = gs.players[p]?.heroes?.[t.heroIdx];
      if (!hero?.statuses) continue;
      if (negKeys.some(k => hero.statuses[k])) targets.push(t);
    }
    for (const t of engine.getCreatureTargets(p)) {
      const inst = t.cardInstance;
      if (!inst) continue;
      if (engine.getCleansableCreatureStatusKeys(inst).length > 0) targets.push(t);
    }
  }
  return targets;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js.

  /**
   * Play-time gate: at least one target on EITHER side must carry a
   * cleansable status. Without engine access (rare), fall back to a
   * Hero-only optimistic scan over both sides — same shape Cure uses.
   */
  spellPlayCondition(gs, pi, engine) {
    if (engine) return getValidTargets(gs, engine).length > 0;
    const negKeys = getCleansableStatuses();
    for (let p = 0; p < 2; p++) {
      const ps = gs.players[p];
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses && negKeys.some(k => hero.statuses[k])) return true;
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      const validTargets = getValidTargets(gs, engine);
      if (validTargets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const pickedIds = await engine.promptEffectTarget(pi, validTargets, {
        title: CARD_NAME,
        description: 'Select any targets — yours or your opponent\'s — to remove status effects from.',
        confirmLabel: '✨ Cleanse!',
        confirmClass: 'btn-gold',
        cancellable: true,
        goldSelect: true,
        exclusiveTypes: false,
        maxPerType: { hero: 99, equip: 99 },
      });

      if (!pickedIds || pickedIds.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const selectedTargets = pickedIds
        .map(id => validTargets.find(t => t.id === id))
        .filter(Boolean);
      if (selectedTargets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // Per-target status selection — sequential statusSelect prompts,
      // same UX as Beer. The player may pick 0 statuses on any given
      // target (the prompt commits with an empty selection); those
      // targets simply don't contribute to the count.
      const cleanseActions = [];
      for (let ti = 0; ti < selectedTargets.length; ti++) {
        const target = selectedTargets[ti];
        const statuses = getTargetStatuses(target, engine);
        if (statuses.length === 0) {
          cleanseActions.push({ target, statuses: [] });
          continue;
        }
        const result = await engine.promptGeneric(pi, {
          type: 'statusSelect',
          targetName: target.cardName,
          statuses,
          title: `${CARD_NAME} — ${target.cardName} (${ti + 1}/${selectedTargets.length})`,
          description: `Choose status effects to remove from ${target.cardName}.`,
          confirmLabel: ti === selectedTargets.length - 1 ? '✨ Cleanse!' : 'Next →',
          cancellable: false,
        });
        cleanseActions.push({ target, statuses: result?.selectedStatuses || [] });
      }

      // Apply removals. Each successfully-removed status counts as one
      // toward the draw threshold — multiple targets carrying the same
      // status name accumulate (the threshold treats them as multiple
      // effects, per the card text).
      let totalRemoved = 0;
      for (const { target, statuses } of cleanseActions) {
        if (statuses.length === 0) continue;

        if (target.type === 'hero') {
          const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (!hero?.statuses) continue;
          const removed = engine.cleanseHeroStatuses(
            hero, target.owner, target.heroIdx, statuses, CARD_NAME);
          totalRemoved += (removed || []).length;
          engine._broadcastEvent('play_zone_animation', {
            type: 'super_saiyan_aura',
            owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
          });
        } else if (target.type === 'equip') {
          const inst = target.cardInstance || engine.cardInstances.find(c =>
            c.owner === target.owner && c.zone === 'support'
            && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
          );
          if (!inst) continue;
          const removed = engine.cleanseCreatureStatuses(inst, statuses, CARD_NAME);
          totalRemoved += (removed || []).length;
          engine._broadcastEvent('play_zone_animation', {
            type: 'super_saiyan_aura',
            owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
          });
        }
      }

      engine.sync();
      await engine._delay(400);

      engine.log('divine_zeal', {
        player: ps.username, removed: totalRemoved,
      });

      if (totalRemoved >= DRAW_THRESHOLD) {
        // ── LOGISCHE Zugmenge, nicht Einzelkarten (Als Ruling 16.8.) ──
        // Der Text sagt "draw 2 cards" — EIN Zug von 2. Die alte
        // 1er-Schleife war reine Animation und haette Tuscan Artist
        // immer nur "1" gezeigt, den Riegel also umgangen.
        // `actionDrawCards` staffelt intern bereits.
        await engine.actionDrawCards(pi, DRAW_COUNT);
        engine.sync();
      }

      engine.sync();
    },
  },
};
