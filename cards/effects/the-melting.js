
// ═══════════════════════════════════════════
//  CARD EFFECT: "The Melting"
//  Spell (Reaction, Support Magic Lv1)
//
//  „Play this card immediately when one or more targets are Frozen. Heal all Frozen targets on the board from their Freeze. If the
//   user has at least Destruction Magic 1 and the Freeze effect was an opponent's effect during the opponent's turn, immediately end
//   their turn."
//
//  ── FENSTER: „one or more targets are Frozen" ───────────────────────────
//  Das generische Kettenfenster auf `onStatusApplied` (Bauform Sculpture Theft): jedes Mal, wenn ein Held oder eine Kreatur eingefroren
//  wird. Wirkt EIN Effekt auf mehrere Ziele (Iceage, Yuki-Onna, Biseria, Snowstorm Mischief, Mischief Invasion, The White Army), bündelt
//  `engine.batchStatusWindow('frozen', …)` sie zu EINEM Fenster NACH dem ganzen Effekt — „one or more targets". Wirkt ein Held des
//  Spielers nicht mehr (eingefroren, betäubt, negiert), kann er die Karte nicht spielen: ein Massen-Freeze, der alle eigenen Helden trifft,
//  lässt dieses Fenster leer — Eis auf Kreaturen allein dagegen nicht. Die Karte wird JEDEM Spieler angeboten, auch beim Eis des eigenen
//  Effekts und für fremde Ziele: der Text sagt „targets", nicht „your targets".
//
//  ── HEILEN: ALLE GEFRORENEN ZIELE AUF DEM BRETT ─────────────────────────
//  Nicht nur das gerade eingefrorene: ALLE gefrorenen Helden und Kreaturen BEIDER Seiten, über `cleanse…Statuses` (Sperren wie „status
//  effects cannot be removed" gelten). Die Brett-Animation `the_melting` zeigt das Schmelzen an jedem dieser Ziele zugleich.
//
//  ── ZUG BEENDEN: NUR BEI GEGNER-EIS IM GEGNER-ZUG ───────────────────────
//  „If the user has at least Destruction Magic 1 AND the Freeze effect was an opponent's effect during the opponent's turn" — beides
//  muss stimmen:
//    • der Nutzer (wirkender Held) hat Destruction Magic 1+ (`effectiveSchoolLevelForCaster`, „as if" zählt);
//    • mindestens ein Ziel, das dieses Fenster geöffnet hat, wurde von einem GEGNER des Nutzers eingefroren (`statusVerursacher`) UND
//      dieser Gegner ist am Zug. Ein Freeze des Nutzers selbst (auch im Zug des Gegners) oder ein Freeze im eigenen Zug zählt nicht.
//  Das Ergebnis steht beim Aktivieren fest (`onChainAdd`, am Kettenglied) — ein Gegenzug, der das Eis vorher wegheilt, ändert es nicht.
//  Der Zug des Gegners endet über den kanonischen Hebel der Engine (`gs._terrorForceEndTurn` + `_terrorForceEndSource`, wie Phoenix
//  Bombardment): der Server wartet, bis nichts mehr aufgelöst wird, und beendet dann den Zug. Blackstache und Tuscan Prisoner schützen
//  (`_blackstacheBlocksTurnEnd`).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `the_melting` (Brett-Animation `zoneType: 'board'`, Hülle `ppSalve`, Pixelart, 1,45 s; Vorlage: Flamme neben einem
//  Schneemann): an jedem gefrorenen Ziel schmilzt die Eiskruste von oben nach unten ab (Tropfkanten, Tropfen, wachsende Pfütze, Dampf), eine
//  kleine Flamme brennt daneben, zum Schluss blitzen Funkelsterne. Aufgetaut wird, wenn sie blitzen (`HEAL_MS`). Klänge in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { alleGefrorenen } = require('./_frost-shared');

const CARD_NAME = 'The Melting';
const STATUS = 'frozen';
const DAUER_MS = 1450;       // Länge der Animation (deckt sich mit `the_melting` im Client)
const HEAL_MS = 880;         // Funkelsterne bei ~760 ms der Animation (+100 ms Einbau-Versatz des Clients)
const NACH_MS = 420;         // Pfütze und Dampf noch ein Stück stehen lassen, bevor die Karte endet

const istSitz = (gs, x) => Number.isInteger(x) && x >= 0 && x < (gs.players || []).length;

/** Die Ziele, die das offene Fenster ausgelöst haben (Stapel oder Einzelfall). */
function ausloeser(fensterCtx) {
  const hc = fensterCtx || {};
  if (Array.isArray(hc.targets) && hc.targets.length) return hc.targets.map(e => e.target);
  return hc.target ? [hc.target] : [];
}

module.exports = {
  isReaction: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (chainCtx?.hookName !== 'onStatusApplied') return false;
    const hc = chainCtx.hookCtx || {};
    if ((hc.statusName || hc.status) !== STATUS) return false;
    // Eine zweite Kopie auf die erste zu ketten brächte nichts: die erste taut ohnehin ALLES Gefrorene.
    if ((chainCtx.chain || []).some(l => l.cardName === CARD_NAME)) return false;
    return alleGefrorenen(engine).length > 0;           // noch etwas da, das schmelzen kann
  },

  /**
   * CPU: nur spielen, wenn das Eis überwiegend EIGENE Ziele trifft — alles Gefrorene taut, also auch das des Gegners.
   * (Mit Destruction Magic kommt der Zugabbruch dazu; die Wertung bleibt bewusst grob.)
   */
  cpuMeta: {
    reactionHeuristic(engine) {
      const cpu = engine._cpuPlayerIdx;
      let eigene = 0, fremde = 0;
      for (const z of alleGefrorenen(engine)) {
        const seite = z.type === 'hero' ? engine.heroSideOf(z.owner, z.obj) : (z.obj.controller ?? z.obj.owner);
        if (seite === cpu) eigene++; else fremde++;
      }
      return eigene > 0 && eigene >= fremde;
    },
  },

  /**
   * Beim Aktivieren (Kettenglied steht): WER hat eingefroren, und wessen Zug ist es? Das Fenster ist hier noch offen
   * (`engine.reactionWindowEvent()`); aufgelöst wird später, wenn die Kette abgearbeitet wird.
   */
  onChainAdd: async (engine, pi, chain, link) => {
    const gs = engine.gs;
    const fenster = engine.reactionWindowEvent?.();
    link._gegnerEis = ausloeser(fenster?.hookCtx).some(t => {
      const v = engine.statusVerursacher(t, STATUS);
      return !!v && istSitz(gs, v.spieler) && v.spieler !== pi && v.spieler === gs.activePlayer;
    });
  },

  resolve: async (engine, pi, _selectedIds, _validTargets, chain, myIdx) => {
    const gs = engine.gs;
    const link = chain?.[myIdx] || {};
    const casterHeroIdx = Number.isInteger(link.casterHeroIdx) ? link.casterHeroIdx : -1;
    const casterSeite = link.casterOwner ?? pi;
    const ziele = alleGefrorenen(engine);
    const gegnerEis = link._gegnerEis === true;
    const aktiver = gs.activePlayer;
    const ps = gs.players[pi];

    if (ziele.length === 0) { engine.log('the_melting', { player: ps?.username, healed: 0, endedTurn: false }); return false; }

    // ── Schmelzen: ALLE gefrorenen Ziele zugleich ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'the_melting', zoneType: 'board', owner: casterSeite, heroIdx: -1, zoneSlot: -1, duration: DAUER_MS,
      regionAll: true, originOwner: casterSeite, originHeroIdx: Math.max(0, casterHeroIdx),
      targets: ziele.map(z => ({ owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.type === 'hero' ? -1 : z.slotIdx })),
    });
    await engine._delay(HEAL_MS);

    let aufgetaut = 0;
    for (const z of alleGefrorenen(engine)) {                       // erneut: wer jetzt noch gefroren ist
      const weg = z.type === 'hero'
        ? engine.cleanseHeroStatuses(z.obj, z.owner, z.heroIdx, [STATUS], CARD_NAME)
        : engine.cleanseCreatureStatuses(z.obj, [STATUS], CARD_NAME);
      if (weg.includes(STATUS)) aufgetaut++;
    }
    engine.sync();

    // ── „Immediately end their turn" ──
    let beendet = false, geschuetzt = false;
    const dm = casterHeroIdx >= 0 ? engine.effectiveSchoolLevelForCaster('Destruction Magic', pi, casterHeroIdx, casterSeite) : 0;
    if (gegnerEis && dm >= 1 && aktiver !== pi && !gs.result) {
      const quelle = { name: CARD_NAME, owner: pi };
      if (engine._blackstacheBlocksTurnEnd(aktiver, quelle)) {
        geschuetzt = true;
        engine.log('turn_end_blocked', { player: gs.players[aktiver]?.username, source: CARD_NAME, via: 'theMelting' });
      } else {
        gs._terrorForceEndTurn = aktiver;
        gs._terrorForceEndSource = quelle;
        beendet = true;
      }
    }
    engine.log('the_melting', { player: ps?.username, healed: aufgetaut, endedTurn: beendet, blocked: geschuetzt });
    engine.sync();
    await engine._delay(NACH_MS);
    return true;
  },
};
