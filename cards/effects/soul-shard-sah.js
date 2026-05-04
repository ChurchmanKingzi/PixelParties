// ═══════════════════════════════════════════
//  CARD EFFECT: "Soul Shard Sah" (Spiritual Body)
//  Creature (Summoning Magic Lv3, Normal, 120 HP)
//  Archetype: Soul Shards.
//
//  PASSIVE: This Creature's effects don't get
//    negated when it's summoned by the effect
//    of Necromancy.
//
//  ON SUMMON BY NECROMANCY: choose another
//    Creature in your discard pile; this Creature
//    gains that Creature's effect while it
//    remains on the board.
//
//  Implementation: the chosen Creature's name is
//  stamped onto `inst.counters._effectOverride`.
//  Two engine paths consult this counter and
//  re-route through `loadCardEffect(override)`:
//    1. Active creature-effect activation
//       (server.js): `creatureEffect`,
//       `canActivateCreatureEffect`,
//       `onCreatureEffect`.
//    2. Passive hook dispatch
//       (CardInstance.getHook in _engine.js):
//       any `hooks.<name>` defined on the
//       override script fires from Sah's
//       instance.
//  After binding, Sah immediately re-fires
//  `onPlay` for its own instance — this
//  triggers the mimicked Creature's on-summon
//  effect with Sah as the subject (host hero,
//  zone slot, owner, etc.). The summon-flag
//  context (`_summonedFromDiscard`,
//  `_summonedByNecromancy`, `_necromancyLevel`)
//  is forwarded so the mimicked Creature's
//  trigger gates ("on summon from discard",
//  "on summon by Necromancy") fire correctly.
//  `onCardEnterZone` does NOT need a manual
//  re-fire — Necromancy fires it AFTER Sah's
//  onPlay returns, so the override is already
//  bound by then and the mimic hook dispatch
//  picks it up automatically.
//  Sah's own `bypassNecromancyNegation` flag and
//  `canSummon` predicate stay intact (those are
//  consulted by name at summon time, not via
//  the override). The mimic effect persists for
//  as long as Sah remains on the board — the
//  inst's counters are discarded with the inst.
//
//  HARD 1/TURN by name.
// ═══════════════════════════════════════════

const {
  canSummonSoulShard, markSoulShardSummoned,
  SOUL_SHARD_PILE_FUEL,
  soulShardEffectActivates_FromNecromancy,
  markSoulShardEffectFired,
} = require('./_soul-shards-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Soul Shard Sah';

module.exports = {
  activeIn: ['support'],
  bypassNecromancyNegation: true,
  canSummon: canSummonSoulShard,
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },
  // Sandy Blob gate — Sah's mimic effect only runs when summoned by
  // Necromancy specifically (stricter than the other Shards' from-
  // discard gate; Sah uses the `_summonedByNecromancy` flag).
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
      // discard pile, excluding Sah itself ("another Creature"). Other
      // Soul Shards are valid targets — mimicking another Shard is legal
      // (the per-name 1/turn cap fires on Sah, not the mimicked Shard,
      // and the override only routes hook/activation lookups; the
      // mimicked Shard's own onPlay does NOT re-fire).
      const cardDB = engine._getCardDB();
      const counts = {};
      for (const name of ps.discardPile) {
        if (name === CARD_NAME) continue;
        const cd = cardDB[name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        counts[name] = (counts[name] || 0) + 1;
      }
      const gallery = Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'discard', count }));
      if (gallery.length === 0) return;

      const pick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Choose another Creature in your discard pile. Soul Shard Sah gains that Creature\'s effect while it remains on the board.',
        cancellable: true,
      });
      if (!pick || pick.cancelled || !pick.cardName) return;
      const chosenName = pick.cardName;

      // Bind the chosen Creature's effect onto Sah's instance. The
      // engine's creature-effect activation path and CardInstance.getHook
      // both consult `inst.counters._effectOverride`.
      const inst = ctx.card;
      if (!inst) return;
      inst.counters = inst.counters || {};
      inst.counters._effectOverride = chosenName;

      // Effect fully committed (mimic bound) — Sandy Blob marker.
      // The subsequent re-fire of onPlay for the mimicked Creature
      // runs against Sah's own inst; if the mimicked Creature's
      // onPlay sets its OWN marker that's fine — Sandy Blob would
      // already have fired off Sah's marker by then.
      markSoulShardEffectFired(ctx);
      engine.log('soul_shard_sah_mimic', {
        player: ps.username, mimicking: chosenName,
      });
      engine.sync();

      // Immediately re-fire onPlay for Sah's own instance. With the
      // override now set, CardInstance.getHook routes the lookup to the
      // mimicked Creature's onPlay, which then fires in Sah's context
      // (ctx.card = Sah, host hero/zone = Sah's). Forward the summon
      // flags Sah received from Necromancy so the mimicked Creature's
      // own trigger gates ("on summon from discard / by Necromancy")
      // fire correctly. `_onlyCard: inst` keeps OTHER cards from
      // re-reacting — they already saw Sah's original summon.
      const summonExtras = {
        _summonedFromDiscard: !!ctx._summonedFromDiscard,
        _summonedByNecromancy: !!ctx._summonedByNecromancy,
        _necromancyLevel: ctx._necromancyLevel,
        _summonedBySoulShardSah: true,
      };
      await engine.runHooks('onPlay', {
        _onlyCard: inst, playedCard: inst,
        cardName: chosenName, zone: 'support',
        heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        ...summonExtras,
      });
    },
  },
};
