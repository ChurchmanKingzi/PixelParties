// ═══════════════════════════════════════════
//  CARD EFFECT: "Nieht, the Blitz Blade"
//  Hero (400 HP, 100 ATK — Adventurousness + Training)
//
//  Two on-Attack riders, both gated to "exactly
//  1 target hit" (matches every standard single-
//  target Attack — Quick Attack, Heavy Hit, etc.):
//
//  1. DRAW 1 — Whenever this Hero hits exactly 1
//     opponent-controlled target with an Attack,
//     draw 1 card. Fires every time, including on
//     the bonus Attack below (the second Attack
//     also hits 1 opp target).
//
//  2. ADDITIONAL ATTACK (once per turn) — When
//     this Hero hits exactly 1 target with an
//     Attack and doesn't defeat it, you may pick
//     a Lv1-or-lower Attack from hand and
//     immediately use it as an additional Action
//     AGAINST THE SAME TARGET. The bonus Attack
//     auto-targets the original target via the
//     engine's `gs._forcedDamageTarget` opt-in
//     (read by `promptDamageTarget`); no second
//     target-picker UI surfaces. Mirrors the
//     Victory Phoenix Cannon bonus-spell flow but
//     for Attacks. Marked `isSecondCast: true` on
//     `afterSpellResolved` so the once-per-turn
//     gate can't re-fire on the bonus itself.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Nieht, the Blitz Blade';
const HOPT_KEY = 'nieht_blitz_extra_attack';

/** Is the given target still alive after the just-resolved Attack? */
function targetSurvived(engine, target) {
  if (!target) return false;
  if (target.type === 'hero') {
    const hr = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    return !!(hr && hr.hp > 0);
  }
  const inst = target.cardInstance || engine.cardInstances.find(c =>
    c.owner === target.owner && c.zone === 'support'
    && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
  );
  return !!(inst && inst.zone === 'support' && (inst.counters?.currentHp ?? 1) > 0);
}

/** Build the list of Attack cards in hand that pass the Lv1-or-lower gate. */
function eligibleAttacks(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < (ps.hand || []).length; i++) {
    const cardName = ps.hand[i];
    if (seen.has(cardName)) continue;
    const cd = cardDB[cardName];
    if (!cd || !hasCardType(cd, 'Attack')) continue;
    // Effective level (Mana Absorbing Crystal's +1 / future hand-active
    // adjusters / per-slot offsets).
    const lvl = engine.effectiveCardLevel(cd, pi, { handIdx: i });
    if (lvl > 1) continue;
    // Spell-school gating per the Attack's printed schools — caster-
    // aware so a Demon's-Gate-style override on the original Attack
    // doesn't accidentally over-qualify the bonus pick.
    if (cd.spellSchool1
        && engine.effectiveSchoolLevelForCaster(cd.spellSchool1, pi, heroIdx) < lvl) continue;
    if (cd.spellSchool2
        && engine.effectiveSchoolLevelForCaster(cd.spellSchool2, pi, heroIdx) < lvl) continue;
    seen.add(cardName);
    out.push({ name: cardName, source: 'hand' });
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];

      // Only react to Attacks cast BY this Hero.
      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;
      const cardData = ctx.spellCardData;
      if (!cardData || !hasCardType(cardData, 'Attack')) return;

      // Don't react to a fully-negated Attack.
      if (gs._spellNegatedByEffect) return;

      // Exactly 1 hit target.
      const targets = ctx.damageTargets || [];
      if (targets.length !== 1) return;
      const target = targets[0];

      // Verify Nieht is still alive (he can die to retaliation /
      // recoil during his own Attack — Phoenix Tackle etc.).
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // ── Effect 1: Draw 1 on hit-exactly-1-opp-target ──
      const oppIdx = pi === 0 ? 1 : 0;
      if (target.owner === oppIdx) {
        await engine.actionDrawCards(pi, 1);
        engine.log('nieht_blitz_draw', {
          player: ps.username, hero: hero.name, target: target.cardName,
        });
      }

      // ── Effect 2: Bonus Lv1-or-lower Attack on the same target ──
      // Block on the bonus cast itself so it can't re-trigger.
      if (ctx.isSecondCast) return;
      // Once per turn.
      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return;
      // Target must have survived.
      if (!targetSurvived(engine, target)) return;
      // Nieht must still be able to act.
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const eligible = eligibleAttacks(engine, pi, heroIdx);
      if (eligible.length === 0) return;

      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Immediately perform another Attack with ${hero.name} against ${target.cardName || 'the same target'}?`,
      });
      if (!confirmed) return;

      const selected = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: eligible,
        title: CARD_NAME,
        description: `Choose a Level 1 or lower Attack to use against ${target.cardName || 'the same target'}.`,
        cancellable: true,
      });
      if (!selected || !selected.cardName) return;

      const bonusName = selected.cardName;
      const bonusScript = loadCardEffect(bonusName);
      if (!bonusScript?.hooks?.onPlay) return;

      // Re-resolve the hand index right before the splice — the
      // confirm + gallery prompts above are async and the hand may
      // have shifted (drawn cards, opp interactions during a chain).
      const handIdx = ps.hand.indexOf(bonusName);
      if (handIdx < 0) return;

      // Claim HOPT now — committing to the play, even if the bonus
      // Attack later self-cancels (target lost mid-resolve, etc.),
      // burns the once-per-turn slot.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;

      ps.hand.splice(handIdx, 1);

      // Reveal the bonus Attack to the opponent.
      const oppSid = gs.players[oppIdx]?.socketId;
      if (oppSid && engine.io) {
        engine.io.to(oppSid).emit('card_reveal', { cardName: bonusName });
      }
      await engine._delay(100);

      // Force auto-target to the same target the first Attack hit.
      // Consumed (cleared) by the bonus Attack's first
      // `promptDamageTarget` call inside its onPlay.
      gs._forcedDamageTarget = { ...target };

      // Standard "second-cast" tracking so Bartas-style listeners see
      // a fresh damage log + the isSecondCast flag.
      gs._spellDamageLog = [];
      gs._spellExcludeTargets = [];

      const bonusInst = engine._trackCard(bonusName, pi, 'hand', heroIdx, -1);
      try {
        await engine.runHooks('onPlay', {
          _onlyCard: bonusInst, playedCard: bonusInst,
          cardName: bonusName, zone: 'hand', heroIdx,
          _skipReactionCheck: true,
        });

        const bonusCardData = engine._getCardDB()[bonusName];
        const uniqueTargets = [];
        const seenIds = new Set();
        for (const t of (gs._spellDamageLog || [])) {
          if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
        }
        await engine.runHooks('afterSpellResolved', {
          spellName: bonusName, spellCardData: bonusCardData, heroIdx, casterIdx: pi,
          damageTargets: uniqueTargets, isSecondCast: true,
          _skipReactionCheck: true,
        });
      } catch (err) {
        console.error(`[Engine] Nieht bonus Attack error for "${bonusName}":`, err.message);
      }

      // Cleanup tracking.
      delete gs._spellDamageLog;
      delete gs._spellExcludeTargets;
      // Defensive: clear forced-target in case the bonus Attack
      // never called `promptDamageTarget` (it should — but a future
      // off-path Attack that builds its own picker shouldn't leak
      // the flag into the next unrelated play).
      delete gs._forcedDamageTarget;

      engine._untrackCard(bonusInst.id);
      ps.discardPile.push(bonusName);

      engine.log('nieht_blitz_extra_attack', {
        player: ps.username, hero: hero.name,
        attack: bonusName, target: target.cardName,
      });
      engine.sync();
    },
  },
};
