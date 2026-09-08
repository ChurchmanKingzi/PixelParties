// ═══════════════════════════════════════════
//  CARD EFFECT: "Cavalry"
//  Creature (Summoning Magic Lv1, Normal, 150 HP)
//
//  „You may once per turn choose a Hero your opponent controls and
//   deal 50 damage to it and all Creatures in its Support Zones."
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · Aktiver Effekt ohne Aktionskosten (`creatureEffect`), soft once
//    per turn — die Engine stempelt `creature-effect:<id>`. Abbruch
//    vor der Zielwahl kostet nichts (`return false`).
//  · Zielwahl NUR ueber Helden des Gegners (`promptDamageTarget`,
//    side 'enemy', types ['hero']) — damit greifen Untargetable, Diver
//    Helmet, Truth-Seeing-Eye-Ausnahmen, Post-Target-Reaktionen usw.
//    generisch. Wird der Treffer umgelenkt (Reaktion liefert eine
//    Kreatur statt des Helden), trifft Cavalry NUR das umgelenkte
//    Ziel — der Sturm galt dem Helden, ohne Helden keine Zonen.
//  · Der Flaechenteil laeuft ueber `ctx.aoeHit` mit Held- und
//    Kreaturenfilter auf die gewaehlte Spalte: Held zuerst, dann
//    seine Kreaturen; verdeckte Surprises sind immun (aoeHit-Regel),
//    Damage-Type 'creature', Quelle Cavalry — Schadensmodifikatoren
//    und Tod laufen ueber die normalen Kanaele.
//  · Auftritt: `cavalry_charge` (v604, eigene Klasse, Klang
//    `attack_ram`) ZWEIMAL gleichzeitig (Als Wunsch, v605/v606): auf der
//    Heldenkarte und quer ueber alle seine Support Zones
//    (zoneType 'supportRow' — der Client vereinigt die Zonenrechtecke,
//    Insel-Zonen von Flying Island in the Sky inklusive, und laesst die
//    Reiter entsprechend laenger galoppieren). Die Zonen-Instanz
//    bekommt 1400 ms Lebenszeit fuer breite Reihen.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cavalry';
const DAMAGE = 50;
const ANIM_CHARGE = 'cavalry_charge';

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const oppIdx = ctx.cardOwner === 0 ? 1 : 0;
    return (ctx._engine.gs.players[oppIdx]?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  async onCreatureEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    const target = await ctx.promptDamageTarget({
      side: 'enemy',
      types: ['hero'],
      damageType: 'creature',
      baseDamage: DAMAGE,
      title: CARD_NAME,
      description: `Choose a Hero your opponent controls — the cavalry deals ${DAMAGE} damage to it and every Creature in its Support Zones.`,
      confirmLabel: `🐎 Charge! (${DAMAGE})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const source = { name: CARD_NAME, owner: pi, heroIdx };

    // Umgelenkt auf eine Kreatur: nur dieses Ziel.
    if (target.type !== 'hero') {
      engine._broadcastEvent('play_zone_animation', {
        type: ANIM_CHARGE, owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
      });
      await engine._delay(350);
      if (target.cardInstance) {
        await engine.actionDealCreatureDamage(source, target.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true });
      }
      engine.log('cavalry_charge', { player: gs.players[pi]?.username, target: target.cardName, damage: DAMAGE, redirected: true });
      engine.sync();
      return true;
    }

    const tgtOwner = target.owner, tgtHeroIdx = target.heroIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_CHARGE, owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: -1,
    });
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_CHARGE, owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: -1,
      zoneType: 'supportRow', duration: 1400,
    });
    await engine._delay(350);

    const result = await ctx.aoeHit({
      side: 'enemy',
      types: ['hero', 'creature'],
      damage: DAMAGE,
      damageType: 'creature',
      sourceName: CARD_NAME,
      heroFilter: (hero, hi, tpi) => tpi === tgtOwner && hi === tgtHeroIdx,
      creatureFilter: (inst) => (inst.controller ?? inst.owner) === tgtOwner && inst.heroIdx === tgtHeroIdx,
      hitDelay: 120,
    });

    engine.log('cavalry_charge', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      creaturesHit: (result?.creatures || []).length,
      damage: DAMAGE,
    });
    engine.sync();
    return true;
  },
};
