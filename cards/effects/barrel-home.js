'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Barrel Home"  (Welle 6b)
//  Spell (Area, Decay Magic Lv3) — banned
//
//  „All Heroes have 1 fewer Support Zone. If a Hero has more cards in its Support Zones than it has Zones after you play this card, its controller must send a card from its
//   Support Zones to the discard pile. Creatures sent that way do not count as being defeated."
//
//  ── −1 SUPPORT ZONE JE HELD ─────────────────────────────────────────────
//  Je Barrel Home hat JEDER Held beider Seiten eine Support Zone weniger. Welche, regelt `_zonen-welt-shared.js` (ausführlich dort):
//    1. die Zone von Gigalopolis, the Mega-City wird zuerst entzogen (sie verschwindet, solange das Fass liegt, und kommt zurück, wenn es geht);
//    2. weitere Fässer versiegeln eine GRUNDZONE (Platzhalter `_ZoneBarrel`: belegt, nimmt nichts auf, im Client ein Fass); eine freie bevorzugt, rechts zuerst;
//    3. Flying-Island-Zonen werden nie bevorzugt entzogen (sie werden nie versiegelt; mehr als 3 Fässer ohne Gigalopolis schließen nicht weiter).
//  Verlässt das Fass das Brett, kehrt die Zone zurück (Siegel gelöst bzw. Gigalopolis-Zone neu angelegt).
//
//  ── ZU VIELE KARTEN ─────────────────────────────────────────────────────
//  Passt der Inhalt nicht mehr, zieht eine Kreatur zuerst in eine freie Zone um (Inselzonen zuerst). Bleibt keine, MUSS der Kontrolleur des Helden (Pflichtwahl, nicht abbrechbar)
//  eine Karte aus den Support Zonen dieses Helden in die Ablage schicken. Die Karte geht OHNE Niederlage in die Ablage (`actionMoveCard` mit `ohneNiederlage`): keine Todes-Hooks,
//  kein Kadaver-Anspruch — Kreaturen „do not count as being defeated"; Abgangs-Hooks (z. B. Flying Island entfernt seine Zonen) laufen wie bei jeder Karte, die das Brett verlässt.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU schickt die wertloseste Karte: Ausrüstung vor Kreaturen, schwache Kreaturen vor starken.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Hintergrund-Szene „barrel-home" (`public/app-areas.jsx`): ein großes hölzernes Fass auf der Seite liegend. Versiegelte Zonen zeigen ein kleines Fass (Pixelart).
// ═══════════════════════════════════════════

const { abgleichen } = require('./_zonen-welt-shared');

const CARD_NAME = 'Barrel Home';

module.exports = {
  // „All Heroes have 1 fewer Support Zone": die Wirkung gilt allen Helden beider Seiten (AoE-Erkennbarkeit, `check-aoe-text`; kein Schaden, daher von Hand).
  hitsMultipleTargets: true,

  activeIn: ['hand', 'area'],

  hooks: {
    /** Areas landen nicht von selbst im Slot (Cottage-Lehre v186): die Karte legt sich selbst. */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    /** Eintritt: Zonen abgleichen (Überhang → Pflichtwahl des Kontrolleurs). */
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'area') return;
      if (ctx.enteringCard?.id !== ctx.card?.id) return;
      await abgleichen(ctx._engine);
    },

    /** Spielstart (Puzzle/Skilltest): vorab gelegtes Fass. */
    onGameStart: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      await abgleichen(ctx._engine);
    },

    /** Zugbeginn: neu aufgetauchte Helden bekommen ihre Verkleinerung nach (idempotent). */
    onTurnStart: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      await abgleichen(ctx._engine);
    },

    /** Das Fass geht: die Zonen kommen zurück. Es zählt beim Abgleich nicht mehr mit (der Hook feuert vor dem Zonenwechsel). */
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'area') return;
      if (ctx.leavingCard && ctx.leavingCard.id !== ctx.card?.id) return;
      await abgleichen(ctx._engine, { ausser: ctx.card });
    },
  },

  /** CPU: Pflichtwahl — die wertloseste Karte des Helden in die Ablage. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget' || promptData?.config?.title !== CARD_NAME) return undefined;
    const frei = (promptData.validTargets || []).filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    const wert = (t) => {
      const inst = t.cardInstance;
      const cd = (inst ? engine.getEffectiveCardData(inst) : null) || engine._getCardDB()[t.cardName] || {};
      if (cd.cardType !== 'Creature') return cd.cost || 0;
      return 100 + (cd.level || 0) * 10 + (cd.hp || 0) / 50 + (cd.atk || 0) / 50;
    };
    return [frei.slice().sort((a, b) => wert(a) - wert(b))[0].id];
  },
};
