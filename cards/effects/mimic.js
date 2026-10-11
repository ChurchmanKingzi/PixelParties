// ═══════════════════════════════════════════
//  CARD EFFECT: "Mimic"
//  Creature (Normal, Lv0, 50 HP, Summoning Magic)
//
//  „Steal 10 Gold from your opponent at the beginning of each of your turns."
//
//  ── LEVEL ───────────────────────────────────────────────────────────────
//  Als Vorgabe 10.10.: die Karte ist jetzt Lv 0 (vorher Lv 1) — Datenänderung in `cards.json`, hier nichts weiter.
//
//  ── DER DIEBSTAHL ───────────────────────────────────────────────────────
//  `engine.actionStealGold` ist der kanonische Weg und deckelt SELBST auf das, was der Gegner tatsächlich besitzt (Als Vorgabe 10.10.:
//  „gestohlenes Gold ist generell immer bei dem gecappt, was der Gegner tatsächlich besitzt"):
//    • Gegner hat 4 Gold → es werden 4 gestohlen, nicht 10.
//    • Gegner hat 0 Gold ODER ist im Minus (Schulden) → es wird NICHTS gestohlen. Der Effekt kehrt sich nie um: er schenkt dem Gegner
//      kein Gold und „stiehlt" keine Schulden, der Besitzer bekommt nichts.
//    • Erster Zug des Gegners (Anfangsschutz, `gs.firstTurnProtectedPlayer`) → Fehlschlag, wie bei jedem Goldraub.
//  Der Hook ruft deshalb nur den Primitiv auf und verlässt sich auf dessen Klammer; es gibt hier keine eigene Rechnung, die davon
//  abweichen könnte.
//
//  ── „AT THE BEGINNING OF EACH OF YOUR TURNS" ────────────────────────────
//  `onTurnStart` mit `isMyTurn` (Kontrolleur, nicht Besitzer: eine übernommene Mimic raubt für ihren neuen Herrn). Jede Mimic stiehlt
//  für sich — zwei Mimics holen 20. Gefroren/betäubt/negiert: die allgemeine Kreatur-Sperre der Engine greift (der Hook feuert dann
//  nicht), hier ist dafür nichts nötig.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Nur wenn wirklich etwas zu holen ist, schnappt die Mimic: `play_zone_animation` `mimic_chomp` (Pixelart, Brett-Animation mit der
//  Mimic als Ursprung UND Ziel, Hülle `ppSalve`; Vorlage: das Kartenbild, die Truhe mit dem Zahnrachen): Kiefer klappen zweimal zu, beim
//  zweiten Zuschnappen (~560 ms) springen Münzen aus dem Maul; im selben Moment fliegt der Münzstrom (`gold_steal_burst`) vom Gegner zu
//  dir. Klänge: `ZONE_ANIM_SFX.mimic_chomp` (zwei Bisse); der Münzstrom klingt im Client über `ev_gold_steal_burst` (zwei Münzklänge, Abheben und Landung — für jeden Goldraub).
// ═══════════════════════════════════════════

const CARD_NAME = 'Mimic';
const STEAL = 10;
const DAUER_MS = 1150;       // Länge der Animation (deckt sich mit `mimic_chomp` im Client)
const BISS_MS = 660;         // zweiter Biss bei ~560 ms der Animation (+100 ms Einbau-Versatz des Clients)
const NACH_MS = 360;         // die Münzen noch ein Stück fliegen lassen

/** Gibt es beim Gegner überhaupt etwas zu holen? (Gleiche Bedingungen wie in `actionStealGold`; nur fürs Bild.) */
function gibtEtwasZuHolen(engine, pi) {
  const oi = engine.opponentOf(pi);
  const ops = engine.gs.players[oi];
  if (!ops) return false;
  if (engine.gs.firstTurnProtectedPlayer === oi) return false;
  return (ops.gold || 0) > 0;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || inst.faceDown) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;                 // Kontrolleur
      const seite = ctx.cardHeroOwner ?? pi;    // Brettseite, auf der die Mimic PHYSISCH steht
      const heroIdx = ctx.cardHeroIdx;

      if (gibtEtwasZuHolen(engine, pi)) {
        const slot = inst.zoneSlot ?? -1;
        engine._broadcastEvent('play_zone_animation', {
          type: 'mimic_chomp', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1, duration: DAUER_MS,
          targets: [{ owner: seite, heroIdx, zoneSlot: slot, cardName: CARD_NAME }],
          originOwner: seite, originHeroIdx: heroIdx, originZoneSlot: slot,
        });
        await engine._delay(BISS_MS);
      }

      // Die Klammer auf das tatsächliche Gold des Gegners sitzt im Primitiv (nie unter 0, nie umgekehrt).
      const res = await engine.actionStealGold(pi, STEAL, { sourceName: CARD_NAME });
      if (res?.stolen > 0) await engine._delay(NACH_MS);
    },
  },
};
