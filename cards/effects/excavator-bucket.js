// ═══════════════════════════════════════════
//  CARD EFFECT: "Excavator Bucket"
//  Artifact (Equipment, Cost 4 — von Al am 19.8. von 10 gesenkt)
//
//  "Equip this card to a Hero you control. You may once per turn
//   choose an Area in play and send it to the discard pile. If you
//   don't use this effect during your turn, send this card to the
//   discard pile at the end of the turn."
//
//  Mechanics
//  ─────────
//   • Aktivierbares Equipment über `equipEffect: true` +
//     `canActivateEquipEffect` + `onEquipEffect` — dasselbe Muster wie
//     `slippery-skates.js`. Die Einmal-pro-Zug-Sperre kommt von der
//     Engine (`hoptUsed['equip-effect:<instId>']`), sie muss hier
//     nicht nachgebaut werden. Aktivierbar nur in einer Main Phase des
//     eigenen Zuges — ebenfalls Engine-Seite (`getActivatableEquips`).
//   • „an Area in play" heißt BEIDE Seiten. Areas liegen in
//     `gs.areaZones[owner]`; sichtbar und damit anklickbar ist je Seite
//     nur der OBERSTE Eintrag — dieselbe Einschränkung, die `sun-beam`
//     schon dokumentiert. Angeboten wird deshalb genau der.
//   • Abgeräumt wird über `engine.removeArea` — der kanonische Weg für
//     Areas, inklusive Schutzfenster `onAreaWouldBeAffected` (Guardian
//     of Teocuilatl). `actionDestroyCard` wäre der falsche Weg.
//   • Die Selbstabwurf-Klausel: „If you don't use this effect during
//     your turn". Gemerkt wird die Benutzung als Zugnummer auf der
//     Instanz. Am Zugende prüft die Karte, ob sie in DIESEM Zug
//     benutzt wurde — und zwar nur im Zug ihres eigenen Trägers. Im
//     Zug des Gegners passiert nichts; „your turn" steht so im Text.
//   • Bewusste Auslegung: gibt es GAR KEINE Area auf dem Brett, kann
//     der Effekt nicht benutzt werden — die Karte geht am Zugende
//     trotzdem. Der Text knüpft die Schonung an die Benutzung, nicht
//     an die Möglichkeit. Wer sie halten will, braucht ein Ziel.
//   • Weggeworfen wird über `artefaktInDieAblage` aus
//     `_crusader-shared` — der bestehende Helfer für „Artefakt aus der
//     Support Zone in die Ablage", inklusive `onCardLeaveZone`,
//     Flug-Ereignis und Untracking.
//   • Kein Treibstoff-Sonderweg: dass Cybug RHINOCEROS diese Karte
//     löscht, ist Sache von RHINOCEROS.
// ═══════════════════════════════════════════

const { artefaktInDieAblage } = require('./_crusader-shared');

const CARD_NAME = 'Excavator Bucket';

/** Die sichtbaren (obersten) Areas beider Seiten als Ziele. */
function areaZiele(engine) {
  const gs = engine.gs;
  const ziele = [];
  for (let owner = 0; owner < 2; owner++) {
    const arr = gs.areaZones?.[owner] || [];
    if (arr.length === 0) continue;
    const name = arr[arr.length - 1];
    const inst = engine.cardInstances.find(c =>
      c.zone === 'area' && c.owner === owner && c.name === name);
    if (!inst) continue;
    ziele.push({
      id: `area-${owner}`, type: 'area', owner, heroIdx: -1,
      cardName: name, cardInstance: inst, _cardInstance: inst,
    });
  }
  return ziele;
}

module.exports = {
  activeIn: ['support'],
  equipEffect: true,

  /** Ohne Area auf dem Brett gibt es nichts abzuräumen. */
  canActivateEquipEffect(ctx) {
    return areaZiele(ctx._engine).length > 0;
  },

  /**
   * Eine Area wählen und in die Ablage schicken.
   * Rückgabe `false` bricht ab (die Engine nimmt die
   * Einmal-pro-Zug-Sperre dann zurück).
   */
  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    const ziele = areaZiele(engine);
    if (ziele.length === 0) return false;

    const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
      title: CARD_NAME,
      source: CARD_NAME,
      description: 'Choose an Area in play and send it to the discard pile.',
      confirmLabel: '⛏ Excavate!',
      confirmClass: 'btn-danger',
      minRequired: 1,
      maxTotal: 1,
      alwaysConfirmable: false,
      cancellable: true,
    });
    const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
    if (!id) return false;
    // Nach der Abfrage neu einsammeln — das Brett kann sich bewegt haben.
    const eintrag = areaZiele(engine).find(z => z.id === id);
    if (!eintrag?.cardInstance) return false;

    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: eintrag.owner, heroIdx: -1,
      zoneSlot: -1, zoneType: 'area',
    });
    await engine._delay(400);

    await engine.removeArea(eintrag.cardInstance, CARD_NAME);

    // Benutzt — die Selbstabwurf-Klausel greift diesen Zug nicht mehr.
    if (!inst.counters) inst.counters = {};
    inst.counters.excavatorUsedTurn = gs.turn;

    engine.log('excavator_bucket_dig', {
      player: gs.players[pi]?.username,
      area: eintrag.cardName,
      from: gs.players[eintrag.owner]?.username,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * Ungenutzt im eigenen Zug → die Karte geht selbst in die Ablage.
     */
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      // Nur im Zug des eigenen Trägers — „during your turn".
      // ★ NICHT `ctx.activePlayer` lesen: der Karten-Kontext überschreibt
      // gleichnamige Felder der Hook-Nutzlast, `ctx.activePlayer` zeigt
      // also auf `gs.activePlayer` und nicht auf das, was der Aufrufer
      // mitgegeben hat. Maßgeblich ist ohnehin `gs.activePlayer` — die
      // Zug-Ende-Hooks laufen VOR dem Spielerwechsel, dort steht also
      // noch der Spieler, dessen Zug endet.
      if (engine.gs.activePlayer !== ctx.cardOwner) return;
      if ((inst.counters?.excavatorUsedTurn ?? -1) === engine.gs.turn) return;

      engine.log('excavator_bucket_expire', {
        player: engine.gs.players[ctx.cardOwner]?.username,
        hero: ctx.attachedHero?.name,
      });
      await artefaktInDieAblage(engine, inst);
      engine.sync();
    },
  },
};
