// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Sword - Kunagi"
//  Artifact / Equipment (Idej) — Cost 20 (0 on Idej Lord Shoguwana)
//  (Banned)
//
//  "You can only equip this Artifact to an "Idej" Hero you control.
//   If you equip this Artifact to "Idej Lord Shoguwana", its Cost
//   becomes 0. A Hero can only be equipped with 1 "Idej Sword"
//   Artifact. When the equipped Hero defeats exactly 1 Creature with
//   an Attack, it may immediately perform that Attack again against a
//   different target your opponent controls. For every Creature the
//   equipped Hero defeats, draw 1 card."
//
//  • Cost-0-on-Shoguwana: Idej Lord Shoguwana's `equipCostReduction`.
//  • `afterSpellResolved` watches the equipped Hero's Attacks. A repeat
//    RE-RUNS THE SAME Attack card's `onPlay` (the Bomb Berserker Bartas
//    re-cast pattern) — so it replays that Attack's own animation. The
//    repeat fires automatically with no confirm pop-up; the player
//    opts out via the Attack's OWN Cancel button in its target picker.
//  • The chain loops: a repeat that itself defeats exactly 1 Creature
//    triggers the next, and so on (bounded by the opponent's Creatures).
//  • Draws happen the instant a Creature is defeated — one individual
//    draw per kill, never a batch, interleaved with the repeats.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { canEquipToIdejHero, heroHasIdejSword } = require('./_idej-shared');

const CARD_NAME = 'Idej Sword - Kunagi';
const LOOP_CAP = 30; // safety only — the chain ends when an Attack stops
                     // defeating exactly 1 Creature (opponent runs dry).

module.exports = {
  activeIn: ['support'],

  canEquipToHero(gs, pi, heroIdx, engine) {
    if (!canEquipToIdejHero(gs, pi, heroIdx, engine)) return false;
    const eng = engine || gs._engineRef;
    return eng ? !heroHasIdejSword(eng, pi, heroIdx) : true;
  },

  hooks: {
    afterSpellResolved: async (ctx) => {
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Attack') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (ctx.isSecondCast) return; // a repeat itself — don't recurse

      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs._spellNegatedByEffect) return;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const attackName = ctx.spellName;
      const attackScript = loadCardEffect(attackName);

      // Count Creatures a damage-target list defeated — a creature
      // entry with no live support-zone instance left was defeated.
      const countDefeated = (targets) => {
        let n = 0;
        for (const t of (targets || [])) {
          if (!t || (t.type !== 'creature' && t.type !== 'equip')) continue;
          const inst = t.cardInstance;
          const live = inst && engine.cardInstances.find(c =>
            c.id === inst.id && c.zone === 'support' && (c.counters?.currentHp ?? 1) > 0);
          if (!live) n++;
        }
        return n;
      };

      const heroReady = () => {
        const h = gs.players[pi]?.heroes?.[heroIdx];
        return !!h?.name && h.hp > 0
          && !h.statuses?.frozen && !h.statuses?.stunned && !h.statuses?.negated;
      };

      // "For every Creature the equipped Hero defeats, draw 1 card."
      // Each draw is its OWN trigger — drawn one at a time, the moment
      // the kills happen, never batched.
      const drawPerKill = async (n) => {
        for (let i = 0; i < n; i++) await ctx.drawCards(pi, 1);
        if (n > 0) {
          engine.log('idej_kunagi_draw', { player: gs.players[pi]?.username, drew: n });
        }
      };

      // Re-perform the SAME Attack card — re-running its `onPlay`
      // replays the Attack's own animation and opens its OWN target
      // picker (whose Cancel button is the player's opt-out).
      // `_spellExcludeTargets` forces "a different target";
      // `_bartasSecondCast` skips its cost and marks it a second cast.
      const repeatAttack = async (excludeId) => {
        const prevCancelled = gs._spellCancelled;
        gs._spellDamageLog = [];
        gs._spellExcludeTargets = excludeId ? [excludeId] : [];
        gs._bartasSecondCast = true;
        gs._spellCancelled = false;
        const tempInst = engine._trackCard(attackName, pi, 'hand', heroIdx, -1);
        try {
          await engine.runHooks('onPlay', {
            _onlyCard: tempInst, playedCard: tempInst,
            cardName: attackName, zone: 'hand', heroIdx,
            _skipReactionCheck: true,
          });
        } catch (err) {
          console.error(`[${CARD_NAME}] repeat-attack error for "${attackName}":`, err.message);
        }
        const targets = [...(gs._spellDamageLog || [])];
        engine._untrackCard(tempInst.id);
        delete gs._spellDamageLog;
        delete gs._spellExcludeTargets;
        delete gs._bartasSecondCast;
        gs._spellCancelled = prevCancelled; // don't leak the repeat's cancel
        return targets;
      };

      // The original Attack's kills — draw for them immediately.
      await drawPerKill(countDefeated(ctx.damageTargets));

      // ── Chain ── each Attack that defeats EXACTLY 1 Creature
      // repeats automatically; the repeat's kills draw the instant
      // they land, and the repeat itself can chain the next one.
      let lastTargets = ctx.damageTargets || [];
      let guard = 0;
      while (
        attackScript?.hooks?.onPlay
        && countDefeated(lastTargets) === 1
        && heroReady()
        && guard++ < LOOP_CAP
      ) {
        const repeatTargets = await repeatAttack(lastTargets[0]?.id || null);
        await drawPerKill(countDefeated(repeatTargets));
        if (repeatTargets.length > 0) {
          engine.log('idej_kunagi_repeat', {
            player: gs.players[pi]?.username, attack: attackName,
          });
        }
        lastTargets = repeatTargets; // empty (cancelled) / non-lethal ends the loop
      }

      engine.sync();
    },
  },
};
