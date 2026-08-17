// ═══════════════════════════════════════════
//  CARD EFFECT: "Soul Shard Sah" (Spiritual Body)
//  Creature (Summoning Magic Lv3, Normal, 120 HP)
//  Archetype: Soul Shards.
//
//  PASSIVE: This Creature's effects don't get
//    negated when it's summoned by the effect
//    of Necromancy.
//
//  ON SUMMON BY NECROMANCY: choose up to 2
//    Creatures with different names in your
//    discard pile (excluding Sah itself). Sah
//    resolves each chosen Creature's on-summon
//    effect AS IF IT WERE ITS OWN — i.e. each
//    selected Creature's `onPlay` fires once,
//    routed through Sah's instance (Sah is the
//    host hero / zone subject). The mimicked
//    Creature's hooks/effects are NOT inherited
//    persistently — the override is bound only
//    while each `onPlay` runs, then cleared.
//
//  Implementation:
//    • `inst.counters._effectOverride` is bound
//      to the chosen Creature's name just before
//      that Creature's `onPlay` is dispatched
//      via `engine.runHooks('onPlay', { _onlyCard:
//      inst, … })`. CardInstance.getHook routes
//      Sah's hook lookups through the override
//      script for the duration of the fire, so
//      the dispatcher finds the chosen Creature's
//      onPlay and runs it with Sah's instance as
//      the subject. The summon-flag context
//      (`_summonedFromDiscard`,
//      `_summonedByNecromancy`,
//      `_necromancyLevel`) is forwarded so the
//      mimicked Creature's trigger gates fire
//      correctly.
//    • After every chosen Creature's onPlay
//      resolves, `_effectOverride` is deleted —
//      no persistent inheritance of active
//      effects or passive hooks. Sah falls back
//      to a hook-less Creature for the rest of
//      its time on the board.
//
//  Sah's own `bypassNecromancyNegation` flag and
//  `canSummon` predicate stay intact (those are
//  consulted by name at summon time, not via
//  the override).
//
//  HARD 1/TURN by name.
// ═══════════════════════════════════════════

const {
  canSummonSoulShard, markSoulShardSummoned,
  SOUL_SHARD_PILE_FUEL,
  soulShardEffectActivates_FromNecromancy,
  markSoulShardEffectFired,
} = require('./_soul-shards-shared');
const { isPileCreature, hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Soul Shard Sah';
const MAX_PICKS = 2;

/**
 * Does this Creature have an on-summon effect we can resolve?
 * "On-summon effect" = an `onPlay` hook. Vanilla stat Creatures with
 * no `hooks.onPlay` are excluded from Sah's picker per the new effect
 * text: there's nothing for Sah to resolve, so showing them would just
 * be dead options.
 */
function _hasOnSummonEffect(cardName) {
  if (!cardName) return false;
  const script = loadCardEffect(cardName);
  return typeof script?.hooks?.onPlay === 'function';
}

module.exports = {
  activeIn: ['support'],
  bypassNecromancyNegation: true,
  canSummon: canSummonSoulShard,
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },
  // Sandy Blob gate — Sah's effect only fires when summoned by Necromancy.
  summonEffectActivates: soulShardEffectActivates_FromNecromancy,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      markSoulShardSummoned(gs, pi, CARD_NAME);
      if (!ctx._summonedByNecromancy) return;

      const ps = gs.players[pi];
      if (!ps?.discardPile?.length) return;

      // Build deduped gallery of distinct Creature names from the own
      // discard pile, excluding Sah itself AND Creatures with no
      // `onPlay` hook (nothing to resolve, so they're not eligible).
      const cardDB = engine._getCardDB();
      const counts = {};
      for (const name of ps.discardPile) {
        if (name === CARD_NAME) continue;
        const cd = cardDB[name];
        if (!cd || !isPileCreature(cd)) continue;
        if (!_hasOnSummonEffect(name)) continue;
        counts[name] = (counts[name] || 0) + 1;
      }
      const gallery = Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'discard', count }));
      // No eligible Creatures → Sah fizzles. (Sah's body stays on the
      // board; only the mimic effect doesn't fire.)
      if (gallery.length === 0) return;

      // Multi-select: up to MAX_PICKS distinct names. The gallery is
      // already deduped by name, so picking 2 entries naturally yields 2
      // different Creatures.
      const pick = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: gallery,
        title: CARD_NAME,
        description: `Choose up to ${MAX_PICKS} Creatures with different names from your discard pile. Soul Shard Sah resolves each of their on-summon effects as if they were its own.`,
        confirmLabel: '✨ Resolve!',
        cancellable: true,
        alwaysConfirmable: true,
        selectCount: MAX_PICKS,
        minSelect: 0,
        maxTotal: MAX_PICKS,
      });
      if (!pick || pick.cancelled) return;
      // `promptGeneric` returns `selectedCards` as an array of plain
      // string names for `cardGalleryMulti`. The gallery was deduped
      // by name above, so `chosenNames` is already distinct.
      const chosenNames = (pick.selectedCards || []).filter(Boolean);
      if (chosenNames.length === 0) return;

      const inst = ctx.card;
      if (!inst) return;
      inst.counters = inst.counters || {};

      // Effect fully committed (mimic bound, at least one pick) —
      // Sandy Blob marker. Mimicked Creatures' own onPlays may set
      // their own markers; Sah's marker is set here regardless.
      markSoulShardEffectFired(ctx);
      engine.log('soul_shard_sah_mimic', {
        player: ps.username, mimicking: chosenNames,
      });
      engine.sync();

      // Summon-flag context forwarded so each mimicked Creature's own
      // trigger gates ("on summon from discard / by Necromancy") fire.
      const summonExtras = {
        _summonedFromDiscard: !!ctx._summonedFromDiscard,
        _summonedByNecromancy: !!ctx._summonedByNecromancy,
        _necromancyLevel: ctx._necromancyLevel,
        _summonedBySoulShardSah: true,
      };

      // Fire each chosen Creature's onPlay sequentially against Sah's
      // instance. Bind the override JUST BEFORE the fire, then leave it
      // in place across the loop — getHook reads it on every dispatch,
      // and we want each iteration to route to that iteration's chosen
      // Creature. After the loop, drop the override entirely; Sah has
      // no persistent hooks of its own.
      try {
        for (const chosenName of chosenNames) {
          inst.counters._effectOverride = chosenName;
          await engine.runHooks('onPlay', {
            _onlyCard: inst, playedCard: inst,
            cardName: chosenName, zone: 'support',
            heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
            ...summonExtras,
          });
        }
      } finally {
        delete inst.counters._effectOverride;
      }
    },
  },
};
