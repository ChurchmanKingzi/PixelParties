// ═══════════════════════════════════════════
//  CARD EFFECT: "Rain of Death"
//  Spell (Destruction Magic Lv3, Normal)
//  Pollution archetype.
//
//  Deletes every non-Starting Ability on the board.
//  Then places 1 Pollution Token into the caster's
//  free Support Zones for every OPPONENT Ability
//  that was removed.
//
//  Spell is unplayable if the opponent has more
//  Abilities that would be removed than the caster
//  has free Support Zones to place the resulting
//  Pollution Tokens into.
//
//  "Starting Ability" definition:
//    • Determined per hero, by COUNT. If the hero
//      normally starts with N copies of ability X,
//      then N copies of X are preserved and any
//      additional copies are removed. Excess copies
//      of a starting ability are NOT shielded.
//    • For Ascended Heroes, the starting abilities
//      come from the BASE form (parsed from the
//      Ascended Hero's effect text — same pattern
//      the puzzle builder uses, e.g. Beato, the
//      Eternal Butterfly inherits Magic Arts ×2
//      from Beato, the Butterfly Witch).
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones } = require('./_pollution-shared');

/**
 * For a hero object, return the card data that holds its "starting abilities".
 * For normal Heroes, that's just the hero's own card. For Ascended Heroes,
 * we parse the effect text ("on top of an 'X'" / "Ascend from 'X'") to find
 * the base form and return ITS card data — matching the puzzle builder's
 * ascensionMap logic so the two never disagree.
 */
function getBaseCardData(hero, cardDB) {
  if (!hero?.name) return null;
  const cd = cardDB[hero.name];
  if (!cd) return null;
  if (cd.cardType !== 'Ascended Hero') return cd;

  const m = (cd.effect || '').match(/(?:on top of an? |Ascend from )"([^"]+)"/);
  if (!m) return cd; // No parseable base reference — fall back to the ascended form.
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

/**
 * Build a map of `{ abilityName: startingCount }` for a hero, based on the
 * base form's startingAbility1 / startingAbility2 fields. Duplicates stack.
 */
function getStartingCounts(hero, cardDB) {
  const base = getBaseCardData(hero, cardDB);
  const counts = {};
  if (base?.startingAbility1) counts[base.startingAbility1] = (counts[base.startingAbility1] || 0) + 1;
  if (base?.startingAbility2) counts[base.startingAbility2] = (counts[base.startingAbility2] || 0) + 1;
  return counts;
}

/**
 * Collect ability instances on a player's side that Rain of Death will
 * remove. For each hero, the first N copies of each starting ability
 * (where N = startingCount) are preserved — in instance-creation order,
 * so the originally-placed copies are the ones that survive — and every
 * instance beyond that threshold is marked for deletion.
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

    // Iterate ability instances in creation order (engine.cardInstances is
    // push-ordered), which is effectively oldest-first — preserving the
    // abilities the hero actually started with, removing later stacks.
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
  placesPollutionTokens: true,

  // Block the cast if the opponent would lose more Abilities than the caster
  // has free Support Zones to hold the resulting Pollution Tokens. Anything
  // else is allowed (including "no removable abilities anywhere" — that just
  // fizzles at runtime, which is a valid outcome for a board-wipe effect).
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true; // Can't compute without engine; permissive fallback.
    const oppIdx = pi === 0 ? 1 : 0;
    const oppRemovable = collectRemovableAbilities(engine, oppIdx);
    if (oppRemovable.length === 0) return true;
    return oppRemovable.length <= countFreeZones(gs, pi);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;

      const myRemovable  = collectRemovableAbilities(engine, pi);
      const oppRemovable = collectRemovableAbilities(engine, oppIdx);

      if (myRemovable.length === 0 && oppRemovable.length === 0) {
        engine.log('rain_of_death_fizzle', {
          player: gs.players[pi].username, reason: 'no_non_starting_abilities',
        });
        return;
      }

      // ── Animation on every ability about to be removed, THEN delete ──
      for (const inst of [...myRemovable, ...oppRemovable]) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'rain_of_death', owner: inst.owner,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
          zoneType: 'ability',
        });
      }
      await engine._delay(1400);

      // ── Self-cleanup hooks FIRST, then state mutation ──
      // Abilities like Toughness and Fighting use onCardLeaveZone to undo
      // their own granted bonus (max HP / ATK). Two things matter for that
      // to work correctly:
      //   (1) The card must still be in its 'ability' zone when the hook
      //       fires, so the runHooks `isActiveIn` filter accepts it. If we
      //       mutated state first (setting inst.zone = 'deleted'), its own
      //       hook would be skipped and the bonus would stick forever.
      //   (2) We must pass `_onlyCard: inst` so unrelated still-active
      //       copies of the same ability (e.g. another hero's surviving
      //       Toughness) don't misfire on every removal. They all match
      //       the `fromZone === 'ability'` guard and would otherwise each
      //       drop their OWN hero's HP — once per ability removed anywhere
      //       on the board, which is how a hero who didn't lose any
      //       Toughness could crash from 550 to 1.
      for (const inst of [...myRemovable, ...oppRemovable]) {
        await engine.runHooks('onCardLeaveZone', {
          _onlyCard: inst,
          card: inst, fromZone: 'ability',
          fromOwner: inst.owner, fromHeroIdx: inst.heroIdx, fromZoneSlot: inst.zoneSlot,
          _skipReactionCheck: true,
        });
      }

      // Deleted abilities go to the Deleted pile (matches engine convention
      // for "delete" vs "discard").
      const deleteAbility = (inst) => {
        const ps = gs.players[inst.owner];
        if (!ps) return;
        const slotArr = ps.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot];
        if (Array.isArray(slotArr)) {
          const nameIdx = slotArr.indexOf(inst.name);
          if (nameIdx >= 0) slotArr.splice(nameIdx, 1);
        }
        if (!ps.deletedPile) ps.deletedPile = [];
        ps.deletedPile.push(inst.name);
        inst.zone = 'deleted';
        engine.log('ability_deleted', {
          player: ps.username, ability: inst.name,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
          by: 'Rain of Death',
        });
      };
      for (const inst of myRemovable)  deleteAbility(inst);
      for (const inst of oppRemovable) deleteAbility(inst);

      engine.sync();
      await engine._delay(300);

      // ── Pollution Tokens: 1 per OPPONENT ability removed ──
      // spellPlayCondition guarantees we have enough free zones.
      let placed = 0;
      if (oppRemovable.length > 0) {
        const result = await placePollutionTokens(engine, pi, oppRemovable.length, 'Rain of Death', {
          promptCtx: ctx,
        });
        placed = result.placed;
      }

      engine.log('rain_of_death', {
        player: gs.players[pi].username,
        myRemoved: myRemovable.length,
        oppRemoved: oppRemovable.length,
        tokensPlaced: placed,
      });

      engine.sync();
    },
  },
};
