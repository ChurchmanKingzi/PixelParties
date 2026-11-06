'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigalopolis, the Mega-City"  (Welle 6b)
//  Spell (Area, Support Magic Lv3)
//
//  „This card on the board is unaffected by all other cards and effects and cannot be removed from the board in any way. All Heroes have an additional Support Zone, but that
//   Support Zone can only be occupied by Creatures."
//
//  ── UNBEEINFLUSSBAR & UNENTFERNBAR ──────────────────────────────────────
//  Engine-Vertrag `areaUnremovable: true` (`engine.areaUnentfernbar`): Solange die Area in einer Area Zone liegt, verlässt sie das Brett nie — nicht durch Zerstörung (The Yeeting, Hammer
//  Skeleton …), nicht durch Flächenräumer (Cataclysm, Reality Crack, Cleansing of the Land, Feral, Aquanian Orkallion, Spirit of the Barbarian Sword …), nicht durch Löschen
//  (`deleteArea`), Rückhand/Deck (`actionMoveCard`), nicht durch das Area-Limit (`enforceAreaLimit` wählt sie nie aus) und auch nicht durch eigene Abgänge (`skipProtection`).
//  „Unaffected": jedes Schutztor, das eine Area als Ziel nennt (`tryAreaProtection`), lehnt sie ab. Wird sie ersetzt oder das Limit sinkt, bleibt sie liegen.
//
//  ── +1 SUPPORT ZONE JE HELD ─────────────────────────────────────────────
//  Je Gigalopolis hat JEDER Held beider Seiten eine zusätzliche Support Zone, die nur Kreaturen aufnimmt — eine Inselzone wie bei Flying Island in the Sky (`islandZoneCount`,
//  Index 3 = die erste Inselzone; Flying-Island-Zonen kommen dahinter). Bei ungerader Inselzahl liegt die Extra-Zone LINKS (1 | 2 | 3 | 4 — die Ability Zones 1-3 über den
//  Support Zonen 2-4). Der Abgleich (`_zonen-welt-shared.js`) läuft beim Eintritt in die Area Zone, am Zugbeginn (Helden, die später auftauchen) und beim Spielstart (Puzzle).
//  Zusammenspiel mit Barrel Home: ein Fass hebt die Gigalopolis-Zone zuerst wieder auf (siehe dort / `_zonen-welt-shared.js`).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Hintergrund-Szene „gigalopolis" (`public/app-areas.jsx`, `AREA_OVERLAYS`): eine riesige antike griechische Stadt aus großer Höhe, winzige Menschen als wandernde Punkte.
// ═══════════════════════════════════════════

const { abgleichen } = require('./_zonen-welt-shared');

module.exports = {
  /** Engine-Vertrag (s. oben): die Area verlässt das Brett nie. */
  areaUnremovable: true,
  // „All Heroes …": die Wirkung gilt allen Helden beider Seiten (AoE-Erkennbarkeit, `check-aoe-text`; kein Schaden, daher von Hand).
  hitsMultipleTargets: true,

  // 'hand': der Selbstleger-onPlay feuert beim Ausspielen; 'area': die Abgleich-Hooks laufen, solange sie liegt.
  activeIn: ['hand', 'area'],

  hooks: {
    /** Areas landen nicht von selbst im Slot (Cottage-Lehre v186): die Karte legt sich selbst. Beide Wachen — sonst legt sie sich erneut, wenn eine FREMDE Karte gespielt wird. */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    /** Eintritt in die Area Zone (auch per Effekt/Puzzle): die Zonen aller Helden abgleichen. */
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'area') return;
      if (ctx.enteringCard?.id !== ctx.card?.id) return;
      await abgleichen(ctx._engine);
    },

    /** Spielstart (Puzzle/Skilltest legen die Area ohne Zonenwechsel). */
    onGameStart: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      await abgleichen(ctx._engine);
    },

    /** Zugbeginn: Helden, die erst jetzt auf dem Brett stehen, bekommen ihre Zone nach (idempotent). */
    onTurnStart: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      await abgleichen(ctx._engine);
    },
  },
};
