// ═══════════════════════════════════════════
//  CARD EFFECT: "Swift Eagle Warrior"
//  Creature (Normal), Lv1, 50 HP, Summoning Magic
//
//  "You may remove 1 Doom Counter from a 'Doom Clock'
//   on the board to summon this Creature from your
//   hand as an additional Action. You can only summon
//   1 'Swift Eagle Warrior' per turn this way.
//   You may once per turn place a Doom Counter onto a
//   'Doom Clock' on the board. Once per turn, when a
//   Doom Counter is placed onto a 'Doom Clock',
//   draw 1 card."
//
//  Drei Grenzen, und sie sind NICHT gleich streng
//  (Als Praezisierung 5.8.):
//   • Zusatz-Beschwoerung — HARD once per turn, also
//     pro SPIELER. "You can only summon 1 'Swift
//     Eagle Warrior' per turn this way" steht
//     ausdruecklich auf der Karte.
//   • Counter setzen — SOFT, pro INSTANZ. Zwei Eagles
//     duerfen je einen Counter legen. Das leistet der
//     `equipEffect`-artige Vertrag von
//     `creatureEffect` bereits von selbst: die Engine
//     sperrt ueber `creature-effect:<instId>`.
//   • Nachziehen — SOFT, pro INSTANZ. Eigener
//     Rundenstempel auf der Instanz (Muster von
//     Steam Dwarf Dragon Pilot), weil ein Trigger
//     keine Engine-Sperre hat.
// ═══════════════════════════════════════════

const D = require('./_doom-clock-shared');

const CARD_NAME = 'Swift Eagle Warrior';

// HARD, pro Spieler — steht so auf der Karte.
const KEY_SUMMON = (pi) => `free-ability:${CARD_NAME} Summon:${pi}`;
const benutzt = (engine, key) => engine.gs.hoptUsed?.[key] === engine.gs.turn;
const stempeln = (engine, key) => {
  if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
  engine.gs.hoptUsed[key] = engine.gs.turn;
};

// SOFT, pro Instanz: Rundenstempel auf der Karte selbst. Setzt sich
// von allein zurueck, auch wenn die Creature zwischenzeitlich Frozen
// oder Negated war (Lehre vom 3-Headed Giant, v198).
const DRAW_TURN = '_eagleDrawTurn';
const zogSchon = (engine, inst) => inst?.counters?.[DRAW_TURN] === (engine.gs.turn || 0);
const zugVermerken = (engine, inst) => {
  if (!inst.counters) inst.counters = {};
  inst.counters[DRAW_TURN] = engine.gs.turn || 0;
};

module.exports = {
  activeIn: ['hand', 'support'],

  inherentAction(gs, pi, heroIdx, engine) {
    if (benutzt(engine, KEY_SUMMON(pi))) return false;
    return D.clocksWithCounters(engine).length > 0;
  },

  async beforeSummon(ctx) {
    if (!ctx.isInherentAction) return true;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (benutzt(engine, KEY_SUMMON(pi))) return false;

    const uhr = await D.pickClock(engine, pi, D.clocksWithCounters(engine), {
      title: CARD_NAME,
      message: 'Remove 1 counter from which Doom Clock?',
      cancellable: true,
    });
    if (!uhr) return false;
    if (D.removeCounters(engine, uhr, 1) !== 1) return false;
    stempeln(engine, KEY_SUMMON(pi));
    return true;
  },

  // ── Aktiver Effekt: einen Counter setzen ──────────────────────────
  creatureEffect: true,

  // Die Einmal-pro-Runde-Sperre PRO INSTANZ bringt der
  // `creatureEffect`-Vertrag mit (`creature-effect:<instId>`) — hier
  // deshalb KEINE eigene, sonst waere sie doppelt und faelschlich
  // pro Spieler.
  canActivateCreatureEffect(ctx) {
    return D.getDoomClocks(ctx._engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;

    const uhr = await D.pickClock(engine, pi, D.getDoomClocks(engine), {
      title: CARD_NAME,
      message: 'Place a counter onto which Doom Clock?',
      cancellable: true,
    });
    if (!uhr) return false;

    await D.placeCounter(engine, uhr, pi, { sourceName: CARD_NAME });
    return true;
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    /** Einmal pro Zug eine Karte ziehen, wenn ein Counter gelegt wird. */
    onDoomCounterPlaced: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      if (ctx.card?.zone !== 'support') return;
      // Pro INSTANZ, nicht pro Spieler: zwei Eagles ziehen je einmal.
      if (zogSchon(engine, ctx.card)) return;
      zugVermerken(engine, ctx.card);
      await ctx.drawCards(pi, 1);
      engine.log('swift_eagle_draw', { player: engine.gs.players[pi]?.username });
      engine.sync();
    },
  },
};
