// ═══════════════════════════════════════════
//  CARD EFFECT: "Elixir of Immortality"
//  Potion — When played, placed face-up on the
//  board as a permanent. While active, when any
//  target the owner controls dies, Elixir revives
//  it (hero to 50% max HP, creature re-summoned
//  fresh). Then Elixir is deleted.
//
//  If multiple targets die at once, player picks
//  which to revive via gallery prompt.
//
//  Death collection: onHeroKO collects dead heroes
//  without immediately reviving. The actual revive
//  prompt happens at the NEXT batch checkpoint
//  (afterCreatureDamageBatch, afterAllStatusDamage,
//  or afterSpellResolved), giving all simultaneous
//  deaths a chance to be collected first.
// ═══════════════════════════════════════════

const fs = require('fs');
const path = require('path');

module.exports = {
  isPotion: true,
  deferBroadcast: true,
  activeIn: ['permanent'],

  canActivate(gs, pi) {
    return true;
  },

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return { cancelled: true };

    const oi = pi === 0 ? 1 : 0;
    const oppSid = engine.gs.players[oi]?.socketId;
    if (oppSid && engine.io) {
      engine.io.to(oppSid).emit('card_reveal', { cardName: 'Elixir of Immortality' });
    }
    await engine._delay(100);

    if (!ps.permanents) ps.permanents = [];
    const permId = 'perm-' + Date.now() + '-' + Math.random();
    ps.permanents.push({ name: 'Elixir of Immortality', id: permId });

    const inst = engine._trackCard('Elixir of Immortality', pi, 'permanent', -1, -1);
    inst.counters.permId = permId;

    engine.log('permanent_placed', { card: 'Elixir of Immortality', player: ps.username });
    engine.sync();

    return { placed: true };
  },

  hooks: {
    /**
     * Hero KO: collect the dead hero for deferred processing.
     * Do NOT revive here — wait for a batch checkpoint.
     */
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      const hero = ctx.hero;
      if (!hero || !hero.name) return;

      const heroIdx = ps.heroes.findIndex(h => h === hero);
      if (heroIdx < 0) return;

      const perm = (ps.permanents || []).find(p => p.name === 'Elixir of Immortality');
      if (!perm || perm._triggered) return;

      if (!perm._pendingHeroes) perm._pendingHeroes = [];
      if (!perm._pendingHeroes.some(ph => ph.heroIdx === heroIdx)) {
        perm._pendingHeroes.push({ name: hero.name, heroIdx, maxHp: hero.maxHp || 400 });
      }
    },

    /**
     * After creature damage batch: collect dead creatures into pending list.
     * Do NOT resolve here — individual batches may fire multiple times per
     * damage source (e.g. Pyroblast). Resolution happens at later checkpoints.
     */
    afterCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];

      const perm = (ps.permanents || []).find(p => p.name === 'Elixir of Immortality');
      if (!perm || perm._triggered) return;

      const entries = ctx.entries || [];
      for (const e of entries) {
        if (e.inst.owner !== pi) continue;
        if (e.inst.counters.currentHp !== undefined && e.inst.counters.currentHp <= 0) {
          if (ps.discardPile.includes(e.inst.name)) {
            if (!perm._pendingCreatures) perm._pendingCreatures = [];
            if (!perm._pendingCreatures.some(pc => pc.name === e.inst.name && pc.heroIdx === e.inst.heroIdx && pc.zoneSlot === e.inst.zoneSlot)) {
              perm._pendingCreatures.push({
                name: e.inst.name,
                heroIdx: e.inst.heroIdx,
                zoneSlot: e.inst.zoneSlot,
              });
            }
          }
        }
      }
      // Collection only — resolve happens at afterAllStatusDamage / afterSpellResolved / onPhaseEnd
    },

    /** After all status damage: resolve pending hero deaths from burn/poison. */
    afterAllStatusDamage: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];

      const perm = (ps.permanents || []).find(p => p.name === 'Elixir of Immortality');
      if (!perm || perm._triggered) return;
      if (!(perm._pendingHeroes?.length > 0 || perm._pendingCreatures?.length > 0)) return;

      await resolveElixirPending(engine, pi, perm);
    },

    /** After a spell resolves: resolve pending hero deaths from AoE. */
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];

      const perm = (ps.permanents || []).find(p => p.name === 'Elixir of Immortality');
      if (!perm || perm._triggered) return;
      if (!(perm._pendingHeroes?.length > 0 || perm._pendingCreatures?.length > 0)) return;

      await resolveElixirPending(engine, pi, perm);
    },

    /** Phase end: catch-all for deaths from combat, attacks, or other sources. */
    onPhaseEnd: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];

      const perm = (ps.permanents || []).find(p => p.name === 'Elixir of Immortality');
      if (!perm || perm._triggered) return;
      if (!(perm._pendingHeroes?.length > 0 || perm._pendingCreatures?.length > 0)) return;

      await resolveElixirPending(engine, pi, perm);
    },
  },
};

// ═══════════════════════════════════════════
//  SHARED RESOLVE LOGIC
// ═══════════════════════════════════════════

async function resolveElixirPending(engine, pi, perm) {
  const ps = engine.gs.players[pi];
  const pendingHeroes = perm._pendingHeroes || [];
  const pendingCreatures = perm._pendingCreatures || [];
  const allDead = [
    ...pendingHeroes.map(h => ({ ...h, deathType: 'hero' })),
    ...pendingCreatures.map(c => ({ ...c, deathType: 'creature' })),
  ];

  if (allDead.length === 0) return;

  perm._triggered = true;
  perm._pendingHeroes = [];
  perm._pendingCreatures = [];

  let chosen;
  if (allDead.length === 1) {
    chosen = allDead[0];
  } else {
    const galleryCards = allDead.map(d => ({ name: d.name, source: d.deathType === 'hero' ? 'hero' : 'discard' }));
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: 'Elixir of Immortality',
      description: 'Multiple targets fell! Choose one to revive.',
      cancellable: false,
    });
    if (result?.cardName) {
      chosen = allDead.find(d => d.name === result.cardName) || allDead[0];
    } else {
      chosen = allDead[0];
    }
  }

  engine.sync();
  await engine._delay(600);

  engine._broadcastEvent('play_permanent_animation', { owner: pi, permId: perm.id, type: 'holy_revival' });
  await engine._delay(1000);

  if (chosen.deathType === 'hero') {
    await engine.actionReviveHero(pi, chosen.heroIdx, Math.ceil(chosen.maxHp / 2), {
      source: 'Elixir of Immortality',
      animDelay: 800,
    });
  } else {
    await reviveCreature(engine, pi, chosen);
  }

  await removeElixir(engine, pi, perm);
}

async function reviveCreature(engine, pi, chosen) {
  const ps = engine.gs.players[pi];

  const discIdx = ps.discardPile.indexOf(chosen.name);
  if (discIdx < 0) return;

  let targetHi = -1, targetSi = -1;

  const origSlot = (ps.supportZones[chosen.heroIdx] || [])[chosen.zoneSlot] || [];
  if (origSlot.length === 0 && ps.heroes[chosen.heroIdx]?.hp > 0) {
    targetHi = chosen.heroIdx;
    targetSi = chosen.zoneSlot;
  }

  if (targetHi < 0 && ps.heroes[chosen.heroIdx]?.hp > 0) {
    const supZones = ps.supportZones[chosen.heroIdx] || [];
    for (let z = 0; z < supZones.length; z++) {
      if ((supZones[z] || []).length === 0) { targetHi = chosen.heroIdx; targetSi = z; break; }
    }
  }

  if (targetHi < 0) {
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (hi === chosen.heroIdx) continue;
      if (!ps.heroes[hi]?.name || ps.heroes[hi].hp <= 0) continue;
      const supZones = ps.supportZones[hi] || [];
      for (let z = 0; z < supZones.length; z++) {
        if ((supZones[z] || []).length === 0) { targetHi = hi; targetSi = z; break; }
      }
      if (targetHi >= 0) break;
    }
  }

  if (targetHi < 0) {
    engine.log('elixir_fizzle', { reason: 'no_free_zone', creature: chosen.name });
    return;
  }

  ps.discardPile.splice(discIdx, 1);

  if (!ps.supportZones[targetHi]) ps.supportZones[targetHi] = [[], [], []];
  ps.supportZones[targetHi][targetSi] = [chosen.name];

  const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf-8'));
  const cd = allCards.find(c => c.name === chosen.name);
  const maxHp = cd?.hp || 100;
  const reviveHp = Math.ceil(maxHp / 2);

  const newInst = engine._trackCard(chosen.name, pi, 'support', targetHi, targetSi);
  newInst.counters.currentHp = reviveHp;
  newInst.counters.isPlacement = 1;

  engine.log('creature_revived', { card: chosen.name, player: ps.username, hp: reviveHp, heroIdx: targetHi, zoneSlot: targetSi, by: 'Elixir of Immortality' });

  engine._broadcastEvent('summon_effect', { owner: pi, heroIdx: targetHi, zoneSlot: targetSi, cardName: chosen.name });
  engine._broadcastEvent('play_zone_animation', { type: 'holy_revival', owner: pi, heroIdx: targetHi, zoneSlot: targetSi });
  engine.sync();
  await engine._delay(800);

  await engine.runHooks('onPlay', { _onlyCard: newInst, playedCard: newInst, cardName: chosen.name, zone: 'support', heroIdx: targetHi, zoneSlot: targetSi });
  await engine.runHooks('onCardEnterZone', { enteringCard: newInst, toZone: 'support', toHeroIdx: targetHi });
}

async function removeElixir(engine, pi, perm) {
  const ps = engine.gs.players[pi];
  const idx = (ps.permanents || []).findIndex(p => p.id === perm.id);
  if (idx >= 0) ps.permanents.splice(idx, 1);
  ps.deletedPile.push('Elixir of Immortality');
  const inst = engine.cardInstances.find(c => c.owner === pi && c.zone === 'permanent' && c.counters.permId === perm.id);
  if (inst) engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
  engine.log('permanent_removed', { card: 'Elixir of Immortality', player: ps.username });
  engine.sync();
}
