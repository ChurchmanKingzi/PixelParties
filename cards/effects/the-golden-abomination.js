// ═══════════════════════════════════════════
//  CARD EFFECT: "The Golden Abomination"
//  Creature (Summoning Magic Lv2, Normal, 50 HP)
//
//  „Any Gold your opponent would gain during their Resource Phase
//   while their Gold is not 0 goes to you instead."
//
//  · Hook `onResourceGain` (Support Zone; Golden-Vermin-Muster). Der
//    Gewinn traegt `_isResourceGain` NUR fuer das Rundeneinkommen der
//    Resource Phase — Effekt-Gold (Gold Trap, Trade …) bleibt unberuehrt.
//  · Bedingung: Gewinner = Gegner des Controllers, dessen Gold VOR dem
//    Gewinn ≠ 0 (auch negativ zaehlt als „nicht 0"), Betrag > 0.
//  · Umsetzung: der Gewinn wird gecancelt und dem Controller
//    gutgeschrieben — ueber `actionGainGold` OHNE `_isResourceGain`,
//    damit keine Abomination des Gegners ihn erneut umlenkt und keine
//    Resource-Phase-Lauscher doppelt feuern; Gold-Trap-Fenster und
//    Golden Vermin des Controllers sehen ihn als Effekt-Gold.
//  · Mehrere Abominationen: die erste lenkt um, die naechste sieht
//    `ctx.cancelled` und tut nichts (kein doppeltes Gold).
//  · Auftritt: `gold_steal_burst` (Muenzflug Gegner → Controller).
// ═══════════════════════════════════════════

const CARD_NAME = 'The Golden Abomination';

module.exports = {
  activeIn: ['support'],

  hooks: {
    onResourceGain: async (ctx) => {
      if (ctx.cancelled) return;
      if (!ctx._isResourceGain) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const ctrl = inst?.controller ?? inst?.owner;
      const oppIdx = ctrl === 0 ? 1 : 0;
      if (ctx.playerIdx !== oppIdx) return;
      const amount = ctx.amount || 0;
      if (amount <= 0) return;
      const ops = gs.players[oppIdx];
      if ((ops?.gold || 0) === 0) return;               // „while their Gold is not 0"
      ctx.cancel();
      await engine.announceHookActivation(CARD_NAME, ctrl);
      engine._broadcastEvent('gold_steal_burst', { fromPlayer: oppIdx, toPlayer: ctrl, amount });
      engine.log('golden_abomination', { player: gs.players[ctrl]?.username, from: ops?.username, amount });
      await engine.actionGainGold(ctrl, amount, { source: CARD_NAME });
    },
  },
};
