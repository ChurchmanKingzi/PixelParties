// ═══════════════════════════════════════════
//  CARD EFFECT: "Jump in the River"
//  Attack (Fighting Lv2, Reaction)
//
//  Cannot be played proactively (spellPlayCondition
//  always returns false). Activates ONLY via its
//  onTurnStart hook — fires at the START of the
//  OPPONENT's turn.
//
//  NOTE: Does NOT use isReaction — that flag hooks
//  into the chain-reaction system which is wrong
//  for this card. Instead it uses hooks + activeIn.
//
//  Prompt cascade:
//  1. Check eligible heroes FIRST (skip if none)
//  2. "Evade danger this turn?" — Yes/No
//  3. If Yes → select an eligible Hero
//  4. Hero receives "Submerged" buff
//  5. Card consumed from hand → discard
//  6. If another copy in hand AND another
//     eligible Hero → go back to step 1
//
//  Submerged buff:
//  - Immune to ALL damage and status effects
//    while the owner has other alive non-
//    submerged Heroes (generic engine handler).
//  - Expires at start of owner's next turn.
//
//  Per-Hero cooldown:
//  A Hero cannot use this on 2 consecutive
//  opponent turns. Tracked via hero._jumpLastUsedTurn.
//
//  Animation: water splash on the submerged Hero.
// ═══════════════════════════════════════════

// ─── HELPERS ─────────────────────────────

/**
 * Check if a hero can use Jump in the River.
 * Requires: alive, not incapacitated, Fighting Lv2
 * (Performance on Fighting counts), and not on
 * per-hero cooldown.
 */
function heroCanUseJump(gs, ps, heroIdx) {
  const hero = ps.heroes[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return false;

  // Per-hero cooldown: can't use if used on the previous opponent turn.
  // Opponent turns are 2 game-turns apart (A→B→A→B…).
  if (hero._jumpLastUsedTurn != null && (gs.turn - hero._jumpLastUsedTurn) <= 2) return false;

  // Spell school check: needs Fighting Lv2 (Performance on Fighting counts)
  const abZones = ps.abilityZones[heroIdx] || [];
  let fightingCount = 0;
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    const baseAbility = slot[0];
    for (const abName of slot) {
      if (abName === 'Fighting') fightingCount++;
      else if (abName === 'Performance' && baseAbility === 'Fighting') fightingCount++;
    }
  }
  return fightingCount >= 2;
}

/**
 * Run the full prompt cascade for Jump in the River.
 * Handles multiple copies across multiple eligible heroes.
 */
async function doJumpCascade(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const usedThisCascade = new Set(); // Heroes already submerged this cascade

  while (true) {
    // ── Check: eligible heroes exist? ──
    const eligible = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (usedThisCascade.has(hi)) continue;
      if (heroCanUseJump(gs, ps, hi)) eligible.push(hi);
    }
    if (eligible.length === 0) break;

    // ── Check: a Jump copy exists in hand? ──
    if (!ps.hand.includes('Jump in the River')) break;

    // ── Prompt: "Evade danger this turn?" ──
    const wantsJump = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: 'Jump in the River',
      message: 'Evade danger this turn?',
      confirmLabel: '🌊 Yes!',
      cancelLabel: 'No',
      cancellable: true,
    });

    if (!wantsJump) break; // Player declined — stop entire cascade

    // ── Select Hero ──
    let selectedHeroIdx;
    if (eligible.length === 1) {
      selectedHeroIdx = eligible[0]; // Auto-select only option
    } else {
      const heroTargets = eligible.map(hi => ({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: ps.heroes[hi].name,
      }));

      const picked = await engine.promptEffectTarget(pi, heroTargets, {
        title: 'Jump in the River',
        description: 'Select a Hero to submerge.',
        confirmLabel: '🌊 Dive!',
        confirmClass: 'btn-info',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
        greenSelect: true,
      });

      if (!picked || picked.length === 0) break; // Cancelled — stop cascade
      const target = heroTargets.find(t => t.id === picked[0]);
      if (!target) break;
      selectedHeroIdx = target.heroIdx;
    }

    const hero = ps.heroes[selectedHeroIdx];
    if (!hero?.name) break;

    // ── Remove one copy from hand (committed) ──
    const removeIdx = ps.hand.indexOf('Jump in the River');
    if (removeIdx < 0) break;
    ps.hand.splice(removeIdx, 1);

    // Untrack the consumed card instance
    const inst = engine.cardInstances.find(c =>
      c.owner === pi && c.zone === 'hand' && c.name === 'Jump in the River'
    );
    if (inst) engine._untrackCard(inst.id);

    // Reveal card to opponent + spectators
    const oppIdx = pi === 0 ? 1 : 0;
    const oppSid = gs.players[oppIdx]?.socketId;
    if (oppSid) engine.io.to(oppSid).emit('card_reveal', { cardName: 'Jump in the River' });
    if (engine.room.spectators) {
      for (const spec of engine.room.spectators) {
        if (spec.socketId) engine.io.to(spec.socketId).emit('card_reveal', { cardName: 'Jump in the River' });
      }
    }
    await engine._delay(100);

    // ── Execute with reaction window (opponents can chain) ──
    const heroIdxCapture = selectedHeroIdx; // Capture for closure
    const chainResult = await engine.executeCardWithChain({
      cardName: 'Jump in the River',
      owner: pi,
      cardType: 'Attack',
      goldCost: 0,
      resolve: async () => {
        // Play water splash animation
        engine._broadcastEvent('play_zone_animation', {
          type: 'water_splash', owner: pi, heroIdx: heroIdxCapture, zoneSlot: -1,
        });
        await engine._delay(800);

        // Apply Submerged buff — expires at start of owner's next turn
        await engine.actionAddBuff(hero, pi, heroIdxCapture, 'submerged', {
          source: 'Jump in the River',
          expiresAtTurn: gs.turn + 1,
          expiresForPlayer: pi,
        });
        return { success: true };
      },
    });

    // Card always goes to discard (whether negated or not)
    ps.discardPile.push('Jump in the River');

    if (chainResult.negated) {
      engine.log('jump_negated', { player: ps.username, hero: hero.name });
    } else {
      // Only record cooldown + mark used if NOT negated
      hero._jumpLastUsedTurn = gs.turn;
      usedThisCascade.add(selectedHeroIdx);
      engine.log('jump_in_river', { player: ps.username, hero: hero.name });
    }
    engine.sync();

    // Loop continues → checks for more copies + eligible heroes
  }
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  // Fire hooks ONLY from hand zone
  activeIn: ['hand'],

  // NOTE: deliberately NO isReaction flag!
  // isReaction hooks into the chain-reaction system and would cause
  // this card to be prompted after every game event. This card uses
  // its own onTurnStart hook instead.

  // hooks is sufficient for the loader validation check.

  /**
   * Prevent normal play — this card can only be activated
   * via its onTurnStart reaction trigger, never played from hand.
   */
  spellPlayCondition() {
    return false;
  },

  hooks: {
    /**
     * At the start of each turn, check if it's the opponent's turn.
     * If so, run the Jump in the River prompt cascade.
     * Deduplication ensures only ONE card instance triggers per turn.
     */
    onTurnStart: async (ctx) => {
      // Only trigger on the OPPONENT's turn
      if (ctx.isMyTurn) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      // Deduplication: only the first Jump instance fires per turn
      if (gs._jumpPromptDone === gs.turn) return;
      gs._jumpPromptDone = gs.turn;

      // Pre-check: any eligible heroes at all?
      const ps = gs.players[pi];
      let anyEligible = false;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (heroCanUseJump(gs, ps, hi)) { anyEligible = true; break; }
      }
      if (!anyEligible) return; // No eligible heroes — skip silently

      await doJumpCascade(engine, pi);
    },
  },
};
