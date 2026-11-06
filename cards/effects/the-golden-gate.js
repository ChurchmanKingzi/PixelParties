'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "The Golden Gate"  (W76a)
//  Spell (Area, Lv1, Magic Arts)
//
//  „Whenever a Creature is placed into a player's Support Zone, that player gains 2 Gold."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • „placed into a Support Zone": derselbe Auslöser wie bei Ingo, Investor of Evil (`onCardEnterZone` mit `toZone: 'support'`, Ruling des Spielgestalters 25.10.): Beschwörung, Platzieren,
//    Wiederbeleben UND Bewegungen in eine neue Zone (`_isMove`: Slippery Skates, Dark Gear, Diplomacy …) zählen; ebenso Token mit Creature-Untertyp (Biomancy …) und verdeckte Creatures.
//  • „that player": der Spieler, dessen Support Zone es ist — der KONTROLLEUR des Helden, in dessen Zone die Creature landet (`heroSideOf`: ein geliehener Held zählt für den Entleiher, ein an den
//    Gegner abgegebener eigener Held für den Gegner). Beide Spieler profitieren, jeder von seinen eigenen Zonen; auch Plant-Golem-Platzierungen in die gegnerische Zone zahlen DEM Gegner.
//  • Gold über `actionGainGold` (Gold-Sperren, Boni und Ersatz-Effekte greifen wie bei jedem Effekt-Gold).
//  • Areas legen sich selbst (`placeArea`), `activeIn: ['hand', 'area']` (Wächter `check-areas`); Diver Helmet gilt NICHT (das Gold geht an den Spieler, nicht an die Creature).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  Hintergrund: `GoldenGateOverlay` (public/app-areas.jsx). Je Auszahlung `play_zone_animation` `golden_gate_gold` an der Zone (Pixelart-Münzen steigen auf), beim Spielen
//  `golden_gate_sparkle`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'The Golden Gate';
const GOLD = 2;

module.exports = {
  spellVisual: { impact: { type: 'golden_gate_sparkle' }, impactMs: 500 },

  activeIn: ['hand', 'area'],

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
      ctx._engine.log('golden_gate_placed', { player: ctx._engine.gs.players[ctx.cardOwner]?.username });
      ctx._engine.sync();
    },

    onCardEnterZone: async (ctx) => {
      if (ctx.cardZone !== 'area') return;                 // nur solange sie LIEGT (nicht aus der Hand)
      const entering = ctx.enteringCard;
      if (!entering || ctx.toZone !== 'support') return;
      const engine = ctx._engine;
      const cd = engine.getEffectiveCardData(entering) || engine._getCardDB()[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;     // Token mit Untertyp Creature zählen mit (wie bei Ingo)

      // „that player" = Kontrolleur des Helden, in dessen Zone die Creature landet.
      const seite = engine.physicalSide(entering);
      const hero = engine.gs.players[seite]?.heroes?.[entering.heroIdx];
      const empfaenger = hero?.name ? engine.heroSideOf(seite, hero) : (entering.controller ?? entering.owner);
      if (!Number.isInteger(empfaenger) || !engine.gs.players[empfaenger]) return;
      if (engine.spielerIstVonAreasAusgenommen(empfaenger)) return;   // W82 (Shipwrecked): der Empfaenger ist von Areas ausgenommen

      engine._broadcastEvent('play_zone_animation', { type: 'golden_gate_gold', owner: seite, heroIdx: entering.heroIdx, zoneSlot: entering.zoneSlot, duration: 900 });
      await engine.actionGainGold(empfaenger, GOLD, { source: CARD_NAME });
      engine.log('golden_gate_gold', { player: engine.gs.players[empfaenger]?.username, creature: entering.name, gold: GOLD });
      engine.sync();
    },
  },
};
