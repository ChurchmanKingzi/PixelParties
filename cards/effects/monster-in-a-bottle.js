// ═══════════════════════════════════════════
//  CARD EFFECT: "Monster in a Bottle"
//  Potion — Choose a level 3 or lower Creature
//  from your hand or discard pile and immediately
//  summon it to a free Support Zone of a Hero
//  that meets the summoning requirements.
//
//  Blocked by summonLocked. Counts as placement
//  (fires onPlay/onCardEnterZone hooks).
//  Deleted after use (standard Potion behavior).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const fs = require('fs');
const path = require('path');

/**
 * Check if a specific hero can summon a specific creature.
 *
 * Delegates the level/school math to `engine.heroMeetsLevelReq`, which
 * already accounts for every reduction path the local copy was missing:
 *   • Generic `reduceCardLevel` hooks  (Slippery Whoolmoth's 0-level
 *     rebate when every alive own Hero has a Creature; Phatnir; …)
 *   • Per-card hero overrides  (Sol Rym)
 *   • Per-hand-position offsets  (Rocky Slime / Sparkfly rebate)
 *   • Mana Absorbing Crystal +1 on Spells
 *   • Lethe per-pile stamps  (passed via `source === 'discard'`)
 *   • Hard Negation suppressing ability zones, and Lizbeth-style borrows
 *
 * Pre-gates (alive + not Frozen/Stunned) stay here — the engine helper's
 * dead-hero branch is `canBypassLevelReq`-aware and the Frozen/Stunned
 * gate isn't strictly a "level req," so we keep them explicit.
 */
function canHeroSummon(engine, ps, pi, heroIdx, creatureData, source) {
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned) return false;
  const opts = source === 'discard' ? { pileSide: 'discard' } : {};
  return engine.heroMeetsLevelReq(pi, heroIdx, creatureData, opts);
}

/**
 * Check if a hero has at least one free base support zone.
 */
function hasFreeZone(ps, heroIdx) {
  const supZones = ps.supportZones[heroIdx] || [];
  for (let z = 0; z < 3; z++) {
    if ((supZones[z] || []).length === 0) return true;
  }
  return false;
}

/**
 * Build the list of eligible creatures from hand + discard.
 *
 * `engine` (optional) — when present, the per-Hero filter also consults
 * `engine.isCreatureSummonable(name, pi, hi, { _bypassBeforeSummon: true })`,
 * so per-creature `canSummon` hooks like King Trex's relaxed-but-bypass-aware
 * rule are honored (placement here skips `beforeSummon`, so we want strict
 * mode — Trex can't land on a Gigantisaur-occupied Hero via the Bottle).
 */
// cards.json wurde bei JEDEM getEligibleCreatures-Aufruf synchron von
// Platte gelesen und komplett geparst — und canActivate ruft das in
// jedem isPotionPlayable-Scan der Planungsschleifen. Laut V8-Profil
// war das nach dem Loader-Fix der größte Einzelfresser im
// Slip-'n'-Slide-Deck (19% der Ticks). Jetzt: engine-DB bevorzugen,
// sonst einmalig lazy laden und modulweit cachen.
let _cardDBCache = null;
function _getCardDB(engine) {
  if (engine && typeof engine._getCardDB === 'function') return engine._getCardDB();
  if (!_cardDBCache) {
    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf-8'));
    _cardDBCache = {};
    allCards.forEach(c => { _cardDBCache[c.name] = c; });
  }
  return _cardDBCache;
}

function getEligibleCreatures(gs, pi, engine = null) {
  const cardDB = _getCardDB(engine);

  const ps = gs.players[pi];
  const eligible = [];
  const seen = new Set();
  const summonBlocked = gs.summonBlocked || [];

  // Effective level via the engine helper — honours `reduceCardLevel`
  // hooks (Slippery Whoolmoth's 0-level rebate, Phatnir, …),
  // per-card overrides, Mana Absorbing Crystal +1 on Spells, and the
  // generic reducer hooks. Falls back to raw level when no engine
  // ref is supplied (defensive — every live call site passes one).
  // `source` is forwarded so the discard branch picks up Lethe per-pile
  // +1 stamps via `pileSide`; hand reads stay unstamped.
  const effLvl = (cd, source) =>
    engine?.effectiveCardLevel
      ? engine.effectiveCardLevel(cd, pi, source === 'discard' ? { pileSide: 'discard' } : {})
      : (cd.level || 0);

  const checkSource = (list, source) => {
    for (const name of list) {
      if (seen.has(name + ':' + source)) continue;
      const cd = cardDB[name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      if (effLvl(cd, source) > 3) continue;
      if (summonBlocked.includes(name)) continue;
      // Check if ANY living hero with free zones can summon this
      let canSummon = false;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (engine && !canHeroSummon(engine, ps, pi, hi, cd, source)) continue;
        if (!hasFreeZone(ps, hi)) continue;
        if (engine && !engine.isCreatureSummonable(name, pi, hi, { _bypassBeforeSummon: true })) continue;
        canSummon = true;
        break;
      }
      if (!canSummon) continue;
      seen.add(name + ':' + source);
      eligible.push({ name, source, cardData: cd });
    }
  };

  checkSource(ps.hand || [], 'hand');
  checkSource(ps.discardPile || [], 'discard');
  return { eligible, cardDB };
}

module.exports = {
  isPotion: true,
  deferBroadcast: true, // Broadcast after creature+zone selected, not before

  canActivate(gs, pi, engine) {
    const ps = gs.players[pi];
    // Summon lock blocks all summoning
    if (ps?.summonLocked) return false;
    // Need eligible creatures
    const { eligible } = getEligibleCreatures(gs, pi, engine);
    return eligible.length > 0;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // Re-check summon lock
    if (ps.summonLocked) return { cancelled: true };

    // Build eligible creatures
    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf-8'));
    const cardDB = {};
    allCards.forEach(c => { cardDB[c.name] = c; });

    while (true) {
      // Recompute eligible each loop iteration (state may change)
      const eligible = [];
      const seen = new Set();
      const summonBlocked = gs.summonBlocked || [];

      // Same effective-level helper as `getEligibleCreatures` —
      // pile reads pick up Lethe per-pile stamps.
      const effLvl = (cd, source) => engine.effectiveCardLevel(
        cd, pi, source === 'discard' ? { pileSide: 'discard' } : {}
      );

      const checkSrc = (list, source) => {
        for (const name of list) {
          if (seen.has(name + ':' + source)) continue;
          const cd = cardDB[name];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          if (effLvl(cd, source) > 3) continue;
          if (summonBlocked.includes(name)) continue;
          let canSummon = false;
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            if (!canHeroSummon(engine, ps, pi, hi, cd, source)) continue;
            if (!hasFreeZone(ps, hi)) continue;
            if (!engine.isCreatureSummonable(name, pi, hi, { _bypassBeforeSummon: true })) continue;
            canSummon = true;
            break;
          }
          if (!canSummon) continue;
          seen.add(name + ':' + source);
          eligible.push({ name, source });
        }
      };

      checkSrc(ps.hand || [], 'hand');
      checkSrc(ps.discardPile || [], 'discard');

      if (eligible.length === 0) return { cancelled: true };

      // Step 1: Pick a creature
      const selected = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: eligible,
        title: 'Monster in a Bottle',
        description: 'Choose a Lv 3 or lower Creature to summon.',
        cancellable: true,
      });
      if (!selected) return { cancelled: true };

      const creatureName = selected.cardName;
      const creatureSource = eligible.find(e => e.name === creatureName)?.source || 'hand';
      const cd = cardDB[creatureName];
      if (!cd) return { cancelled: true };

      // Step 2: Pick a support zone on an eligible hero
      const freeZones = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (!canHeroSummon(engine, ps, pi, hi, cd, creatureSource)) continue;
        if (!engine.isCreatureSummonable(creatureName, pi, hi, { _bypassBeforeSummon: true })) continue;
        const hero = ps.heroes[hi];
        const supZones = ps.supportZones[hi] || [];
        for (let s = 0; s < 3; s++) {
          if ((supZones[s] || []).length === 0) {
            freeZones.push({ heroIdx: hi, slotIdx: s, label: `${hero.name} — Support ${s + 1}` });
          }
        }
      }

      if (freeZones.length === 0) return { cancelled: true };

      const zone = await engine.promptGeneric(pi, {
        type: 'zonePick',
        zones: freeZones,
        title: 'Monster in a Bottle',
        description: `Place ${creatureName} into a Support Zone.`,
        cancellable: true,
      });
      if (!zone) continue; // Back → re-pick creature

      // All decisions finalized — broadcast card to opponent NOW
      const oi = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oi]?.socketId;
      if (oppSid && engine.io) {
        engine.io.to(oppSid).emit('card_reveal', { cardName: 'Monster in a Bottle' });
      }
      await engine._delay(100);

      // Execute: remove from source, place into support zone
      let _letheBonus = 0;
      if (creatureSource === 'hand') {
        const idx = ps.hand.indexOf(creatureName);
        if (idx < 0) return { cancelled: true };
        ps.hand.splice(idx, 1);
      } else {
        const idx = ps.discardPile.indexOf(creatureName);
        if (idx < 0) return { cancelled: true };
        ps.discardPile.splice(idx, 1);
        _letheBonus = engine.consumeLetheStamp(pi, creatureName);
      }

      const hi = zone.heroIdx;
      const si = zone.slotIdx;
      if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
      ps.supportZones[hi][si] = [creatureName];

      // Track card instance
      const inst = engine._trackCard(creatureName, pi, 'support', hi, si);
      inst.counters.isPlacement = 1;
      if (_letheBonus > 0) inst.counters._letheLevelBonus = _letheBonus;

      engine.log('placement', { card: creatureName, by: 'Monster in a Bottle', from: creatureSource, heroIdx: hi, zoneSlot: si });

      // Summon animation
      engine._broadcastEvent('summon_effect', { owner: pi, heroIdx: hi, zoneSlot: si, cardName: creatureName });
      engine._broadcastEvent('play_zone_animation', { type: 'deep_sea_bubbles', owner: pi, heroIdx: hi, zoneSlot: si });

      // Fire on-summon hooks
      await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName: creatureName, zone: 'support', heroIdx: hi, zoneSlot: si });
      await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: hi });

      engine.sync();
      break;
    }
  },
};
