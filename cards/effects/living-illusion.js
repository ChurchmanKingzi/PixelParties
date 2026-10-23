// ═══════════════════════════════════════════
//  CARD EFFECT: "Living Illusion"
//  Spell (Summoning Magic Lv1, Normal)
//  Pollution archetype.
//
//  Search your deck for a level-3-or-lower Creature
//  and place it into the user's free Support Zone.
//  Then place Pollution Tokens equal to the Creature's
//  level + 1 into your free Support Zones. You cannot
//  summon Creatures for the rest of the turn afterwards
//  (`ps.summonLocked`, wie bei Create Illusion — erst nach
//  gelungener Aufloesung gesetzt, die Engine loest die Sperre
//  zum naechsten Zugbeginn).
//
//  Inherent additional Action: playable from hand in
//  any Main Phase as well as the Action Phase, and
//  never consumes the turn's Action — the engine's
//  `inherentAction: true` handles both the Main-Phase
//  gate and the heroesActedThisTurn skip.
//
//  The summoned Creature gets the shared blue
//  "illusion" tint via `_illusionSummon`, the same
//  counter Create Illusion / Staff of Illusions /
//  Omikron / Xuanwu already set to mark an illusory
//  summon.
//
//  Sacrifice-requiring Creatures (Dragon Pilot, any
//  future tribute summon) are filtered out of the
//  gallery when their cost can't be paid, and — if
//  picked — the sacrifice is prompted BEFORE the
//  creature is placed, via the engine's beforeSummon
//  hook. All handled transparently by
//  `engine.isCreatureSummonable` + summonCreatureWithHooks.
//
//  "User" = the Hero that cast this spell, so placement
//  is restricted to that specific Hero's free zones.
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones, getFreeZones } = require('./_pollution-shared');
const { hasCardType, isSummonablePileCreature } = require('./_hooks');
const { heldSeite } = require('./_hooks');   // Als Befund 29.9.: Brettseite geliehener Helden

/**
 * Return the free Support Zones belonging to a specific Hero only.
 * (getFreeZones walks all heroes; Living Illusion must restrict to
 * the casting Hero per the card's "user's free Support Zone" wording.)
 *
 * ★ W63a (Al, 22.10.2026: Alices Effekt gilt fuer ALLE Platzierungs-Effekte; „erst die geteilte Zone, DANN die erste leere"): mit `name` kommt die
 * EINE Zonenfrage der Engine (`beschwoerZonenFuer`) — geteilte Zone einer GLEICHNAMIGEN Creature (Alice-Teilung des Wirkers) vorn, dahinter die freien
 * Basiszonen des Helden. Ohne `name` nur die freien Zonen (Vorpruefung ohne Kartenwahl).
 */
function getFreeZonesForHero(gs, playerIdx, heroIdx, engine = null, name = null) {
  const ps = gs.players[playerIdx];
  if (!ps) return [];
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return [];
  if (engine && name) return engine.beschwoerZonenFuer(playerIdx, name, { heroIdx, nurBasis: true, livingHeroesOnly: true });
  const result = [];
  for (let si = 0; si < 3; si++) {
    const slot = (ps.supportZones?.[heroIdx] || [])[si] || [];
    if (slot.length === 0) {
      result.push({ heroIdx, slotIdx: si, label: `${hero.name} — Slot ${si + 1}` });
    }
  }
  return result;
}

/**
 * ★ W63a: Namen der Level-<=3-Kreaturen im Deck, fuer die der Held `heroIdx` eine Zone hat (frei oder, mit Alice-Teilung, geteilt) und die er
 * beschwoeren darf. Quelle der Galerie UND der Spielbarkeit — die Creature steht erst nach der Deck-Wahl fest, aber SIE WIRD GEWAEHLT, also ist
 * der Zauber spielbar, sobald mindestens ein Name eine Zone findet.
 */
function deckKandidaten(engine, gs, pi, heroIdx) {
  const ps = gs.players[pi];
  const cardDB = engine._getCardDB();
  const out = [];
  const gesehen = new Set();
  for (const name of (ps?.mainDeck || [])) {
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    const cd = cardDB[name];
    if (!cd || !isSummonablePileCreature(cd, name)) continue;
    if (engine.effectiveCardLevel(cd, pi) > 3) continue;
    if (getFreeZonesForHero(gs, pi, heroIdx, engine, name).length === 0) continue;
    if (!engine.isCreatureSummonable(name, pi, heroIdx)) continue;
    out.push(name);
  }
  return out;
}

module.exports = {
  placesPollutionTokens: true,
  // Reaction-equivalent-for-action-economy: no Action cost, playable in
  // both Main Phases (no additional-action provider needed) AND the
  // Action Phase (doesn't advance the phase after resolving).
  inherentAction: true,

  // Per-hero gate — the spell summons a Creature into THIS hero's free
  // Support Zone, so the casting Hero specifically must have at least
  // one free slot. `spellPlayCondition` only knows "any hero has a free
  // zone somewhere"; that's not enough, a player with Hero A full and
  // Hero B empty was previously able to try to cast from Hero A and
  // fizzle mid-resolution. The engine calls this per hero during the
  // eligibility check and re-validates at play-time.
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const ps = gs.players[heldSeite(gs, pi, heroIdx)];
    const supZones = ps?.supportZones?.[heroIdx] || [];
    for (let z = 0; z < 3; z++) {
      if ((supZones[z] || []).length === 0) return true;
    }
    // ★ W63a (Al): mit Alice-Teilung reicht auch die Zone einer GLEICHNAMIGEN Creature — spielbar, sobald eine Deck-Kreatur dort hineinpasst.
    if (engine && require('./_alice-shared').sharingActive(gs, pi)) return deckKandidaten(engine, gs, pi, heroIdx).length > 0;
    return false;
  },

  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need at least one free zone total for the creature placement.
    // (Pollution Token count depends on the creature's level, so we can't
    // pre-validate exactly — the spell fizzles partially at runtime if
    // there aren't enough zones for all tokens.)
    // ★ W63a (Al): ... oder, mit Alice-Teilung, die Zone einer gleichnamigen Creature fuer eine Deck-Kreatur.
    if (countFreeZones(gs, pi) === 0) {
      if (!engine || !require('./_alice-shared').sharingActive(gs, pi)) return false;
      if (!(ps.heroes || []).some((h, hi) => h?.name && h.hp > 0 && deckKandidaten(engine, gs, pi, hi).length > 0)) return false;
    }
    // Need at least one level-≤3 Creature in the deck.
    // Defer the actual check to onPlay to keep spellPlayCondition cheap
    // approximate here by requiring a non-empty deck.
    return (ps.mainDeck || []).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const userHeroIdx = ctx.cardHeroIdx; // "the user" = casting Hero
      const ps = gs.players[pi];
      if (!ps || userHeroIdx < 0) return;

      const hero = ps.heroes?.[userHeroIdx];
      if (!hero?.name || hero.hp <= 0) {
        gs._spellCancelled = true;
        return;
      }

      const cardDB = engine._getCardDB();

      // ── Check: does the caster's Hero have any free Support Zone? (W63a: oder, mit Alice-Teilung, eine geteilte Zone fuer eine Deck-Kreatur) ──
      const userZones = getFreeZonesForHero(gs, pi, userHeroIdx);
      if (userZones.length === 0 && deckKandidaten(engine, gs, pi, userHeroIdx).length === 0) {
        engine.log('living_illusion_fizzle', {
          player: ps.username, hero: hero.name, reason: 'no_free_zone_on_user',
        });
        return;
      }

      // ── Filter deck to Lv≤3 Creatures, deduplicated with counts. ──
      // Also exclude Creatures whose sacrifice/tribute cost can't be paid
      // right now (Dragon Pilot etc.) — isCreatureSummonable returns true
      // for Creatures with no canSummon script, so this is a no-op for
      // the vast majority of cards and only filters the tribute summons
      // that actually care.
      const deck = ps.mainDeck || [];
      const countMap = {};
      const effLevels = {};
      for (const name of deck) {
        const cd = cardDB[name];
        if (!cd || !isSummonablePileCreature(cd, name)) continue;
        const lvl = engine.effectiveCardLevel(cd, pi);
        if (lvl > 3) continue;
        if (!engine.isCreatureSummonable(name, pi, userHeroIdx)) continue;
        if (getFreeZonesForHero(gs, pi, userHeroIdx, engine, name).length === 0) continue;   // W63a: Zone je Karte (frei oder geteilt)
        countMap[name] = (countMap[name] || 0) + 1;
        effLevels[name] = lvl;
      }
      const gallery = Object.entries(countMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({
          name, source: 'deck', count,
          level: effLevels[name] ?? (cardDB[name]?.level || 0),
        }));

      if (gallery.length === 0) {
        engine.log('living_illusion_fizzle', {
          player: ps.username, reason: 'no_eligible_creature_in_deck',
        });
        return;
      }

      // ── Pick the creature ──
      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: 'Living Illusion',
        description: 'Search your deck for a level 3 or lower Creature.',
        cancellable: true,
      });
      if (!picked || picked.cancelled) {
        gs._spellCancelled = true;
        return;
      }
      const creatureName = picked.cardName;
      const creatureCd = cardDB[creatureName];
      const creatureLevel = creatureCd?.level || 0;

      // ── Pick which of the user's free slots to place it into ──
      // W63a: Zonen der gewaehlten Karte — geteilte Zone (Alice) zuerst, dahinter die freien.
      const userZonesFuer = getFreeZonesForHero(gs, pi, userHeroIdx, engine, creatureName);
      if (userZonesFuer.length === 0) { gs._spellCancelled = true; return; }
      let destZone;
      if (userZonesFuer.length === 1) {
        destZone = userZonesFuer[0];
      } else {
        const zonePick = await ctx.promptZonePick(userZonesFuer, {
          title: 'Living Illusion — Placement',
          description: `Place ${creatureName} into which of ${hero.name}'s free Support Zones?`,
          cancellable: false,
        });
        destZone = (zonePick && userZonesFuer.find(z => z.heroIdx === zonePick.heroIdx && z.slotIdx === zonePick.slotIdx)) || userZonesFuer[0];
      }

      // ── Remove one copy from the deck and shuffle ──
      const _taken_deckIdx = await engine.deckEntnahme(ps,  creatureName, { source: 'living-illusion' });   // v820: Stapel-Schicht
      if (_taken_deckIdx) {
      }

      // Deck-search reveal animation
      engine._broadcastEvent('deck_search_add', { cardName: creatureName, playerIdx: pi });
      engine.log('deck_search', { player: ps.username, card: creatureName, by: 'Living Illusion' });

      // ── Summon the creature (full lifecycle) ──
      // beforeSummon runs FIRST for tribute summons (Dragon Pilot etc.)
      // and will abort the summon if the sacrifice can't be paid; we
      // already pre-filtered such cases via isCreatureSummonable above,
      // but the engine re-checks as a safety net.
      const placeResult = await engine.summonCreatureWithHooks(
        creatureName, pi, destZone.heroIdx, destZone.slotIdx,
        {
          source: 'Living Illusion', skipReactionCheck: false,
          isPlacement: true,
          hookExtras: { _summonedBy: 'Living Illusion', ...engine.deckHookExtras() },
        },
      );
      // Apply the shared blue illusion tint to the summoned creature —
      // same `_illusionSummon` flag Create Illusion / Staff of Illusions
      // / Omikron / Xuanwu's revived creatures already use, so the
      // existing board-card render picks it up automatically.
      if (placeResult?.inst) {
        placeResult.inst.counters._illusionSummon = true;
      }
      engine.shuffleDeck(pi, 'main');
      engine.sync();
      await engine._delay(300);

      // ── Place (level + 1) Pollution Tokens ──
      const tokenCount = creatureLevel + 1;
      const { placed } = await placePollutionTokens(engine, pi, tokenCount, 'Living Illusion', {
        promptCtx: ctx,
      });

      // Reveal to opponent (symmetry with other deck-search spells)
      const oi = engine.opponentOf(pi);
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: creatureName,
        searcherName: ps.username,
        title: 'Living Illusion',
        cancellable: false,
      });

      // „You cannot summon Creatures for the rest of the turn afterwards."
      ps.summonLocked = true;

      engine.log('living_illusion', {
        player: ps.username, creature: creatureName,
        level: creatureLevel, tokensPlaced: placed,
      });

      engine.sync();
    },
  },
};
