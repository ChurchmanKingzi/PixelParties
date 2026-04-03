// ═══════════════════════════════════════════
//  CARD EFFECT: "Flame Avalanche"
//  Spell (Destruction Magic Lv3) — Deals 150
//  damage to ALL targets the opponent controls.
//  After resolving, the player cannot deal any
//  more damage to opponent's targets this turn
//  (absolute lock — overrides everything).
//
//  Cannot be played if the player already dealt
//  damage to opponent's targets this turn.
//
//  If played through a Hero with forcesSingleTarget
//  (Ida), becomes single-target instead of AoE.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const ps = ctx.players[pi];
      const oppPs = ctx.players[oppIdx];
      const heroIdx = ctx.cardHeroIdx;

      // Safety: if already dealt damage this turn, fizzle
      if (ps.dealtDamageToOpponent) return;

      // Check Ida's single-target override
      const gs = ctx.gameState;
      const heroFlags = gs.heroFlags?.[`${pi}-${heroIdx}`];
      const singleTarget = heroFlags?.forcesSingleTarget;

      if (singleTarget) {
        // ── SINGLE-TARGET MODE (Ida) ──
        const target = await ctx.promptDamageTarget({
          side: 'enemy',
          types: ['hero', 'creature'],
          damageType: 'destruction_spell',
          title: 'Flame Avalanche',
          description: 'Ida has to concentrate on one target — choose! Deal 150 damage.',
          confirmLabel: '🔥 150 Damage!',
          confirmClass: 'btn-danger',
          cancellable: false,
        });

        if (!target) {
          // Lock damage even if no target (spell still resolves)
          ps.damageLocked = true;
          engine.sync();
          return;
        }

        // Play flame animation on target
        if (target.type === 'hero') {
          engine._broadcastEvent('play_zone_animation', { type: 'flame_avalanche', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1 });
        } else {
          engine._broadcastEvent('play_zone_animation', { type: 'flame_avalanche', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
        }
        await engine._delay(300);

        // Deal damage
        if (target.type === 'hero') {
          const hero = oppPs.heroes?.[target.heroIdx];
          if (hero && hero.hp > 0) {
            await ctx.dealDamage(hero, 150, 'destruction_spell');
          }
        } else if (target.type === 'equip') {
          const inst = target.cardInstance || engine.cardInstances.find(c =>
            c.owner === target.owner && c.zone === 'support' &&
            c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
          );
          if (inst) {
            await engine.actionDealCreatureDamage(
              { name: 'Flame Avalanche', owner: pi, heroIdx },
              inst, 150, 'destruction_spell',
              { sourceOwner: pi, canBeNegated: true }
            );
          }
        }
      } else {
        // ── AoE MODE (normal) ──
        // Collect ALL opponent heroes for animation (including shielded/immune)
        const allHeroes = [];
        const damageableHeroes = [];
        for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
          const hero = oppPs.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          allHeroes.push({ heroIdx: hi, hero });
          if (!hero.statuses?.shielded) damageableHeroes.push({ heroIdx: hi, hero });
        }

        const creatureEntries = [];
        for (const inst of engine.cardInstances) {
          if (inst.owner !== oppIdx || inst.zone !== 'support') continue;
          creatureEntries.push({
            inst,
            amount: 150,
            type: 'destruction_spell',
            source: { name: 'Flame Avalanche', owner: pi, heroIdx },
            sourceOwner: pi,
            canBeNegated: true,
            isStatusDamage: false,
            animType: 'flame_avalanche',
          });
        }

        // Play flame animation on ALL targets simultaneously (even shielded — animation always plays)
        for (const { heroIdx: hi } of allHeroes) {
          engine._broadcastEvent('play_zone_animation', { type: 'flame_avalanche', owner: oppIdx, heroIdx: hi, zoneSlot: -1 });
        }
        if (allHeroes.length > 0 && creatureEntries.length === 0) {
          await engine._delay(300);
        }

        // Deal 150 to each DAMAGEABLE opponent hero (not shielded)
        for (const { hero } of damageableHeroes) {
          await ctx.dealDamage(hero, 150, 'destruction_spell');
          engine.sync();
          await engine._delay(150);
        }

        // Deal 150 to all opponent creatures via batch
        if (creatureEntries.length > 0) {
          await engine.processCreatureDamageBatch(creatureEntries);
        }
      }

      // Lock: no more damage to opponent's targets this turn (absolute)
      ps.damageLocked = true;
      engine.log('damage_locked', { player: ps.username, by: 'Flame Avalanche' });
      engine.sync();
    },
  },

  /**
   * Play condition: cannot play if player already dealt damage
   * to opponent's targets this turn.
   * Used by engine.getBlockedSpells() to gray out in hand.
   */
  spellPlayCondition(gs, playerIdx) {
    return !gs.players[playerIdx]?.dealtDamageToOpponent;
  },
};
