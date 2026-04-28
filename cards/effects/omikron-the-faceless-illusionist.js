// ═══════════════════════════════════════════
//  CARD EFFECT: "Omikron, the Faceless Illusionist"
//  Hero — 400 HP, 40 ATK
//  Starting abilities: Creativity, Magic Arts
//
//  Once per turn: choose ANY Creature in the
//  game (full card DB gallery) and place a copy
//  into one of this Hero's free Support Zones.
//  The copy:
//    • Has _illusionSummon = true (blue filter)
//    • Has current and max HP set to 1
//    • Is negated until the start of your next
//      turn (actionNegateCreature with timed buff)
//    • Its on-summon hooks (onPlay / onCardEnterZone)
//      are suppressed (skipHooks: true) because
//      negation is applied BEFORE placement
//
//  Per-name once-per-game gate: each Omikron
//  Hero tracks the names it has already summoned
//  in `hero._omikronSummoned` (a string list).
//  Names already in the list are filtered out of
//  the gallery on subsequent activations and the
//  chosen name is appended on a successful
//  resolution. Tracking is per-Hero (two Omikrons
//  on the same player keep independent lists),
//  matching the "this Hero" wording.
//
//  HOPT enforced by engine (heroEffect: true).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Omikron, the Faceless Illusionist';

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = ctx.players[pi];
    // Need at least one free support zone on this hero
    return (ps?.supportZones?.[heroIdx] || []).some(slot => (slot || []).length === 0);
  },

  async onHeroEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];
    if (!ps) return false;
    const hero    = ps.heroes?.[heroIdx];
    if (!hero?.name) return false;

    const cardDB = engine._getCardDB();
    const { loadCardEffect } = require('./_loader');

    // ── Per-Hero exclusion set: names this Omikron has already summoned ──
    const usedNames = new Set(hero._omikronSummoned || []);

    // ── Step 1: gallery of implemented creatures (excluding already-used names) ──

    const galleryCards = Object.values(cardDB)
      .filter(cd => hasCardType(cd, 'Creature') && !hasCardType(cd, 'Token') && cd.subtype !== 'Token' && !!loadCardEffect(cd.name))
      .filter(cd => !usedNames.has(cd.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(cd => ({ name: cd.name, source: 'omikron' }));

    if (galleryCards.length === 0) return false;

    const picked = await engine.promptGeneric(pi, {
      type:         'cardGallery',
      cards:        galleryCards,
      title:        CARD_NAME,
      description:  'Choose any Creature to summon as an illusion (negated, 1 HP, until your next turn). Each name only once per game.',
      confirmLabel: '✨ Summon Illusion',
      confirmClass: 'btn-info',
      cancellable:  true,
    });

    if (!picked || picked.cancelled || !picked.cardName) return false;

    const chosenName = picked.cardName;
    // Defensive guard against a stale gallery: if something snuck the
    // chosen name into the used-set during the prompt, bail out.
    if (usedNames.has(chosenName)) return false;

    // ── Step 2: find a free slot on this hero ────────────────────────────

    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    const destSlot = ps.supportZones[heroIdx].findIndex(slot => (slot || []).length === 0);
    if (destSlot < 0) return false;

    // ── Step 3: place the illusion ───────────────────────────────────────

    ps.supportZones[heroIdx][destSlot] = [chosenName];
    const inst = engine._trackCard(chosenName, pi, 'support', heroIdx, destSlot);
    inst.turnPlayed = gs.turn; // Summoning sickness

    // Blue illusion filter
    inst.counters._illusionSummon = true;

    // Force HP to 1 (regardless of base stats)
    inst.counters.maxHp     = 1;
    inst.counters.currentHp = 1;

    // Negate until the start of Omikron owner's NEXT turn
    // expiresAtTurn = gs.turn + 1 when expiresForPlayer === pi
    engine.actionNegateCreature(inst, CARD_NAME, {
      expiresAtTurn:    gs.turn + 1,
      expiresForPlayer: pi,
      buffKey:          'omikron_negated',
    });

    // Track summon count
    ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

    // Per-Hero once-per-game: stamp the chosen name onto Omikron's
    // history so subsequent activations of THIS Omikron filter it out.
    if (!Array.isArray(hero._omikronSummoned)) hero._omikronSummoned = [];
    hero._omikronSummoned.push(chosenName);

    engine._broadcastEvent('summon_effect', {
      owner: pi, heroIdx, zoneSlot: destSlot, cardName: chosenName,
    });
    await engine._delay(400);

    engine.log('omikron_illusion', {
      player: ps.username,
      creature: chosenName,
      hero: ps.heroes[heroIdx]?.name,
    });

    // Hooks are intentionally SKIPPED — the creature is negated before placement,
    // so none of its on-summon effects (nor external triggers like Ingo/Maya/Layn)
    // should fire. This matches the "effects negated" wording.
    // (No runHooks('onCardEnterZone') call here.)

    engine.sync();
    return true;
  },
};
