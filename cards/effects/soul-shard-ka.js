// ═══════════════════════════════════════════
//  CARD EFFECT: "Soul Shard Ka" (Vital Spark)
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//  Archetype: Soul Shards.
//
//  PASSIVE: This Creature's effects don't get
//    negated when it's summoned by the effect
//    of Necromancy.
//
//  ON SUMMON FROM DISCARD: you MAY search your
//    deck for a Creature whose level is at most
//    (host Hero's Summoning Magic level − 1) and
//    immediately summon it as an additional
//    Action, but negate its effects until the
//    end of the turn.
//
//  Level cap scales with the host Hero's
//  Summoning Magic level:
//    Summoning 1 → max Lv 0
//    Summoning 2 → max Lv 1
//    Summoning 3 → max Lv 2
//  Performance copies sitting on Summoning Magic
//  count toward its level (engine convention).
//
//  The placed Creature is Necromancy-style
//  negated until the start of the OPPONENT's
//  turn (= end of this turn).
//
//  HARD 1/TURN by name.
// ═══════════════════════════════════════════

const {
  canSummonSoulShard, markSoulShardSummoned,
  SOUL_SHARD_PILE_FUEL,
  soulShardEffectActivates_FromDiscard,
  markSoulShardEffectFired,
} = require('./_soul-shards-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Soul Shard Ka';

/**
 * Level cap for the deck-search, derived from the host Hero's
 * Summoning Magic ability stack: max level = (Summoning Magic level − 1).
 * 0 if the Hero has no Summoning Magic (which shouldn't happen — Ka
 * itself requires Summoning Magic 1 to be summoned — but the floor
 * keeps the gate well-defined regardless).
 */
function levelCapForHost(engine, ps, heroIdx) {
  const abZones = ps.abilityZones?.[heroIdx] || [];
  const summoningLevel = engine.countAbilitiesForSchool('Summoning Magic', abZones);
  return Math.max(0, summoningLevel - 1);
}

/** Enumerate every (hero, free-slot) pair the player could host the
 *  Creature on — one entry per individual slot, mirroring standard
 *  summon-target highlighting (the player picks ANY free Support Zone
 *  of ANY eligible Hero, not just the leftmost slot per Hero).
 *
 *  The per-Hero `canSummon` check runs with `_bypassBeforeSummon:
 *  true` because Ka summons via direct splice + _trackCard — never
 *  calling `summonCreatureWithHooks`, so the chosen Creature's
 *  `beforeSummon` won't fire. Cards whose summonability depends on a
 *  beforeSummon-paid cost (King Trex's auto-sacrifice path) read
 *  the flag and apply their strict per-Hero rule. */
function eligibleHostSlots(engine, pi, creatureCardData) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, creatureCardData)) continue;
    if (!engine.isCreatureSummonable(creatureCardData.name, pi, hi, { _bypassBeforeSummon: true })) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let z = 0; z < 3; z++) {
      if ((zones[z] || []).length === 0) {
        out.push({ heroIdx: hi, slotIdx: z, heroName: h.name });
      }
    }
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  bypassNecromancyNegation: true,
  canSummon: canSummonSoulShard,
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },
  // Gates Sandy Blob (and future "when on-summon effect activates"
  // listeners) — Ka's effect ONLY runs when summoned from discard.
  // A normal hand summon hits the `_summonedFromDiscard` early return
  // below and produces no effect, so Sandy Blob shouldn't fire.
  summonEffectActivates: soulShardEffectActivates_FromDiscard,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      markSoulShardSummoned(gs, pi, CARD_NAME);
      if (!ctx._summonedFromDiscard) return;

      const ps = gs.players[pi];
      if (!ps?.mainDeck?.length) return;

      // Cap = host Hero's Summoning Magic level − 1. Resolved on the
      // host Hero (this Soul Shard Ka's `cardHeroIdx`), not the player
      // overall — Performance copies on Summoning Magic count, which
      // matches the engine's standard ability-level semantics.
      const levelCap = levelCapForHost(engine, ps, ctx.cardHeroIdx);

      // Build a deduped gallery of Lv ≤ levelCap Creatures from the
      // deck that AT LEAST one own Hero can host (level/school check
      // performed against each candidate's data). Names with no
      // eligible host get filtered out so the player can't pick a
      // dud and fizzle the effect.
      const cardDB = engine._getCardDB();
      const counts = {};
      for (const name of ps.mainDeck) counts[name] = (counts[name] || 0) + 1;
      const gallery = [];
      const seen = new Set();
      for (const [name, count] of Object.entries(counts)) {
        if (seen.has(name)) continue;
        const cd = cardDB[name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (engine.effectiveCardLevel(cd, pi) > levelCap) continue;
        // `_bypassBeforeSummon: true` — Ka summons via direct splice
        // + _trackCard, not summonCreatureWithHooks, so beforeSummon
        // never runs. Cards whose canSummon depends on a cost paid in
        // beforeSummon (King Trex's auto-sacrifice path) apply the
        // STRICT rule here and refuse Gigantisaur-occupied Heroes.
        if (!engine.isCreatureSummonable(name, pi, -1, { _bypassBeforeSummon: true })) continue;
        if (eligibleHostSlots(engine, pi, cd).length === 0) continue;
        seen.add(name);
        gallery.push({ name, source: 'deck', count });
      }
      if (gallery.length === 0) return;

      const pick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: `Choose a Lv ${levelCap} or lower Creature from your deck to summon (its effects will be negated until end of turn).`,
        cancellable: true,
      });
      if (!pick || pick.cancelled || !pick.cardName) return;
      const chosenName = pick.cardName;
      const chosenCd = cardDB[chosenName];
      if (!chosenCd) return;
      // Defensive — re-validate.
      if (ps.mainDeck.indexOf(chosenName) < 0) return;

      // Pick host slot — every free Support Zone of every eligible
      // Hero is offered (standard summon targeting). Auto-resolves
      // ONLY if a single slot exists.
      const hosts = eligibleHostSlots(engine, pi, chosenCd);
      if (hosts.length === 0) return;
      let chosenHost;
      if (hosts.length === 1) {
        chosenHost = hosts[0];
      } else {
        const zones = hosts.map(h => ({
          heroIdx: h.heroIdx, slotIdx: h.slotIdx,
          label: `${h.heroName} — Support ${h.slotIdx + 1}`,
        }));
        const zp = await ctx.promptZonePick(zones, {
          title: CARD_NAME,
          description: `Place ${chosenName} into which Support Zone?`,
          cancellable: true,
        });
        if (!zp) return;
        chosenHost = hosts.find(h => h.heroIdx === zp.heroIdx && h.slotIdx === zp.slotIdx)
          || hosts[0];
      }

      // Splice from deck and summon via the canonical helper.
      const deckIdx = ps.mainDeck.indexOf(chosenName);
      if (deckIdx < 0) return;
      ps.mainDeck.splice(deckIdx, 1);

      const placeRes = await engine.summonCreatureWithHooks(
        chosenName, pi, chosenHost.heroIdx, chosenHost.slotIdx,
        {
          source: CARD_NAME,
          isPlacement: true,
          hookExtras: {
            _summonedFromDeck: true,
            _summonedBySoulShard: true,
            _isNormalSummon: false,
          },
        },
      );
      if (!placeRes) {
        ps.mainDeck.push(chosenName);
        engine.shuffleDeck(pi, 'main');
        return;
      }

      // Reveal-from-deck animation (the placed Creature itself is
      // visible on the board, but the deck-flight signals "searched
      // from deck" specifically).
      engine._broadcastEvent('deck_search_add', {
        cardName: chosenName, playerIdx: pi,
      });
      // Standard summon animation on the placement zone — mirrors the
      // glow that fires for a hand-summoned Creature so the placement
      // reads as an actual summon rather than a silent drop-in.
      engine._broadcastEvent('summon_effect', {
        owner: pi, heroIdx: chosenHost.heroIdx,
        zoneSlot: placeRes.actualSlot, cardName: chosenName,
      });

      // Negate the placed Creature's effects until end of THIS turn —
      // expires when opp's next turn starts.
      const oi = pi === 0 ? 1 : 0;
      await engine.actionNegateCreature(placeRes.inst, CARD_NAME, {
        expiresAtTurn: gs.turn + 1,
        expiresForPlayer: oi,
        buffKey: 'soul_shard_ka_negated',
        selfInflicted: true,
      });

      await engine.runHooks('onActionUsed', {
        actionType: 'creature', source: CARD_NAME, playerIdx: pi,
        cardName: chosenName, heroIdx: chosenHost.heroIdx,
        _skipReactionCheck: true,
      });
      await engine.runHooks('onAdditionalActionUsed', {
        actionType: 'creature', source: CARD_NAME, playerIdx: pi,
        cardName: chosenName, heroIdx: chosenHost.heroIdx,
        _skipReactionCheck: true,
      });

      engine.shuffleDeck(pi, 'main');
      // Effect fully committed — stamp the activation marker so Sandy
      // Blob (and similar "when on-summon effect activates" listeners)
      // know this onPlay actually did its thing. Mid-flow cancellations
      // (gallery cancel, no eligible cards, etc.) early-returned above
      // and never reach this line.
      markSoulShardEffectFired(ctx);
      engine.log('soul_shard_ka_search_summon', {
        player: ps.username, summoned: chosenName,
        heroIdx: chosenHost.heroIdx, zoneSlot: placeRes.actualSlot,
      });
      engine.sync();

      // Reveal modal to opp — standard tutor disclosure.
      await engine._delay(500);
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: chosenName,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
    },
  },
};
