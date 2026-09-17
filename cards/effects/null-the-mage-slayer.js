// ═══════════════════════════════════════════
//  CARD EFFECT: „Null, the Mage Slayer"
//  Hero (450 HP, 100 ATK, Start-Abilities: Fighting + Interference)
//
//  „Negate the effects of any targets hit by this Hero's Attacks for
//   2 turns. This counts as a status effect."
//
//  BAUART
//  ──────
//  • ZWEI HAKEN, EIN VERTRAG: Helden treffen ueber `afterDamage`,
//    Kreaturen ueber `afterCreatureDamageBatch` — der Schadensweg ist
//    fuer beide getrennt, die Regel ist dieselbe. Bauform Ghuanjun.
//
//  • ★ „HIT BY THIS HERO'S ATTACKS": drei Bedingungen zusammen —
//    Schadensart `attack`, die Quelle gehoert MIR, und ihr `heroIdx`
//    ist DIESER Held. Ohne die dritte wuerde jeder Angriff meiner
//    anderen Helden mitnegieren.
//
//  • ★ GETROFFEN HEISST GETROFFEN — AUCH MIT 0 SCHADEN (Als Korrektur
//    12.9.). Ein weggedrueckter Treffer (Spectral Armor, „Interference",
//    Schild) bringt trotzdem zum Schweigen. Nur NEGIERTE oder
//    ausgewichene Angriffe (Invisibility Cloak) nicht — und die
//    erreichen diese Haken ohnehin nicht: der Schadenspfad kehrt dort
//    vor `afterDamage` zurueck, und Batch-Eintraege tragen `cancelled`.
//
//  • ★ „for 2 turns" ueber `duration: 2` — dieselbe Schreibweise wie
//    Iceages Lv-4-Frost. Sie wird angezeigt UND heruntergezaehlt. Die
//    Ablaufzug-Form (`expiresAtTurn`, Locke) ist fuer „bis Zug X"
//    gedacht und traegt keine Rundenzahl. Und weil der
//    Text es ausdruecklich sagt, laeuft es ueber die STATUS-Wege
//    (`addHeroStatus` / `actionNegateCreature`), nicht ueber einen
//    eigenen Zaehler: damit greifen Immunitaeten, „Defending the Gate"
//    und die Statusanzeige von selbst.
// ═══════════════════════════════════════════

const CARD_NAME = 'Null, the Mage Slayer';
const DAUER = 2;

/** Gehoert dieser Treffer einem Angriff DIESES Helden? */
function vonDiesemHelden(ctx, quelle, typ) {
  if (typ !== 'attack') return false;
  const besitzer = quelle?.owner ?? quelle?.controller ?? -1;
  if (besitzer !== ctx.cardOwner) return false;
  return (quelle?.heroIdx ?? -1) === ctx.cardHeroIdx;
}

module.exports = {
  hooks: {
    // ── Getroffene HELDEN ────────────────────────────────────────
    afterDamage: async (ctx) => {
      if (!vonDiesemHelden(ctx, ctx.source, ctx.type)) return;
      const ziel = ctx.target;
      if (!ziel || ziel.hp === undefined) return;
      // ★ EIN TREFFER MIT 0 SCHADEN IST TROTZDEM EIN TREFFER (Als
      // Korrektur 12.9.). Wer den Schaden nur wegdrueckt — Spectral
      // Armor, „Interference", ein Schild — wird trotzdem zum
      // Schweigen gebracht. Nur ein NEGIERTER oder ausgewichener
      // Angriff (Invisibility Cloak) bringt gar nichts: solche Wege
      // kehren im Schadenspfad VOR `afterDamage` zurueck
      // (`return { dealt: 0, cancelled: true }`), dieser Haken laeuft
      // dort also nie an. Deshalb steht hier KEINE Betragspruefung.
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      let zielBesitzer = -1;
      for (let p = 0; p < 2; p++) {
        if ((gs.players[p]?.heroes || []).includes(ziel)) { zielBesitzer = p; break; }
      }
      if (zielBesitzer < 0) return;
      const zielIdx = gs.players[zielBesitzer].heroes.indexOf(ziel);
      if (ziel.hp <= 0) return;                   // ein toter Held braucht nichts

      // Der Auftritt gehoert hierhin: der Effekt feuert WIRKLICH. Er
      // geht an beide Seiten — es ist ein passiver Trigger, kein
      // aktiver Einsatz (v1034er Regel), und der Spieler soll sehen,
      // dass sein Angriff nebenbei zum Schweigen bringt.
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: 'null-hero', windowMs: 1200 });
      // ★ DAUER ALS `duration`, NICHT ALS ABLAUFZUG (v1048, Als Befund
      // 12.9.: „Nulls Silence zeigt keine Rundenanzahl, Iceages
      // Lv-4-Frost schon"). Beide Schreibweisen wirken im Spiel, aber
      // nur `duration` ist die, die das ganze System — Badge,
      // Rundenabbau, Tooltip — schon kennt; Iceage fuehrt genau so.
      // `expiresAtTurn` ist die Sonderform fuer „bis Zug X" (Locke:
      // bis zum Beginn deines naechsten Zuges) und traegt keine
      // Rundenzahl.
      await engine.addHeroStatus(zielBesitzer, zielIdx, 'negated', {
        duration: DAUER, appliedBy: pi, source: CARD_NAME,
      });
      engine.log('null_silence', {
        player: gs.players[pi]?.username, target: ziel.name, turns: DAUER,
      });
      engine.sync();
    },

    // ── Getroffene KREATUREN ─────────────────────────────────────
    afterCreatureDamageBatch: async (ctx) => {
      if (!Array.isArray(ctx.entries)) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      for (const e of ctx.entries) {
        // ★ `cancelled` ist die Trennlinie: negiert/ausgewichen → nichts.
        // Ein Treffer mit 0 Schaden zaehlt dagegen (s. Helden-Haken).
        if (e.cancelled) continue;
        if (!vonDiesemHelden(ctx, e.source, e.type)) continue;
        const inst = e.inst;
        if (!inst || inst.zone !== 'support') continue;
        // Einmal je Schlag, nicht je Kreatur — `source` entprellt.
        await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: 'null-batch', windowMs: 1200 });
        // ★ Gleiche Ueberlegung wie beim Helden: `applyCreatureStatus`
        // mit `duration` ist der Weg, den Iceage fuer seinen
        // Zwei-Runden-Frost geht — die Dauer landet in
        // `counters.negatedDuration` und wird angezeigt UND
        // heruntergezaehlt. `actionNegateCreature` legt sie stattdessen
        // in einen Buff, den das Badge erst suchen muss.
        await engine.applyCreatureStatus(inst, 'negated', {
          duration: DAUER, appliedBy: pi, source: CARD_NAME,
        });
        engine.log('null_silence', {
          player: gs.players[pi]?.username, target: inst.name, turns: DAUER,
        });
      }
      engine.sync();
    },
  },
};
