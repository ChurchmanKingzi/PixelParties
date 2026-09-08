// ═══════════════════════════════════════════
//  CARD EFFECT: "Loving Puppet Pavi"
//  Token (Normal) — Puppets, PP MSIN
//
//  "… You may once per turn summon a Creature
//  from your hand as an additional Action, but
//  if you do, its current and max HP become 1.
//  No other Token in the corresponding Hero's
//  Support Zones can use its active effect for
//  the rest of the turn afterwards. If the
//  corresponding Hero's name is "Tri Fecta, the
//  Puppet Master", immediately replace this
//  Token with a "Destructive Puppet Shishi"
//  Token."
//
//  Als Ruling 6 (2.9.): Summoning-Magic-Level und
//  Kosten gelten ganz normal — nur die Action ist
//  zusaetzlich (kein „place").
//
//  Umsetzung (v706, Als Vorgabe 3.9.: Subroutine
//  wie Drill Sergeant — NUR die Zusatzbeschwoerung
//  ist moeglich, abbrechbar)
//  ────────────────
//  • `performImmediateActionAnyHero` (Spider-
//    Dance-Muster): Immediate-Action-Modus, auf
//    Creatures beschraenkt, Helden-Picker bei
//    mehreren Kandidaten; Level/Schule/Summon-
//    barkeit kommen aus `getHeroEligibleActionCards`
//    (Als Ruling 6). Abbruch → `return false`,
//    kostet nichts (kein HOPT, keine Sperre).
//  • HP-1-Rider direkt auf der frisch beschworenen
//    Instanz (eigene Seite, gleicher Name,
//    turnPlayed = jetzt, juengste Instanz).
// ═══════════════════════════════════════════

const { hasCardType, ZONES } = require('./_hooks');
const {
  PUPPET_TOKEN_BASE, PUPPET_TOKEN_HOOKS, puppetGlow, PAVI, canUsePuppetActive, lockPuppetActives,
} = require('./_puppets-shared');

const CARD_NAME = PAVI;

function creatureInHand(engine, pi) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  return (ps?.hand || []).some(n => hasCardType(cardDB[n], 'Creature'));
}

module.exports = {
  ...PUPPET_TOKEN_BASE,
  hooks: { ...PUPPET_TOKEN_HOOKS },

  canActivateCreatureEffect(ctx) {
    if (!canUsePuppetActive(ctx)) return false;
    return creatureInHand(ctx._engine, ctx.cardOwner);
  },

  onCreatureEffect: async (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    if (!creatureInHand(engine, pi)) return false;
    puppetGlow(engine, pi, inst);   // v707: ohne Wartezeit

    const res = await engine.performImmediateActionAnyHero(pi, {
      title: CARD_NAME,
      description: 'You may summon a Creature from your hand as an additional Action — its current and max HP become 1.',
      allowedCardTypes: ['Creature'],
      skipAbilities: true,
      skipHeroEffects: true,
      cancellable: true,
    });
    if (!res?.played || !res.cardName) return false;   // abgebrochen: kostet nichts

    // HP-1-Rider auf der frisch beschworenen Instanz.
    const cands = engine.cardInstances.filter(c =>
      (c.controller ?? c.owner) === pi && c.zone === ZONES.SUPPORT
      && c.name === res.cardName && c.turnPlayed === gs.turn);
    const fresh = cands[cands.length - 1];
    if (fresh) {
      fresh.counters.maxHp = 1;
      fresh.counters.currentHp = 1;
      engine._broadcastEvent('play_zone_animation', {
        type: 'puppet_swap_pavi', owner: pi, heroIdx: fresh.heroIdx, zoneSlot: fresh.zoneSlot,
      });
      engine.log('pavi_hp_one', { player: gs.players[pi]?.username, creature: fresh.name });
    } else {
      engine.log('pavi_hp_one_missed', { player: gs.players[pi]?.username, creature: res.cardName });
    }
    lockPuppetActives(engine, pi, inst.heroIdx, inst.id);
    engine.sync();
    return true;
  },
};
