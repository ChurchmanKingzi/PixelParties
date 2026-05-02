// ═══════════════════════════════════════════
//  CARD EFFECT: "Thep, the Court Scribe"
//  Hero — Magic Arts / Learning, 300 HP / 30 ATK.
//
//  HERO EFFECT (1/turn): choose a "Soul Shard"
//  Creature from your discard pile that was NOT
//  sent there this turn, and place it into one of
//  this Hero's free Support Zones.
//
//  Implementation notes:
//  • "Place" is a form of summon. We route through
//    `summonCreatureWithHooks` with `_summonedFromDiscard:
//    true` so the placed Shard's discard-summon
//    trigger fires (Ka searches deck, Khet revives
//    a Creature, Ren tutors any card, Sah binds a
//    mimic, Sekhem strikes, Shut self-mills, Ba
//    grants a second Action, Ib heals).
//  • The "not sent there this turn" rule is gated
//    via `ps._discardNamesAtTurnStart` (set in
//    _engine.js startTurn). A Shard's name is
//    eligible iff it was already in the snapshot
//    AND a copy is currently in the discard. Set-
//    based — multi-copy nuance is approximated by
//    name presence; the rare revive-then-redie
//    case rounds in the player's favour.
//  • The Shard's per-name 1/turn cap (shared
//    `canSummonSoulShard`) STILL applies — Thep's
//    placement is still a summon, so Necromancy /
//    hand-play / placement of the same Shard
//    earlier in the turn blocks it.
// ═══════════════════════════════════════════

const {
  isSoulShard, SOUL_SHARD_PILE_FUEL,
} = require('./_soul-shards-shared');

const CARD_NAME = 'Thep, the Court Scribe';

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // Thep IS a Soul-Shard reanimator: while she's alive (zone === 'hero',
  // weight 1.0 from SOUL_SHARD_PILE_FUEL.presenceWeights), every Soul
  // Shard already in her controller's discard pile is worth its
  // discardValue toward eval. Drives the brain to seed discard with
  // Shards via Magenta / Shut / Ren / Book of Doom on its own Shards
  // even when no Shard is on the board yet — a living Thep is a
  // standing reanimation engine on her own.
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;

    // Need at least one free Support Zone on Thep.
    const zones = ps.supportZones?.[heroIdx] || [];
    let hasFreeSlot = false;
    for (let z = 0; z < 3; z++) {
      if ((zones[z] || []).length === 0) { hasFreeSlot = true; break; }
    }
    if (!hasFreeSlot) return false;

    // Need at least one Soul Shard in own discard whose name was
    // already there at turn start (i.e. not sent there THIS turn).
    const startSet = ps._discardNamesAtTurnStart || new Set();
    for (const name of (ps.discardPile || [])) {
      if (!isSoulShard(name)) continue;
      if (!startSet.has(name)) continue;
      // Per-name 1/turn cap — Thep's placement still goes through
      // canSummonSoulShard, so re-summoning a Shard already played
      // this turn would fizzle. Filter here so the picker never
      // surfaces a fizzling option.
      if (ps._soulShardSummonedThisTurn?.[name]) continue;
      return true;
    }
    return false;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    const hero = ps?.heroes?.[heroIdx];
    if (!ps || !hero?.name) return false;

    // Thep's free Support Zones — placement target.
    const zones = ps.supportZones?.[heroIdx] || [];
    const freeSlots = [];
    for (let z = 0; z < 3; z++) {
      if ((zones[z] || []).length === 0) freeSlots.push(z);
    }
    if (freeSlots.length === 0) return false;

    // Build a deduped gallery of eligible Soul Shard names from the
    // own discard pile. "Eligible" = was already in the discard at
    // turn start AND not blocked by the per-name 1/turn cap.
    const startSet = ps._discardNamesAtTurnStart || new Set();
    const summonedThisTurn = ps._soulShardSummonedThisTurn || {};
    const counts = {};
    for (const name of ps.discardPile) {
      if (!isSoulShard(name)) continue;
      if (!startSet.has(name)) continue;
      if (summonedThisTurn[name]) continue;
      counts[name] = (counts[name] || 0) + 1;
    }
    const gallery = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'discard', count }));
    if (gallery.length === 0) return false;

    const pick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Choose a Soul Shard Creature in your discard pile (one that was not sent there this turn) to place into one of this Hero\'s free Support Zones.',
      cancellable: true,
    });
    if (!pick || pick.cancelled || !pick.cardName) return false;
    const chosenName = pick.cardName;

    // Re-validate against the live state (the prompt could have
    // resolved after another effect changed the discard contents).
    if (!isSoulShard(chosenName)) return false;
    if (!startSet.has(chosenName)) return false;
    if (summonedThisTurn[chosenName]) return false;
    if (ps.discardPile.indexOf(chosenName) < 0) return false;

    // Pick a free slot on Thep. Auto-resolves if only one is open.
    let chosenSlot;
    if (freeSlots.length === 1) {
      chosenSlot = freeSlots[0];
    } else {
      const zoneOptions = freeSlots.map(z => ({
        heroIdx, slotIdx: z,
        label: `${hero.name} — Support ${z + 1}`,
      }));
      const zp = await ctx.promptZonePick(zoneOptions, {
        title: CARD_NAME,
        description: `Place ${chosenName} into which Support Zone?`,
        cancellable: true,
      });
      if (!zp) return false;
      chosenSlot = zp.slotIdx;
    }

    // Splice the chosen copy out of the discard pile, then place via
    // the canonical summon helper so the Shard's full on-summon-from-
    // discard hooks fire (Ka searches deck, Khet revives, etc.).
    // `_summonedFromDiscard: true` is the discard-trigger flag every
    // Shard reads in its onPlay gate.
    const idx = ps.discardPile.indexOf(chosenName);
    if (idx < 0) return false;
    ps.discardPile.splice(idx, 1);

    const placeRes = await engine.summonCreatureWithHooks(
      chosenName, pi, heroIdx, chosenSlot,
      {
        source: CARD_NAME,
        isPlacement: true,
        hookExtras: {
          _summonedFromDiscard: true,
          _isNormalSummon: false,
        },
      },
    );
    if (!placeRes) {
      // beforeSummon refused (e.g. canSummonSoulShard tripped despite
      // our pre-filter, or some other gate). Refund the discard copy
      // so the player isn't silently down a card.
      ps.discardPile.push(chosenName);
      return false;
    }

    // Standard summon glow on the placement zone.
    engine._broadcastEvent('summon_effect', {
      owner: pi, heroIdx, zoneSlot: placeRes.actualSlot, cardName: chosenName,
    });

    engine.log('thep_revive', {
      player: ps.username, revived: chosenName,
      heroIdx, zoneSlot: placeRes.actualSlot,
    });
    engine.sync();
    return true;
  },
};
