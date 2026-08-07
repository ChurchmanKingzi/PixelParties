// ═══════════════════════════════════════════
//  CARD EFFECT: "Disgruntled Forest Warden"
//  Creature (Summoning Magic Lv1), 50 HP
//
//  "You can only summon this Creature while you control
//   at least 1 Ascended Hero. Summoning this Creature
//   counts as an additional Action. You may once per turn
//   choose a target and deal 150 damage to it."
//
//  Three clauses, three contracts:
//    • "only while you control ≥1 Ascended Hero"
//        → `canSummon(ctx)`. Checked via the card database's
//          `cardType`, not a name list, so every present and
//          future Ascended Hero counts — including a Waflav
//          form the controller ascended into this turn.
//    • "counts as an additional Action"
//        → `inherentAction: true`. The Creature summon path
//          (`doSummonCreature`) exempts inherent actions in
//          BOTH the Main and the Action Phase.
//    • "once per turn ... deal 150 damage"
//        → `creatureEffect` + `onCreatureEffect`; the engine
//          stamps the once-per-turn itself, so the card only
//          declares the effect. Free — the text names no
//          Action cost, only the once-per-turn limit.
//
//  Fragile on purpose: 50 HP means the Warden dies to almost
//  any retaliation, so the 150 is meant to be spent early.
// ═══════════════════════════════════════════

const CARD_NAME = 'Disgruntled Forest Warden';
const DAMAGE = 150;

/** Does `pi` control at least one Ascended Hero right now? */
function controlsAscendedHero(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  const cardDB = engine._getCardDB();
  return (ps.heroes || []).some(h =>
    h?.name && h.hp > 0 && cardDB[h.name]?.cardType === 'Ascended Hero');
}

module.exports = {
  activeIn: ['support'],

  // Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  requiresTarget: true,

  /** "You can only summon this Creature while you control at least 1 Ascended Hero." */
  canSummon(ctx) {
    return controlsAscendedHero(ctx._engine, ctx.cardOwner);
  },

  /** "Summoning this Creature counts as an additional Action." */
  inherentAction: true,

  // ── Active effect ──
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    // Once-per-turn is stamped generically by the engine; nothing else
    // gates the effect, so it is available whenever the Warden stands.
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const heroIdx = ctx.cardHeroIdx;

    // "choose a target" — any target, either side. Cancellable: the
    // clause opens with "You may".
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'normal',
      baseDamage: DAMAGE,
      title: CARD_NAME,
      description: `Deal ${DAMAGE} damage to a target.`,
      confirmLabel: `🪓 ${DAMAGE} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    // `critical_slash` ist ein im Client vorhandener Zonen-Animationstyp
    // (drei weitere Karten nutzen ihn). Erfundene Typnamen kommen still
    // nirgends an — der Effekt liefe dann ohne jedes visuelle Signal.
    const slot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'critical_slash', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: slot,
    });
    await engine._delay(380);

    if (target.type === 'hero') {
      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, DAMAGE, 'normal');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, DAMAGE, 'normal',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('forest_warden_strike', {
      player: gs.players[pi]?.username,
      target: target.cardName || target.name, damage: DAMAGE,
    });
    engine.sync();
    return true;
  },

  cpuMeta: {
    dealsDamage: true,
    // Der Aktiveffekt ist der ganze Wert der Karte — 50 HP halten nichts
    // auf. Die CPU soll ihn nicht aufsparen.
    cpuInstBonus: 20,
  },
};
