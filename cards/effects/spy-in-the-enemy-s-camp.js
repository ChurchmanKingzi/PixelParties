'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Spy in the Enemy's Camp"
//  Spell (Reaction, Decay Magic Lv1) — Umsetzung 23.10.
//
//  „Play this card immediately when your opponent summons a Creature. You may activate that Creature's active effect during your turn as if you control it."
//
//  Al (23.10.): die Kreatur bleibt auf der Seite des Gegners; an ihr hängt eine Marke, die Statusheilung NICHT entfernen kann; die Marke gilt, bis die Kreatur das Brett verlässt
//  (wohin auch immer sie geht).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Fenster: das Kettenfenster der Beschwörung (Bauform Off Duty — die Kreatur liegt noch nicht auf dem Brett). Angeboten nur auf die Beschwörung einer GEGNERISCHEN Kreatur aus der
//     Hand (oder die Platzierung per Effekt, `reactsToPlacement`) und nur, wenn die Kreatur einen AKTIVEN Effekt hat (`creatureEffect`) — sonst gäbe es nichts zu benutzen.
//  2. `resolve`: merkt am Kettenglied der Beschwörung „Spion X" vor (`_spy-shared.spyVormerken`). Wird die Beschwörung danach negiert (Off Duty …), verfällt die Vormerkung; landet die
//     Kreatur, bekommt sie die Marke `counters._spyMask` (Engine: erster Schritt von `onCardEnterZone`), die Karte geht in die Ablage. Bild `spy_mark` zeigt sich dann an der Kreatur.
//  3. Benutzung: in MEINEM Zug bietet `engine.getActivatableCreatures` die Kreatur an (Feld `spy: true`, `charmedOwner` = Gegenseite wie bei geliehenen Kreaturen); `server.js`
//     `doActivateCreatureEffect` lässt den Klick zu und stellt die Kontrolle für die Dauer des Effekts auf mich (`engine._leiheKontrolle`: „you / your opponent / your deck" im Effekt
//     sind meine; `stolenBy`/`controller` springen danach zurück, kein `onTakeControl`). Alle üblichen Torwächter bleiben: Phase (Main; bei `creatureActionCost` Action/Zusatzaktion — die
//     Aktion zahlt ein EIGENER Held wie bei `activatableByAnyPlayer`), Rundensperre (HOPT je Kreatur und Runde), Einmal-pro-Spiel (MEIN Zähler), Frost/Betäubung/Negierung, Blindheit,
//     Reaktionsfenster der Aktivierung (Gigantisaur Skull, Dark Deal …). Kein Beschwörungs-Schlaf (die Kreatur ist nicht meine).
//
//  ── ANNAHMEN ────────────────────────────────────────────────────────────
//  • „Summons" = die Beschwörung aus der Hand oder die Platzierung; das Aufdecken einer Bakhm-Creature-Surprise setzt keine Marke (die Kreatur liegt dort schon).
//  • Mehrere Spione auf dieselbe Kreatur: je ein Bit je Sitz; zwei Kopien desselben Sitzes ändern nichts.
//  • Die Marke ist an die Instanz gebunden: Tod, Rückkehr auf die Hand, ins Deck oder aus dem Spiel beendet sie; ein erneutes Beschwören beginnt ohne Marke.
//  • Gewinnt der Spion die Kreatur selbst (Aligning Goals, Mind Control …), gilt der normale Weg (Kontrolleur), die Marke bleibt für später.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Standard-Reaktion der CPU („sofort feuern", wenn spielbar); die CPU benutzt Spionagekreaturen über denselben Aktivierungs-Sammler wie eigene.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { spyVormerken } = require('./_spy-shared');

module.exports = {
  // Wird die Karte NEGIERT, läuft `resolve` nie — die Engine spielt dann dieses Bild (wie Off Duty).
  spellVisual: { impact: { type: 'deepsea_idol_negate' }, impactMs: 260 },

  isReaction: true,
  requiresTarget: false,
  reactsToPlacement: true,                  // auch auf das Platzieren einer Kreatur per Effekt (`actionPlaceCreature`)

  /** Nur als Reaktion, nie proaktiv. */
  spellPlayCondition() { return false; },

  /** Nur auf die Beschwörung einer GEGNERISCHEN Kreatur mit aktivem Effekt (aus der Hand oder Platzierung). */
  reactionCondition(gs, pi, engine, chainCtx) {
    const chain = chainCtx?.chain;
    if (!chain || chain.length < 1) return false;
    const letzter = chain[chain.length - 1];
    if (!letzter || !letzter.isInitialCard) return false;
    if (letzter.owner === pi) return false;                         // muss der Gegner sein
    if (letzter.cardType !== 'Creature') return false;              // nur Beschwörungen
    if (letzter.fromBoard && !letzter.isPlacement) return false;    // aus der HAND — oder Platzierung
    const script = loadCardEffect(letzter.cardName);
    return !!script?.creatureEffect;                                // ohne aktiven Effekt gibt es nichts zu benutzen
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const ziel = chain[myIndex - 1];
    if (!ziel || ziel.negated) return;
    spyVormerken(engine, pi, ziel);
    engine.log('spy_in_the_enemys_camp', {
      player: engine.gs.players[pi]?.username, creature: ziel.cardName, opponent: engine.gs.players[ziel.owner]?.username,
    });
    engine.sync();
  },
};
