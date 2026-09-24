'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Hole in the Sky"  (v1346, neuer Text)
//  Spell — Destruction Magic Lv2, Normal
//
//  "All Creatures both players control take 999 damage. While both
//   players control at least 1 Creature, this Spell can be used as an
//   additional Action."
//
//  ① SCHADEN: ein Flaechenschlag ueber `ctx.aoeHit` (side 'both', nur
//     Creatures, `destruction_spell`). Damit gilt alles, was der
//     Flaechenweg mitbringt: EIN Kreaturen-Batch (Deepsea Idol reagiert),
//     Surprise- und Post-Target-Fenster, Idas Einzelziel-Regel,
//     Erst-Runden-Immunitaet, `hitsMultipleTargets` per Autoerkennung.
//
//  ② ZUSATZAKTION: `inherentAction` als Funktion — der Satz regelt NUR
//     die Aktions-Oekonomie, nicht die Spielbarkeit (CARD_API
//     „Conditional inherent additional Actions"). Ohne die Bedingung
//     kostet die Karte schlicht die Aktion. „Control" = Controller,
//     offen in einer Support Zone, Kartentyp Creature (Tokens zaehlen
//     nicht, verdeckte Surprise-Creatures auch nicht).
//     Wie MOE Bomb (gleicher Effekt) bleibt die Karte auch ohne
//     Kreaturen auf dem Brett spielbar.
//
//  ③ BILDER (Kartenbild als Vorlage, Al 24.9.): tiefroter Himmel mit
//     einem pixeligen Rissnetz, in der Mitte ein gluehendes Loch.
//     • Kulisse `hole_in_the_sky` (Lage 'overAreas', CSS in style.css):
//       der Himmel faerbt sich blutrot, die Risse reissen von der Mitte
//       aus auf, das Loch glueht.
//     • Welle `hole_in_the_sky_pull` (ueber den Karten): das Loch oeffnet
//       sich, ALLE Zielkreaturen werden gleichzeitig hineingesogen — die
//       KARTEN SELBST verlassen ihre Zonen, drehen sich, kreisen auf einer
//       Spirale ums Loch und schrumpfen (v1347, `einsaugen: true`). Um
//       1900 ms schnappt es zu, genau dann faellt der Schaden.
//     • Danach (Engine, v1347): Tote fliegen VOM LOCH zu ihrem Stapel,
//       Ueberlebende zurueck in ihre Zone — beide wachsen dabei wieder auf
//       ihre Groesse.
//     • Negiert (`spellVisual`): nur ein kleiner Riss `sky_crack` auf den
//       Zielen — ein Himmel, der aufreisst und nichts tut, waere falsch.
//     Beide Lagen laufen ueber `waveAnimation` (+ `backdrop`), also erst
//     nach allen Abwehr-Fenstern.
// ═══════════════════════════════════════════
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Hole in the Sky';
const SCHADEN = 999;

/** Anzahl offener Creatures, die `p` kontrolliert. */
function kreaturenVon(engine, p) {
  const db = engine._getCardDB();
  let n = 0;
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== p) continue;
    const cd = engine.getEffectiveCardData?.(inst) || db[inst.name];
    if (cd && hasCardType(cd, 'Creature')) n++;
  }
  return n;
}

/** Grober Wert einer Seite fuer die CPU (Baseline von `mctsEnemyCreatureValue`). */
function seitenWert(engine, p) {
  const db = engine._getCardDB();
  let wert = 0;
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== p) continue;
    const cd = engine.getEffectiveCardData?.(inst) || db[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    wert += 1 + (cd.level || 0) * 0.4;
  }
  return wert;
}

module.exports = {
  // Negierter Guss: ein kleiner Riss auf jedem Ziel statt des ganzen Himmels.
  spellVisual: {
    impact: { type: 'sky_crack' }, impactMs: 420,
  },

  /** „While both players control at least 1 Creature …" */
  inherentAction(gs, pi, _heroIdx, engine) {
    if (!engine) return false;
    return kreaturenVon(engine, pi) > 0 && kreaturenVon(engine, pi === 0 ? 1 : 0) > 0;
  },

  /**
   * CPU: der Wipe trifft die EIGENE Seite mit. Nur spielen, wenn auf der
   * Gegenseite mehr (und angreifbarer) Wert liegt als auf der eigenen.
   * In der Erst-Runden-Immunitaet zaehlt die Gegenseite nicht.
   */
  cpuPlayVeto(engine, pi) {
    try {
      const opp = pi === 0 ? 1 : 0;
      const gegner = engine.gs?.firstTurnProtectedPlayer === opp ? 0 : seitenWert(engine, opp);
      const eigen = seitenWert(engine, pi);
      return gegner <= 0 || gegner <= eigen;
    } catch {
      return false;   // die Heuristik darf nie einen legalen Play verhindern
    }
  },

  hooks: {
    onPlay: async (ctx) => {
      await ctx.aoeHit({
        damage: SCHADEN,
        damageType: 'destruction_spell',
        side: 'both',
        types: ['creature'],
        animationType: null,      // die Welle IST das Bild
        hitDelay: 0,
        animDelay: 0,
        waveAnimation: {
          type: 'hole_in_the_sky_pull', duration: 2400, delay: 1900,
          einsaugen: true,   // v1347: die Karten selbst kreisen ins Loch
          backdrop: { type: 'hole_in_the_sky', duration: 4600, lead: 750 },
        },
      });
      ctx._engine.sync();
    },
  },
};
