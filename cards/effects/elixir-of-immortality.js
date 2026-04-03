// ═══════════════════════════════════════════
//  CARD EFFECT: "Elixir of Immortality"
//  Potion — When played, placed face-up on the
//  board as a permanent. While active, when any
//  target the owner controls dies, Elixir revives
//  it (hero to 50% max HP, creature re-summoned
//  fresh). Then Elixir is deleted.
//
//  If multiple targets die at once, player picks
//  which to revive. Elixir is mandatory.
//
//  Heroes: die normally (equips lost, statuses
//  cleared), then revived with 50% max HP.
//  Creatures: go to discard, then brought back
//  as fresh instance with 50% HP + on-summon.
// ═══════════════════════════════════════════

const fs = require('fs');
const path = require('path');

module.exports = {
  isPotion: true,
  deferBroadcast: true,
  activeIn: ['permanent'],

  canActivate(gs, pi) {
    // Can always be placed — no conditions
    return true;
  },

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return { cancelled: true };

    // Broadcast to opponent
    const oi = pi === 0 ? 1 : 0;
    const oppSid = engine.gs.players[oi]?.socketId;
    if (oppSid && engine.io) {
      engine.io.to(oppSid).emit('card_reveal', { cardName: 'Elixir of Immortality' });
    }
    await engine._delay(100);

    // Place as a permanent on the board (don't delete)
    if (!ps.permanents) ps.permanents = [];
    const permId = 'perm-' + Date.now() + '-' + Math.random();
    ps.permanents.push({ name: 'Elixir of Immortality', id: permId });

    // Track as a card instance in the permanent zone
    const inst = engine._trackCard('Elixir of Immortality', pi, 'permanent', -1, -1);
    inst.counters.permId = permId;

    engine.log('permanent_placed', { card: 'Elixir of Immortality', player: ps.username });
    engine.sync();

    // Return special flag: card was placed, not consumed normally
    return { placed: true };
  },

  hooks: {
    /**
     * Hero KO: if our hero died and Elixir is active, revive immediately.
     */
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      const hero = ctx.hero;
      if (!hero || !hero.name) return;

      // Only trigger for OUR heroes
      const heroIdx = ps.heroes.findIndex(h => h === hero);
      if (heroIdx < 0) return;

      // Check Elixir is still active (not already triggered)
      const perm = (ps.permanents || []).find(p => p.name === 'Elixir of Immortality');
      if (!perm) return;

      // Mark as triggered to prevent double-fire
      if (perm._triggered) return;
      perm._triggered = true;

      // Delay briefly so death visuals register
      engine.sync();
      await engine._delay(600);

      // Golden animation on Elixir permanent
      engine._broadcastEvent('play_permanent_animation', { owner: pi, permId: perm.id, type: 'holy_revival' });
      await engine._delay(1000);

      // Revive hero: 50% max HP (rounded up)
      const reviveHp = Math.ceil((hero.maxHp || 400) / 2);
      await engine.actionReviveHero(pi, heroIdx, reviveHp, {
        source: 'Elixir of Immortality',
        animDelay: 800,
      });

      // Delete Elixir
      await removeElixir(engine, pi, perm);
    },

    /**
     * After creature damage batch: check if any of our creatures died.
     * If Elixir is active and wasn't consumed by a hero KO, revive one.
     */
    afterCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];

      // Check Elixir is still active
      const perm = (ps.permanents || []).find(p => p.name === 'Elixir of Immortality');
      if (!perm || perm._triggered) return;

      // Check if any of our creatures died in this batch
      const entries = ctx.entries || [];
      const deadCreatures = [];
      for (const e of entries) {
        if (e.inst.owner !== pi) continue;
        if (e.inst.counters.currentHp !== undefined && e.inst.counters.currentHp <= 0) {
          // Creature is dead — check it's actually in discard now
          if (ps.discardPile.includes(e.inst.name)) {
            deadCreatures.push({
              name: e.inst.name,
              heroIdx: e.inst.heroIdx,
              zoneSlot: e.inst.zoneSlot,
            });
          }
        }
      }

      if (deadCreatures.length === 0) return;

      perm._triggered = true;

      // If multiple died, player picks which to revive
      let chosen;
      if (deadCreatures.length === 1) {
        chosen = deadCreatures[0];
      } else {
        const galleryCards = deadCreatures.map(dc => ({ name: dc.name, source: 'discard' }));
        const result = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: galleryCards,
          title: 'Elixir of Immortality',
          description: 'Multiple targets fell! Choose one to revive.',
          cancellable: false,
        });
        if (result?.cardName) {
          chosen = deadCreatures.find(dc => dc.name === result.cardName) || deadCreatures[0];
        } else {
          chosen = deadCreatures[0];
        }
      }

      // Delay briefly so death visuals register
      engine.sync();
      await engine._delay(600);

      // Golden animation on Elixir permanent
      engine._broadcastEvent('play_permanent_animation', { owner: pi, permId: perm.id, type: 'holy_revival' });
      await engine._delay(1000);

      // Revive creature: remove from discard, find a free support zone
      const discIdx = ps.discardPile.indexOf(chosen.name);
      if (discIdx < 0) { await removeElixir(engine, pi, perm); return; }

      // Find a free zone: prefer original zone, then same hero, then any hero
      let targetHi = -1, targetSi = -1;

      // Try original zone
      const origSlot = (ps.supportZones[chosen.heroIdx] || [])[chosen.zoneSlot] || [];
      if (origSlot.length === 0 && ps.heroes[chosen.heroIdx]?.hp > 0) {
        targetHi = chosen.heroIdx;
        targetSi = chosen.zoneSlot;
      }

      // Try same hero, different zone
      if (targetHi < 0 && ps.heroes[chosen.heroIdx]?.hp > 0) {
        const supZones = ps.supportZones[chosen.heroIdx] || [];
        for (let z = 0; z < supZones.length; z++) {
          if ((supZones[z] || []).length === 0) { targetHi = chosen.heroIdx; targetSi = z; break; }
        }
      }

      // Try any other hero
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
        // No free zone anywhere — Elixir fizzles but is still consumed
        engine.log('elixir_fizzle', { reason: 'no_free_zone', creature: chosen.name });
        await removeElixir(engine, pi, perm);
        return;
      }

      // Remove from discard
      ps.discardPile.splice(discIdx, 1);

      // Place fresh creature
      if (!ps.supportZones[targetHi]) ps.supportZones[targetHi] = [[], [], []];
      ps.supportZones[targetHi][targetSi] = [chosen.name];

      // Load card DB for HP
      const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf-8'));
      const cd = allCards.find(c => c.name === chosen.name);
      const maxHp = cd?.hp || 100;
      const reviveHp = Math.ceil(maxHp / 2);

      // Track fresh instance
      const newInst = engine._trackCard(chosen.name, pi, 'support', targetHi, targetSi);
      newInst.counters.currentHp = reviveHp;
      newInst.counters.isPlacement = 1;

      engine.log('creature_revived', { card: chosen.name, player: ps.username, hp: reviveHp, heroIdx: targetHi, zoneSlot: targetSi, by: 'Elixir of Immortality' });

      // Revival animation on creature zone
      engine._broadcastEvent('summon_effect', { owner: pi, heroIdx: targetHi, zoneSlot: targetSi, cardName: chosen.name });
      engine._broadcastEvent('play_zone_animation', { type: 'holy_revival', owner: pi, heroIdx: targetHi, zoneSlot: targetSi });
      engine.sync();
      await engine._delay(800);

      // Fire on-summon hooks (fresh instance)
      await engine.runHooks('onPlay', { _onlyCard: newInst, playedCard: newInst, cardName: chosen.name, zone: 'support', heroIdx: targetHi, zoneSlot: targetSi });
      await engine.runHooks('onCardEnterZone', { enteringCard: newInst, toZone: 'support', toHeroIdx: targetHi });

      // Delete Elixir
      await removeElixir(engine, pi, perm);
    },
  },
};

/**
 * Remove the Elixir permanent from the board and send to deleted pile.
 */
async function removeElixir(engine, pi, perm) {
  const ps = engine.gs.players[pi];
  const idx = (ps.permanents || []).findIndex(p => p.id === perm.id);
  if (idx >= 0) ps.permanents.splice(idx, 1);
  ps.deletedPile.push('Elixir of Immortality');
  // Untrack card instance
  const inst = engine.cardInstances.find(c => c.owner === pi && c.zone === 'permanent' && c.counters.permId === perm.id);
  if (inst) engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
  engine.log('permanent_removed', { card: 'Elixir of Immortality', player: ps.username });
  engine.sync();
}
