// ═══════════════════════════════════════════
//  CARD EFFECT: "Anti Magic"
//  Spell (Support Magic Lv2, Attachment)
//
//  Attach to any Hero. While Anti Magic is
//  attached to that Hero:
//   • The Hero becomes immune to all OTHER
//     Spells whose level is ≤ X.
//   • X = 1 / 2 / 3 depending on the caster's
//     Support Magic level when Anti Magic
//     resolved (capped at 3).
//   • Detaches all other Spells of level ≤ X
//     already attached to the Hero at resolve
//     time.
//
//  Wiring:
//   • Targeting block lives in the engine's
//     `promptDamageTarget` / `promptMultiTarget`
//     Magic-Immune filter (added alongside
//     this card). Spells gated as `cardType ===
//     'Spell'` and level ≤ buff.level are
//     filtered out of the Hero target list.
//   • `bypassesMagicImmune: true` — Anti Magic
//     itself opts out, so a NEW copy can
//     legally target an already-immune Hero
//     and overwrite the existing buff (matches
//     the "detach all other Spells of level ≤
//     X" clause — a stale Anti Magic gets
//     replaced).
//   • Buff is keyed `magic_immune` and stores
//     `{ level: X, source: 'Anti Magic' }`. The
//     `BuffColumn` tooltip is function-form and
//     reads `data.level` to render the live
//     "immune to Spells up to level X" text.
//   • On leave-zone: clear the buff IF no other
//     Anti Magic remains attached to the same
//     Hero. Multiple copies → buff stays at the
//     HIGHEST X among remaining copies.
//
//  Animation: light barrier flicker on the
//  protected Hero at resolve time.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Anti Magic';
const MAX_LEVEL = 3;

/**
 * Compute the level X granted by THIS cast, based on the caster's
 * effective Support Magic level on its host Hero. Capped at MAX_LEVEL.
 */
function computeLevel(engine, pi, heroIdx) {
  const lvl = engine.effectiveSchoolLevelForCaster('Support Magic', pi, heroIdx);
  return Math.max(1, Math.min(MAX_LEVEL, lvl || 1));
}

/**
 * Highest `magic_immune.level` provided by any Anti Magic instance
 * currently attached to (ownerIdx, heroIdx). Returns 0 when none
 * are attached. Used on leave-zone to recompute the buff after one
 * copy departs.
 */
function highestRemainingLevel(engine, ownerIdx, heroIdx, excludeInstId) {
  let best = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.name !== CARD_NAME) continue;
    if (inst.owner !== ownerIdx) continue;
    if (inst.heroIdx !== heroIdx) continue;
    if (excludeInstId != null && inst.id === excludeInstId) continue;
    const lvl = inst.counters?.antiMagicLevel || 0;
    if (lvl > best) best = lvl;
  }
  return best;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // Engine target-filter opt-out — Anti Magic ignores its own buff so a
  // new copy can replace a stale one (the "detach all other Spells of
  // level ≤ X" clause).
  bypassesMagicImmune: true,

  // Need at least 1 Hero (any side) with a free Support Zone.
  spellPlayCondition(gs) {
    for (let p = 0; p < 2; p++) {
      const ps = gs.players[p];
      for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        const zones = ps.supportZones?.[hi] || [];
        for (let si = 0; si < 3; si++) {
          if (((zones[si] || []).length === 0)) return true;
        }
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const casterHeroIdx = ctx.cardHeroIdx;

      // ── Build target list: any living Hero with a free Support slot ──
      const targets = [];
      for (let p = 0; p < 2; p++) {
        const tps = gs.players[p];
        for (let hi = 0; hi < (tps?.heroes || []).length; hi++) {
          const hero = tps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          const zones = tps.supportZones?.[hi] || [];
          let hasFreeZone = false;
          for (let si = 0; si < 3; si++) {
            if (((zones[si] || []).length === 0)) {
              hasFreeZone = true;
              targets.push({
                id: `equip-${p}-${hi}-${si}`,
                type: 'equip',
                owner: p, heroIdx: hi, slotIdx: si,
                cardName: '',
              });
            }
          }
          if (hasFreeZone) {
            targets.push({
              id: `hero-${p}-${hi}`,
              type: 'hero',
              owner: p, heroIdx: hi,
              cardName: hero.name,
            });
          }
        }
      }
      if (targets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Pick target (auto if only one Hero + one slot) ──
      let targetOwner, targetHeroIdx, targetSlot;
      const heroTargets = targets.filter(t => t.type === 'hero');
      const zoneTargets = targets.filter(t => t.type === 'equip');
      if (heroTargets.length === 1 && zoneTargets.length === 1) {
        targetOwner = heroTargets[0].owner;
        targetHeroIdx = heroTargets[0].heroIdx;
        targetSlot = zoneTargets[0].slotIdx;
      } else {
        const picked = await engine.promptEffectTarget(pi, targets, {
          title: CARD_NAME,
          description: 'Attach Anti Magic to a Hero. That Hero becomes immune to other Spells up to your Support Magic level.',
          confirmLabel: '🛡️ Attach!',
          confirmClass: 'btn-info',
          cancellable: true,
          exclusiveTypes: false,
          maxPerType: { hero: 1, equip: 1 },
          greenSelect: true,
        });
        if (!picked || picked.length === 0) {
          gs._spellCancelled = true;
          return;
        }
        const target = targets.find(t => t.id === picked[0]);
        if (!target) { gs._spellCancelled = true; return; }
        targetOwner = target.owner;
        if (target.type === 'equip') {
          targetHeroIdx = target.heroIdx;
          targetSlot = target.slotIdx;
        } else {
          targetHeroIdx = target.heroIdx;
          const tps = gs.players[targetOwner];
          for (let si = 0; si < 3; si++) {
            if (((tps.supportZones[targetHeroIdx] || [])[si] || []).length === 0) {
              targetSlot = si;
              break;
            }
          }
        }
      }
      if (targetSlot === undefined) return;

      const tps = gs.players[targetOwner];
      const targetHero = tps.heroes[targetHeroIdx];
      if (!targetHero?.name || targetHero.hp <= 0) return;

      // ── Compute X from caster's Support Magic level ──
      const X = computeLevel(engine, pi, casterHeroIdx);

      // ── Detach OTHER Spells of level ≤ X already attached ──
      // Iterate the target's Support Zones; for each face-up Spell
      // (cardType === 'Spell' on a support card) whose level ≤ X,
      // destroy it through the canonical actionDestroyCard path so its
      // onCardLeaveZone hooks fire correctly (e.g. Overheal Shock
      // clears its healReversed status). Skip any Anti Magic instance
      // sitting in the SAME slot we're about to place into (defensive
      // — shouldn't happen since target slot is empty, but safe).
      const cardDB = engine._getCardDB();
      const toDetach = [];
      const targetSupport = tps.supportZones[targetHeroIdx] || [[],[],[]];
      for (let si = 0; si < targetSupport.length; si++) {
        const slot = targetSupport[si] || [];
        if (slot.length === 0) continue;
        const slotTop = slot[slot.length - 1];
        const cd = cardDB[slotTop];
        if (!cd || cd.cardType !== 'Spell') continue;
        if ((cd.level || 0) > X) continue;
        const inst = engine.cardInstances.find(c =>
          c.zone === 'support' && c.owner === targetOwner
          && c.heroIdx === targetHeroIdx && c.zoneSlot === si
          && c.name === slotTop
        );
        if (!inst) continue;
        toDetach.push(inst);
      }
      for (const inst of toDetach) {
        await engine.actionDestroyCard(
          { name: CARD_NAME, owner: pi, heroIdx: casterHeroIdx },
          inst,
        );
      }

      // After detach, the slot we initially chose MAY have shifted —
      // re-check it's still empty (a same-slot Spell we just destroyed
      // landed in that slot). If not, pick the first remaining free
      // slot on the same hero.
      let placeSlot = targetSlot;
      const liveZones = tps.supportZones[targetHeroIdx] || [];
      if ((liveZones[placeSlot] || []).length !== 0) {
        let found = -1;
        for (let si = 0; si < 3; si++) {
          if (((liveZones[si] || []).length === 0)) { found = si; break; }
        }
        if (found < 0) {
          // Should never happen — detaches just freed slot(s) — bail
          // cleanly if it does.
          gs._spellCancelled = true;
          return;
        }
        placeSlot = found;
      }

      // ── Place Anti Magic in the target's Support Zone ──
      if (!tps.supportZones[targetHeroIdx]) tps.supportZones[targetHeroIdx] = [[], [], []];
      if (!tps.supportZones[targetHeroIdx][placeSlot]) tps.supportZones[targetHeroIdx][placeSlot] = [];
      tps.supportZones[targetHeroIdx][placeSlot].push(CARD_NAME);

      // Re-track the live inst at the new zone (untrack the hand copy).
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === CARD_NAME && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);
      const inst = engine._trackCard(CARD_NAME, targetOwner, 'support', targetHeroIdx, placeSlot);
      inst.counters = inst.counters || {};
      inst.counters.antiMagicLevel = X;
      // Originating side info (used by leave-zone cleanup to recompute
      // the buff). Track who CAST this copy — informational, not
      // load-bearing.
      inst.counters.antiMagicCastBy = pi;

      // Tell the server not to discard — the card lives on the board.
      gs._spellPlacedOnBoard = true;

      // ── Apply / refresh the magic_immune buff ──
      // If a previous Anti Magic was just detached, the buff might
      // already be lifted (its leave-zone hook runs). Re-apply with
      // the new level. `addBuff` overwrites existing buffs cleanly.
      await engine.actionAddBuff(targetHero, targetOwner, targetHeroIdx, 'magic_immune', {
        level: X,
        source: CARD_NAME,
      });

      // Barrier shimmer on the protected Hero
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: targetOwner, heroIdx: targetHeroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      // Fire enter-zone hook so any listeners on the attached side
      // observe the new support card.
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine.log('anti_magic_attached', {
        player: ps.username,
        target: targetHero.name,
        level: X,
        detached: toDetach.map(i => i.name),
      });
      engine.sync();
    },

    // When this Anti Magic leaves the support zone (destroyed,
    // detached by a new Anti Magic, bounced, etc.), recompute the
    // host Hero's magic_immune buff. If another Anti Magic instance
    // remains attached to the same Hero, the buff stays at the
    // HIGHEST X among them; if none remain, the buff is cleared.
    onCardLeaveZone: async (ctx) => {
      const card = ctx.card;
      if (!card || card.name !== CARD_NAME) return;
      if (ctx.leavingCard?.id !== card.id) return; // Self-only
      if (ctx.fromZone !== 'support') return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const hostOwner = card.owner;
      const hostHeroIdx = ctx.fromHeroIdx ?? card.heroIdx;
      const hero = gs.players[hostOwner]?.heroes?.[hostHeroIdx];
      if (!hero?.name) return;

      const remaining = highestRemainingLevel(engine, hostOwner, hostHeroIdx, card.id);
      if (remaining > 0) {
        // Refresh the buff to the highest remaining level.
        await engine.actionAddBuff(hero, hostOwner, hostHeroIdx, 'magic_immune', {
          level: remaining,
          source: CARD_NAME,
        });
      } else if (hero.buffs?.magic_immune) {
        await engine.actionRemoveBuff(hero, hostOwner, hostHeroIdx, 'magic_immune', {
          _skipReactionCheck: true,
        });
      }
    },
  },
};
