// ═══════════════════════════════════════════
//  CARD EFFECT: "Fire Bolts"
//  Spell (Destruction Magic Lv1)
//
//  1. Choose an enemy target → deal 100 damage.
//  2. Choose an own target → deal 50 recoil.
//
//  ENHANCED MODE (optional):
//  Requires: casting Hero has Destruction Magic
//  at level 3 (Performance counts) AND this is
//  the first Destruction Magic spell the player
//  uses this turn.
//
//  If enhanced: recoil becomes 200, but the spell
//  does NOT consume an Action.
//
//  When played in Main Phase via its own condition
//  (no external additional action), auto-enhances
//  (no prompt — it MUST be enhanced to play there).
//
//  When played in Action Phase or via an immediate
//  action (Coffee), the player is prompted to choose.
//
//  Both damage instances are type 'destruction_spell'.
// ═══════════════════════════════════════════

// ─── HELPERS ─────────────────────────────

/**
 * Count Destruction Magic levels on a specific hero.
 * Performance copies in a DM-base zone count as DM.
 */
function countDM(gs, playerIdx, heroIdx) {
  const ps = gs.players[playerIdx];
  const abZones = ps?.abilityZones?.[heroIdx] || [];
  let count = 0;
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    const base = slot[0];
    for (const card of slot) {
      if (card === 'Destruction Magic') count++;
      else if (card === 'Performance' && base === 'Destruction Magic') count++;
    }
  }
  return count;
}

/**
 * Check if any Destruction Magic spell has already been played
 * by this player this turn by scanning the action log.
 * Checks both normal spell_played and immediate_action entries.
 * Uses the engine's card DB to verify spell school.
 */
function isFirstDMSpellThisTurn(engine, playerIdx) {
  const currentTurn = engine.gs.turn;
  const playerName = engine.gs.players[playerIdx]?.username;
  const cardDB = engine._getCardDB();
  for (const entry of engine.actionLog) {
    if (entry.turn !== currentTurn) continue;
    if (entry.type !== 'spell_played' && entry.type !== 'immediate_action') continue;
    if (entry.player !== playerName) continue;
    const cd = cardDB[entry.card];
    if (cd && (cd.spellSchool1 === 'Destruction Magic' || cd.spellSchool2 === 'Destruction Magic')) {
      return false;
    }
  }
  return true;
}

/**
 * Check if enhanced mode conditions are met.
 */
function canEnhance(gs, engine, playerIdx, heroIdx) {
  return countDM(gs, playerIdx, heroIdx) >= 3 && isFirstDMSpellThisTurn(engine, playerIdx);
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  /**
   * Dynamic inherentAction — returns true only in Main Phase
   * when the casting hero meets the DM3 + first-DM-spell condition.
   * This allows Fire Bolts to self-provide as an additional action.
   * In Action Phase, always returns false (normal action play).
   * @param {object} gs - Game state
   * @param {number} playerIdx - Player index
   * @param {number} heroIdx - Casting hero index
   * @param {object} [engine] - Engine instance (for action log scan)
   */
  inherentAction(gs, playerIdx, heroIdx, engine) {
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    if (!isMainPhase) return false;
    if (countDM(gs, playerIdx, heroIdx) < 3) return false;
    if (engine) return isFirstDMSpellThisTurn(engine, playerIdx);
    // Fallback without engine: conservative check via action log absence
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const oppIdx = pi === 0 ? 1 : 0;

      // ── Step 1: Determine enhanced mode BEFORE targeting ──
      // Must check before promptDamageTarget, which fires the pending play log
      // (isFirstDMSpellThisTurn would see Fire Bolts itself and fail)
      const enhancedAvailable = canEnhance(gs, engine, pi, heroIdx);
      let recoilDamage = 50;
      let enhanced = false;

      if (enhancedAvailable) {
        const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
        const isImmediate = !!gs._immediateActionContext;

        if (isMainPhase && !isImmediate) {
          // Main Phase self-providing play → auto-enhanced (no prompt)
          enhanced = true;
          recoilDamage = 200;
        } else {
          // Action Phase or immediate action → prompt the player
          const confirmed = await engine.promptGeneric(pi, {
            type: 'confirm',
            title: 'Fire Bolts — Enhanced Mode',
            message: 'Increase recoil damage to 200 to make Fire Bolts an additional Action?',
            confirmLabel: '🔥 200 Recoil — Free Action!',
            cancelLabel: 'No (50 Recoil)',
            cancellable: true,
            // Two distinct effect paths: 200 recoil + free action vs
            // 50 recoil + standard action. Gerrymander redirects which
            // one opp takes.
            gerrymanderEligible: true,
          });

          if (confirmed && !confirmed.cancelled) {
            enhanced = true;
            recoilDamage = 200;
          }
        }
      }

      // ── Step 2: Select enemy target and deal 100 damage ──
      const enemyTarget = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: 100,
        title: 'Fire Bolts',
        description: 'Choose an enemy target to deal 100 damage.',
        confirmLabel: '🔥 100 Damage!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!enemyTarget) return; // Cancelled or negated

      // Play fireball animation + deal damage
      if (enemyTarget.type === 'hero') {
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: enemyTarget.owner,
          heroIdx: enemyTarget.heroIdx, zoneSlot: -1,
        });
        await engine._delay(400);
        const hero = gs.players[oppIdx].heroes[enemyTarget.heroIdx];
        if (hero && hero.hp > 0) {
          await ctx.dealDamage(hero, 100, 'destruction_spell');
        }
      } else if (enemyTarget.type === 'equip') {
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: enemyTarget.owner,
          heroIdx: enemyTarget.heroIdx, zoneSlot: enemyTarget.slotIdx,
        });
        await engine._delay(400);
        const inst = enemyTarget.cardInstance || engine.cardInstances.find(c =>
          c.owner === enemyTarget.owner && c.zone === 'support' &&
          c.heroIdx === enemyTarget.heroIdx && c.zoneSlot === enemyTarget.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            { name: 'Fire Bolts', owner: pi, heroIdx },
            inst, 100, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      engine.sync();
      await engine._delay(300);

      // ── Step 3: Defer recoil to after afterSpellResolved ──
      // This ensures recoil happens AFTER Bartas's second cast (if any).
      // Second cast skips recoil entirely — only one recoil per Fire Bolts play.
      if (!gs._bartasSecondCast) {
        gs._deferredRecoil = {
          cardName: 'Fire Bolts',
          ownerIdx: pi,
          heroIdx,
          damage: recoilDamage,
          enhanced,
          damageType: 'destruction_spell',
        };
      }

      // ── Step 4: Set free action flag if enhanced ──
      if (enhanced) {
        gs._spellFreeAction = true;
      }

      engine.log('fire_bolts', {
        player: gs.players[pi].username,
        hero: gs.players[pi].heroes[heroIdx]?.name,
        enhanced,
        recoilDamage,
        enemyTarget: enemyTarget?.cardName,
      });

      engine.sync();
    },
  },
};
