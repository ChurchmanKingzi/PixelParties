// ═══════════════════════════════════════════
//  CARD EFFECT: "Devlin, the Masked Butcher"
//  Hero
//
//  "Any target that is hit by this Hero with an
//  Attack Bleeds for the rest of the game. When
//  this Hero hits 1 or more Bleeding targets
//  with an Attack, those targets' controller
//  must discard 2 cards from their hand per
//  Bleeding target hit."
//
//  Als Ruling 4 (4.9.): fuer den Discard zaehlen
//  nur Ziele, die VOR diesem Treffer schon
//  bluteten.
//
//  Umsetzung (v712)
//  ────────────────
//  • Heldenziele: `beforeDamage` stempelt den
//    Vorher-Zustand auf das Heldenobjekt,
//    `afterDamage` legt Bleed und zaehlt den
//    Discard.
//  • Kreaturenziele: `beforeCreatureDamageBatch` /
//    `afterCreatureDamageBatch` je Eintrag.
//  • „Hit" = der Schadensvorgang lief (auch bei
//    0 durch Schilde); negierte Angriffe feuern
//    afterDamage nicht.
//  • Discard ueber `actionPromptForceDiscard`
//    (Erst-Runden-Schutz greift wie ueberall).
// ═══════════════════════════════════════════

const { bleedHero, bleedCreature } = require('./_bleed-shared');

const CARD_NAME = 'Devlin, the Masked Butcher';
const DISCARD_PER_TARGET = 2;

function isOwnAttack(ctx, source) {
  if (!source || ctx.type !== 'attack' && ctx.entryType !== 'attack') return false;
  if (source.heroIdx !== ctx.card.heroIdx) return false;
  const srcOwner = source.heroOwner ?? source.controller ?? source.owner ?? -1;
  return srcOwner === ctx.cardOwner;
}

async function forceDiscard(engine, pi, count, source) {
  if (count <= 0) return;
  await engine.actionPromptForceDiscard(pi, count, { source: CARD_NAME, sourceOwner: source });
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    beforeDamage: (ctx) => {
      if (ctx.type !== 'attack' || !isOwnAttack(ctx, ctx.source)) return;
      const t = ctx.target;
      if (!t || t.hp === undefined) return;
      t._devlinWasBleeding = !!t.statuses?.bleeding;
    },
    afterDamage: async (ctx) => {
      if (ctx.type !== 'attack' || !isOwnAttack(ctx, ctx.source)) return;
      const engine = ctx._engine;
      const t = ctx.target;
      if (!t || t.hp === undefined) return;
      const wasBleeding = !!t._devlinWasBleeding;
      delete t._devlinWasBleeding;
      const owner = engine._findHeroOwner(t);
      const heroIdx = engine.gs.players[owner]?.heroes?.indexOf(t) ?? -1;
      if (owner < 0 || heroIdx < 0) return;
      if (t.hp > 0) await bleedHero(engine, owner, heroIdx, CARD_NAME, ctx.cardOwner);
      if (wasBleeding) {
        engine.log('devlin_bleeding_hit', { player: engine.gs.players[ctx.cardOwner]?.username, targets: 1 });
        await forceDiscard(engine, owner, DISCARD_PER_TARGET, ctx.cardOwner);
      }
    },
    beforeCreatureDamageBatch: (ctx) => {
      for (const e of (ctx.entries || [])) {
        if (e.type !== 'attack' || !isOwnAttack({ ...ctx, type: 'attack' }, e.source)) continue;
        e._devlinWasBleeding = !!e.inst?.counters?.bleeding;
        e._devlinOwn = true;
      }
    },
    afterCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const byOwner = new Map();
      for (const e of (ctx.entries || [])) {
        if (!e._devlinOwn || e.cancelled) continue;
        const inst = e.inst;
        if (!inst) continue;
        if (inst.zone === 'support') await bleedCreature(engine, inst, CARD_NAME, ctx.cardOwner);
        if (e._devlinWasBleeding) {
          const o = inst.controller ?? inst.owner;
          byOwner.set(o, (byOwner.get(o) || 0) + 1);
        }
      }
      for (const [o, n] of byOwner) {
        engine.log('devlin_bleeding_hit', { player: engine.gs.players[ctx.cardOwner]?.username, targets: n });
        await forceDiscard(engine, o, DISCARD_PER_TARGET * n, ctx.cardOwner);
      }
    },
  },
};
