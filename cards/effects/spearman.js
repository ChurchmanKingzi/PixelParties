'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Spearman"
//  Creature (Normal, Lv0, 50 HP, Summoning Magic)
//
//  „Once per turn, when your opponent activates one of their Creatures' active effects, you may negate that effect and deal 50 damage to that
//   Creature instead."
//
//  ── LEVEL UND WORTLAUT (Als Vorgabe 10.10.) ─────────────────────────────
//  Jetzt Lv 0 (vorher Lv 1); „once per turn effects" heißt jetzt „active effects" — jeder AKTIVE Effekt einer gegnerischen Creature, nicht nur
//  die mit eigener Rundengrenze. Datenänderung in `data/cards.json`.
//
//  ── DAS FENSTER: KETTE UM DIE AKTIVIERUNG ───────────────────────────────
//  Eine Creature, die ihren aktiven Effekt benutzt (`doActivateCreatureEffect`), öffnet eine Kette (`cardType: 'CreatureEffect'`), in die Reaktionen
//  einsteigen dürfen — dasselbe Fenster wie bei Gigantisaur Skull und Dark Deal. Der Speerkämpfer steigt als BOARD-CREATURE-REAKTION ein: neuer
//  Engine-Vertrag `isCreatureReaction` + `creatureReactionCondition(gs, pi, engine, chainCtx, inst)` (+ `payActivationCost`, `creatureReactionResolve`),
//  siehe `_promptReactionsForChain` und CARD_API.md. Der Gegner sieht keine Handkarte, nur das Angebot „Activate Spearman?" mit dem Auslöser daneben.
//  • Bedingung: die Initialkarte der Kette ist die Aktivierung einer GEGNERISCHEN Creature (`initial.owner !== pi`), die Creature steht noch auf dem
//    Brett und wird vom Gegner kontrolliert; der Speerkämpfer selbst ist aktiv (nicht Frozen/Stunned/Negated: die Engine filtert das schon beim Einsammeln)
//    und hat in diesem Zug noch nicht gestochen. Auch ein Spearman unter Dark Ocean oder in der Erstzug-Sperre bleibt stumm — das Fenster kennt beides.
//  • Pro Aktivierung sticht nur EIN Speerkämpfer (der Effekt wird nur einmal negiert; eine weitere Kopie bietet sich in derselben Kette nicht an).
//  • „Once per turn": je EXEMPLAR (`inst.counters._spearTurn`), wie jede Creature mit Rundengrenze — zwei Speerkämpfer stechen zweimal. Gestempelt wird
//    beim Aktivieren (`payActivationCost`): wird der Stich selbst negiert, ist er verbraucht.
//  • Wirkung („negate that effect and deal 50 damage to that Creature instead"): die Aktivierung wird negiert (`negateChainLink` auf das Initialglied),
//    der Server überspringt dann `onCreatureEffect`, stempelt die Rundengrenze der negierten Creature und erstattet eine verbrauchte Zusatzaktion; die
//    Creature bekommt 50 Schaden (`actionDealCreatureDamage`, Quelle: der Speerkämpfer, `canBeNegated`).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `spearman_thrust` (Pixelart, Brett-Animation mit dem Speerkämpfer als Ursprung und der angreifenden Creature als Ziel, Hülle
//  `ppSalve`; Vorlage: das Kartenbild — die Speerträger): der Speer wird zurückgezogen und schießt auf die Creature, beim Treffer (~320 ms) Kreuzblitz und
//  Funken, der Speer bleibt zitternd stecken, ein rotes Verbotszeichen pulsiert über dem Ziel. Klänge in ZONE_ANIM_SFX; Log `spearman_negate`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Spearman';
const DAMAGE = 50;
const TREFFER_MS = 420;       // bis zum Einschlag der Speerspitze (deckt sich mit `spearman_thrust` im Client: TREFFER 320 ms + 100 ms Einbau-Versatz)

module.exports = {
  activeIn: ['support'],

  // ── Engine-Vertrag: Board-Creature-Reaktion im Kettenfenster ──
  isCreatureReaction: true,

  /** Die Aktivierung einer GEGNERISCHEN Creature, die noch auf dem Brett steht und dem Gegner gehört, und dieser Speerkämpfer hat noch nicht gestochen. */
  creatureReactionCondition(gs, pi, engine, chainCtx, inst) {
    const initial = (chainCtx?.chain || []).find(l => l.isInitialCard);
    if (!initial || initial.cardType !== 'CreatureEffect' || initial.negated) return false;
    if (initial.owner === pi) return false;
    if (inst.counters?._spearTurn === gs.turn) return false;
    // Ein Effekt wird nur EINMAL negiert: steht schon ein Spearman in dieser Kette, bietet sich keine weitere Kopie an (sie würde nur ihren Stich vergeuden).
    if ((chainCtx?.chain || []).some(l => l.fromCreature && l.cardName === CARD_NAME)) return false;
    const ziel = gs._creatureEffectActivationContext?.activatingInst;
    if (!ziel || ziel.zone !== 'support') return false;
    if ((ziel.controller ?? ziel.owner) === pi) return false;
    return true;
  },

  /** Der Stich ist mit dem Aktivieren verbraucht — auch wenn er selbst negiert wird. */
  async payActivationCost(engine, pi, chainCtx, inst) {
    if (!inst.counters) inst.counters = {};
    inst.counters._spearTurn = engine.gs.turn;
    return true;
  },

  async creatureReactionResolve(engine, pi, chain, myIndex, inst) {
    const gs = engine.gs;
    const ziel = gs._creatureEffectActivationContext?.activatingInst;
    const idx = chain.findIndex(l => l.isInitialCard);
    // Zwischen Aktivieren und Auflösen kann sich etwas geändert haben (Speerkämpfer eingefroren/besiegt, Ziel weg, schon negiert).
    if (!ziel || ziel.zone !== 'support' || idx < 0 || chain[idx].negated
        || inst.zone !== 'support' || engine.isCreatureEffectSuppressed(inst)) {
      engine.log('spearman_fizzle', { player: gs.players[pi]?.username });
      return false;
    }
    // Der Speer fliegt.
    engine._broadcastEvent('play_zone_animation', {
      type: 'spearman_thrust', zoneType: 'board', owner: inst.owner, heroIdx: -1, zoneSlot: -1, duration: TREFFER_MS + 700,
      targets: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.zoneSlot, cardName: ziel.name }],
      originOwner: inst.owner, originHeroIdx: inst.heroIdx, originZoneSlot: inst.zoneSlot,
    });
    await engine._delay(TREFFER_MS);
    // „Negate that effect …"
    engine.negateChainLink(chain, idx);
    // „… and deal 50 damage to that Creature instead."
    await engine.actionDealCreatureDamage(
      { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
      ziel, DAMAGE, 'creature',
      { sourceOwner: pi, canBeNegated: true },
    );
    engine.log('spearman_negate', {
      player: gs.players[pi]?.username, target: ziel.name, targetOwner: ziel.owner, damage: DAMAGE,
    });
    engine.sync();
    return true;
  },

  cpuMeta: {
    // Der Speerkämpfer negiert JEDEN aktiven Gegnereffekt und macht obendrein Schaden — die CPU sticht, sobald das Fenster offen ist.
    reactionHeuristic: () => true,
  },

  /** CPU: das Angebot „Activate Spearman?" immer annehmen. */
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },
};
