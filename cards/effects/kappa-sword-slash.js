// ═══════════════════════════════════════════
//  CARD EFFECT: "Kappa Sword Slash"
//  Attack (Fighting Lv5, Normal)
//  Archetype: Rebelliokai
//
//  Effect:
//    This Attack's level in your hand is reduced
//    by the number of different "Rebelliokai"
//    Creatures in your discard pile. Delete 1
//    "Rebelliokai Camouflaged Kappa" from your
//    discard pile to play this card. Choose a
//    target and deal 300 damage to it. Then, you
//    may remove any number of Areas from the
//    board.
//
//  House clarifications (per user spec):
//    • Cost (delete Camouflaged Kappa) is paid
//      AFTER the player picks the damage target,
//      BEFORE the 300 damage is dealt. The chain-
//      reaction window remains the cancellation
//      point — if the Attack is negated mid-chain,
//      onPlay never fires and the cost is NOT
//      paid.
//
//  Wiring:
//    • `reduceCardLevel(cardData, engine, ownerIdx)`
//      is the engine-side level-reduction hook the
//      heroMeetsLevelReq path queries when
//      computing whether a Hero can play this
//      Attack. The engine walks all instances
//      `controller === ownerIdx`, sums their
//      reductions, subtracts from the raw level.
//      With `activeIn: ['hand']`, the reducer only
//      contributes while Kappa Sword Slash is
//      sitting in the player's hand — exactly
//      the card-text condition.
//    • `spellPlayCondition` enforces "Camouflaged
//      Kappa in discard" — if absent, the card
//      greys out in hand.
//    • The cost lives inside `onPlay`, paid via
//      `payRebelliokaiCost` AFTER the target is
//      locked in. Once the player confirms the
//      target, the Kappa is deleted (with the
//      canonical discard→deleted flight) and the
//      300 damage resolves.
//    • Effect: prompt a damage target, pay cost,
//      deal 300, then optional any-number Area
//      removal (multi-pick across both players'
//      Area Zones, removed via the canonical
//      `engine.removeArea` helper which fires
//      onCardLeaveZone).
// ═══════════════════════════════════════════

const {
  countDifferentRebelliokaiInDiscard,
  payRebelliokaiCost,
} = require('./_rebelliokai-shared');

const CARD_NAME    = 'Kappa Sword Slash';
const COST_NAME    = 'Rebelliokai Camouflaged Kappa';
const SLASH_DMG    = 300;

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  // Listen while in hand so `reduceCardLevel` contributes to
  // heroMeetsLevelReq's level computation. Without this `activeIn`,
  // the engine's instance walk would still consider the inst, but
  // restricting to 'hand' makes the rule symmetric with the card
  // text ("Attack's level IN YOUR HAND is reduced by …").
  activeIn: ['hand'],

  /**
   * Engine-queried hook (see `_applyCardLevelReductions`) — return how
   * many levels to subtract from `cardData`. Only reduces the level of
   * Kappa Sword Slash itself (its OWN level — checking by name keeps
   * other Attacks unaffected even if they happen to be in hand at the
   * same time as this card).
   *
   * The reduction equals the count of differently-named Rebelliokai
   * Creatures in the OWNER's discard pile (per the rule). Capped at
   * the raw level by `_applyCardLevelReductions` itself (`Math.max(0,
   * rawLevel - total)`), so we don't need to clamp here.
   */
  reduceCardLevel(cardData, engine, ownerIdx) {
    if (cardData?.name !== CARD_NAME) return 0;
    const ps = engine.gs.players[ownerIdx];
    if (!ps) return 0;
    return countDifferentRebelliokaiInDiscard(ps, engine);
  },

  spellPlayCondition(gs, pi /*, engine */) {
    const ps = gs.players[pi];
    return (ps?.discardPile || []).indexOf(COST_NAME) >= 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // ── Step 1: damage target (commitment point) ──
      // Cancellable — if the player backs out here, the cost has not
      // yet been paid and Camouflaged Kappa stays in discard.
      const target = await ctx.promptDamageTarget({
        side:        'any',
        types:       ['hero', 'creature'],
        damageType:  'attack',
        baseDamage:  SLASH_DMG,
        title:       CARD_NAME,
        description: `Deal ${SLASH_DMG} damage to a target.`,
        confirmLabel: `⚔️ Slash! (${SLASH_DMG})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) {
        gs._spellCancelled = true;
        return;
      }

      // ── Step 2: pay the cost ──
      // Re-check the cost is still in discard (defensive — a parallel
      // reaction during the prompt could have shifted the pile). If
      // missing, the Attack still resolves but no cost was paid.
      if ((ps.discardPile || []).indexOf(COST_NAME) >= 0) {
        await payRebelliokaiCost(engine, pi, COST_NAME, { source: CARD_NAME });
      }

      // Slash animation on the target.
      engine._broadcastEvent('play_zone_animation', {
        type:     'critical_slash',
        owner:    target.owner,
        heroIdx:  target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : (target.slotIdx ?? -1),
      });
      await engine._delay(380);

      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) {
          await ctx.dealDamage(hero, SLASH_DMG, 'attack');
        }
      } else if (target.cardInstance) {
        const inst = engine.cardInstances.find(c => c.id === target.cardInstance.id);
        if (inst && inst.zone === 'support') {
          await engine.actionDealCreatureDamage(
            { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
            inst, SLASH_DMG, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      // ── Step 3: optional Area removal ──
      // Areas are bound to per-player zones with the canonical
      // `[data-area-zone][data-area-owner=...]` selector. Each player
      // has at most one VISIBLE area at a time (top of areaZones[pi]),
      // so the target list is at most 2 entries (one per side). Use
      // `type: 'area'` to match The Yeeting's targeting shape — the
      // click handlers wire that to the area-zone selector.
      const areaTargets = [];
      for (let aoi = 0; aoi < 2; aoi++) {
        const arr = gs.areaZones?.[aoi] || [];
        if (arr.length === 0) continue;
        const topName = arr[arr.length - 1];
        const inst = engine.cardInstances.find(c =>
          c.owner === aoi && c.zone === 'area' && c.name === topName,
        );
        if (!inst) continue;
        areaTargets.push({
          id:       `area-${aoi}`,
          type:     'area',
          owner:    aoi,
          heroIdx:  -1,
          cardName: topName,
          _cardInstance: inst,
        });
      }

      if (areaTargets.length > 0) {
        const picked = await engine.promptEffectTarget(pi, areaTargets, {
          title:        `${CARD_NAME} — Area Removal`,
          description:  'You may remove any number of Areas from the board.',
          confirmLabel: '🌪️ Remove!',
          confirmClass: 'btn-info',
          cancellable:  true,
          alwaysConfirmable: true, // 0 picks = skip step
          exclusiveTypes: false,    // both Areas (mine + opp) selectable in one pass
          maxPerType:   { area: areaTargets.length },
          maxTotal:     areaTargets.length,
          minRequired:  0,
        });

        if (picked && picked.length > 0) {
          for (const id of picked) {
            const t = areaTargets.find(a => a.id === id);
            if (!t) continue;
            // Re-validate the tracked inst is still in the area zone —
            // a prior removal in this same loop could have shifted
            // pile state if a stacked Area surfaced between picks.
            const cur = engine.cardInstances.find(c =>
              c.id === t._cardInstance?.id && c.zone === 'area',
            );
            if (!cur) continue;

            // Slash VFX on the Area zone before the removal lands —
            // matches the per-target slash on the damage step.
            // `zoneType: 'area'` routes the animation selector to
            // `[data-area-zone][data-area-owner=...]` (see app-board's
            // onZoneAnim switch).
            engine._broadcastEvent('play_zone_animation', {
              type:     'critical_slash',
              owner:    t.owner,
              heroIdx:  -1,
              zoneSlot: -1,
              zoneType: 'area',
            });
            await engine._delay(380);

            await engine.removeArea(cur, CARD_NAME);
          }
        }
      }

      engine.log('kappa_sword_slash', {
        player: ps.username,
        target: target.cardName || `hero-${target.heroIdx}`,
        damage: SLASH_DMG,
      });
      engine.sync();
    },
  },
};
