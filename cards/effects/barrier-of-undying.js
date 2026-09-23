'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Barrier of Undying"  (v1313, neuer Text)
//  Spell (Reaction) — Magic Arts Lv1
//
//  "Play this card immediately when a Creature would be defeated. That
//   Creature's HP become 1 instead. At the end of its owner's next turn,
//   if it is still on the board, delete it."
//
//  Als Vorgaben 23.9.:
//   • Kettet an JEDE Niederlage einer Creature: toedlicher Schaden,
//     Removal (The Yeeting …) und Opfer. Beide Spieler duerfen („a
//     Creature") — `preDefeatAnySide`, `preDefeatOnDestroy`.
//   • Wird ein Effekt-Opfer gerettet, FIZZELT der zugehoerige Effekt
//     (Occultism, Teocuilatl …) — die Engine setzt dafuer
//     `gs._opferFizzle`, die Aufrufer-Wege werten den Einsatz als
//     verbraucht.
//   • AUSNAHME: Opfer, die eine BESCHWOERUNG kostet (Foresta, Blue-Ice
//     Dragon …), oeffnen kein Fenster (Engine: `_beschwoerungsOpferTiefe`).
//
//  „its owner's next turn": der naechste Zug des BESITZERS der Creature —
//  laeuft gerade sein Zug, ist es der uebernaechste Zug insgesamt. Das
//  Loeschen haengt an der Instanz (`markiereBrettLoeschung`): wurde sie
//  inzwischen entfernt und neu beschworen, passiert nichts.
// ═══════════════════════════════════════════
const CARD_NAME = 'Barrier of Undying';

module.exports = {
  isCreaturePreDefeatReaction: true,
  preDefeatAnySide: true,
  preDefeatOnDestroy: true,

  creaturePreDefeatCondition(gs, reactorIdx, engine, inst, source, amount, type, info) {
    if (!inst || inst.zone !== 'support') return false;
    engine._barrierKontext = { reactorIdx, instId: inst.id, owner: inst.controller ?? inst.owner, isSacrifice: !!info?.isSacrifice };
    return true;
  },

  async creaturePreDefeatResolve(engine, reactorIdx, inst, source, amount, type, info) {
    const gs = engine.gs;
    if (!inst || inst.zone !== 'support') return { saved: false };
    engine._broadcastEvent('play_zone_animation', {
      type: 'barrier_of_faith', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    await engine._delay(450);
    if (!inst.counters) inst.counters = {};
    inst.counters.currentHp = 1;
    const besitzer = inst.owner;
    const amZug = gs.activePlayer === besitzer ? gs.turn + 2 : gs.turn + 1;
    engine.markiereBrettLoeschung(inst, amZug, CARD_NAME);
    inst.counters._barrierOfUndying = amZug;
    engine.log('barrier_of_undying', {
      player: gs.players[reactorIdx]?.username, target: inst.name,
      sacrifice: !!info?.isSacrifice, deleteTurn: amZug,
    });
    engine.sync();
    return { saved: true };
  },

  // CPU: eigene Creature immer retten; eine gegnerische nur, wenn damit
  // ein Opfer (und so sein Effekt) ins Leere laeuft.
  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME || p?.type !== 'confirm') return undefined;
    const k = engine._barrierKontext;
    if (!k) return { confirmed: false };
    return { confirmed: k.owner === k.reactorIdx || k.isSacrifice };
  },
};
