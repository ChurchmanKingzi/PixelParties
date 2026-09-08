// ═══════════════════════════════════════════
//  CARD EFFECT: "Lucky Puppet Laki"
//  Token (Normal) — Puppets, PP MSIN
//
//  "… You may once per turn place a Luck Counter
//  on all targets you control. When a target
//  with a Luck Counter on it is chosen by an
//  opponent's card or effect, you may remove all
//  Luck Counters from all targets you control to
//  redirect that card or effect to another
//  target you control of your choice. No other
//  Token … If the corresponding Hero's name is
//  "Tri Fecta, the Puppet Master", immediately
//  replace this Token with a "Preserving Puppet
//  Vinny" Token."
//
//  Als Ruling 7 (2.9.): Umleitung auch auf einen
//  Helden oder ein anderes Puppet; Preis ist
//  IMMER das Entfernen ALLER Luck Counter.
//
//  Umsetzung (v704)
//  ────────────────
//  • Luck Counter: Helden `hero._luckCounter`,
//    Support-Instanzen `counters.luck` (Client
//    zeigt 🍀).
//  • Die UMLEITUNG haengt NICHT an diesem Token:
//    Luck Counter sind jederzeit einloesbar, auch
//    ohne Laki (Als Ruling 3.9.). Der Waechter
//    (`LUCK_GUARD` in `_puppets-shared`) liegt an
//    Tri Fecta / Tri Ad (`boardGuards`). Das neue
//    Ziel muss in der Zielliste des Effekts stehen
//    (wie Monia Bot).
// ═══════════════════════════════════════════

const {
  PUPPET_TOKEN_BASE, PUPPET_TOKEN_HOOKS, LAKI, canUsePuppetActive, lockPuppetActives,
  collectAllyTargets,
} = require('./_puppets-shared');

const CARD_NAME = LAKI;

module.exports = {
  ...PUPPET_TOKEN_BASE,
  hooks: { ...PUPPET_TOKEN_HOOKS },

  canActivateCreatureEffect(ctx) { return canUsePuppetActive(ctx); },

  onCreatureEffect: async (ctx) => {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const { heroes, creatures } = collectAllyTargets(engine, pi);
    // `puppet_luck`: gold_sparkle-Bild mit lautem, klarem Klang (v706).
    for (const { hero, heroIdx } of heroes) {
      hero._luckCounter = (hero._luckCounter || 0) + 1;
      engine._broadcastEvent('play_zone_animation', { type: 'puppet_luck', owner: pi, heroIdx, zoneSlot: -1 });
    }
    for (const c of creatures) {
      c.counters.luck = (c.counters.luck || 0) + 1;
      engine._broadcastEvent('play_zone_animation', { type: 'puppet_luck', owner: pi, heroIdx: c.heroIdx, zoneSlot: c.zoneSlot });
    }
    engine.log('laki_luck_counters', { player: engine.gs.players[pi]?.username, heroes: heroes.length, creatures: creatures.length });
    lockPuppetActives(engine, pi, inst.heroIdx, inst.id);
    engine.sync();
    await engine._delay(400);
    return true;
  },
};
