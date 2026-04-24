// ═══════════════════════════════════════════
//  CARD EFFECT: "Elven Druid"
//  Creature (Summoning Magic Lv2) — 50 HP
//
//  HOPT creature effect — once per turn, choose an
//  Elven Creature from your deck (except Elven Druid)
//  and summon it as an additional Action with the
//  corresponding Hero (i.e. the Hero Druid is attached
//  to).
//
//  Excludes Elven Rider by name: Rider's own text
//  forbids being summoned by anything except its own
//  effect. Druid is not Rider's own effect, so Rider
//  is filtered out of the gallery.
//
//  "Additional Action" here is purely flavour/mechanic
//  distinction: creature effects never cost an action
//  in the first place, so the tutored summon is
//  implemented as a direct `summonCreatureWithHooks`
//  call inside Druid's HOPT — no additional-action
//  slot registration is needed.
// ═══════════════════════════════════════════

const { isElvenCreature } = require('./_elven-shared');

const CARD_NAME   = 'Elven Druid';
const EXCLUDE_SET = new Set(['Elven Druid', 'Elven Rider']);

/**
 * Can Druid's host Hero legally summon `cardData` right now? Mirrors the
 * relevant Creature gates from `getHeroPlayableCards`:
 *   - Hero exists, is alive, not frozen / stunned
 *   - Player is not summon-locked
 *   - Hero meets the spell-school / level requirement (respects the Elven
 *     Forager level reduction — `heroMeetsLevelReq` walks it generically)
 * Combo-lock / action-limit / bonus-actions don't apply — Druid's effect
 * is a creature effect, not a hero action, so it doesn't consume the
 * hero's turn economy. The card text explicitly preserves the school /
 * level requirement ("additional Action", not "ignore level").
 */
function heroCanHostDruidTutor(engine, pi, heroIdx, cardData) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name) return false;
  if (hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned) return false;
  if (ps.summonLocked) return false;
  return engine.heroMeetsLevelReq(pi, heroIdx, cardData);
}

module.exports = {
  activeIn: ['support'],

  creatureEffect: true,

  /**
   * Only offer the effect if there's at least one summonable target in
   * the deck AND Druid's host Hero can actually host the summon right
   * now. If the Hero is dead / frozen / stunned / lacks Summoning Magic
   * for every Elven in the deck, the button stays disabled — no
   * activation, no HOPT burn.
   */
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps     = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;

    // Must have at least one support slot free on Druid's hero —
    // otherwise the summon cannot land.
    const heroIdx = ctx.cardHeroIdx;
    const zones   = ps.supportZones?.[heroIdx] || [[], [], []];
    const hasFreeSlot = zones.some(slot => (slot || []).length === 0);
    if (!hasFreeSlot) return false;

    const cardDB = engine._getCardDB();
    for (const name of (ps.mainDeck || [])) {
      if (EXCLUDE_SET.has(name)) continue;
      const cd = cardDB[name];
      if (!isElvenCreature(cd)) continue;
      if (!heroCanHostDruidTutor(engine, ctx.cardOwner, heroIdx, cd)) continue;
      return true;
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];
    if (!ps) return false;

    const cardDB = engine._getCardDB();

    // ── Build gallery of deck Elven Creatures (excl. Druid & Rider) ──
    // Gallery is filtered to creatures Druid's host Hero can actually
    // summon right now — same gate as `canActivateCreatureEffect`, so a
    // partially-blocked Hero (e.g. has Summoning Magic Lv1 but not Lv2)
    // still sees only the subset it can legally host.
    const counts = {};
    for (const name of (ps.mainDeck || [])) {
      if (EXCLUDE_SET.has(name)) continue;
      const cd = cardDB[name];
      if (!isElvenCreature(cd)) continue;
      if (!heroCanHostDruidTutor(engine, pi, heroIdx, cd)) continue;
      counts[name] = (counts[name] || 0) + 1;
    }
    const gallery = Object.entries(counts)
      .map(([name, count]) => ({ name, source: 'deck', count, level: cardDB[name]?.level || 0 }))
      .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
    if (gallery.length === 0) return false;

    // ── Prompt ──
    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Choose an Elven Creature from your deck to summon.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;

    const chosenName = picked.cardName;

    // ── Remove from deck, shuffle ──
    const idx = (ps.mainDeck || []).indexOf(chosenName);
    if (idx < 0) return false; // Deck changed between prompt and confirm; fizzle
    ps.mainDeck.splice(idx, 1);
    engine.shuffleDeck(pi, 'main');

    // Reveal to opponent via the standard deck-search gallery
    engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });

    // ── Verify a support slot is still free on Druid's hero ──
    const zones = ps.supportZones?.[heroIdx] || [[], [], []];
    const freeSlot = zones.findIndex(slot => (slot || []).length === 0);
    if (freeSlot < 0) {
      // Hero's support zone filled up between the pre-check and now
      // (highly unlikely mid-HOPT, but safest to handle). Return the
      // card to deck and fizzle.
      ps.mainDeck.push(chosenName);
      engine.shuffleDeck(pi, 'main');
      engine.log('elven_druid_fizzle', { player: ps.username, reason: 'no_free_slot' });
      return false;
    }

    // ── Summon with full hook lifecycle (onPlay, onCardEnterZone) ──
    // Routes through safePlaceInSupport → _trackCard. The engine's
    // existing mechanics (summoning sickness via turnPlayed, guardian
    // immunity, etc.) all apply.
    const summonRes = await engine.summonCreatureWithHooks(
      chosenName, pi, heroIdx, freeSlot,
      { source: CARD_NAME }
    );
    if (!summonRes) {
      // beforeSummon refused (unlikely for an Elven) — put card back
      // and fizzle so the player doesn't lose the deck copy.
      ps.mainDeck.push(chosenName);
      engine.shuffleDeck(pi, 'main');
      engine.log('elven_druid_fizzle', { player: ps.username, reason: 'beforeSummon_refused' });
      return false;
    }

    // Nature-magic summon flourish on the destination slot. `druid_leaf_
    // storm` is a Druid-specific animation: ~36 leafy emoji spawn at the
    // centre and fan outwards in all directions, spinning as they blow
    // past the slot — "storm-of-leaves" feel distinct from biomancy_vines
    // (which pulls inward). Carries the `elem_biomancy` SFX mapping.
    engine._broadcastEvent('play_zone_animation', {
      type: 'druid_leaf_storm',
      owner: pi,
      heroIdx,
      zoneSlot: freeSlot,
    });

    engine.log('elven_druid_tutor', {
      player: ps.username, summoned: chosenName, heroIdx,
    });

    // ── Opponent-side deck-search reveal modal ──
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: chosenName,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });

    engine.sync();
    return true;
  },
};
