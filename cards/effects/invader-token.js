// ═══════════════════════════════════════════
//  CARD EFFECT: "Invader Token"
//  Token Creature (50 HP). Spawned by Analyzer's
//  active, by Invader's onPlay, etc.
//
//  At the end of EACH turn, if the turn player
//  controls 0 cards with 1+ Change Counters on
//  them, that player must:
//    (a) discard 1 card OR
//    (b) take 50 damage on a target they control,
//        with the OPPONENT picking which target.
//
//  The turn player picks (a) vs (b); only (b)
//  hands target selection over to the opponent.
//
//  Listener fires on `onTurnEnd` for the turn-
//  ending player ONLY. Each Invader Token on
//  the punished side fires independently — N
//  Tokens deliver N punishments in sequence.
//  The "no Change Counters" predicate is rechecked
//  per token so a discard-resolved punishment
//  that re-populates counters self-skips later
//  tokens; damage punishments don't touch the
//  predicate so they stack as expected.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { changeCounterCardsOnSide } = require('./_cosmic-shared');

const CARD_NAME = 'Invader Token';
const DAMAGE = 50;

module.exports = {
  activeIn: ['support'],

  // Gerrymander redirect — pick `damage` for the 50-dmg punishment
  // over the 1-card discard. Damage is generally more impactful, and
  // Effect 1 also redirects the subsequent target picker (no — that's
  // promptEffectTarget, not redirected). Either way, 50 dmg lands.
  cpuGerrymanderResponse(/* engine, gerryOwnerPi, promptData */) {
    return { optionId: 'damage' };
  },

  // CPU eval declaration — Invader Token punishes the turn player
  // who controls no Change Counters at end of turn. The eval picks
  // up `endOfTurnPunisher` declarations generically (see
  // _cpu.js evaluateState). With this in place, the CPU avoids
  // ending its own turn with own Invader Tokens AND zero counters,
  // and seeks to put opp in that exact position via Analyzer-/
  // Invader-spawned Tokens.
  cpuMeta: {
    endOfTurnPunisher: {
      conditionFor: 'noChangeCounters',
      expectedDamage: DAMAGE,
    },
  },

  hooks: {
    onTurnEnd: async (ctx) => {
      // Fire ONCE PER TOKEN (no per-turn flag). With N Invader Tokens
      // on the punished side, the player suffers N independent
      // punishments — that's the intended scaling per the user spec.
      // The "no Change Counters" predicate is rechecked at each
      // listener so a discard-resolved punishment that somehow re-
      // populated counters (e.g. discarding a card that adds a counter
      // on its own discard hook) self-skips later tokens. Damage-mode
      // punishments don't change the predicate, so subsequent tokens
      // also fire and stack.
      const engine = ctx._engine;
      const gs = engine.gs;
      const turnPlayerIdx = ctx.activePlayer ?? gs.activePlayer;
      const ps = gs.players[turnPlayerIdx];
      if (!ps) return;

      // Predicate: does turn player control any card with ≥1 Change
      // Counter? If yes, no punishment.
      const hasCounters = changeCounterCardsOnSide(engine, turnPlayerIdx).length > 0;
      if (hasCounters) return;

      const oppIdx = turnPlayerIdx === 0 ? 1 : 0;

      // Step 1: turn player picks discard vs damage.
      const choices = [];
      if ((ps.hand || []).length > 0) {
        choices.push({ id: 'discard', label: 'Discard 1 card' });
      }
      // Build the list of own targets the player could absorb damage on.
      const ownTargets = ownDamageTargets(engine, turnPlayerIdx);
      if (ownTargets.length > 0) {
        choices.push({ id: 'damage', label: `Take ${DAMAGE} damage (opponent picks the target)` });
      }
      if (choices.length === 0) {
        // No hand AND no targets — both options unavailable. Fizzle.
        engine.log('invader_token_fizzle', {
          player: ps.username, reason: 'no_hand_no_targets',
        });
        return;
      }

      let mode;
      if (choices.length === 1) {
        mode = choices[0].id;
      } else {
        const pick = await engine.promptGeneric(turnPlayerIdx, {
          type: 'optionPicker',
          title: CARD_NAME,
          description: 'You control no cards with Change Counters. Choose your punishment.',
          options: choices,
          cancellable: false,
          gerrymanderEligible: true, // Discard 1 vs Take 50 dmg are distinct effects.
        });
        mode = pick?.optionId;
        if (mode !== 'discard' && mode !== 'damage') return;
      }

      if (mode === 'discard') {
        await engine.actionPromptForceDiscard(turnPlayerIdx, 1, {
          title: CARD_NAME,
          source: CARD_NAME,
          selfInflicted: true,
        });
        engine.log('invader_token_discard', { player: ps.username });
        return;
      }

      // mode === 'damage' — opp picks target.
      const targetEntries = ownTargets.map(targetToEntry);
      const picked = await engine.promptEffectTarget(oppIdx, targetEntries, {
        title: CARD_NAME,
        description: `Choose a target your opponent (${ps.username}) controls to take ${DAMAGE} damage.`,
        confirmLabel: `💥 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
        exclusiveTypes: false,
        maxPerType: { hero: 1, equip: 1 },
      });
      if (!picked || picked.length === 0) return;
      const tgt = ownTargets.find(t => targetToEntry(t).id === picked[0]);
      if (!tgt) return;

      const source = { name: CARD_NAME, owner: oppIdx, heroIdx: -1 };
      engine._broadcastEvent('play_zone_animation', {
        type: 'cosmic_invader_strike',
        owner: turnPlayerIdx,
        heroIdx: tgt.kind === 'hero' ? tgt.heroIdx : tgt.heroIdx,
        zoneSlot: tgt.kind === 'hero' ? -1 : tgt.slotIdx,
      });
      await engine._delay(380);

      if (tgt.kind === 'hero') {
        const h = gs.players[turnPlayerIdx]?.heroes?.[tgt.heroIdx];
        if (h && h.hp > 0) {
          await engine.actionDealDamage(source, h, DAMAGE, 'creature');
        }
      } else {
        await engine.actionDealCreatureDamage(
          source, tgt.ref, DAMAGE, 'creature',
          { sourceOwner: oppIdx, canBeNegated: true },
        );
      }

      engine.log('invader_token_damage', {
        player: ps.username, target: tgt.ref?.name, damage: DAMAGE,
      });
    },
  },
};

// Own-side damage targets for Invader Token's damage mode.
function ownDamageTargets(engine, pi) {
  const out = [];
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return out;

  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    out.push({ kind: 'hero', owner: pi, heroIdx: hi, ref: h });
  }
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (inst.owner !== pi) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push({
      kind: 'creature', owner: pi, heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot, ref: inst,
    });
  }
  return out;
}

function targetToEntry(t) {
  if (t.kind === 'hero') {
    return { id: `hero-${t.owner}-${t.heroIdx}`, type: 'hero', owner: t.owner, heroIdx: t.heroIdx, cardName: t.ref?.name };
  }
  return {
    id: `equip-${t.owner}-${t.heroIdx}-${t.slotIdx}`, type: 'equip',
    owner: t.owner, heroIdx: t.heroIdx, slotIdx: t.slotIdx,
    cardName: t.ref?.name, cardInstance: t.ref,
  };
}
