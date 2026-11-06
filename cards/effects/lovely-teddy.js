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
//  • „use that Creature's ACTIVE effects as if you controlled it for the rest of
//    the turn" (Entscheidung Al: „nur actives leihen"): geliehen werden NUR die
//    AKTIVEN Effekte — die Kontrolle wechselt NICHT, passive Teile bleiben beim
//    Besitzer (ein geliehener Horned Demon bekommt am Zugende des Entleihers
//    keinen Demon Counter; stirbt er, geht er in die Ablage des Besitzers).
//    Technik wie „Spy in the Enemy's Camp" (`_spy-shared.js`): die Kreatur bekommt die
//    befristete Marke `counters._teddyLeihe = { by, turn }`; solange sie gilt (genau dieser
//    Zug), steht jeder aktive Effekt der Kreatur — auch mehrere — im normalen
//    Aktivierungsmenue des Entleihers, und nur fuer die DAUER des jeweiligen Effekts
//    gilt die Kreatur als seine (`_leiheKontrolle`: „you / your opponent / your deck"
//    meinen ihn). Die Engine-Rundensperre je Kreatur bleibt (hat der Gegner sie in
//    diesem Zug schon benutzt, bleibt sie gesperrt); kostet ein Effekt eine Aktion,
//    zahlt sie ein EIGENER Held.
//  • Ziele: offene gegnerische Kreaturen MIT aktivem Effekt, die nicht
//    schon geliehen sind. Gegen Immunitaet (Cardinal Beasts) und das
//    Schutzfenster („control", Cool Rescuer Monia …) laeuft die Leihe ins Leere.
//    Auftritt: ein expandierendes, ausblendendes Herz (`heart_expand`) auf dem Ziel.
//  • Anders als bei Aligning Goals kostet das weder Gold noch gilt es als
//    zusaetzliche Aktion — der Text sagt davon nichts.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { LEIHE } = require('./_spy-shared');

const CARD_NAME = 'Lovely Teddy';

/** Offene gegnerische Kreaturen mit aktivem Effekt, noch nicht geliehen. */
function ziele(engine, pi) {
  const oppIdx = engine.opponentOf(pi);
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

    // Vorpruefung wie bei einer Uebernahme (Immunitaet, Schutzfenster 'control' — W71b), aber OHNE Kontrollwechsel:
    // geliehen werden nur die aktiven Effekte (Entscheidung Al).
    let moeglich = !inst.counters?._heldKreatur && inst.stolenBy == null && (inst.controller ?? inst.owner) !== pi
      && !engine.isOmniImmune(inst, pi, { sourceName: CARD_NAME });
    if (moeglich) {
      moeglich = await engine.kreaturBetroffen(inst, 'control', { name: CARD_NAME, owner: pi }, { sourceOwner: pi, detail: 'steal' });
    }
    if (!moeglich) {
      engine.log('lovely_teddy_fizzle', { player: ps.username, target: inst.name, reason: 'immune' });
      engine.sync();
      return true;   // der Effekt lief (die Wahl war getroffen), das Ziel ist immun
    }
    // Befristete Marke (nur dieser Zug): der Entleiher darf die aktiven Effekte der Kreatur benutzen. Veraltete Marken
    // frueherer Zuege werden dabei mit abgeraeumt.
    for (const c of engine.cardInstances) {
      if (c.counters?.[LEIHE] && c.counters[LEIHE].turn !== gs.turn) delete c.counters[LEIHE];
    }
    if (!inst.counters) inst.counters = {};
    inst.counters[LEIHE] = { by: pi, turn: gs.turn };

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
