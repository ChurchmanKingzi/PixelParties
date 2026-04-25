// ═══════════════════════════════════════════
//  CARD EFFECT: "Gathering Storm"
//  Spell (Destruction Magic Lv3, Attachment)
//
//  On cast: attach this Spell to the casting Hero
//  by placing it into one of that Hero's Support
//  Zones. The drag-target slot (gs._attachmentZoneSlot)
//  is honoured if it points at a free zone of the
//  caster; otherwise we auto-pick the first free
//  slot on the caster, then fall back to any other
//  living Hero on the same side.
//
//  While attached: at the start of each of the
//  opponent's turns, the opponent chooses up to 3
//  targets they control (or as many as possible if
//  they control fewer than 3). Deal 70 damage to
//  each. Damage is doubled when the corresponding
//  Hero (this card's host) also has "The White Eye"
//  equipped in their Support Zone.
//
//  Multiple Gathering Storms can be in play at the
//  same time (per host hero) — each fires its own
//  damage round at opp turn start, in attachment
//  order.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Gathering Storm';
const EYE_NAME  = 'The White Eye';
const BASE_DMG  = 70;
const MAX_TGTS  = 3;

/** Find a free Support Zone slot for `heroIdx` on player `pi`, or -1. */
function findFreeSlot(ps, heroIdx) {
  const sz = ps.supportZones?.[heroIdx] || [[], [], []];
  for (let si = 0; si < 3; si++) {
    if (((sz[si] || []).length) === 0) return si;
  }
  return -1;
}

/** Whether the attached host hero is also equipped with The White Eye. */
function hostHasWhiteEye(engine, ownerIdx, heroIdx) {
  return engine.cardInstances.some(c =>
    c.owner === ownerIdx && c.zone === 'support' &&
    c.heroIdx === heroIdx && c.name === EYE_NAME);
}

module.exports = {
  // Active in 'hand' for self-cast onPlay; in 'support' for the
  // recurring opp-turn-start damage hook.
  activeIn: ['hand', 'support'],

  /**
   * CPU target override — mirrors the smart self-targeting logic used
   * by Bottled Lightning's `chainTargetPick` so the CPU doesn't just
   * dump damage onto its own ascended heroes (which the generic
   * ally-fallback in cpuPickTargets does, since Gathering Storm
   * looks neither like heal nor buff).
   *
   * For each of the `pickCount` slots:
   *   • If we're forced to fill every remaining slot and at least one
   *     target would die to this hit, pick the LOWEST-HP doomed
   *     target (least HP wasted on overkill).
   *   • Otherwise pick the HIGHEST-HP target so it survives.
   *   • If even the highest-HP would die, pick the lowest-HP
   *     (minimise overkill since something must die).
   *   • Each target picked once.
   *
   * Damage per target is read from `config.damage`, which Gathering
   * Storm's onTurnStart writes into the prompt config below.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'target') return undefined;
    const validTargets = promptData?.validTargets || [];
    const config       = promptData?.config || {};
    if (validTargets.length === 0) return [];

    const dmg = config.damage || BASE_DMG;
    const pickCount = Math.min(
      config.minRequired || 1,
      config.maxTotal ?? validTargets.length,
      validTargets.length,
    );
    if (pickCount <= 0) return [];

    const cardDB = engine._getCardDB();
    const getHp = (t) => {
      if (t.type === 'hero') {
        const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
        return h?.hp || 0;
      }
      // Creatures (whether tagged 'creature' or 'equip' by promptEffectTarget)
      const inst = t.cardInstance || engine.cardInstances.find(c =>
        c.owner === t.owner && c.zone === 'support' &&
        c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx
      );
      const cd = inst ? cardDB[inst.name] : (cardDB[t.cardName] || null);
      return inst?.counters?.currentHp ?? cd?.hp ?? 0;
    };

    const selected = [];
    const used = new Set();
    for (let step = 0; step < pickCount; step++) {
      const available = validTargets.filter(t => !used.has(t.id));
      if (available.length === 0) break;

      const remainingSteps = pickCount - step;
      let chosen = null;

      // If forced to fill every remaining slot AND at least one target
      // would die to this hit, sacrifice the lowest-HP doomed one
      // first (minimal overkill, saves the higher-HP doomed targets
      // for a later step where they might still help).
      if (available.length <= remainingSteps) {
        const doomed = available.filter(t => getHp(t) <= dmg);
        if (doomed.length > 0) {
          doomed.sort((a, b) => getHp(a) - getHp(b));
          chosen = doomed[0];
        }
      }

      if (!chosen) {
        // Highest HP first — survivors preferred.
        const sorted = [...available].sort((a, b) => getHp(b) - getHp(a));
        const highest = sorted[0];
        if (dmg >= getHp(highest)) {
          // Even the highest dies — pick lowest-HP to minimise overkill.
          chosen = sorted[sorted.length - 1];
        } else {
          chosen = highest;
        }
      }

      selected.push(chosen);
      used.add(chosen.id);
    }

    return selected.map(t => t.id);
  },

  /**
   * Caster must have at least one alive Hero with a free Support Zone.
   * (We allow placement on any of the caster's heroes — but the card
   * text says "Hero that uses it" so the caster's own hero is preferred;
   * fallback to other side-mates only when the caster itself has no
   * free slot.)
   */
  spellPlayCondition(gs, playerIdx) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (findFreeSlot(ps, hi) >= 0) return true;
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps     = gs.players[pi];
      if (!ps) return;

      // ── Pick destination Hero + slot ──
      let destHero = -1;
      let destSlot = -1;

      // Drag-drop hint from the client first (caster's hero only).
      if (gs._attachmentZoneSlot != null && gs._attachmentZoneSlot >= 0) {
        const si = gs._attachmentZoneSlot;
        const slot = (ps.supportZones[heroIdx] || [])[si] || [];
        if (slot.length === 0) { destHero = heroIdx; destSlot = si; }
      }
      // Auto-attach to caster's own first free slot.
      if (destSlot < 0) {
        const si = findFreeSlot(ps, heroIdx);
        if (si >= 0) { destHero = heroIdx; destSlot = si; }
      }
      // Fallback: any other living hero on this side.
      if (destSlot < 0) {
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          if (hi === heroIdx) continue;
          const h = ps.heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          const si = findFreeSlot(ps, hi);
          if (si >= 0) { destHero = hi; destSlot = si; break; }
        }
      }
      if (destSlot < 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Place into the chosen Support Zone ──
      if (!ps.supportZones[destHero]) ps.supportZones[destHero] = [[], [], []];
      if (!ps.supportZones[destHero][destSlot]) ps.supportZones[destHero][destSlot] = [];
      ps.supportZones[destHero][destSlot].push(CARD_NAME);

      // Re-track from hand → support
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === CARD_NAME && c.zone === 'hand' && c.id === ctx.card.id
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard(CARD_NAME, pi, 'support', destHero, destSlot);
      gs._spellPlacedOnBoard = true;

      engine._broadcastEvent('play_zone_animation', {
        type: 'electric_strike', owner: pi, heroIdx: destHero, zoneSlot: destSlot,
      });

      engine.log('gathering_storm_attached', {
        player: ps.username, hero: ps.heroes[destHero]?.name,
      });

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: destHero,
        _skipReactionCheck: true,
      });
      engine.sync();
    },

    /**
     * At the start of the opponent's turn (relative to this card's owner),
     * the opponent picks up to 3 targets they control to take 70 damage
     * each. Damage doubled when host hero is also equipped with The White
     * Eye.
     */
    onTurnStart: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      const engine = ctx._engine;
      const gs     = engine.gs;
      const ownerIdx = ctx.cardOwner;
      const oppIdx   = ownerIdx === 0 ? 1 : 0;

      // Only fires when the opponent is the active player (their turn start).
      if (gs.activePlayer !== oppIdx) return;

      // Host must still be alive + functional (frozen/stunned/negated kill the trigger).
      const host = ctx.attachedHero;
      if (!host?.name || host.hp <= 0) return;
      if (host.statuses?.frozen || host.statuses?.stunned || host.statuses?.negated) return;

      const oppPs = gs.players[oppIdx];
      if (!oppPs) return;

      // ── Collect every target the opponent controls ──
      const cardDB = engine._getCardDB();
      const targets = [];
      for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
        const h = oppPs.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        targets.push({
          id: `hero-${oppIdx}-${hi}`, type: 'hero',
          owner: oppIdx, heroIdx: hi, cardName: h.name,
        });
      }
      for (const inst of engine.cardInstances) {
        if (inst.owner !== oppIdx || inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({
          id: `equip-${oppIdx}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip', owner: oppIdx,
          heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          cardName: inst.name, cardInstance: inst,
        });
      }
      if (targets.length === 0) return;

      const dmg = hostHasWhiteEye(engine, ownerIdx, ctx.cardHeroIdx)
        ? BASE_DMG * 2 : BASE_DMG;
      const pickCount = Math.min(MAX_TGTS, targets.length);

      // ── Opponent picks up to `pickCount` of their own targets ──
      // `damage: dmg` is consumed by `cpuResponse` so the CPU brain can
      // distinguish "this hit kills the target" from "this hit leaves
      // them alive" when assigning damage slots — same heuristic as
      // chainTargetPick (Bottled Lightning).
      const picked = await engine.promptEffectTarget(oppIdx, targets, {
        title: CARD_NAME,
        description: `${host.name}'s Gathering Storm forces you to pick ${pickCount} target${pickCount > 1 ? 's' : ''} to take ${dmg} damage.`,
        confirmLabel: `⚡ Take ${dmg} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
        exclusiveTypes: false,
        maxPerType: { hero: pickCount, equip: pickCount },
        maxTotal: pickCount,
        minRequired: pickCount,
        damage: dmg,
      });
      if (!picked || picked.length === 0) return;

      const source = { name: CARD_NAME, owner: ownerIdx, heroIdx: ctx.cardHeroIdx };
      const chosen = picked.map(id => targets.find(t => t.id === id)).filter(Boolean);

      // ── Animate + damage each picked target ──
      // Dedicated `gathering_storm_strike` event so the client can
      // route the per-target damage cue to a lightning SFX (rather
      // than the silent `electric_strike` zone-animation default).
      // The visual still uses the existing electric_strike effect.
      for (const t of chosen) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'electric_strike', owner: t.owner,
          heroIdx: t.heroIdx, zoneSlot: t.type === 'hero' ? -1 : t.slotIdx,
        });
        engine._broadcastEvent('gathering_storm_strike', {
          owner: t.owner, heroIdx: t.heroIdx,
          zoneSlot: t.type === 'hero' ? -1 : t.slotIdx,
        });
      }
      await engine._delay(400);

      for (const t of chosen) {
        if (t.type === 'hero') {
          const tgtHero = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (tgtHero && tgtHero.hp > 0) {
            await engine.actionDealDamage(source, tgtHero, dmg, 'destruction_spell');
          }
        } else {
          const inst = t.cardInstance || engine.cardInstances.find(c =>
            c.owner === t.owner && c.zone === 'support' &&
            c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx
          );
          if (inst && inst.zone === 'support') {
            await engine.actionDealCreatureDamage(
              source, inst, dmg, 'destruction_spell',
              { sourceOwner: ownerIdx, canBeNegated: true }
            );
          }
        }
      }

      engine.log('gathering_storm_tick', {
        player: gs.players[ownerIdx]?.username,
        opponent: oppPs.username,
        damage: dmg, doubled: dmg !== BASE_DMG,
        targets: chosen.map(t => t.cardName),
      });
      engine.sync();
    },
  },
};
