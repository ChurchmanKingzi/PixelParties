// ═══════════════════════════════════════════
//  CARD EFFECT: "The Golden Abomination"
//  Creature (Summoning Magic Lv2, Normal, 50 HP)
//
//  „Any Gold your opponent would gain during their Resource Phase
//   while their Gold is not 0 goes to you instead."
//
//  · Hook `onResourceGain` (Support Zone; Golden-Vermin-Muster).
//  · ★ Als Ruling 24.9. (v1345): umgeleitet wird ALLES Gold, das der
//    Gegner WAEHREND SEINER Resource Phase gewinnt — nicht nur das
//    Rundeneinkommen (`_isResourceGain`), sondern auch Effekt-Gold aus
//    dieser Phase (Golden Ladybug u.ae.). Phasen-Test, kein Marker-Test —
//    dieselbe Bauart wie Tuscan Aristocrat. Ausserhalb der Resource Phase
//    bleibt Effekt-Gold (Gold Trap, Trade …) unberuehrt.
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

const { PHASES } = require('./_hooks');

const CARD_NAME = 'The Golden Abomination';

/**
 * Wuerde eine Abomination unter `ctrl` einen Gold-Gewinn von `gewinner`
 * JETZT umlenken? Die eine Auslegungsstelle — auch fuer Karten, die vorab
 * wissen wollen, ob ihr Gold ankommt (Golden Ladybug, CPU-Wahl).
 */
function stiehltGoldVon(engine, ctrl, gewinner) {
  const gs = engine?.gs;
  if (!gs || gewinner == null || ctrl == null) return false;
  if (gewinner !== (ctrl === 0 ? 1 : 0)) return false;
  if (gs.currentPhase !== PHASES.RESOURCE || gs.activePlayer !== gewinner) return false;
  return (gs.players[gewinner]?.gold || 0) !== 0;       // „while their Gold is not 0"
}

/** Kontrolliert der Gegner von `gewinner` eine aktive Abomination, die gerade umlenkt? */
function goldWuerdeUmgeleitet(engine, gewinner) {
  const ctrl = gewinner === 0 ? 1 : 0;
  return (engine?.cardInstances || []).some(c =>
    c.name === CARD_NAME && c.zone === 'support' && (c.controller ?? c.owner) === ctrl
    && engine.isCardEffectActive(c) && stiehltGoldVon(engine, ctrl, gewinner));
}

module.exports = {
  activeIn: ['support'],
  stiehltGoldVon,
  goldWuerdeUmgeleitet,

  hooks: {
    onResourceGain: async (ctx) => {
      if (ctx.cancelled) return;
      const engine = ctx._engine;
      const inst = ctx.card;
      const ctrl = inst?.controller ?? inst?.owner;
      if (!stiehltGoldVon(engine, ctrl, ctx.playerIdx)) return;
      const gs = engine.gs;
      const oppIdx = ctx.playerIdx;
      const amount = ctx.amount || 0;
      if (amount <= 0) return;
      const ops = gs.players[oppIdx];
      ctx.cancel();
      await engine.announceHookActivation(CARD_NAME, ctrl);
      engine._broadcastEvent('gold_steal_burst', { fromPlayer: oppIdx, toPlayer: ctrl, amount });
      engine.log('golden_abomination', { player: gs.players[ctrl]?.username, from: ops?.username, amount });
      await engine.actionGainGold(ctrl, amount, { source: CARD_NAME });
    },
  },
};
