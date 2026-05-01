// ═══════════════════════════════════════════
//  Shared helpers for the "Guardian Beasts"
//  archetype.
//
//  Twelve Creatures (Gou, Hou, Hu, Ji, Long, Ma,
//  Niu, She, Shu, Tu, Yang, Zhu) plus two Spells
//  (Guard Duty, Guardian's Appearance) and the
//  Hero "Mao, the Vengeful Guardian". The
//  Creatures share three common rules:
//
//  1. SUMMON GATE — "you can only summon this
//     while you have no cards in your discard
//     pile". Enforced via `canSummon(ctx)` in each
//     creature; helper below centralizes the
//     check.
//
//  2. FIRST-OF-TURN BONUS — "if you have not
//     summoned a Guardian Beast Creature yet this
//     turn, summoning this counts as an additional
//     Action". Engine reads `inherentAction(...)`
//     at hand-play time; helper returns true if
//     the player's per-turn flag isn't yet set.
//     The flag itself is stamped in `onPlay` as
//     soon as the summon resolves, so subsequent
//     Guardian Beast summons in the same turn
//     correctly DO consume an action.
//
//  3. DELETE-FROM-DISCARD COSTS — each Creature's
//     active effect costs N cards "deleted total
//     from both discard piles". The deletion picker
//     opens both players' discard piles and lets
//     the activator choose any combination summing
//     to the requested count. Deleted cards land on
//     each player's `deletedPile`.
//
//  The loader skips files starting with "_", so
//  this module is registered as private
//  infrastructure and never loaded as a card.
// ═══════════════════════════════════════════

const ARCHETYPE = 'Guardian Beasts';

// All twelve Creatures by exact name. Used to filter pickers and to
// detect "summoned a Guardian Beast Creature this turn" — the
// archetype field on cardData is the source of truth, but a hard set
// avoids cross-archetype false positives if anyone else later uses
// "Guardian Beasts" as their tag.
const GUARDIAN_BEAST_CREATURES = new Set([
  'Guardian Beast Gou',
  'Guardian Beast Hou',
  'Guardian Beast Hu',
  'Guardian Beast Ji',
  'Guardian Beast Long',
  'Guardian Beast Ma',
  'Guardian Beast Niu',
  'Guardian Beast She',
  'Guardian Beast Shu',
  'Guardian Beast Tu',
  'Guardian Beast Yang',
  'Guardian Beast Zhu',
]);

const PER_TURN_FLAG = '_guardianBeastSummonedThisTurn';

/** Is this card name one of the twelve Guardian Beast Creatures? */
function isGuardianBeastCreature(cardName) {
  return GUARDIAN_BEAST_CREATURES.has(cardName);
}

/** Archetype check via cards.json — covers Spells / Hero too. */
function isGuardianBeastsArchetype(cardName, engine) {
  if (!cardName || !engine) return false;
  const cd = engine._getCardDB()[cardName];
  return cd?.archetype === ARCHETYPE;
}

/**
 * Empty-discard-pile gate, shared `canSummon` for every Guardian Beast
 * Creature. Called via `engine.isCreatureSummonable(name, pi, ...)`.
 * Returns false when the player's discard pile has any cards.
 */
function canSummonGuardianBeast(ctx) {
  const engine = ctx?._engine;
  const pi = ctx?.cardOwner;
  if (engine == null || pi == null) return false;
  const ps = engine.gs?.players?.[pi];
  if (!ps) return false;
  return (ps.discardPile?.length || 0) === 0;
}

/**
 * `inherentAction` predicate shared by every Guardian Beast Creature.
 * Returns true (= treat this play as an additional Action) when the
 * player hasn't already summoned a Guardian Beast Creature this turn.
 *
 * The flag is set in `onPlay` (see `markGuardianBeastSummoned`), AFTER
 * the engine has consulted `inherentAction` at hand-play time. So the
 * FIRST Guardian Beast of the turn pays no main Action; the second
 * onwards pays normally.
 */
function inherentActionForFirstSummon(gs, pi) {
  const ps = gs?.players?.[pi];
  return ps != null && !ps[PER_TURN_FLAG];
}

/**
 * Stamp the player's per-turn "I have summoned a Guardian Beast" flag.
 * Call this from each Creature's `onPlay` hook. Idempotent — repeated
 * calls in the same turn are no-ops. The flag is reset by the engine
 * at the start of each turn (see `_engine.js` startTurn).
 */
function markGuardianBeastSummoned(gs, pi) {
  const ps = gs?.players?.[pi];
  if (!ps) return;
  ps[PER_TURN_FLAG] = true;
}

/**
 * Build a flat list of "deletable" entries from BOTH discard piles
 * for the activator's picker. Each entry carries enough info to
 * uniquely identify which card on which side it came from, so the
 * resolver can splice it cleanly when the user confirms a selection.
 */
function buildBothDiscardEntries(engine) {
  const entries = [];
  for (let pi = 0; pi < 2; pi++) {
    const ps = engine.gs?.players?.[pi];
    if (!ps) continue;
    const dp = ps.discardPile || [];
    for (let i = 0; i < dp.length; i++) {
      entries.push({
        id: `dp-${pi}-${i}`,
        owner: pi,
        idx: i,
        cardName: dp[i],
        side: pi,
      });
    }
  }
  return entries;
}

/**
 * Gallery view of both discard piles for a `cardGalleryMulti` prompt.
 * Each gallery card carries an `entryId` (`dp-<pi>-<idx>`) so the
 * resolver can map the selection back to a real pile location.
 *
 * Cards from the activator's pile are tagged `(yours)` and opponent's
 * pile `(opp)` in the label so the player can tell them apart. We do
 * NOT collapse duplicates here — each physical copy is a distinct
 * choice (deleting "Heal" from your pile vs from the opponent's pile
 * are different decisions).
 */
function buildDiscardGallery(engine, activatorIdx) {
  const out = [];
  for (let pi = 0; pi < 2; pi++) {
    const ps = engine.gs?.players?.[pi];
    if (!ps) continue;
    const dp = ps.discardPile || [];
    const tag = pi === activatorIdx ? '(yours)' : '(opp)';
    for (let i = 0; i < dp.length; i++) {
      out.push({
        name: dp[i],
        source: 'discard',
        entryId: `dp-${pi}-${i}`,
        label: `${dp[i]} ${tag}`,
      });
    }
  }
  return out;
}

/**
 * Apply a confirmed delete-from-discard selection. Splices each chosen
 * entry from its source discard pile (highest indices first to keep
 * earlier indices stable) and pushes it onto the corresponding
 * deletedPile, going through `_tryBeforeDelete` for rescue support
 * (Guardian Angel-style "I save myself from being deleted" cards can
 * intercept and prevent the move). Returns the array of card NAMES
 * that actually landed in deletedPile, in selection order minus any
 * rescues.
 *
 * @param {GameEngine} engine
 * @param {Array<{owner:number, idx:number, cardName:string}>} picks
 * @param {string} sourceName  — Guardian Beast card name (for log).
 * @returns {Promise<string[]>}
 */
async function deleteSelectedDiscardCards(engine, picks, sourceName) {
  if (!Array.isArray(picks) || picks.length === 0) return [];
  // Group by owner so we can splice each pile in descending-index
  // order (index-stable splices). A card can only be selected once
  // per pick (the picker enforces this), so the same idx never
  // appears twice in one group.
  const byOwner = [[], []];
  for (const p of picks) {
    if (p?.owner != null && p?.idx != null) byOwner[p.owner].push(p);
  }
  const deletedNames = [];
  // Per-pile name buckets so we can fire one batch animation per
  // owner after the splices. Animation order matches splice order.
  const animByOwner = [[], []];
  for (let pi = 0; pi < 2; pi++) {
    const ps = engine.gs?.players?.[pi];
    if (!ps?.discardPile) continue;
    // Splice from highest index downward.
    byOwner[pi].sort((a, b) => b.idx - a.idx);
    for (const p of byOwner[pi]) {
      const dp = ps.discardPile;
      // Defensive: re-validate the splice target name in case of
      // mid-resolve drift (a hand-shuffle reaction etc.).
      if (p.idx < 0 || p.idx >= dp.length) continue;
      if (dp[p.idx] !== p.cardName) continue;
      const cardName = dp[p.idx];
      const rescued = await engine._tryBeforeDelete(cardName, pi, {
        fromZone: 'discard',
        fromInstance: null,
        source: sourceName || ARCHETYPE,
      });
      if (rescued) continue; // rescue claimed it — leave the discard alone
      dp.splice(p.idx, 1);
      ps.deletedPile = ps.deletedPile || [];
      ps.deletedPile.push(cardName);
      engine.log('card_deleted', {
        card: cardName, player: ps.username, source: sourceName || ARCHETYPE,
      });
      deletedNames.push(cardName);
      animByOwner[pi].push(cardName);
    }
  }
  // Visual: one flying-card animation per owner (discard pile → deleted
  // pile). Card images chain with a small per-card delay so deleting
  // multiple feels like a wave. Single broadcast per side keeps the
  // timing tight when picks span both piles.
  for (let pi = 0; pi < 2; pi++) {
    if (animByOwner[pi].length === 0) continue;
    engine._broadcastEvent('discard_to_deleted_animation', {
      owner: pi,
      cardNames: animByOwner[pi],
      source: sourceName || ARCHETYPE,
    });
  }
  if (deletedNames.length > 0) engine.sync();
  return deletedNames;
}

/**
 * Combined-discard delete picker. Opens a `cardGalleryMulti` over the
 * union of both discard piles and lets the player click the exact set
 * they want to delete. The COUNT of cards selected IS the cost — no
 * separate "how many?" step.
 *
 * Cost shapes are expressed via `validCounts`:
 *   - exact: `[5]`        → must pick exactly 5
 *   - discrete set: `[3, 6, 9]`  → must pick one of these counts
 *   - any-up-to-N: `[1, 2, 3, 4, 5]` → any count between 1 and 5
 *   - multiple-of-K: `[4, 8, 12, 16, ...]` → multiples of K up to cap
 *
 * The picker grays out the confirm button while the current selection
 * count isn't in `validCounts`. The largest entry in `validCounts`
 * caps how many cards can be picked. Counts larger than the combined
 * discard size are filtered out before the prompt opens — if NO valid
 * count is achievable, we fizzle (return null).
 *
 * @param {object} ctx               — hook context with `_engine` + `cardOwner`
 * @param {object} opts
 * @param {number[]} opts.validCounts — required, see above
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} opts.sourceName    — for logging (e.g. "Guardian Beast Ji")
 * @param {boolean} [opts.cancellable=true]
 * @returns {Promise<string[]|null>} array of deleted card names, or
 *                                   null on cancel / no achievable count.
 */
async function promptAndDeleteFromBothDiscards(ctx, opts = {}) {
  const engine = ctx?._engine;
  const pi = ctx?.cardOwner;
  if (engine == null || pi == null) return null;

  const totalAvailable = (engine.gs.players[0]?.discardPile?.length || 0)
    + (engine.gs.players[1]?.discardPile?.length || 0);

  // Filter validCounts to those achievable given the combined pile.
  const requested = Array.isArray(opts.validCounts)
    ? opts.validCounts.filter(n => Number.isInteger(n) && n > 0)
    : [];
  const achievable = requested.filter(n => n <= totalAvailable).sort((a, b) => a - b);
  if (achievable.length === 0) return null;

  const gallery = buildDiscardGallery(engine, pi);
  if (gallery.length === 0) return null;

  const result = await engine.promptGeneric(pi, {
    type: 'cardGalleryMulti',
    cards: gallery,
    title: opts.title || 'Guardian Beasts',
    description: opts.description
      || `Click cards to select them. Valid counts: ${achievable.join(', ')}.`,
    validCounts: achievable,
    cancellable: opts.cancellable !== false,
  });
  if (!result || result.cancelled) return null;

  // Map selections back to (owner, idx) pairs. The picker now returns
  // `selectedIndices` (gallery indices) — the canonical mapping. We
  // walk those, look up the gallery entry's entryId, and parse it. The
  // older string-only `selectedCards` shape is supported as a fallback
  // for offline replays / legacy CPU responders that don't include
  // indices.
  const picks = [];
  const usedIds = new Set();
  if (Array.isArray(result.selectedIndices) && result.selectedIndices.length > 0) {
    for (const galleryIdx of result.selectedIndices) {
      const entry = gallery[galleryIdx];
      if (!entry) continue;
      const m = /^dp-(\d+)-(\d+)$/.exec(entry.entryId || '');
      if (!m) continue;
      const owner = parseInt(m[1], 10);
      const idx = parseInt(m[2], 10);
      const ps = engine.gs.players[owner];
      if (ps?.discardPile?.[idx] !== entry.name) continue;
      const claimKey = entry.entryId;
      if (usedIds.has(claimKey)) continue;
      usedIds.add(claimKey);
      picks.push({ owner, idx, cardName: entry.name });
    }
  } else if (Array.isArray(result.selectedCards)) {
    // Legacy fallback — selectedCards is array of names. Linear-search
    // either pile, claiming each (owner, idx) once so duplicate names
    // get distinct slots.
    for (const raw of result.selectedCards) {
      const name = typeof raw === 'string' ? raw : raw?.cardName || raw?.name;
      if (!name) continue;
      let placed = false;
      for (let pi2 = 0; pi2 < 2 && !placed; pi2++) {
        const dp = engine.gs.players[pi2]?.discardPile || [];
        for (let i = 0; i < dp.length; i++) {
          const claimKey = `dp-${pi2}-${i}`;
          if (usedIds.has(claimKey)) continue;
          if (dp[i] !== name) continue;
          usedIds.add(claimKey);
          picks.push({ owner: pi2, idx: i, cardName: name });
          placed = true;
          break;
        }
      }
    }
  }
  if (picks.length === 0) return null;

  // Post-resolution validation — the count MUST be in achievable.
  // Defensive: a malformed CPU responder or a stale client could
  // submit a count outside validCounts. Reject before we delete
  // anything.
  if (!achievable.includes(picks.length)) return null;

  return deleteSelectedDiscardCards(engine, picks, opts.sourceName || ARCHETYPE);
}

/**
 * Build a `validCounts` array from a "any count from 1 to cap" rule.
 * Useful for the variable-cost beasts (Gou / Hou / Long / Niu / She).
 * Returns `[1, 2, ..., min(cap, totalAvailable)]`. Empty array if cap
 * is 0 or no cards exist.
 */
function rangeValidCounts(cap) {
  if (!Number.isFinite(cap) || cap <= 0) return [];
  const out = [];
  for (let i = 1; i <= cap; i++) out.push(i);
  return out;
}

/**
 * Multiples-of-K up to `maxN`. Used by Shu (`multiplesOfK(4, total)` →
 * `[4, 8, 12, ...]`).
 */
function multiplesOfK(k, maxN) {
  if (!Number.isInteger(k) || k <= 0) return [];
  const out = [];
  for (let n = k; n <= maxN; n += k) out.push(n);
  return out;
}

/**
 * "Delete N cards from MY discard pile" — single-pile variant for
 * cards (Mao's Hero effect) that explicitly target one side. Uses the
 * same beforeDelete rescue path. Top-of-discard order — no picker.
 *
 * Returns the array of card names actually deleted (post-rescue), in
 * deletion order. Stops early if the pile runs out before reaching
 * the requested count.
 */
async function deleteTopOfOwnDiscard(engine, pi, count, sourceName) {
  const ps = engine.gs?.players?.[pi];
  if (!ps?.discardPile) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    if (ps.discardPile.length === 0) break;
    // We delete from the BOTTOM of the discard pile (oldest cards) so
    // recently-discarded cards (which the player may want to recur)
    // stay accessible. This matches typical "delete from the discard"
    // semantics in similar games and is documented in Mao's text as
    // "delete 5 cards" without specifying which.
    const cardName = ps.discardPile[0];
    const rescued = await engine._tryBeforeDelete(cardName, pi, {
      fromZone: 'discard',
      fromInstance: null,
      source: sourceName || ARCHETYPE,
    });
    if (rescued) {
      // The card removed itself via beforeDelete; leave the rest of
      // the pile alone and continue with the next slot's name.
      // Most rescue paths splice the card out of the pile themselves;
      // re-check the pile length so we don't loop on the same name.
      if (ps.discardPile[0] === cardName) ps.discardPile.shift();
      continue;
    }
    ps.discardPile.shift();
    ps.deletedPile = ps.deletedPile || [];
    ps.deletedPile.push(cardName);
    engine.log('card_deleted', {
      card: cardName, player: ps.username, source: sourceName || ARCHETYPE,
    });
    out.push(cardName);
  }
  if (out.length > 0) {
    engine._broadcastEvent('discard_to_deleted_animation', {
      owner: pi, cardNames: out, source: sourceName || ARCHETYPE,
    });
    engine.sync();
  }
  return out;
}

/**
 * Build a "creature target" list from the entire board — used by
 * Guardian Beast effects that say "choose targets on the board"
 * (Hou's damage spread, Ji's stun, etc.). Includes both Heroes and
 * face-up Creatures from both sides.
 *
 * Excludes: empty hero slots, dead Heroes (the standard target rule),
 * face-down Creatures.
 */
function buildAllBoardTargets(engine, opts = {}) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (let p = 0; p < 2; p++) {
    const ps = engine.gs.players[p];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (opts.excludeHeroOwner === p && opts.excludeHeroIdx === hi) continue;
      out.push({
        id: `hero-${p}-${hi}`, type: 'hero',
        owner: p, heroIdx: hi, cardName: hero.name,
      });
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd) continue;
    if (opts.excludeInstId === inst.id) continue;
    if (typeof opts.excludeName === 'string' && inst.name === opts.excludeName) continue;
    if (typeof opts.creaturesOnly === 'function' && !opts.creaturesOnly(inst, cd)) continue;
    out.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
      owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return out;
}

module.exports = {
  ARCHETYPE,
  GUARDIAN_BEAST_CREATURES,
  PER_TURN_FLAG,
  isGuardianBeastCreature,
  isGuardianBeastsArchetype,
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  markGuardianBeastSummoned,
  buildBothDiscardEntries,
  buildDiscardGallery,
  deleteSelectedDiscardCards,
  promptAndDeleteFromBothDiscards,
  rangeValidCounts,
  multiplesOfK,
  deleteTopOfOwnDiscard,
  buildAllBoardTargets,
};
