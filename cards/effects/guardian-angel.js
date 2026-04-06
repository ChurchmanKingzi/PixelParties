// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Angel"
//  Spell (Support Magic Lv3, Attachment)
//
//  Once per game. Attach to ANY Hero (friend
//  or foe). When the equipped Hero would die,
//  set HP to 1, play angel animation, then
//  fully heal to max HP. Delete Guardian Angel.
//
//  If the Hero has Overheal Shock, the full
//  heal converts to damage and kills the hero.
// ═══════════════════════════════════════════

module.exports = {
  oncePerGame: true,
  oncePerGameKey: 'guardianAngel',

  spellPlayCondition(gs, pi) {
    // Need at least 1 alive hero (either side) with a free support zone
    for (let p = 0; p < 2; p++) {
      const ps = gs.players[p];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        for (let si = 0; si < 3; si++) {
          if (((ps.supportZones[hi] || [])[si] || []).length === 0) return true;
        }
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];

      // Build targets: ALL heroes (both sides) with free support zones
      const targets = [];
      for (let p = 0; p < 2; p++) {
        const tps = gs.players[p];
        for (let hi = 0; hi < (tps.heroes || []).length; hi++) {
          const hero = tps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          let hasFreeZone = false;
          for (let si = 0; si < 3; si++) {
            const slot = (tps.supportZones[hi] || [])[si] || [];
            if (slot.length === 0) {
              hasFreeZone = true;
              targets.push({
                id: `equip-${p}-${hi}-${si}`,
                type: 'equip',
                owner: p,
                heroIdx: hi,
                slotIdx: si,
                cardName: '',
              });
            }
          }
          if (hasFreeZone) {
            targets.push({
              id: `hero-${p}-${hi}`,
              type: 'hero',
              owner: p,
              heroIdx: hi,
              cardName: hero.name,
            });
          }
        }
      }

      if (targets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // Select target
      let targetOwner, targetHeroIdx, targetSlot;
      const heroTargets = targets.filter(t => t.type === 'hero');
      const zoneTargets = targets.filter(t => t.type === 'equip');

      if (heroTargets.length === 1 && zoneTargets.length === 1) {
        targetOwner = heroTargets[0].owner;
        targetHeroIdx = heroTargets[0].heroIdx;
        targetSlot = zoneTargets[0].slotIdx;
      } else {
        const picked = await engine.promptEffectTarget(pi, targets, {
          title: 'Guardian Angel',
          description: 'Choose a Hero to protect with a Guardian Angel.',
          confirmLabel: '👼 Bless!',
          confirmClass: 'btn-success',
          cancellable: true,
          exclusiveTypes: false,
          maxPerType: { hero: 1, equip: 1 },
          greenSelect: true,
        });

        if (!picked || picked.length === 0) {
          gs._spellCancelled = true;
          return;
        }

        const target = targets.find(t => t.id === picked[0]);
        if (!target) { gs._spellCancelled = true; return; }

        if (target.type === 'equip') {
          targetOwner = target.owner;
          targetHeroIdx = target.heroIdx;
          targetSlot = target.slotIdx;
        } else {
          targetOwner = target.owner;
          targetHeroIdx = target.heroIdx;
          const tps = gs.players[targetOwner];
          for (let si = 0; si < 3; si++) {
            if (((tps.supportZones[targetHeroIdx] || [])[si] || []).length === 0) {
              targetSlot = si;
              break;
            }
          }
        }
      }

      if (targetSlot === undefined) return;
      const tps = gs.players[targetOwner];
      const targetHero = tps.heroes[targetHeroIdx];
      if (!targetHero?.name) return;

      // Place card in support zone
      if (!tps.supportZones[targetHeroIdx]) tps.supportZones[targetHeroIdx] = [[], [], []];
      if (!tps.supportZones[targetHeroIdx][targetSlot]) tps.supportZones[targetHeroIdx][targetSlot] = [];
      tps.supportZones[targetHeroIdx][targetSlot].push('Guardian Angel');

      // Re-track card instance
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === 'Guardian Angel' && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard('Guardian Angel', targetOwner, 'support', targetHeroIdx, targetSlot);
      gs._spellPlacedOnBoard = true;

      engine.sync();

      // Play golden sparkle animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'holy_revival', owner: targetOwner, heroIdx: targetHeroIdx, zoneSlot: -1,
      });
      await engine._delay(1000);

      // Fire zone enter hook
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine.log('guardian_angel_placed', {
        player: ps.username, target: targetHero.name, owner: targetOwner,
      });
      engine.sync();
    },

    /**
     * When the equipped Hero would die, prevent death and fully heal.
     */
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const hero = ctx.hero;
      if (!hero?.name) return;

      // Find which player/hero this is
      let heroPi = -1, heroHi = -1;
      for (let p = 0; p < 2; p++) {
        for (let h = 0; h < (gs.players[p]?.heroes || []).length; h++) {
          if (gs.players[p].heroes[h] === hero) { heroPi = p; heroHi = h; break; }
        }
        if (heroPi >= 0) break;
      }
      if (heroPi < 0 || heroHi < 0) return;

      // Check if this hero has Guardian Angel equipped
      const supportZones = gs.players[heroPi].supportZones[heroHi] || [];
      let gaSlot = -1;
      for (let si = 0; si < supportZones.length; si++) {
        if ((supportZones[si] || []).includes('Guardian Angel')) { gaSlot = si; break; }
      }
      if (gaSlot < 0) return;

      // ── Delete Guardian Angel FIRST (prevents infinite loop with Overheal Shock) ──
      supportZones[gaSlot] = supportZones[gaSlot].filter(c => c !== 'Guardian Angel');
      const gaInst = engine.cardInstances.find(c =>
        c.owner === heroPi && c.zone === 'support' && c.heroIdx === heroHi && c.zoneSlot === gaSlot && c.name === 'Guardian Angel'
      );
      if (gaInst) {
        engine._untrackCard(gaInst.id);
        gs.players[heroPi].deletedPile.push('Guardian Angel');
      }

      // Set HP to 1 (prevent death)
      hero.hp = 1;
      engine.sync();

      // ── Play angel descending animation ──
      engine._broadcastEvent('play_guardian_angel', {
        owner: heroPi, heroIdx: heroHi,
      });
      await engine._delay(1200);

      // ── Golden light explosion on hero ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'holy_revival', owner: heroPi, heroIdx: heroHi, zoneSlot: -1,
      });
      await engine._delay(600);

      // ── Fully heal to max HP (routes through actionHealHero for Overheal Shock interaction) ──
      const maxHp = hero.maxHp || 400;
      const healAmount = maxHp - 1; // From 1 to maxHp
      const healSource = { name: 'Guardian Angel', owner: heroPi, heroIdx: heroHi };
      await engine.actionHealHero(healSource, hero, healAmount);

      engine.log('guardian_angel_triggered', {
        hero: hero.name, owner: heroPi, healed: hero.hp > 0,
      });
      engine.sync();
    },
  },
};
