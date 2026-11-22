// ═══════════════════════════════════════════
//  CARD EFFECT: "Thieving"
//  Ability — Free activation once per turn
//
//  Lv1: Steal up to 4 Gold from the opponent.
//  Lv2: Steal up to 8 Gold.
//  Lv3: Steal up to 12 Gold.
//
//  Amount is clamped at the opponent's current
//  Gold. Fizzles when opponent is at 0 Gold or
//  during the opening turn — both rules live in
//  the shared stealGoldFromOpponent helper.
//  Once-per-turn is enforced by the engine's
//  standard free-ability HOPT path.
//
//  Gold-Gewinn-Sperre des Diebes (Tuscan Aristocrat, Golden Arrow)
//  — Spielgestalter-Entscheidung 16.11.2026: Thieving bleibt
//  aktivierbar, der Gegner VERLIERT das Gold trotzdem (gleiche
//  Klemmung auf seinen Bestand), der Dieb bekommt nichts („es ist
//  dann weg"). `actionStealGold(…, { verlustBleibtBeiSperre })` — dieselbe Regel gilt
//  (Spielgestalter-Entscheidung 16.11.2026) auch für Mimic, Deepsea Pirate und Dirty Smuggler.
// ═══════════════════════════════════════════

const STEAL_BY_LEVEL = [4, 8, 12];
const CARD_NAME = 'Thieving';

module.exports = {
  // Spielgestalter-Entscheidung 16.11.2026: trifft nur die Gegnerseite. Der Erste-Runden-Schutz des Gegners sperrt die Karte NICHT mehr (aktivierbar, die Wirkung verpufft) — die Markierung dient nur noch der CPU (`engine.nutzlosErsteRunde`: sie aktiviert sie nicht gegen den Geschuetzten).
  blockedByFirstTurnProtection: true,
  activeIn: ['ability'],
  freeActivation: true,

  /**
   * Unusable while the opponent has 0 Gold.
   * ★ Spielgestalter-Entscheidung 16.11.2026: Turn-1-Schutz des Gegners sperrt NICHT mehr — aktivierbar, `actionStealGold` fizzelt (Einmal-Limit verbraucht).
   */
  canFreeActivate(ctx) {
    const gs = ctx._engine.gs;
    const pi = ctx.cardOwner;
    const oi = ctx._engine.opponentOf(pi);
    if (ctx._engine.cpuMeidetErsteRunde(pi)) return false;   // CPU (Spielgestalter-Entscheidung 16.11.2026): der Mensch darf die nutzlose Aktivierung gegen den Erste-Runden-Geschuetzten wählen, die CPU nicht
    const ops = gs.players[oi];
    return !!(ops && (ops.gold || 0) > 0);
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const lv = Math.max(1, Math.min(3, level | 0));
    const amount = STEAL_BY_LEVEL[lv - 1];

    // Spielgestalter-Entscheidung 16.11.2026: Unter einer Gold-Gewinn-Sperre des Diebes (Tuscan Aristocrat, Golden Arrow) bleibt Thieving aktivierbar
    // und der Gegner VERLIERT das Gold trotzdem — der Dieb bekommt es nur nicht, es ist dann weg. Das Once-per-turn wird normal verbraucht.
    // (Adventurousness/Trade sind dort ausgegraut, weil Gold ihr einziger Nutzen ist — hier verliert der Gegner ja etwas; Regel in `_gold-block-shared.js`.)
    const { stolen, lost } = await engine.actionStealGold(pi, amount, {
      sourceName: CARD_NAME,
      verlustBleibtBeiSperre: true,
    });

    engine.log('thieving_activated', {
      player: engine.gs.players[pi]?.username,
      hero: ctx.heroName ? ctx.heroName() : null,
      level: lv,
      maxSteal: amount,
      stolen,
      ...(lost ? { lost } : {}),
    });
  },
};
