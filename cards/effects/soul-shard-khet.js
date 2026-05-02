// ═══════════════════════════════════════════
//  CARD EFFECT: "Soul Shard Khet" (Body)
//  Creature (Summoning Magic Lv2, Normal, 100 HP)
//  Archetype: Soul Shards.
//
//  PASSIVE: This Creature's effects don't get
//    negated when it's summoned by the effect
//    of Necromancy.
//
//  ON SUMMON FROM DISCARD: you MAY immediately
//    summon a Creature from your discard pile
//    with any of your Heroes as an additional
//    Action.
//
//  Implementation note: the placed Creature
//  fires its full on-play / entering-zone
//  hooks (including its own discard-summon
//  trigger if it's another Soul Shard — Khet
//  passes `_summonedFromDiscard: true` in the
//  hookExtras so a chained Soul Shard correctly
//  detects the revive). Effects are NOT negated
//  by Khet — text doesn't say so.
//
//  HARD 1/TURN by name.
// ═══════════════════════════════════════════

const {
  canSummonSoulShard, markSoulShardSummoned,
  SOUL_SHARD_PILE_FUEL,
} = require('./_soul-shards-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Soul Shard Khet';

/** Enumerate every (hero, free-slot) pair the player could host the
 *  Creature on — alive Hero, not frozen/stunned, meets level/school
 *  requirement, slot empty. One entry per individual free slot, so
 *  ALL free Support Zones of ALL eligible Heroes are offered as
 *  targets (standard summon-target highlighting), not just the
 *  leftmost slot per Hero. */
function eligibleHostSlots(engine, pi, creatureCardData) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, creatureCardData)) continue;
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

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      markSoulShardSummoned(gs, pi, CARD_NAME);
      if (!ctx._summonedFromDiscard) return;

      const ps = gs.players[pi];
      if (!ps?.discardPile?.length) return;

      // Step 1: build a gallery of distinct Creature names in the
      // own discard pile that can ALSO be summoned by at least one
      // alive Hero (level/school requirement). Names with no eligible
      // host get filtered out — picking them would just fizzle.
      const cardDB = engine._getCardDB();
      const seen = new Set();
      const gallery = [];
      for (const name of ps.discardPile) {
        if (seen.has(name)) continue;
        const cd = cardDB[name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (!engine.isCreatureSummonable(name, pi)) continue;
        if (eligibleHostSlots(engine, pi, cd).length === 0) continue;
        seen.add(name);
        gallery.push({ name, source: 'discard' });
      }
      if (gallery.length === 0) return;

      const pick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Choose a Creature in your discard pile to summon as an additional Action.',
        cancellable: true,
      });
      if (!pick || pick.cancelled || !pick.cardName) return;
      const chosenName = pick.cardName;
      const chosenCd = cardDB[chosenName];
      if (!chosenCd) return;

      // Step 2: pick a host slot — every free Support Zone of every
      // eligible Hero is offered (standard summon targeting).
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

      // Splice from discard, then summon via the canonical helper so
      // the placed Creature gets full on-play / entering-zone hooks.
      // Pass `_summonedFromDiscard: true` so a chained Soul Shard
      // correctly fires its own discard-trigger.
      const discardIdx = ps.discardPile.indexOf(chosenName);
      if (discardIdx < 0) return;
      ps.discardPile.splice(discardIdx, 1);

      const placeRes = await engine.summonCreatureWithHooks(
        chosenName, pi, chosenHost.heroIdx, chosenHost.slotIdx,
        {
          source: CARD_NAME,
          isPlacement: true,
          hookExtras: {
            _summonedFromDiscard: true,
            _summonedBySoulShard: true,
            _isNormalSummon: false,
          },
        },
      );
      if (!placeRes) {
        // Refund — beforeSummon refused, etc.
        ps.discardPile.push(chosenName);
        return;
      }

      engine._broadcastEvent('summon_effect', {
        owner: pi, heroIdx: chosenHost.heroIdx,
        zoneSlot: placeRes.actualSlot, cardName: chosenName,
      });
      // Necromancy logs an additional-action use for animation/CPU
      // consistency — mirror that here so the same hooks fire.
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

      engine.log('soul_shard_khet_revive', {
        player: ps.username, revived: chosenName,
        heroIdx: chosenHost.heroIdx, zoneSlot: placeRes.actualSlot,
      });
      engine.sync();
    },
  },
};
