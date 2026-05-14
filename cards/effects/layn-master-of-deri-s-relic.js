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
//  Choose up to 3 level 1 Creatures with the
//  SAME NAME from the discard pile and place
//  them into the free Support Zones of Heroes
//  you control. Placements may target dead /
//  incapacitated Heroes' zones (the player
//  controls the slot regardless of host state).
//  Summoning Magic is NOT required on the
//  receiving Hero — this is the war hero
//  "rallying her troops", a placement that
//  bypasses school / level / ability gates.
//  Each placed Creature has summoning sickness
//  this turn.
//
//  Implementation
//  ──────────────
//  • Gallery picker (`cardGallery`) shows the
//    DISTINCT Lv1 Creature names in discard with
//    a count badge. The player picks ONE name;
//    the system then places `min(in_discard, 3,
//    free_zones)` copies one zone at a time.
//
//  • Zone loop: the first placement is committed
//    (cancellable: false) — the player already
//    confirmed at the gallery. Placements 2+ are
//    cancellable so the player can stop after 1
//    or 2 if they prefer to save copies for a
//    later turn / different rally.
//
//  • Free-zone enumeration includes dead Heroes'
//    columns — `h.hp <= 0` is NOT a filter here,
//    matching the spec's "even in Support Zones
//    of dead or incapacitated Heroes" carve-out.
//    Empty hero slots (no `h.name`) are still
//    excluded — there's no column at all there.
//
//  • Manual placement (splice discard → push to
//    supportZones → `_trackCard` → mark
//    `turnPlayed` for summoning sickness → fire
//    `onCardEnterZone`). Does NOT fire `onPlay`
//    — this is "place from discard", not summon,
//    matching the old behaviour for revive-style
//    effects in this game.
//
//  • Engine HOPT for hero effects is auto-stamped
//    when `onHeroEffect` returns truthy (see
//    `server.js` `doActivateHeroEffect` line
//    ~L5582). Returning `false` BEFORE the
//    gallery confirms refunds the slot; returning
//    `true` after gallery confirmation commits
//    it regardless of how many placements
//    actually landed (matches the original
//    "fizzle but resolve" convention — once the
//    player picked a Creature name, the rally is
//    spent).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME      = 'Layn, Master of Deri\'s Relic';
const TARGET_LEVEL   = 1;
const MAX_PLACEMENTS = 3;

/** True iff the discard pile has at least one Lv1 Creature. */
function hasEligibleCreature(ps, cardDB) {
  return (ps.discardPile || []).some(cn => {
    const cd = cardDB[cn];
    return cd && hasCardType(cd, 'Creature') && (cd.level ?? 0) === TARGET_LEVEL;
  });
}

/**
 * Collect every free Support Zone slot across the player's Heroes —
 * INCLUDING dead / incapacitated Heroes. Per spec, Layn's rally can
 * reinforce zones on a fallen Hero's column. Only empty hero slots
 * (no `h.name`) are excluded; those columns don't exist.
 */
function collectFreeZones(ps) {
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name) continue;
    for (let si = 0; si < 3; si++) {
      if ((ps.supportZones?.[hi]?.[si] || []).length === 0) {
        const koTag = h.hp <= 0 ? ' (KO)' : '';
        out.push({
          heroIdx: hi,
          slotIdx: si,
          label: `${h.name}${koTag} — Slot ${si + 1}`,
        });
      }
    }
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  async onAscensionBonus(engine, pi, heroIdx) {
    await engine.performAscensionBonus(pi, heroIdx, ['Fighting']);
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;
    const cardDB = engine._getCardDB();
    if (!hasEligibleCreature(ps, cardDB)) return false;
    if (collectFreeZones(ps).length === 0) return false;
    return true;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const pi     = ctx.cardOwner;
    const ps     = gs.players[pi];
    if (!ps) return false;

    const cardDB = engine._getCardDB();

    // ── Step 1: build the gallery of Lv1 Creature names in discard ─────────
    // Dedupe by name; show each with its count so the player can see at a
    // glance how many copies a rally would cap at (max 3 regardless).
    const counts = {};
    for (const cn of (ps.discardPile || [])) {
      const cd = cardDB[cn];
      if (!cd || !hasCardType(cd, 'Creature') || (cd.level ?? 0) !== TARGET_LEVEL) continue;
      counts[cn] = (counts[cn] || 0) + 1;
    }
    const galleryCards = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'discard', count }));

    if (galleryCards.length === 0) return false;

    const namePick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: `Choose a level 1 Creature. Up to ${MAX_PLACEMENTS} copies from your discard pile will be placed onto free Support Zones of your Heroes (including KO'd ones).`,
      confirmLabel: '⚔️ Rally!',
      confirmClass: 'btn-success',
      cancellable: true,
      // Loud count badge — the per-name copy count is the load-bearing
      // number for this picker (it caps the rally at min(count, 3)), so
      // the renderer switches to the larger gold badge instead of the
      // default 10px corner pill. Read by the cardGallery renderer in
      // `app-board.jsx` (~L25363).
      emphasizeCount: true,
    });

    if (!namePick || namePick.cancelled || !namePick.cardName) return false;

    const chosenName = namePick.cardName;
    const inDiscard  = counts[chosenName] || 0;
    const cap        = Math.min(MAX_PLACEMENTS, inDiscard);

    // ── Step 2: loop placements one zone at a time, up to `cap` ─────────────
    let placedCount = 0;
    while (placedCount < cap) {
      const freeZones = collectFreeZones(ps);
      if (freeZones.length === 0) break;

      const zonePick = await ctx.promptZonePick(freeZones, {
        title: CARD_NAME,
        description: placedCount === 0
          ? `Place ${chosenName} (1 of up to ${cap}).`
          : `Place another ${chosenName}? (${placedCount + 1} of up to ${cap})`,
        confirmLabel: '📍 Place',
        // First placement is committed — player confirmed at the gallery.
        // Subsequent placements are optional ("up to 3"); player may stop
        // after 1 or 2 by cancelling. Override the default `← Back` label
        // since cancelling doesn't return to a previous step — it ENDS
        // the rally early with the placements already made.
        cancellable: placedCount > 0,
        cancelLabel: '✓ Done',
      });
      if (!zonePick) break;

      const destHeroIdx = zonePick.heroIdx;
      const destSlot    = zonePick.slotIdx;

      const discardIdx = ps.discardPile.indexOf(chosenName);
      if (discardIdx < 0) break;
      ps.discardPile.splice(discardIdx, 1);

      if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
      ps.supportZones[destHeroIdx][destSlot] = [chosenName];

      const inst = engine._trackCard(chosenName, pi, 'support', destHeroIdx, destSlot);
      inst.turnPlayed = gs.turn; // Summoning sickness — placed this turn

      ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

      engine._broadcastEvent('summon_effect', {
        owner: pi, heroIdx: destHeroIdx, zoneSlot: destSlot, cardName: chosenName,
      });
      await engine._delay(400);

      // Fire enter-zone hooks so passive listeners (Ingo, Maya, Layn's own
      // aura, archetype-counters, etc.) react to the placement. `onPlay`
      // is intentionally NOT fired — this is "place from discard", not a
      // summon, matching the old single-copy version's contract so
      // on-summon riders (Beagle gold, Hell Fox tutor) don't retrigger
      // on revived bodies.
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
        _skipReactionCheck: true,
      });

      placedCount++;
    }

    if (placedCount > 0) {
      engine.log('layn_ascended_rally', {
        player: ps.username,
        creature: chosenName,
        placed: placedCount,
      });
    }

    engine.sync();
    // HOPT is committed once the player confirmed at the gallery — even
    // if zone-pick cancels short or zones somehow disappear mid-loop.
    return true;
  },
};
