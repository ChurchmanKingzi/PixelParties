// ═══════════════════════════════════════════
//  CARD EFFECT: "Layn, Master of Deri's Relic"
//  Ascended Hero — 800 HP, 100 ATK
//  Starting ability: Fighting 3
//
//  Ascension condition (enforced by base Layn's
//  script + Earth-Shattering Hammer):
//  Play on top of "Layn, Defender of Deri"
//  equipped with "Earth-Shattering Hammer,
//  Relic of Deri". Not cheat-ascendable.
//
//  Hero Effect (once per turn):
//  Choose a level 3 or lower Creature from your
//  discard pile and place it into a free Support
//  Zone of any of your Heroes. The creature has
//  summoning sickness this turn.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { performAscensionBonus } = require('./_ascension-bonus');

const CARD_NAME  = 'Layn, Master of Deri\'s Relic';
const MAX_LEVEL  = 3;

/** True if the player's discard contains at least one eligible Creature. */
function hasEligibleCreature(ps, cardDB) {
  return (ps.discardPile || []).some(cn => {
    const cd = cardDB[cn];
    return cd && hasCardType(cd, 'Creature') && (cd.level ?? 0) <= MAX_LEVEL;
  });
}

/** True if the player has at least one free Support Zone slot. */
function hasFreeZone(ps) {
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      if ((ps.supportZones?.[hi]?.[si] || []).length === 0) return true;
    }
  }
  return false;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  async onAscensionBonus(engine, pi, heroIdx) {
    await performAscensionBonus(engine, pi, heroIdx, ['Fighting']);
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;
    const cardDB = engine._getCardDB();
    return hasEligibleCreature(ps, cardDB) && hasFreeZone(ps);
  },

  async onHeroEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const ps      = gs.players[pi];
    if (!ps) return false;

    const cardDB = engine._getCardDB();

    // ── Step 1: pick a Creature from discard ─────────────────────────────

    // Build deduplicated gallery (level ≤ 3 Creatures only)
    const seen = new Set();
    const galleryCards = [];
    for (const cn of (ps.discardPile || [])) {
      if (seen.has(cn)) continue;
      const cd = cardDB[cn];
      if (!cd || !hasCardType(cd, 'Creature') || (cd.level ?? 0) > MAX_LEVEL) continue;
      seen.add(cn);
      galleryCards.push({ name: cn, source: 'discard' });
    }
    galleryCards.sort((a, b) => a.name.localeCompare(b.name));

    if (galleryCards.length === 0) return false;

    const creaturePick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: `Choose a level ${MAX_LEVEL} or lower Creature from your discard pile to summon.`,
      confirmLabel: '⚔️ Summon!',
      confirmClass: 'btn-success',
      cancellable: true,
    });

    if (!creaturePick || creaturePick.cancelled || !creaturePick.cardName) return false;

    const chosenName = creaturePick.cardName;

    // ── Step 2: pick a target hero's free Support Zone ────────────────────

    const freeZones = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      for (let si = 0; si < 3; si++) {
        if ((ps.supportZones?.[hi]?.[si] || []).length === 0) {
          freeZones.push({ heroIdx: hi, slotIdx: si, label: `${h.name} — Slot ${si + 1}` });
        }
      }
    }

    if (freeZones.length === 0) return false;

    let destHeroIdx, destSlot;

    if (freeZones.length === 1) {
      // Only one option — auto-select
      destHeroIdx = freeZones[0].heroIdx;
      destSlot    = freeZones[0].slotIdx;
    } else {
      const zonePick = await ctx.promptZonePick(freeZones, {
        title: CARD_NAME,
        description: `Choose where to place ${chosenName}.`,
        confirmLabel: '📍 Place here',
        cancellable: false, // Creature already committed
      });
      if (!zonePick) return true; // Fizzle but resolve (card was already picked)
      destHeroIdx = zonePick.heroIdx;
      destSlot    = zonePick.slotIdx;
    }

    // ── Step 3: remove from discard, place in support zone ───────────────

    const discardIdx = ps.discardPile.indexOf(chosenName);
    if (discardIdx < 0) return true; // Shouldn't happen, guard

    ps.discardPile.splice(discardIdx, 1);

    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    ps.supportZones[destHeroIdx][destSlot] = [chosenName];

    const inst = engine._trackCard(chosenName, pi, 'support', destHeroIdx, destSlot);
    inst.turnPlayed = gs.turn; // Summoning sickness

    ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

    engine._broadcastEvent('summon_effect', {
      owner: pi, heroIdx: destHeroIdx, zoneSlot: destSlot, cardName: chosenName,
    });
    await engine._delay(400);

    engine.log('layn_ascended_summon', {
      player: ps.username, creature: chosenName,
      hero: ps.heroes[destHeroIdx]?.name, slot: destSlot,
    });

    // Fire enter-zone hooks so passive effects (Ingo, Maya, Layn aura etc.) react
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
      _skipReactionCheck: true,
    });

    engine.sync();
    return true;
  },
};
