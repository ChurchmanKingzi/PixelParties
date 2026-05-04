// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Forgetting"
//  Spell (Decay Magic Lv3, Normal)
//
//  Once per game (shared "Divine Gift" key).
//  Inherent additional Action.
//  Your opponent shuffles all Abilities attached to
//  Heroes they control back into their deck, except
//  Starting Abilities.
//
//  "Starting Ability" — by-count semantics, mirrors
//  Rain of Death:
//    • Per hero, count comes from the hero card's
//      INTRINSIC `startingAbility1/2` fields in
//      cards.json — NOT from `hero.ability1/2`,
//      which carries the deck-builder's chosen
//      abilities and may differ from the printed
//      starting set.
//    • If a hero starts with N copies of ability X,
//      then N copies of X are preserved (oldest-
//      first by instance creation order). Excess
//      copies are not shielded.
//    • Ascended Heroes inherit their base form's
//      starting abilities (parsed from the effect
//      text — same ascensionMap convention used
//      by Rain of Death and the puzzle builder).
//
//  Animation: each removed ability flies from its
//  ability slot to the opponent's deck via the
//  standard `play_pile_transfer` envelope before
//  state mutation, then `onCardLeaveZone` fires so
//  self-cleanup hooks (Toughness HP, Fighting ATK,
//  Friendship gold, etc.) run with the card still
//  parked in its 'ability' zone.
// ═══════════════════════════════════════════

/**
 * For a hero object, return the card data that holds its "starting abilities".
 * Normal Heroes: own card. Ascended Heroes: parsed base form.
 */
function getBaseCardData(hero, cardDB) {
  if (!hero?.name) return null;
  const cd = cardDB[hero.name];
  if (!cd) return null;
  if (cd.cardType !== 'Ascended Hero') return cd;

  const m = (cd.effect || '').match(/(?:on top of an? |Ascend from )"([^"]+)"/);
  if (!m) return cd;
  const baseName = m[1];

  // Waflav variants reference just "Waflav" — resolve to whichever Waflav
  // Hero is in the card DB (matches puzzle builder's handling).
  if (baseName === 'Waflav') {
    for (const n of Object.keys(cardDB)) {
      if (cardDB[n]?.cardType === 'Hero' && n.startsWith('Waflav')) return cardDB[n];
    }
    return cd;
  }
  return cardDB[baseName] || cd;
}

/** `{ abilityName: startingCount }` from the base form's startingAbility1/2. */
function getStartingCounts(hero, cardDB) {
  const base = getBaseCardData(hero, cardDB);
  const counts = {};
  if (base?.startingAbility1) counts[base.startingAbility1] = (counts[base.startingAbility1] || 0) + 1;
  if (base?.startingAbility2) counts[base.startingAbility2] = (counts[base.startingAbility2] || 0) + 1;
  return counts;
}

/**
 * Collect ability instances on `playerIdx` that Forgetting will shuffle
 * back. Per-hero: preserve the first N copies of each starting ability
 * in instance-creation order; everything else goes back to the deck.
 */
function collectRemovableAbilities(engine, playerIdx) {
  const cardDB = engine._getCardDB();
  const ps = engine.gs.players[playerIdx];
  if (!ps) return [];

  const result = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;

    const startingCounts = getStartingCounts(hero, cardDB);
    const preservedSoFar = {};

    for (const inst of engine.cardInstances) {
      if (inst.owner !== playerIdx) continue;
      if (inst.zone !== 'ability') continue;
      if (inst.heroIdx !== hi) continue;

      const limit = startingCounts[inst.name] || 0;
      const already = preservedSoFar[inst.name] || 0;
      if (already < limit) {
        preservedSoFar[inst.name] = already + 1;
      } else {
        result.push(inst);
      }
    }
  }
  return result;
}

module.exports = {
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const oppPs = gs.players[oi];
      if (!oppPs) return;

      const removable = collectRemovableAbilities(engine, oi);
      if (removable.length === 0) {
        engine.log('divine_gift_forgetting_fizzle', {
          player: gs.players[pi].username, reason: 'no_non_starting_abilities',
        });
        return;
      }

      // Randomize order — sells the "scattered, confused forgetting"
      // read better than a deterministic walk. Fisher-Yates shuffle.
      const order = removable.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      // Question-mark burst on every hero that loses ≥ 1 ability.
      // Fire ONCE per affected hero up front — they layer over the
      // sequential ability-flight animations and create a "the heroes
      // are forgetting" tableau across the affected board side. Dedup
      // by heroIdx since multiple removals on one hero only need one
      // mark burst.
      const affectedHeroes = new Set(order.map(inst => inst.heroIdx));
      for (const hi of affectedHeroes) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'forgetting_question_mark',
          owner: oi, heroIdx: hi, zoneSlot: -1,
        });
      }

      // ── Flight animation: each removed ability flies one-by-one
      // from its slot into the opponent's deck. Short staggered delay
      // between launches so they read as a sequence rather than a wall
      // of cards departing at once.
      //
      // The client's pile-transfer handler captures the source slot's
      // bounding rect SYNCHRONOUSLY at the moment of the broadcast and
      // then animates an overlay copy independently — meaning state
      // CAN (and should) mutate immediately, before the flight lands.
      // If we waited for the flight to finish first, the source slot
      // would keep rendering the card for the full flight duration
      // and then snap empty — the "pops away after a second or two"
      // visual the user reported. Tengu Windstorm's flow is the
      // correct reference here. ──
      const STAGGER_MS = 220;       // gap between successive launches
      const FLIGHT_MS  = 1100;      // standard pile-transfer flight runtime
      for (let i = 0; i < order.length; i++) {
        const inst = order[i];
        engine._broadcastEvent('play_pile_transfer', {
          owner: inst.owner,
          cardName: inst.name,
          from: 'ability',
          to: 'deck',
          fromHeroIdx: inst.heroIdx,
          fromSlotIdx: inst.zoneSlot,
        });

        // Self-cleanup hook (Toughness HP, Fighting ATK, etc.) BEFORE
        // state mutation — `_onlyCard` scopes the hook to this inst so
        // unrelated same-name copies on the board don't misfire.
        await engine.runHooks('onCardLeaveZone', {
          _onlyCard: inst,
          card: inst, leavingCard: inst,
          fromZone: 'ability',
          fromOwner: inst.owner,
          fromHeroIdx: inst.heroIdx,
          fromZoneSlot: inst.zoneSlot,
          toZone: 'deck',
          _skipReactionCheck: true,
        });

        // Splice from ability zone, push name to mainDeck, untrack —
        // immediately, so the slot empties as the flight begins.
        const slotArr = oppPs.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot];
        if (Array.isArray(slotArr)) {
          const idx = slotArr.indexOf(inst.name);
          if (idx >= 0) slotArr.splice(idx, 1);
        }
        oppPs.mainDeck.push(inst.name);
        engine._untrackCard(inst.id);
        engine.log('ability_returned_to_deck', {
          player: oppPs.username, ability: inst.name,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
          by: 'Divine Gift of Forgetting',
        });
        engine.sync();

        // Hold for the next launch — or the full flight runtime on
        // the last ability so the final card finishes landing before
        // the next phase advances and the deck-shuffle log fires.
        const wait = (i === order.length - 1) ? FLIGHT_MS : STAGGER_MS;
        await engine._delay(wait);
      }

      engine.shuffleDeck(oi);

      engine.log('divine_gift_forgetting', {
        player: gs.players[pi].username,
        opponent: oppPs.username,
        shuffled: removable.length,
        heroesAffected: affectedHeroes.size,
      });
      engine.sync();
    },
  },
};
