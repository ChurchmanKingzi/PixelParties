// ═══════════════════════════════════════════
//  CARD EFFECT: "Minocrete War Counselor"
//  Creature (Summoning Magic Lv2, Normal) — 100 HP
//
//  EFFECT:
//   "You can only control 1 \"Minocrete War
//    Counselor\".
//    Any damage your other \"War Counselor\"
//    Creatures deal is doubled. You may once per turn
//    choose a target and deal damage to it equal to
//    the amount of damage it already took this turn."
//
//  ── ① Der Verdoppler ──
//  Gilt fuer die ANDEREN Ratgeber, nicht fuer
//  Minocrete selbst — sein eigener Schuss unten wird
//  also nicht verdoppelt. Da jeder Ratgeber auf ein
//  Exemplar begrenzt ist, genuegt der Namensvergleich,
//  um "andere" zu erkennen.
//
//  Zwei Hooks, weil Helden- und Kreaturenschaden
//  verschiedene Wege nehmen (`beforeDamage` bzw.
//  `beforeCreatureDamageBatch`) — dasselbe Paar wie
//  bei Goffs Burn-Verdoppler, an dem ich mich hier
//  orientiert habe.
//
//  ── ② Der Nachschlag ──
//  Schaden in Hoehe dessen, was das Ziel in DIESEM Zug
//  schon genommen hat. Die Engine merkte sich bislang
//  nur den ZUG des letzten Treffers, nicht die Summe —
//  dafuer gibt es jetzt `engine.damageTakenThisTurn()`
//  (siehe `_noteDamageTaken` in _engine.js). Der
//  Zaehler laeuft in der Engine und nicht in dieser
//  Karte, damit auch Schaden mitzaehlt, der VOR
//  Minocretes Erscheinen gefallen ist.
//
//  Ein unversehrtes Ziel bringt 0 — dann ist die
//  Aktivierung gesperrt, statt die Rundennutzung
//  wirkungslos zu verbrennen.
// ═══════════════════════════════════════════

const {
  WC,
  isWarCounselorCreatureName,
  makeSingletonCanSummon,
} = require('./_war-counselor-shared');

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Minocrete War Counselor';

/**
 * Verdoppeln, aber die Obergrenze der QUELLE achten. Karten, deren Text
 * "cannot exceed N" sagt, exportieren `damageCap` — dann darf auch die
 * Verdopplung nicht darueber (Als Ruling 8.8.: Harpthenean bleibt selbst
 * verdoppelt bei hoechstens 300).
 */
function doubledWithCap(engine, source, amount) {
  const doubled = amount * 2;
  const cap = loadCardEffect(source?.name)?.damageCap;
  return (typeof cap === 'number') ? Math.min(doubled, cap) : doubled;
}

/** Stammt dieser Schaden von einem ANDEREN Ratgeber unter meiner Kontrolle? */
function fromOtherCounselor(engine, source, pi) {
  if (!source?.name) return false;
  if (source.name === CARD_NAME) return false;                 // "other"
  const srcOwner = source.owner ?? source.controller ?? -1;
  if (srcOwner !== pi) return false;
  return isWarCounselorCreatureName(engine, source.name);
}

/** Traeger der Schadensmarker: Held selbst, Kreatur ihr counters-Objekt. */
function damageBagFor(engine, target) {
  if (!target) return null;
  if (target.hp !== undefined && target.counters === undefined) return target;   // Held
  return target.counters || null;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: makeSingletonCanSummon(CARD_NAME),

  canActivateCreatureEffect(ctx) {
    // Mindestens ein Ziel, das diesen Zug schon Schaden genommen hat.
    const engine = ctx._engine;
    const gs = engine.gs;
    for (const p of gs.players) {
      for (const hero of (p.heroes || [])) {
        if (hero?.name && hero.hp > 0 && engine.damageTakenThisTurn(hero) > 0) return true;
      }
    }
    for (const inst of (engine.cardInstances || [])) {
      if (inst?.zone === 'support' && engine.damageTakenThisTurn(inst.counters) > 0) return true;
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      title: CARD_NAME,
      description: 'Deal damage equal to what the target has already taken this turn.',
      confirmLabel: '🪓 Repeat the blow!',
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    let bag = null;
    let hero = null;
    if (target.type === 'hero') {
      hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      bag = hero;
    } else {
      bag = target.cardInstance?.counters || null;
    }
    const damage = engine.damageTakenThisTurn(bag);
    if (!(damage > 0)) {
      engine.log('minocrete_no_wound', {
        player: gs.players[pi]?.username, target: target.cardName,
      });
      return false;                                  // nichts zu wiederholen
    }

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      // Grosse doppelseitige Streitaxt, die das Ziel spaltet (Als Vorgabe).
      type: 'battle_axe_cleave',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(450);

    if (target.type === 'hero') {
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, damage, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('minocrete_repeat', {
      player: gs.players[pi]?.username, target: target.cardName, damage,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /** Heldenschaden anderer Ratgeber verdoppeln. */
    beforeDamage: (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (!(ctx.amount > 0)) return;
      if (!fromOtherCounselor(ctx._engine, ctx.source, ctx.cardOwner)) return;
      // Nicht stapeln: eine zweite Minocrete (Kopie, Mimik) verdoppelt
      // denselben Schaden nicht noch einmal.
      if (ctx._minocreteDoubled) return;
      ctx._minocreteDoubled = true;
      const doubled = doubledWithCap(ctx._engine, ctx.source, ctx.amount);
      ctx.setAmount(doubled);
      ctx._engine.log('minocrete_doubled', {
        source: ctx.source?.name, target: ctx.target?.name, newAmount: doubled,
      });
    },

    /** Kreaturenschaden anderer Ratgeber verdoppeln (Stapelpfad). */
    beforeCreatureDamageBatch: (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      for (const e of (ctx.entries || [])) {
        if (e.cancelled) continue;
        if (!(e.amount > 0)) continue;
        if (!fromOtherCounselor(ctx._engine, e.source, ctx.cardOwner)) continue;
        if (e._minocreteDoubled) continue;          // nicht stapeln
        e._minocreteDoubled = true;
        e.amount = doubledWithCap(ctx._engine, e.source, e.amount);
        ctx._engine.log('minocrete_doubled', {
          source: e.source?.name, target: e.inst?.name, newAmount: e.amount,
        });
      }
    },
  },
};
