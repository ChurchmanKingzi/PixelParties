// ═══════════════════════════════════════════
//  CARD EFFECT: "Gorinthian War Counsellor"
//  Creature (Summoning Magic Lv2, Normal) — 90 HP
//
//  EFFECT:
//   "You can only control 1 \"Gorinthian War
//    Counsellor\".
//    While you control at least 2 different \"War
//    Counsellor\" Creatures, you may once per turn
//    choose a target, except this Creature, and Stun
//    it for 2 turns. Any damage targets Stunned by
//    this effect would take becomes 0."
//
//  ── Die Bedingung ──
//  Mindestens ZWEI VERSCHIEDENE Ratgeber — Gorinthian
//  selbst zaehlt mit, es braucht also einen Kollegen.
//  Geprueft in `canActivateCreatureEffect`, damit der
//  Effekt gar nicht erst angeboten wird.
//
//  ── Der Schadensschutz ──
//  Der zweite Satz ist kein allgemeiner Stun-Effekt:
//  er gilt NUR fuer Ziele, die DIESER Effekt betaeubt
//  hat. Deshalb setze ich einen eigenen Merker
//  (`_gorinthianStun`) auf das Ziel und pruefe im
//  Schadenspfad gegen den Merker, nicht gegen den
//  Stun-Status. Ein Ziel, das anderweitig betaeubt
//  ist, nimmt weiterhin normal Schaden.
//
//  Der Merker haelt einen Zug-Stempel: gesetzt wird
//  "bis Zug X", passend zu den 2 Zuegen Stun. Laeuft
//  der Stun aus, ist auch der Schutz vorbei — beides
//  endet zusammen, ohne dass ich am Status-Ablauf der
//  Engine mitschreiben muss.
//
//  Umgesetzt in zwei Hooks, weil Helden- und
//  Kreaturenschaden verschiedene Wege nehmen:
//  `beforeDamage` (Helden) und
//  `beforeCreatureDamageBatch` (Kreaturen) — dasselbe
//  Paar wie bei Goffs Burn-Verdoppler.
//
//  Durchschlagender Schaden ("cannot be reduced or
//  negated") geht vor, wie ueberall.
// ═══════════════════════════════════════════

const {
  WC,
  countDistinctWarCounsellors,
  makeSingletonCanSummon,
} = require('./_war-counsellor-shared');

const CARD_NAME = 'Gorinthian War Counsellor';
const NEEDED_DISTINCT = 2;
const STUN_TURNS = 2;

/** Bis zu welchem Zug schuetzt ein jetzt gesetzter Merker? */
function shieldUntil(engine) {
  return (engine.gs.turn || 0) + STUN_TURNS;
}

/** Traegt dieses Ziel einen noch gueltigen Gorinthian-Merker? */
function isShielded(engine, bag) {
  const until = bag?._gorinthianStun;
  return typeof until === 'number' && (engine.gs.turn || 0) <= until;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: makeSingletonCanSummon(CARD_NAME),

  canActivateCreatureEffect(ctx) {
    return countDistinctWarCounsellors(ctx._engine, ctx.cardOwner) >= NEEDED_DISTINCT;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    const distinct = countDistinctWarCounsellors(engine, pi);
    if (distinct < NEEDED_DISTINCT) return false;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'status',
      dealsDamage: false,     // reiner Stun — keine Schadensreaktionen wecken
      title: CARD_NAME,
      description: `Stun a target for ${STUN_TURNS} turns. While Stunned by this effect, any damage it would take becomes 0.`,
      confirmLabel: '🌀 Stun!',
      confirmClass: 'btn-info',
      cancellable: true,
      // "except this Creature" — Gorinthian selbst ist kein Ziel.
      condition: (t) => !(t.type === 'equip' && t.cardInstance?.id === inst?.id),
    });
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      // Versteinerung — Gorinthian ist eine Medusa (Als Vorgabe).
      // Dieselbe Animation nutzt Medusa's Curse.
      type: 'petrify',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(420);

    const until = shieldUntil(engine);
    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero || !(hero.hp > 0)) return false;
      await engine.addHeroStatus(target.owner, target.heroIdx, 'stunned', {
        duration: STUN_TURNS, appliedBy: pi,
      });
      hero._gorinthianStun = until;
    } else if (target.cardInstance) {
      const applied = await engine.applyCreatureStatus(target.cardInstance, 'stunned', {
        sourceOwner: pi, duration: STUN_TURNS, source: CARD_NAME,
      });
      if (!applied) return false;
      if (!target.cardInstance.counters) target.cardInstance.counters = {};
      target.cardInstance.counters._gorinthianStun = until;
    } else {
      return false;
    }

    engine.log('gorinthian_stun', {
      player: gs.players[pi]?.username,
      target: target.cardName, turns: STUN_TURNS, until,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /** Heldenschaden: auf 0, solange der eigene Merker gilt. */
    beforeDamage: (ctx) => {
      if (!(ctx.amount > 0)) return;
      if (ctx.cannotBeReduced || ctx.cannotBeNegated) return;   // Durchschlag
      const engine = ctx._engine;
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      if (!isShielded(engine, target)) return;
      ctx.setAmount(0);
      engine._broadcastEvent('play_damage_zero', {
        owner: engine._findHeroOwner?.(target) ?? -1,
        heroIdx: (engine.gs.players[engine._findHeroOwner?.(target)]?.heroes || []).indexOf(target),
        zoneSlot: -1,
      });
      engine.log('gorinthian_nullified', { target: target.name, by: CARD_NAME });
    },

    /** Kreaturenschaden laeuft ueber den Stapel — je Eintrag pruefen. */
    beforeCreatureDamageBatch: (ctx) => {
      const engine = ctx._engine;
      for (const e of (ctx.entries || [])) {
        if (e.cancelled) continue;
        if (!(e.amount > 0)) continue;
        if (e.canBeNegated === false) continue;                 // Durchschlag
        if (!e.inst || !isShielded(engine, e.inst.counters)) continue;
        e.amount = 0;
        engine.log('gorinthian_nullified', { target: e.inst.name, by: CARD_NAME });
      }
    },
  },
};
