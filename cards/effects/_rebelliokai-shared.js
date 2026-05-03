// ═══════════════════════════════════════════
//  SHARED HELPER: Rebelliokai archetype
//
//  The archetype is a discard-pile graveyard
//  engine: each Creature self-deletes when sent
//  to discard from outside the hand or board
//  (so opp mills can't fuel us), but we deliberately
//  feed our OWN discard from the hand — and most
//  Rebelliokai Spells/Attacks "Delete X from your
//  discard pile to play this card" while scaling
//  off the pile's diversity.
//
//  Self-delete redirect lives in the engine
//  (`_engine.js` → `actionMoveCard` and
//  `actionMillCards`); cards opt in via
//  `selfDeleteOnExternalDiscard: true`. This
//  module's primitives intentionally do NOT
//  duplicate that gate — they're the higher-level
//  "what does this archetype care about" helpers
//  the per-card scripts read off.
//
//  Conventions:
//    • All Rebelliokai discards triggered by an
//      archetype effect set `opts.source =
//      DISCARD_SOURCE_TAG`. Kind Kitsune's
//      discard hook (Phase 3) keys off this so
//      it doesn't have to enumerate Creature
//      names.
//    • "Different Rebelliokai Creatures in your
//      discard pile" is the most-quoted scaling
//      stat in the archetype (8 / 12 cards). The
//      helper below is the single source of
//      truth — both for runtime and CPU eval.
// ═══════════════════════════════════════════

const REBELLIOKAI_ARCHETYPE = 'Rebelliokai';

// Tag passed in `opts.source` for any discard caused by a Rebelliokai
// effect. Kind Kitsune (Phase 3) reads this off the onDiscard ctx.
const DISCARD_SOURCE_TAG = 'rebelliokai';

/**
 * Is this card a Rebelliokai Creature?
 *
 * Pure archetype check against `cards.json`. All Rebelliokai cards
 * with `cardType: "Creature"` qualify; Spells / Attacks share the
 * archetype tag but are NOT Creatures and so are NOT counted by the
 * "Rebelliokai Creatures in your discard pile" scaling effects.
 */
function isRebelliokaiCreature(cardName, engine /*, inst = null */) {
  if (!cardName || !engine) return false;
  const cd = engine._getCardDB()[cardName];
  if (!cd) return false;
  if (cd.cardType !== 'Creature') return false;
  return cd.archetype === REBELLIOKAI_ARCHETYPE;
}

/**
 * Unique-name list of Rebelliokai Creatures in `playerIdx`'s discard
 * pile. Order is alphabetical (deterministic — used in galleries).
 *
 * Returns an array of card-name strings (NOT objects). Callers that
 * need counts can use `.length`; callers that want the gallery shape
 * (`{ name, source: 'discard', count }`) wrap this themselves.
 */
function getDifferentRebelliokaiInDiscard(ps, engine) {
  if (!ps || !engine) return [];
  const seen = new Set();
  const out  = [];
  for (const cn of (ps.discardPile || [])) {
    if (seen.has(cn)) continue;
    if (!isRebelliokaiCreature(cn, engine)) continue;
    seen.add(cn);
    out.push(cn);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Convenience wrapper — returns the count, optionally capped.
 * Used inline in scaling effects:
 *   const draws = countDifferentRebelliokaiInDiscard(ps, engine, 3);
 */
function countDifferentRebelliokaiInDiscard(ps, engine, max = Infinity) {
  return Math.min(max, getDifferentRebelliokaiInDiscard(ps, engine).length);
}

/**
 * Remove the FIRST copy of `cardName` from `playerIdx`'s discard pile
 * and route it to the deleted pile (matching "Delete 1 X from your
 * discard pile" wording). Returns true if a copy was found and moved,
 * false otherwise.
 *
 * Untracks any tracked instance pinned to that pile slot (Cute
 * Familiar / Cute Dog-style discard-zone listeners) to keep the
 * cardInstances array clean.
 *
 * @param {object} engine
 * @param {number} playerIdx
 * @param {string} cardName
 * @param {object} [opts]
 * @param {string} [opts.source]   - Effect name driving the delete (logged).
 * @param {boolean} [opts.silent]  - Skip the engine log entry.
 */
function deleteFromDiscardByName(engine, playerIdx, cardName, opts = {}) {
  const ps = engine?.gs?.players?.[playerIdx];
  if (!ps || !cardName) return false;
  const idx = (ps.discardPile || []).indexOf(cardName);
  if (idx < 0) return false;
  ps.discardPile.splice(idx, 1);
  ps.deletedPile.push(cardName);

  // Untrack any instance parked in the discard zone for this card
  // (rare — only when a card has an `activeIn: ['discard']` listener
  // tracked there). We pop the FIRST match so a "delete 1 of N" leaves
  // the other tracked instances alone.
  const orphan = engine.cardInstances.find(c =>
    c.owner === playerIdx && c.zone === 'discard' && c.name === cardName,
  );
  if (orphan) engine._untrackCard(orphan.id);

  if (!opts.silent) {
    engine.log('rebelliokai_discard_delete', {
      player: ps.username, card: cardName, source: opts.source || null,
    });
  }
  return true;
}

/**
 * Async variant of `deleteFromDiscardByName` that ALSO plays the
 * canonical discard→deleted flying-card animation (matches Mao's
 * delete-5 hero effect, Guardian Beast deletion costs, and the
 * Rebelliokai self-delete transit). Used by the Rebelliokai
 * Spells/Attacks (Kirin Firebreath, Kappa Sword Slash, Tanuki Escape,
 * Tengu Windstorm) so the cost-deletion is visible.
 *
 * Phasing:
 *   1. Splice from discardPile + sync — card vanishes from discard UI.
 *   2. Broadcast `discard_to_deleted_animation` (700 ms travel + 80 ms
 *      stagger handled client-side; we await ~580 ms here to land just
 *      before the visual completes).
 *   3. Push to deletedPile + sync — card appears in deleted UI.
 *
 * Returns true if a copy was found and moved, false otherwise.
 *
 * @param {object} engine
 * @param {number} playerIdx
 * @param {string} cardName
 * @param {object} [opts]
 * @param {string} [opts.source]
 */
async function payRebelliokaiCost(engine, playerIdx, cardName, opts = {}) {
  const ps = engine?.gs?.players?.[playerIdx];
  if (!ps || !cardName) return false;
  const idx = (ps.discardPile || []).indexOf(cardName);
  if (idx < 0) return false;

  // Untrack any tracked instance pinned to that pile slot BEFORE the
  // splice (mirrors the synchronous helper). Keeps cardInstances clean
  // and prevents discard-zone listeners from mis-firing for the leaving
  // card mid-animation.
  const orphan = engine.cardInstances.find(c =>
    c.owner === playerIdx && c.zone === 'discard' && c.name === cardName,
  );
  if (orphan) engine._untrackCard(orphan.id);

  // Phase 1 — vanish from discard pile.
  ps.discardPile.splice(idx, 1);
  engine.sync();

  // Phase 2 — broadcast the chained flight animation. The client pre-
  // registers the deletedPile-bound name so the pile-growth auto-
  // detector doesn't spawn a phantom flight when Phase 3 lands.
  engine._broadcastEvent('discard_to_deleted_animation', {
    owner:     playerIdx,
    cardNames: [cardName],
    source:    opts.source || 'rebelliokai-cost',
  });
  await engine._delay(560);

  // Phase 3 — push to deleted pile.
  ps.deletedPile.push(cardName);
  engine.sync();

  if (!opts.silent) {
    engine.log('rebelliokai_discard_delete', {
      player: ps.username, card: cardName, source: opts.source || null,
    });
  }
  return true;
}

/**
 * Show a hand gallery filtered to Rebelliokai Creatures, optionally
 * excluding a specific name (e.g. Courtly Kirin's reaction trigger
 * forbids using ANOTHER Kirin in your hand to pay its own cost — the
 * trigger explicitly says "a different Rebelliokai Creature").
 *
 * Discards the picked card via `actionDiscardHandCard` with
 * `source: DISCARD_SOURCE_TAG` so Kind Kitsune's hook fires correctly.
 *
 * Returns the discarded card's name on success, null on cancel /
 * empty hand.
 *
 * @param {object} engine
 * @param {number} playerIdx
 * @param {object} [opts]
 * @param {string} [opts.exclude]      - Name to exclude (Kirin → 'Rebelliokai Courtly Kirin').
 * @param {string} [opts.title]        - Prompt title (default 'Rebelliokai').
 * @param {string} [opts.description]  - Prompt body.
 * @param {string} [opts.confirmLabel] - Confirm button text.
 * @param {boolean} [opts.cancellable=true]
 * @param {string} [opts.source]       - Effect name (logged + sent to onDiscard).
 */
async function promptDiscardRebelliokaiFromHand(engine, playerIdx, opts = {}) {
  const ps = engine?.gs?.players?.[playerIdx];
  if (!ps) return null;

  const counts = {};
  for (const cn of (ps.hand || [])) {
    if (opts.exclude && cn === opts.exclude) continue;
    if (!isRebelliokaiCreature(cn, engine)) continue;
    counts[cn] = (counts[cn] || 0) + 1;
  }
  const gallery = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'hand', count }));
  if (gallery.length === 0) return null;

  const result = await engine.promptGeneric(playerIdx, {
    type:        'cardGallery',
    cards:       gallery,
    title:       opts.title || 'Rebelliokai',
    description: opts.description || 'Discard 1 Rebelliokai Creature from your hand.',
    confirmLabel: opts.confirmLabel,
    cancellable: opts.cancellable !== false,
  });
  if (!result || result.cancelled || !result.cardName) return null;
  if (!isRebelliokaiCreature(result.cardName, engine)) return null;
  if ((ps.hand || []).indexOf(result.cardName) < 0) return null;

  const ok = await engine.actionDiscardHandCard(
    playerIdx,
    result.cardName,
    null,
    { source: opts.source || DISCARD_SOURCE_TAG },
  );
  if (!ok) return null;
  return result.cardName;
}

module.exports = {
  REBELLIOKAI_ARCHETYPE,
  DISCARD_SOURCE_TAG,
  isRebelliokaiCreature,
  getDifferentRebelliokaiInDiscard,
  countDifferentRebelliokaiInDiscard,
  deleteFromDiscardByName,
  payRebelliokaiCost,
  promptDiscardRebelliokaiFromHand,
};
