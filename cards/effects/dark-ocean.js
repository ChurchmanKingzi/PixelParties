// ═══════════════════════════════════════════
//  CARD EFFECT: "Dark Ocean"
//  Spell (Area), Lv1, Decay Magic, PP DD
//
//  "While this Area Spell remains on the board,
//   neither player can react to or negate the
//   effects of their opponent's Creatures and
//   Creatures take no damage, except from Attacks
//   and Spells."
//
//  Reine PASSIV-Area — kein aktivierbarer Effekt,
//  keine Trigger. Beide Klauseln wirken zentral in
//  der Engine, solange die Karte in einer Area-Zone
//  liegt:
//
//   1. `darkOceanBlocksReaction` in
//      `_promptReactionsForChain` — kein Reagieren
//      auf Effekte GEGNERISCHER Creatures.
//   2. `processCreatureDamageBatch` — Kreaturschaden
//      nur noch aus `attack` und `destruction_spell`.
//
//  Als Rulings (5.8.)
//  ──────────────────
//  • Symmetrisch: gilt fuer BEIDE Spieler, egal wer
//    die Area gespielt hat.
//  • Nur `attack` und `destruction_spell` kommen
//    durch. Gift- und Brand-Ticks fuegen KEINEN
//    Schaden zu.
//  • Auf die EIGENEN Creatures darf man weiterhin
//    reagieren.
//  • Die Sperre haengt am OBERSTEN Kettenglied:
//    loese ich einen Kreatur-Effekt aus, darf der
//    Gegner nichts. Chaine ich selbst eine Reaktion
//    darauf, darf er auf DIESE reagieren (z.B. mit
//    Lunar Eclipse) — nur weiterhin nicht auf die
//    Creature.
//  • On-Summon- und On-Death-Trigger zaehlen
//    ebenfalls als "Effekte der Creature".
// ═══════════════════════════════════════════

const CARD_NAME = 'Dark Ocean';

module.exports = {
  // Reine Passiv-Area: KEIN `areaEffect` (das ist der Vertrag fuer
  // AKTIVIERBARE Areas wie Slippery Ice oder The Cosmic Depths).
  // Dark Ocean wirkt allein durch ihr Dasein.

  hooks: {
    /**
     * Areas landen nicht von selbst im Slot — die Karte muss sich
     * selbst dorthin bringen und damit `gs._spellPlacedOnBoard`
     * stempeln. Ohne das greift in JEDEM Spielpfad die Standard-
     * Entsorgung Hand -> Ablage (Lehre aus dem Cottage-Fall, v186).
     *
     * Beide Wachen sind noetig: sonst platziert sie sich erneut, wenn
     * eine FREMDE Karte gespielt wird, waehrend sie schon liegt.
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
      ctx._engine.log('dark_ocean_placed', {
        player: ctx._engine.gs.players[ctx.cardOwner]?.username,
      });
      ctx._engine.sync();
    },
  },
};
