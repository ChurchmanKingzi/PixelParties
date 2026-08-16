// ═══════════════════════════════════════════
//  CARD EFFECT: "Debt-O-Tron Model Loan Shredder"
//  Artifact / Creature — Cost 0, 70 HP. Archetyp: Debt-O-Tron.
//
//  "You can only play this card while you have less than 0 Gold by deleting 1 card from your hand. You may once per turn set your Gold to 0. You can only summon 1 "Debt-O-Tron Model Loan Shredder" per turn."
//
//  Gemeinsames Gerüst in `_debt-o-tron-shared.modelBase`: spielbar nur
//  bei negativem Gold, Kosten sind 1 geloeschte Handkarte, hart einmal je Zug beschwoerbar.
//  Hier steht nur der eigene Effekt.
//
//  Der Schuldenschnitt. „Set your Gold to 0" laeuft ueber
//  `actionSetGold` — die Primitive, die genau dafuer da ist (sie feuert
//  `afterGoldSet` statt Gewinn/Zahlung, ein Schnitt ist keins von
//  beidem). Wichtig: Kents Aktionssperre bleibt danach BESTEHEN, weil
//  sein Rundenstempel unabhaengig vom Kontostand haelt — genau dafuer
//  gibt es den Stempel.
// ═══════════════════════════════════════════

'use strict';

const { modelBase } = require('./_debt-o-tron-shared');

const CARD_NAME = 'Debt-O-Tron Model Loan Shredder';
// Laufzeit der gruenen Zaehl-Animation. Kuerzer als Market Crash
// (3000 ms): dort zaehlen zwei Spieler herunter, hier nur einer.
const SHRED_MS = 1600;
const HOPT_KEY = (pi) => `debt-shredder-cut:${pi}`;

const base = modelBase(CARD_NAME);

module.exports = {
  ...base,

  hooks: {
    onPlay: async (ctx) => { await base.payHandCost(ctx); },
  },

  /** „You may once per turn set your Gold to 0." — freier Effekt. */
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    if (gs.hoptUsed?.[HOPT_KEY(pi)] === gs.turn) return false;
    // Auf 0 setzen lohnt nur, wenn man nicht schon dort steht.
    return (gs.players[pi]?.gold || 0) !== 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return;
    if (gs.hoptUsed?.[HOPT_KEY(pi)] === gs.turn) return;

    const vorher = ps.gold || 0;
    // `ctx.promptConfirmEffect` liefert einen BOOLEAN, kein Objekt —
    // der Helfer wertet `result?.confirmed === true` bereits INTERN aus
    // (_engine.js ~3448) und gibt nur das Ergebnis zurueck. Meine erste
    // Fassung fragte `antwort?.confirmed` ab; bei `true` ist das
    // `undefined`, die Karte stieg also IMMER aus. Genau Als Report
    // „Loan Shredder tut noch nichts".
    const bestaetigt = await ctx.promptConfirmEffect({
      title: CARD_NAME,
      message: `Set your Gold to 0? (currently ${vorher})`,
    });
    if (!bestaetigt) return false;

    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[HOPT_KEY(pi)] = gs.turn;

    // Zaehl-Animation wie bei Market Crash, aber GRUEN und von −X auf 0
    // (Als Vorgabe 16.8.). `to` haelt den Gegner auf seinem Wert fest —
    // nur der eigene Stand bewegt sich.
    engine._broadcastEvent('play_gold_crash', {
      amounts: [gs.players[0].gold || 0, gs.players[1].gold || 0],
      to: pi === 0
        ? [0, gs.players[1].gold || 0]
        : [gs.players[0].gold || 0, 0],
      durationMs: SHRED_MS,
      tone: 'recover',
    });

    await engine.actionSetGold(pi, 0, { sourceName: CARD_NAME });
    engine.log('debt_shredder_cut', { player: ps.username, from: vorher });
    engine.sync();
  },
};
