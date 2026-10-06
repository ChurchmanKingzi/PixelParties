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
//  · Skill Test (2–8 Spieler): „your opponent" ist mehrdeutig. Zu Spielbeginn (Hook `onSkillTestStart`, vor dem
//    Start-Gold-Tick) WÄHLT der Controller einen lebenden Gegner (Spielerwahl; Bots nehmen den mit dem meisten Gold);
//    nur dessen Gold wird umgelenkt (`inst._stTarget`). Bei nur einem Gegner entfällt die Frage.
// ═══════════════════════════════════════════

const { PHASES } = require('./_hooks');
const { opponentOfGs } = require('./_opp');

const CARD_NAME = 'The Golden Abomination';

/**
 * Wuerde eine Abomination unter `ctrl` einen Gold-Gewinn von `gewinner`
 * JETZT umlenken? Die eine Auslegungsstelle — auch fuer Karten, die vorab
 * wissen wollen, ob ihr Gold ankommt (Golden Ladybug, CPU-Wahl).
 */
function stiehltGoldVon(engine, ctrl, gewinner, inst) {
  const gs = engine?.gs;
  if (!gs || gewinner == null || ctrl == null) return false;
  if (gs.skillTest) {
    // Skill Test: das beim Spielbeginn gewählte Opfer dieser Abomination (ohne Wahl: kein Diebstahl).
    if (!inst || inst._stTarget !== gewinner || gewinner === ctrl) return false;
  } else if (gewinner !== (opponentOfGs(gs, ctrl))) return false;
  if (gs.currentPhase !== PHASES.RESOURCE || gs.activePlayer !== gewinner) return false;
  return (gs.players[gewinner]?.gold || 0) !== 0;       // „while their Gold is not 0"
}

/** Kontrolliert der Gegner von `gewinner` eine aktive Abomination, die gerade umlenkt? */
function goldWuerdeUmgeleitet(engine, gewinner) {
  return (engine?.cardInstances || []).some(c => {
    if (c.name !== CARD_NAME || c.zone !== 'support') return false;
    const ctrl = c.controller ?? c.owner;
    if (ctrl === gewinner) return false;
    if (!engine.gs?.skillTest && ctrl !== (gewinner === 0 ? 1 : 0)) return false;
    return engine.isCardEffectActive(c) && stiehltGoldVon(engine, ctrl, gewinner, c);
  });
}

module.exports = {
  activeIn: ['support'],
  stiehltGoldVon,
  goldWuerdeUmgeleitet,

  hooks: {
    // Skill Test: einmal zu Spielbeginn den bestohlenen Gegner festlegen.
    onSkillTestStart: async (ctx) => {
      const engine = ctx._engine, gs = engine.gs, inst = ctx.card;
      const ctrl = inst?.controller ?? inst?.owner;
      if (!gs.skillTest || ctrl == null) return;
      const cands = gs.players.map((_, i) => i).filter(i => i !== ctrl && (gs.players[i].heroes || []).some(h => h && h.name && h.hp > 0));
      if (!cands.length) return;
      let pick = cands[0];
      if (cands.length > 1) {
        const res = await engine.promptGeneric(ctrl, {
          type: 'playerPicker', title: CARD_NAME, purpose: 'stealGold', cancellable: false, allowedPlayers: cands,
          description: 'Choose an opponent: any Gold they gain during their Resource Phase (while their Gold is not 0) goes to you instead.',
        });
        if (res && Number.isInteger(res.playerIdx) && cands.includes(res.playerIdx)) pick = res.playerIdx;
      }
      inst._stTarget = pick;
      engine.log('golden_abomination_target', { player: gs.players[ctrl]?.username, target: gs.players[pick]?.username });
    },

    onResourceGain: async (ctx) => {
      if (ctx.cancelled) return;
      const engine = ctx._engine;
      const inst = ctx.card;
      const ctrl = inst?.controller ?? inst?.owner;
      if (!stiehltGoldVon(engine, ctrl, ctx.playerIdx, inst)) return;
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
