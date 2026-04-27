// ═══════════════════════════════════════════
//  CARD EFFECT: "Unsettling Opportunist Vullary"
//  Creature (Summoning Magic Lv 0, 50 HP)
//
//  Two-mode active effect — INDEPENDENT once-
//  per-turn gates. Mode A (attach) does NOT
//  consume the engine's per-instance creatureEffect
//  HOPT (the script stamps `_skipCreatureEffectHopt`
//  on the ctx during the attach), so Mode B can
//  fire the same turn the attach lands. Mode B
//  consumes HOPT normally.
//
//    A) NOT YET ATTACHED:
//       Place a "Cute Princess Mary" from hand
//       or deck underneath this Creature.
//
//    B) MARY ATTACHED:
//       Once per turn, summon a Lv 3 or lower
//       Creature from hand onto Vullary's host
//       Hero, regardless of its level — but the
//       summoned Creature's effects are negated
//       until the start of the controller's
//       NEXT turn.
//
//  While Mary is attached:
//    • +170 HP (current and max).
//    • The bonus mode (B) becomes the active
//      effect.
//
//  The summon bypasses school/level requirements
//  via `actionPlaceCreature` (`countAsSummon:
//  false` — same Klaus pattern), so a Lv0 host
//  Hero with no Summoning Magic can still drop
//  a Lv3 Creature here. The negation is applied
//  on-place and tied to a buff with
//  `clearCountersOnExpire: ['negated', ...]`
//  scheduled for the controller's next turn-
//  start, so the engine's `_processBuffExpiry`
//  cleanly lifts the negation when the timer
//  hits.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const ATTACHABLE = 'Cute Princess Mary';
const CARD_NAME  = 'Unsettling Opportunist Vullary';
const NEGATED_BUFF = 'vullary_negated';

function freeHostSlot(ps, heroIdx) {
  const zones = ps.supportZones?.[heroIdx] || [[], [], []];
  for (let z = 0; z < 3; z++) {
    if ((zones[z] || []).length === 0) return z;
  }
  return -1;
}

function levelMaxNCreatureNames(engine, hand, maxLevel) {
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  for (const cn of (hand || [])) {
    if (seen.has(cn)) continue;
    seen.add(cn);
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if ((cd.level || 0) > maxLevel) continue;
    out.push(cn);
  }
  return out;
}

module.exports = {
  activeIn: ['support'],

  attachableHeroes: [ATTACHABLE],

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;

    if (!ctx.card.counters?.attachedHero) {
      return (ps.hand || []).includes(ATTACHABLE)
        || (ps.mainDeck || []).includes(ATTACHABLE);
    }

    // Mode B: Mary attached — summon Lv≤3 Creature with bypass.
    if (ps.summonLocked) return false;
    if (freeHostSlot(ps, ctx.cardHeroIdx) < 0) return false;
    return levelMaxNCreatureNames(engine, ps.hand, 3).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];

    // Mode A: attach Mary.
    if (!ctx.card.counters?.attachedHero) {
      const ok = await engine.actionAttachHeroToCreature(
        ctx.cardOwner, ATTACHABLE, ctx.card,
        { source: CARD_NAME },
      );
      // Don't burn the once-per-turn creatureEffect slot — Mode B
      // (Lv≤3 bypass-summon) is a SEPARATE once-per-turn gate, and
      // the player should be able to use it the same turn Mary is
      // attached.
      if (ok) ctx._skipCreatureEffectHopt = true;
      return ok;
    }

    // Mode B: bypass-summon a Lv≤3 Creature with negate-until-next-turn.
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const eligible = levelMaxNCreatureNames(engine, ps.hand, 3);
    if (eligible.length === 0) return false;

    const slot = freeHostSlot(ps, heroIdx);
    if (slot < 0) return false;

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: eligible.map(cn => ({ name: cn, source: 'hand' })),
      title: CARD_NAME,
      description: 'Summon a Lv 3 or lower Creature regardless of its level. Its effects are negated until the start of your next turn.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;

    const chosenName = picked.cardName;
    if ((ps.hand || []).indexOf(chosenName) < 0) return false;
    // Re-verify free slot — async prompt could have shifted state.
    const slotNow = freeHostSlot(ps, heroIdx);
    if (slotNow < 0) return false;

    // Place — `actionPlaceCreature` bypasses level/school via the
    // placement code path. `countAsSummon: false` keeps the per-turn
    // summon tally clean (matches Klaus's place-on-Decay pattern).
    const res = await engine.actionPlaceCreature(chosenName, pi, heroIdx, slotNow, {
      source: 'hand',
      sourceName: CARD_NAME,
      countAsSummon: false,
      animationType: 'summon',
    });
    if (!res?.inst) return false;

    // Apply the negated counter and a buff that auto-clears it on the
    // controller's next turn start. The engine's `_processBuffExpiry`
    // calls `actionRemoveCreatureBuff`, which honours
    // `clearCountersOnExpire` and removes the listed counters in
    // lockstep with the buff. `negated_placement` parallels the flag
    // `actionPlaceCreature` would set under `negateEffects: true`,
    // keeping placement-style negate state consistent.
    res.inst.counters.negated = 1;
    res.inst.counters.negated_placement = 1;
    await engine.actionAddCreatureBuff(res.inst, NEGATED_BUFF, {
      expiresAtTurn: engine.gs.turn + 1,
      expiresForPlayer: pi,
      clearCountersOnExpire: ['negated', 'negated_placement'],
      source: CARD_NAME,
    });

    engine.log('vullary_summon', {
      player: ps.username, summoned: chosenName,
      bypassedLevel: true, negatedUntilTurn: engine.gs.turn + 1,
    });
    engine.sync();
    return true;
  },

  onAttachHero(engine, ctx) {
    engine.increaseMaxHp(ctx.card, 170);
  },

  cpuMeta: { alwaysCommit: true },
};
