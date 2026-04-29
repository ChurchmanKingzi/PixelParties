// ═══════════════════════════════════════════
//  CARD EFFECT: "Reincarnation"
//  Spell (Support Magic Lv2, Normal)
//  Pollution archetype.
//
//  Place 2 Pollution Tokens into your free Support
//  Zones to use this Spell. Then choose ONE:
//
//    • Revive Hero — click one of YOUR defeated
//      Heroes to revive them at full HP. Each Hero
//      can be revived by Reincarnation AT MOST
//      ONCE per game (tracked with an individual
//      `hero.reincarnationRevived` flag; dying
//      again later does not clear it).
//
//    • Revive Creature — pick a level-4-or-lower
//      Creature from your discard pile, then pick
//      any of your free Support Zones to summon
//      it there regardless of its level (the
//      normal school/level placement gate is
//      bypassed). Requires 3+ free zones because
//      the 2 Pollution Tokens are placed too; if
//      you can't fit creature + 2 tokens, this
//      mode is unavailable.
//
//  If exactly one mode is available the spell
//  enters it automatically. If BOTH are available,
//  the player is shown a Revive-Hero / Revive-
//  Creature / Cancel picker. If NEITHER is
//  available, spellPlayCondition grays the card
//  out in hand.
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones, getFreeZones } = require('./_pollution-shared');
const { hasCardType } = require('./_hooks');

// Free-zone requirements per mode. Reincarnation always costs 2 Pollution
// Tokens, but the Creature-restore path ALSO needs a zone for the creature
// itself — so the Creature mode is gated by an extra free slot (3 total),
// while the Hero-revive path only needs the 2 cost slots.
const FREE_ZONES_FOR_REVIVE = 2;
const FREE_ZONES_FOR_RESTORE = 3;
const MAX_CREATURE_LEVEL = 4;

/** Caster's defeated heroes that Reincarnation hasn't already revived. */
function getReviveTargets(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    if (hero.hp > 0) continue;
    if (hero.reincarnationRevived) continue;
    out.push({ heroIdx: hi, hero });
  }
  return out;
}

/** Level-4-or-lower Creatures in caster's own discard pile, deduplicated. */
function getRestoreCandidates(ps, cardDB) {
  const counts = {};
  for (const name of (ps?.discardPile || [])) {
    const cd = cardDB[name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if ((cd.level || 0) > MAX_CREATURE_LEVEL) continue;
    counts[name] = (counts[name] || 0) + 1;
  }
  return counts;
}

module.exports = {
  placesPollutionTokens: true,

  // Gerrymander redirect — pick `restore` (Creature) instead of
  // `revive` (Hero). Reviving a Hero is generally far higher-impact
  // than restoring a Creature, so Gerrymander forces the smaller
  // payoff.
  cpuGerrymanderResponse(/* engine, gerryOwnerPi, promptData */) {
    return { optionId: 'restore' };
  },

  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    const freeZones = countFreeZones(gs, pi);

    const canRevive =
      freeZones >= FREE_ZONES_FOR_REVIVE &&
      getReviveTargets(gs, pi).length > 0;

    // Without an engine reference we can't introspect card levels, so fall
    // back to a permissive "there's at least something in the discard" check.
    // The full gate still runs in onPlay.
    let canRestore;
    if (engine) {
      const cardDB = engine._getCardDB();
      canRestore =
        freeZones >= FREE_ZONES_FOR_RESTORE &&
        Object.keys(getRestoreCandidates(ps, cardDB)).length > 0;
    } else {
      canRestore =
        freeZones >= FREE_ZONES_FOR_RESTORE &&
        (ps.discardPile || []).length > 0;
    }

    return canRevive || canRestore;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const cardDB = engine._getCardDB();
      const freeZones = countFreeZones(gs, pi);

      const reviveTargets  = getReviveTargets(gs, pi);
      const restoreCounts  = getRestoreCandidates(ps, cardDB);
      const restoreNames   = Object.keys(restoreCounts);

      const canRevive  = freeZones >= FREE_ZONES_FOR_REVIVE  && reviveTargets.length > 0;
      const canRestore = freeZones >= FREE_ZONES_FOR_RESTORE && restoreNames.length > 0;

      // spellPlayCondition should have blocked this already, but guard anyway.
      if (!canRevive && !canRestore) {
        gs._spellCancelled = true;
        return;
      }

      // ── Mode selection ──
      let mode;
      if (canRevive && canRestore) {
        const pick = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: 'Reincarnation',
          description: 'Place 2 Pollution Tokens, then choose how to reincarnate.',
          options: [
            { id: 'revive',  label: '👼 Revive Hero',     description: 'Bring one of your defeated Heroes back at full HP.' },
            { id: 'restore', label: '🔮 Revive Creature', description: 'Return a Lv≤4 Creature from your discard pile.' },
          ],
          cancellable: true,
          gerrymanderEligible: true, // Hero revive vs Creature restore are distinct effects.
        });
        if (!pick || pick.cancelled) { gs._spellCancelled = true; return; }
        mode = pick.optionId;
      } else if (canRevive) {
        mode = 'revive';
      } else {
        mode = 'restore';
      }

      // ═════════════════ REVIVE HERO ═════════════════
      if (mode === 'revive') {
        // Present dead heroes as clickable targets (highlighted on the board
        // via the standard potion-target-valid styling).
        const validTargets = reviveTargets.map(({ heroIdx, hero }) => ({
          id: `hero-${pi}-${heroIdx}`,
          type: 'hero',
          owner: pi,
          heroIdx,
          cardName: hero.name,
        }));

        const selectedIds = await engine.promptEffectTarget(pi, validTargets, {
          title: 'Reincarnation — Revive Hero',
          description: 'Click one of your defeated Heroes to revive them at full HP.',
          confirmLabel: '👼 Revive!',
          confirmClass: 'btn-success',
          cancellable: true,
          maxTotal: 1,
        });
        if (!selectedIds || selectedIds.length === 0) {
          gs._spellCancelled = true;
          return;
        }
        const chosen = validTargets.find(t => t.id === selectedIds[0]);
        if (!chosen) { gs._spellCancelled = true; return; }
        const targetHero = ps.heroes[chosen.heroIdx];
        if (!targetHero || targetHero.hp > 0 || targetHero.reincarnationRevived) {
          // Raced or blocked; bail without cost (commitment wasn't complete).
          gs._spellCancelled = true;
          return;
        }

        // Pay cost, then mark + revive.
        await placePollutionTokens(engine, pi, 2, 'Reincarnation', { promptCtx: ctx });
        targetHero.reincarnationRevived = true;

        engine._broadcastEvent('play_zone_animation', {
          type: 'angel_revival', owner: pi, heroIdx: chosen.heroIdx, zoneSlot: -1,
        });
        await engine._delay(900);

        const maxHp = targetHero.maxHp || cardDB[targetHero.name]?.hp || 1;
        await engine.actionReviveHero(pi, chosen.heroIdx, maxHp, { source: 'Reincarnation' });

        engine.log('reincarnation_revive', {
          player: ps.username, hero: targetHero.name, heroIdx: chosen.heroIdx,
        });
        engine.sync();
        return;
      }

      // ═════════════════ REVIVE CREATURE ═════════════════
      // Gallery of Lv≤4 Creatures in the caster's discard, deduplicated.
      const gallery = restoreNames
        .sort((a, b) => (cardDB[a]?.level || 0) - (cardDB[b]?.level || 0) || a.localeCompare(b))
        .map(name => ({ name, source: 'discard', count: restoreCounts[name], level: cardDB[name]?.level || 0 }));

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: 'Reincarnation — Revive Creature',
        description: 'Choose a level-4-or-lower Creature from your discard pile.',
        cancellable: true,
      });
      if (!picked || picked.cancelled) { gs._spellCancelled = true; return; }
      const creatureName = picked.cardName;

      // Pick placement zone BEFORE paying the Pollution cost, so the player
      // picks from their full set of free zones (matches the user-facing
      // "click any of your free Support Zones" UX). The 2 Pollution Tokens
      // are auto-placed in whatever's left afterward.
      const placementZones = getFreeZones(gs, pi);
      let destZone;
      if (placementZones.length === 0) {
        // Pre-check guaranteed 3+ zones; nothing should have consumed one
        // between the pre-check and here, but guard anyway.
        gs._spellCancelled = true;
        return;
      } else if (placementZones.length === 1) {
        destZone = placementZones[0];
      } else {
        const zonePick = await ctx.promptZonePick(placementZones, {
          title: 'Reincarnation — Placement',
          description: `Click any of your free Support Zones to summon ${creatureName}.`,
          cancellable: false,
        });
        destZone = (zonePick && placementZones.find(z => z.heroIdx === zonePick.heroIdx && z.slotIdx === zonePick.slotIdx))
                 || placementZones[0];
      }

      // Remove one copy of the chosen creature from the discard pile.
      const discardIdx = ps.discardPile.indexOf(creatureName);
      if (discardIdx >= 0) ps.discardPile.splice(discardIdx, 1);

      // Revival animation on the placement site.
      engine._broadcastEvent('play_zone_animation', {
        type: 'angel_revival', owner: pi, heroIdx: destZone.heroIdx, zoneSlot: destZone.slotIdx,
      });
      await engine._delay(700);

      // Summon with full lifecycle so ETB hooks fire; level/school gate is
      // naturally bypassed because this path doesn't go through normal play.
      await engine.summonCreatureWithHooks(creatureName, pi, destZone.heroIdx, destZone.slotIdx, {
        source: 'Reincarnation',
      });

      // Now pay the Pollution cost into the remaining free zones.
      await placePollutionTokens(engine, pi, 2, 'Reincarnation', { promptCtx: ctx });

      engine.log('reincarnation_restore', {
        player: ps.username, creature: creatureName,
        heroIdx: destZone.heroIdx, zoneSlot: destZone.slotIdx,
      });
      engine.sync();
    },
  },
};
