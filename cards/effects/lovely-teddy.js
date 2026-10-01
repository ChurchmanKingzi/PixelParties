// ═══════════════════════════════════════════
//  CARD EFFECT: "Lovely Teddy"
//  Creature (Normal, Lv 1, 50 HP — Summoning Magic)
//
//  „You may once per turn choose a Creature your opponent controls. You
//   may use that Creature's active effects as if you controlled it for
//   the rest of the turn."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Aktiver Kreatureneffekt (`creatureEffect`); das „once per turn" und
//    die Ausgrauung stempelt die Engine selbst. Abbruch der Wahl gibt
//    `false` zurueck — dann ist nichts verbraucht.
//  • „as if you controlled it for the rest of the turn": derselbe Weg wie
//    „Aligning Goals" („For the rest of the turn, you may use that
//    Creature's active effect as if you controlled it"): die Kreatur
//    wechselt bis zum Zugende die Kontrolle (`actionStealCreature`,
//    faellt am Zugende zurueck). So steht jeder ihrer aktiven Effekte —
//    auch mehrere — in diesem Zug im normalen Aktivierungsmenue, mit der
//    Engine-Rundensperre je Kreatur (hat der Gegner sie schon benutzt,
//    bleibt sie gesperrt).
//  • Ziele: offene gegnerische Kreaturen MIT aktivem Effekt, die nicht
//    schon geliehen sind. Gegen Immunitaet (Cardinal Beasts) laeuft der
//    Wechsel ins Leere. Auftritt: ein expandierendes, ausblendendes Herz
//    (`heart_expand`) auf dem Ziel.
//  • Anders als bei Aligning Goals kostet das weder Gold noch gilt es als
//    zusaetzliche Aktion — der Text sagt davon nichts.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Lovely Teddy';

/** Offene gegnerische Kreaturen mit aktivem Effekt, noch nicht geliehen. */
function ziele(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  return engine.getCreatureTargets(oppIdx).filter(t => {
    const inst = t.cardInstance;
    if (!inst || inst.faceDown) return false;
    if (inst.stolenBy != null) return false;
    const script = loadCardEffect(inst.counters?._effectOverride || t.cardName);
    return !!script?.creatureEffect;
  });
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  /** Einzige Stelle fuer „darf noch": Client-Ausgrauen und CPU lesen hierueber. */
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardController ?? ctx.cardOwner;
    return ziele(engine, pi).length > 0;
  },

  cpuMeta: { dealsDamage: false },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardController ?? ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const targets = ziele(engine, pi);
    if (targets.length === 0) return false;

    const ids = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: "Choose a Creature your opponent controls. You may use its active effects as if you controlled it for the rest of the turn.",
      confirmLabel: '🧸 Borrow!',
      confirmClass: 'btn-info',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: 1 },
      maxTotal: 1,
    });
    if (!ids || ids.length === 0) return false;

    const target = targets.find(t => t.id === ids[0]);
    const inst = target?.cardInstance
      || engine.cardInstances.find(c =>
        c.owner === target?.owner && c.zone === 'support'
        && c.heroIdx === target?.heroIdx && c.zoneSlot === target?.slotIdx);
    if (!inst || inst.zone !== 'support') return false;

    const stolen = engine.actionStealCreature(pi, inst, {
      sourceName: CARD_NAME,
      skipTakeControlHook: true,
    });
    if (!stolen) {
      engine.log('lovely_teddy_fizzle', { player: ps.username, target: inst.name, reason: 'immune' });
      engine.sync();
      return true;   // der Effekt lief (die Wahl war getroffen), das Ziel ist immun
    }

    // Ein HERZ auf dem Ziel, das sich ausdehnt und dabei durchsichtig wird.
    engine._broadcastEvent('play_zone_animation', {
      type: 'heart_expand', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    await engine._delay(900);

    engine.log('lovely_teddy', {
      player: ps.username, target: inst.name,
      opponent: gs.players[target.owner]?.username,
    });
    engine.sync();
    return true;
  },
};
