// ═══════════════════════════════════════════
//  CARD EFFECT: "Preserving Puppet Vinny"
//  Token (Normal) — Puppets, PP MSIN
//
//  "… You may once per turn put a Preserve
//  Counter on all Creatures you control. When a
//  Creature would be affected by an opponent's
//  card or effect while it has a Preserve
//  Counter on it, you may remove all Preserve
//  Counters from all Creatures you control to
//  negate all effects that card or effect would
//  have on those Creatures. No other Token … If
//  the corresponding Hero's name is "Tri Ad, the
//  Puppet Mistress", immediately replace this
//  Token with a "Lucky Puppet Laki" Token."
//
//  Als Ruling 8 (2.9.): Negation wirkt NUR auf
//  die Creatures mit Counter — bei Multi-Ziel
//  wird der Held trotzdem getroffen; ein
//  negierter Angriff gilt als ausgefuehrt.
//  Counter liegen AUCH auf anderen Puppets.
//
//  Umsetzung (v704/v708)
//  ────────────────
//  • Preserve Counter: `counters.preserve`
//    (Client zeigt 🔒).
//  • Die NEGATION haengt NICHT an diesem Token:
//    Preserve Counter sind jederzeit einloesbar,
//    auch ohne Vinny (Als Ruling 3.9.). Der
//    Waechter (`PRESERVE_GUARD` in `_puppets-shared`)
//    liegt an Tri Fecta / Tri Ad (`boardGuards`):
//    Zielwahl-Fenster (Teil-Negation per
//    `dropTargetIds`), AoE-Waechter und Effekt-
//    Waechter fuer Schadensbatch / Zerstoerung /
//    Status.
// ═══════════════════════════════════════════

const {
  PUPPET_TOKEN_BASE, PUPPET_TOKEN_HOOKS, VINNY, canUsePuppetActive, lockPuppetActives,
  collectAllyTargets,
} = require('./_puppets-shared');

const CARD_NAME = VINNY;

module.exports = {
  ...PUPPET_TOKEN_BASE,
  hooks: { ...PUPPET_TOKEN_HOOKS },

  canActivateCreatureEffect(ctx) {
    if (!canUsePuppetActive(ctx)) return false;
    return collectAllyTargets(ctx._engine, ctx.cardOwner, { heroes: false }).creatures.length > 0;
  },

  onCreatureEffect: async (ctx) => {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const { creatures } = collectAllyTargets(engine, pi, { heroes: false });
    for (const c of creatures) {
      c.counters.preserve = (c.counters.preserve || 0) + 1;
      engine._broadcastEvent('play_zone_animation', { type: 'puppet_preserve', owner: pi, heroIdx: c.heroIdx, zoneSlot: c.zoneSlot });
    }
    engine.log('vinny_preserve_counters', { player: engine.gs.players[pi]?.username, creatures: creatures.length });
    lockPuppetActives(engine, pi, inst.heroIdx, inst.id);
    engine.sync();
    await engine._delay(400);
    return true;
  },
};
