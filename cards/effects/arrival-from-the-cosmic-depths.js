// ═══════════════════════════════════════════
//  CARD EFFECT: "Arrival from the Cosmic Depths"
//  Spell (Summoning Magic Lv0, Normal)
//  Cosmic Depths archetype.
//
//  Two-step effect:
//  1. Choose a "Cosmic Depths" Creature from your
//     deck and PLACE it (silent, no on-summon
//     hooks) into a free Support Zone of a Hero
//     your opponent controls.
//  2. Then choose a "Cosmic Depths" Creature 1
//     LEVEL HIGHER and SUMMON it (real summon —
//     hooks fire) onto a Hero you control as an
//     additional Action.
//
//  This counts as an additional Action overall
//  (`inherentAction: true`). HOPT key
//  `arrival-from-the-cosmic-depths:${pi}` enforces
//  the once-per-turn play limit.
//
//  Eligibility for the FIRST pick: only CD
//  Creatures whose lvl+1 counterpart also exists
//  somewhere in your deck (post-removal of the
//  first pick). CD Creatures with no lvl+1
//  counterpart available are filtered out so the
//  spell can't fizzle on the second step.
//
//  Invader gate: the second-half summon is a real
//  summon by a "Cosmic" card (Arrival itself), so
//  Invader's "summoned by Cosmic" restriction is
//  satisfied. The first-half placement is also
//  performed by a Cosmic card, so Invader is
//  technically allowed there too — but Invader is
//  Lv4 with no Lv5 counterpart, so it's
//  automatically excluded by the level-up rule
//  from the first-pick gallery.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  COSMIC_DEPTHS_CREATURES, isCosmicCard,
  canSummonInvaderViaSource,
} = require('./_cosmic-shared');

const CARD_NAME = 'Arrival from the Cosmic Depths';
const HOPT_PREFIX = 'arrival-from-the-cosmic-depths';
const ANIM_PORTAL = 'cosmic_summon';

function hoptUsed(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_PREFIX}:${pi}`] === gs.turn;
}
function stampHopt(gs, pi) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${HOPT_PREFIX}:${pi}`] = gs.turn;
}

/**
 * Deck CD Creature names that have at least one valid lvl+1 counterpart
 * remaining in the deck AFTER one copy of `name` is removed. Returns a
 * Set so callers can filter the gallery cheaply.
 *
 * Edge case: if multiple copies of the same name exist in the deck, the
 * second copy survives the first-pick splice and could itself be a
 * lvl+1 candidate. We re-tally per check.
 */
function deckCdCreaturesByLevel(engine, pi) {
  const cardDB = engine._getCardDB();
  const ps = engine.gs.players[pi];
  const byLevel = {};
  for (const cn of (ps?.mainDeck || [])) {
    if (!COSMIC_DEPTHS_CREATURES.has(cn)) continue;
    const cd = cardDB[cn];
    if (!cd) continue;
    const lvl = cd.level ?? 0;
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(cn);
  }
  return byLevel;
}

/** First-pick eligibility: CD Creature in deck, has lvl+1 counterpart available. */
function firstPickCandidates(engine, pi) {
  const byLevel = deckCdCreaturesByLevel(engine, pi);
  const cardDB = engine._getCardDB();
  const out = new Set();
  for (const [lvlStr, names] of Object.entries(byLevel)) {
    const lvl = parseInt(lvlStr, 10);
    const upgrades = byLevel[lvl + 1];
    if (!upgrades || upgrades.length === 0) continue;
    for (const name of names) {
      // For names that have only ONE copy in deck, ensure the upgrade
      // pool isn't exclusively that name (defensive — same name in
      // adjacent level slots is impossible per the data, but kept for
      // future-proofing).
      const upgradesUsable = upgrades.filter(u => !(u === name && upgrades.length === 1 && names.length === 1));
      if (upgradesUsable.length === 0) continue;
      out.add(name);
    }
  }
  return out;
}

function oppFreeSlots(engine, oppIdx) {
  const ops = engine.gs.players[oppIdx];
  if (!ops) return [];
  const out = [];
  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    const zones = ops.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        out.push({ heroIdx: hi, slotIdx: zi });
      }
    }
  }
  return out;
}

function ownFreeSlots(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        out.push({ heroIdx: hi, slotIdx: zi });
      }
    }
  }
  return out;
}

module.exports = {
  inherentAction: true, // Treated as a free additional Action when cast.

  // CPU eval declaration — Arrival's second-half summon comes
  // directly from deck, which triggers Cosmic Manipulation if it's
  // in hand. Tagging this lets the CPU's hand-card valuation and the
  // candidate ranker reward Arrival plays specifically when CM is
  // already loaded.
  cpuMeta: {
    directDeckSummon: true,
  },

  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    if (hoptUsed(gs, pi)) return false;
    // Both halves need a free zone on each side.
    if (oppFreeSlots(engine, pi === 0 ? 1 : 0).length === 0) return false;
    if (ownFreeSlots(engine, pi).length === 0) return false;
    if (firstPickCandidates(engine, pi).size === 0) return false;
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      if (!ps) return;
      if (hoptUsed(gs, pi)) return;
      // HOPT-stamp eagerly — once we commit to the play, the slot is
      // burned even if a mid-prompt cancel ends step 1 early.
      stampHopt(gs, pi);

      // ── STEP 1: Build candidate gallery and pick the first creature
      const cardDB = engine._getCardDB();
      const candidates = firstPickCandidates(engine, pi);
      if (candidates.size === 0) {
        engine.log('arrival_fizzle', { player: ps.username, reason: 'no_first_pick' });
        return;
      }

      // Count copies per name in deck for the gallery display.
      const countMap = {};
      for (const cn of (ps.mainDeck || [])) {
        if (candidates.has(cn)) countMap[cn] = (countMap[cn] || 0) + 1;
      }
      const gallery = Object.entries(countMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      const firstChosen = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Choose a "Cosmic Depths" Creature to PLACE on your opponent\'s side. (Only Creatures with a lvl+1 counterpart available are listed.)',
        cancellable: false,
      });
      if (!firstChosen?.cardName || !candidates.has(firstChosen.cardName)) {
        engine.log('arrival_fizzle', { player: ps.username, reason: 'first_pick_invalid' });
        return;
      }
      const firstName = firstChosen.cardName;
      const firstCd = cardDB[firstName];
      if (!firstCd) return;

      // ── STEP 2: Pick the opp zone (one slot per opp hero)
      let oppSlots = oppFreeSlots(engine, oi);
      if (oppSlots.length === 0) {
        engine.log('arrival_fizzle', { player: ps.username, reason: 'no_opp_slot' });
        return;
      }
      const ops = gs.players[oi];
      const oppZones = oppSlots.map(s => ({
        heroIdx: s.heroIdx, slotIdx: s.slotIdx,
        label: `${ops.heroes?.[s.heroIdx]?.name || 'Hero'} — Slot ${s.slotIdx + 1}`,
      }));
      const promptCtx = engine._createContext(ctx.card, {});
      const oppPick = await promptCtx.promptZonePick(oppZones, {
        title: CARD_NAME,
        description: `Place ${firstName} into which of your opponent's zones?`,
        cancellable: false,
      });
      if (!oppPick) return;

      // Splice the chosen copy out of the deck. Match by exact name —
      // any copy is equivalent for placement purposes.
      const firstDeckIdx = ps.mainDeck.indexOf(firstName);
      if (firstDeckIdx < 0) return; // Shouldn't happen post-prompt
      ps.mainDeck.splice(firstDeckIdx, 1);

      engine._broadcastEvent('play_zone_animation', {
        type: ANIM_PORTAL,
        owner: oi, heroIdx: oppPick.heroIdx, zoneSlot: oppPick.slotIdx,
      });
      await engine._delay(450);

      // SILENT PLACEMENT — owner is the OPP since the creature lands on
      // their side. summonCreature skips onPlay/onCardEnterZone hooks,
      // matching "place" semantics.
      const placeRes = engine.summonCreature(firstName, oi, oppPick.heroIdx, oppPick.slotIdx, {
        source: CARD_NAME,
      });
      if (!placeRes) {
        engine.log('arrival_fizzle', { player: ps.username, reason: 'opp_place_failed' });
        return;
      }
      engine.log('arrival_place', {
        player: ps.username, card: firstName, oppHero: ops.heroes?.[oppPick.heroIdx]?.name,
      });

      // ── STEP 3: Pick the lvl+1 second creature, summon on own side.
      // Re-tally the deck since we just removed one copy.
      const upgradeLvl = (firstCd.level ?? 0) + 1;
      const upgradeNames = (ps.mainDeck || []).filter(cn => {
        if (!COSMIC_DEPTHS_CREATURES.has(cn)) return false;
        const cd = cardDB[cn];
        return cd && (cd.level ?? 0) === upgradeLvl;
      });
      if (upgradeNames.length === 0) {
        // Should be impossible per firstPickCandidates' filter, but
        // defensive — if the data shifted mid-resolve, log and exit.
        engine.log('arrival_fizzle', { player: ps.username, reason: 'no_upgrade' });
        return;
      }

      const upgradeCounts = {};
      for (const cn of upgradeNames) upgradeCounts[cn] = (upgradeCounts[cn] || 0) + 1;
      const upgradeGallery = Object.entries(upgradeCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      const secondChosen = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: upgradeGallery,
        title: CARD_NAME,
        description: `Choose a Lv${upgradeLvl} "Cosmic Depths" Creature to summon on your own side.`,
        cancellable: false,
      });
      if (!secondChosen?.cardName) return;
      const secondName = secondChosen.cardName;

      // Invader gate: Arrival is a Cosmic card (name contains "Cosmic"),
      // so Invader IS allowed. canSummonInvaderViaSource confirms.
      if (!canSummonInvaderViaSource(secondName, CARD_NAME)) {
        engine.log('arrival_fizzle', { player: ps.username, reason: 'invader_gate' });
        return;
      }

      const secondDeckIdx = ps.mainDeck.indexOf(secondName);
      if (secondDeckIdx < 0) return;

      // ── STEP 4: Pick own-side zone, summon with hooks.
      const ownSlots = ownFreeSlots(engine, pi);
      if (ownSlots.length === 0) {
        engine.log('arrival_fizzle', { player: ps.username, reason: 'no_own_slot' });
        return;
      }
      const ownZones = ownSlots.map(s => ({
        heroIdx: s.heroIdx, slotIdx: s.slotIdx,
        label: `${ps.heroes?.[s.heroIdx]?.name || 'Hero'} — Slot ${s.slotIdx + 1}`,
      }));
      const ownPick = await promptCtx.promptZonePick(ownZones, {
        title: CARD_NAME,
        description: `Summon ${secondName} onto which of your Heroes?`,
        cancellable: false,
      });
      if (!ownPick) return;

      ps.mainDeck.splice(secondDeckIdx, 1);

      engine._broadcastEvent('play_zone_animation', {
        type: ANIM_PORTAL,
        owner: pi, heroIdx: ownPick.heroIdx, zoneSlot: ownPick.slotIdx,
      });
      await engine._delay(550);

      // REAL SUMMON — fires onPlay / onCardEnterZone with the cosmic
      // flags so Life-Searcher / Invader / Cosmic Manipulation react.
      await engine.summonCreatureWithHooks(secondName, pi, ownPick.heroIdx, ownPick.slotIdx, {
        source: CARD_NAME,
        hookExtras: {
          _summonedByCosmic: true,
          _summonedBy: CARD_NAME,
          _summonedFromDeck: true,
        },
      });

      engine.log('arrival_summon', {
        player: ps.username,
        first: firstName, second: secondName,
        ownHero: ps.heroes?.[ownPick.heroIdx]?.name,
      });
      engine.sync();
    },
  },
};
