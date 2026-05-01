// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Gou" (Dog)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): delete N cards from the
//    discard piles where N ≤ the number of
//    targets you control OTHER than Gou Creatures
//    → choose that many targets on the board
//    (excluding Guardian Beast Gou Creatures).
//    Those targets take NO damage until the
//    beginning of your next turn. If THIS Gou
//    leaves the board, the protection ends
//    prematurely.
//
//  IMPLEMENTATION:
//
//  • Each protected target carries the standard
//    `gou_protected` BUFF — `hero.buffs.gou_protected`
//    on Heroes, `inst.counters.buffs.gou_protected`
//    on Creatures. The buff's `grants` array lets
//    multiple Gous protect the same target
//    independently, each with its own expiry and
//    source-Gou inst id.
//
//  • Routing protection through the buff system
//    (instead of a private `_gouProtected` field)
//    surfaces the protection as a visible status
//    badge automatically — `BuffColumn` renders
//    every entry in the target's `buffs` map, and
//    a registered `gou_protected` icon makes it
//    clear at a glance.
//
//  • Damage shielding: `beforeDamage` (Hero) and
//    `beforeCreatureDamageBatch` (Creature) hooks
//    both run `isStillProtected` — which prunes
//    expired (gou's-next-turn reached) and orphaned
//    (source Gou not in support) grants on the fly.
//    When the last grant expires, the buff is
//    deleted, removing the badge.
//
//  • If THIS Gou leaves the board, the
//    `onCardLeaveZone` listener walks every Hero
//    + on-board Creature and removes any grant
//    referencing this Gou's id (the rider "ends
//    prematurely" if Gou leaves).
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
  rangeValidCounts,
  buildAllBoardTargets,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast Gou';
const BUFF_NAME = 'gou_protected';

/** True when `target` is a hero object (has `hp`, no `counters`). */
function isHeroTarget(target) {
  return target && target.hp !== undefined && !target.counters;
}

/** Read the buffs map for the target (heroes use `.buffs`, creatures use `.counters.buffs`). */
function getBuffsMap(target) {
  if (!target) return null;
  if (isHeroTarget(target)) return target.buffs || null;
  return target.counters?.buffs || null;
}

/** Get-or-create the buffs map (used when applying a new grant). */
function ensureBuffsMap(target) {
  if (!target) return null;
  if (isHeroTarget(target)) {
    if (!target.buffs) target.buffs = {};
    return target.buffs;
  }
  if (!target.counters) target.counters = {};
  if (!target.counters.buffs) target.counters.buffs = {};
  return target.counters.buffs;
}

/** Delete the buff key entirely (no live grants left). */
function clearBuff(target) {
  const map = getBuffsMap(target);
  if (!map) return;
  if (BUFF_NAME in map) delete map[BUFF_NAME];
}

/** Count own targets excluding Guardian Beast Gou Creatures (Heroes + non-Gou Creatures). */
function countEligibleOwnTargets(engine, pi, selfInstId) {
  let n = 0;
  const ps = engine.gs.players[pi];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (h?.name && h.hp > 0) n++;
  }
  for (const inst of engine.cardInstances) {
    if (inst.controller !== pi) continue;
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.id === selfInstId) continue;
    if (inst.name === CARD_NAME) continue;
    n++;
  }
  return n;
}

function buildProtectableTargets(engine) {
  // The card excludes "Guardian Beast Gou Creatures" — only those are
  // off-limits. ALL other on-board targets (yours or opp's, hero or
  // creature) are eligible per the text "the same number of targets
  // on the board".
  return buildAllBoardTargets(engine).filter(t => t.cardName !== CARD_NAME);
}

/**
 * Walk the target's `gou_protected` buff. Prune expired entries (the
 * activator's "next turn" reached) and orphaned entries (the source
 * Gou is gone from support). Returns true if at least one live grant
 * remains — caller should zero the incoming damage in that case.
 *
 * Side effect: when no live grants remain, removes the buff entry so
 * the UI badge disappears immediately.
 */
function isStillProtected(engine, target) {
  if (!target) return false;
  const map = getBuffsMap(target);
  if (!map) return false;
  const buff = map[BUFF_NAME];
  if (!buff || !Array.isArray(buff.grants) || buff.grants.length === 0) return false;
  const gs = engine.gs;
  const live = [];
  for (const entry of buff.grants) {
    // Expired? The activator's next turn has begun.
    if (gs.turn >= entry.expiresAtTurn && gs.activePlayer === entry.ownerIdx) continue;
    // Source Gou still on the board?
    const gou = engine.cardInstances.find(c => c.id === entry.gouInstId);
    if (!gou || gou.zone !== 'support') continue;
    live.push(entry);
  }
  if (live.length > 0) {
    buff.grants = live;
    return true;
  }
  delete map[BUFF_NAME];
  return false;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < 1) return false;
    const cap = countEligibleOwnTargets(engine, pi, ctx.card?.id);
    if (cap < 1) return false;
    return buildProtectableTargets(engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const selfId = ctx.card?.id;
    const total = (gs.players[0]?.discardPile?.length || 0)
      + (gs.players[1]?.discardPile?.length || 0);
    const ownCap = countEligibleOwnTargets(engine, pi, selfId);
    const cap = Math.min(total, ownCap);
    if (cap <= 0) return false;

    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: rangeValidCounts(cap),
      title: CARD_NAME,
      description: `Pick 1-${cap} cards from the discard piles to delete. Each = one target damage-immune until your next turn. (Cap = your non-Gou targets.)`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length === 0) return false;
    const k = deleted.length;

    const protectables = buildProtectableTargets(engine);
    if (protectables.length === 0) return true;
    // Player MUST pick exactly k targets (or all available, when fewer
    // exist than k). The relevant param on `promptEffectTarget` is
    // `minRequired` — `minSelect` was a typo and silently fell back
    // to 0, letting the player confirm with too few selections.
    const requiredSelect = Math.min(k, protectables.length);
    if (requiredSelect <= 0) return true;
    const tgtIds = await engine.promptEffectTarget(pi, protectables, {
      title: CARD_NAME,
      description: requiredSelect === protectables.length
        ? `Pick all ${requiredSelect} eligible target${requiredSelect === 1 ? '' : 's'} to protect.`
        : `Pick exactly ${requiredSelect} target${requiredSelect === 1 ? '' : 's'} to protect from damage until your next turn.`,
      confirmLabel: '🛡️ Protect',
      cancellable: false,
      maxTotal: requiredSelect,
      minRequired: requiredSelect,
      exclusiveTypes: false,
    });
    if (!tgtIds || tgtIds.length === 0) return true;

    // Apply each grant. Use turn = current + 1 with expiresForPlayer
    // = activator (pi); the damage hook checks both before treating
    // an entry as live, so the buff naturally falls off when the
    // activator's next turn begins.
    const expiresAtTurn = gs.turn + 1;
    for (const id of tgtIds) {
      const tgt = protectables.find(t => t.id === id);
      if (!tgt) continue;
      const target = tgt.type === 'hero'
        ? gs.players[tgt.owner]?.heroes?.[tgt.heroIdx]
        : tgt.cardInstance;
      if (!target) continue;
      const map = ensureBuffsMap(target);
      if (!map) continue;
      const grant = { gouInstId: selfId, ownerIdx: pi, expiresAtTurn };
      if (!map[BUFF_NAME]) {
        map[BUFF_NAME] = { grants: [grant], appliedTurn: gs.turn };
      } else {
        if (!Array.isArray(map[BUFF_NAME].grants)) map[BUFF_NAME].grants = [];
        map[BUFF_NAME].grants.push(grant);
      }
      // Fire one shield bubble per target. Broadcasts in this loop are
      // synchronous so all bubbles arrive at the client in the same
      // frame and start their animation simultaneously.
      engine._broadcastEvent('play_zone_animation', {
        type: 'shield_bubble',
        owner: tgt.owner,
        heroIdx: tgt.heroIdx,
        zoneSlot: tgt.type === 'hero' ? -1 : tgt.slotIdx,
      });
    }

    engine.log('guardian_beast_gou_protect', {
      player: gs.players[pi]?.username, count: tgtIds.length, deleted: k,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * Hero damage shield. When the target carries a live `gou_protected`
     * grant, set the damage to 0. Expired/orphaned grants are pruned
     * inside `isStillProtected`.
     */
    beforeDamage: (ctx) => {
      const engine = ctx._engine;
      const target = ctx.target;
      if (!target) return;
      if (isStillProtected(engine, target)) ctx.setAmount(0);
    },

    /**
     * Creature damage shield (parity with the hero path). Creature
     * damage flows through `processCreatureDamageBatch`, which fires
     * `beforeCreatureDamageBatch` with `ctx.entries` — an array of
     * `{ inst, amount, type, source, ... }`. We zero the `amount` on
     * any entry whose `inst` is still under a live grant.
     */
    beforeCreatureDamageBatch: (ctx) => {
      const engine = ctx._engine;
      const entries = ctx.entries;
      if (!Array.isArray(entries) || entries.length === 0) return;
      for (const e of entries) {
        if (!e || e.cancelled) continue;
        if (!e.inst) continue;
        if (isStillProtected(engine, e.inst)) {
          e.amount = 0;
        }
      }
    },

    /**
     * If THIS Gou leaves the board, sweep all grants it issued (per
     * the rider "if this Creature leaves the board, this effect ends
     * prematurely"). Walks every Hero + on-board Creature and prunes
     * grants whose `gouInstId` matches our id; if a target's grants
     * list ends up empty, the buff entry is dropped.
     */
    onCardLeaveZone: (ctx) => {
      const engine = ctx._engine;
      const me = ctx.card;          // listener (THIS Gou)
      const leaving = ctx.leavingCard; // the card whose leave triggered the hook
      if (!me || !leaving) return;
      if (leaving.id !== me.id) return;
      const gs = engine.gs;
      const ourId = me.id;
      const sweep = (target) => {
        if (!target) return;
        const map = getBuffsMap(target);
        if (!map) return;
        const buff = map[BUFF_NAME];
        if (!buff || !Array.isArray(buff.grants)) return;
        const filtered = buff.grants.filter(g => g.gouInstId !== ourId);
        if (filtered.length === 0) {
          delete map[BUFF_NAME];
        } else {
          buff.grants = filtered;
        }
      };
      for (let p = 0; p < 2; p++) {
        const ps = gs.players[p];
        for (const h of ps?.heroes || []) {
          if (h && typeof h === 'object') sweep(h);
        }
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone === 'support') sweep(inst);
      }
    },
  },
};
