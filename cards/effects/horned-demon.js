// ═══════════════════════════════════════════
//  CARD EFFECT: "Horned Demon"
//  Creature (Summoning Magic Lv2, Normal, 100 HP)
//
//  „At the end of each of your turns, place a Demon Counter on this
//   Creature. You may once per turn choose a target and deal 50
//   damage times the number of counters on this Creature to it."
//
//  ── Als Rulings (29.8., bindend) ──────────────────────────────
//  · „the number of counters" meint AUSSCHLIESSLICH Demon Counter —
//    andere Zaehlerarten zaehlen nicht.
//  · Der aktive Effekt ist ERST AB 1 Demon Counter aktivierbar. Ein
//    0-Schaden-„Treffer" (der Angriffs-Reiter ausloesen koennte) ist
//    damit ausgeschlossen; die Karte graut im Client aus und die CPU
//    bekommt den Zug gar nicht angeboten (`canActivateCreatureEffect`
//    ist die EINZIGE Stelle, die „darf noch" beantwortet).
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · Zaehler: `_demon-counter-shared.js` (Schluessel `demonCounter`,
//    Auftritt, Log). Rundenende NUR im eigenen Zug — `onTurnEnd`
//    feuert an jedem Zugende, deshalb der `isMyTurn`-Riegel. Vorbild
//    Bunny Bombs (das ausdruecklich BEIDE Zugenden will, hier nicht).
//  · Aktiver Effekt ohne Aktionskosten (`creatureEffect`), soft once
//    per turn — die Engine stempelt `creature-effect:<id>` selbst.
//    „a target" ohne Einschraenkung = beide Seiten, Helden wie
//    Creatures (3-Headed-Giant-Lesart). Abbruch VOR der Zielwahl
//    kostet nichts (`return false`, kein Stempel).
//  · Auftritt: `demon_fire_pillar` (v602, Als Vorgabe: orange-rote
//    FeuerSAEULE, die unter dem Ziel hervorschiesst und es einhuellt —
//    eigene Klasse, nicht die Schwarzflamme von Skeleton Demon). Mit
//    `intensity` = Zaehlerzahl (breiter, hoeher, mehr Zungen). Klang
//    `elem_fire` tiefer, ZONE_ANIM_SFX. Der Schaden kommt als
//    `'creature'`-Typ vom Demon selbst.
//
//  Allgemeine CC-Regel: ein Frozen / Stunned / Negated Horned Demon
//  feuert seine Hooks nicht und bekommt am Zugende keinen Zaehler
//  (runHooks-Filter, wie bei Bunny Bombs). An Al gemeldet.
// ═══════════════════════════════════════════

const { demonCountersOn, placeDemonCounters } = require('./_demon-counter-shared');

const CARD_NAME = 'Horned Demon';
const DAMAGE_PER_COUNTER = 50;
const ANIM_STRIKE = 'demon_fire_pillar';

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  /** Als Ruling: erst ab 1 Demon Counter aktivierbar. */
  canActivateCreatureEffect(ctx) {
    return demonCountersOn(ctx.card) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const inst    = ctx.card;
    const heroIdx = ctx.cardHeroIdx;

    const counters = demonCountersOn(inst);
    if (counters <= 0) return false;
    const damage = counters * DAMAGE_PER_COUNTER;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Choose a target and deal ${damage} damage to it (${DAMAGE_PER_COUNTER} × ${counters} Demon Counter${counters === 1 ? '' : 's'}).`,
      confirmLabel: `😈 ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const tgtOwner   = target.owner;
    const tgtHeroIdx = target.heroIdx;
    const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;

    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_STRIKE,
      owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
      intensity: counters,
    });
    // Die Saeule steht ab ~400 ms; der Schaden landet, waehrend sie
    // das Ziel einhuellt.
    await engine._delay(450);

    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0) await ctx.dealDamage(tgtHero, damage, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('horned_demon_strike', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      counters, damage,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /** Am Ende JEDES EIGENEN Zuges ein Demon Counter. */
    onTurnEnd: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      placeDemonCounters(ctx._engine, [inst], 1, CARD_NAME);
    },
  },
};
