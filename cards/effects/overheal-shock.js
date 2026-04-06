// ═══════════════════════════════════════════
//  CARD EFFECT: "Overheal Shock"
//  Spell (Support Magic Lv1, Attachment)
//
//  Attach to an opponent's Hero. Any healing
//  that Hero would receive is applied as damage
//  instead (checked in actionHealHero).
//
//  Sets hero.statuses.healReversed for visuals.
//  Cleared when the card leaves the zone.
//
//  First-turn-protected heroes: card is immediately
//  sent to the discard pile instead of attaching.
//
//  Inherent Action condition:
//  If the caster has Decay Magic 1+ OR
//  Support Magic 2+, this counts as an
//  inherent additional Action.
// ═══════════════════════════════════════════

module.exports = {
  spellPlayCondition(gs, pi) {
    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const hero = ops.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      for (let si = 0; si < 3; si++) {
        if (((ops.supportZones[hi] || [])[si] || []).length === 0) return true;
      }
    }
    return false;
  },

  inherentAction(gs, pi, heroIdx, engine) {
    const ps = gs.players[pi];
    const abZones = ps.abilityZones[heroIdx] || [[], [], []];
    const smLevel = engine.countAbilitiesForSchool('Support Magic', abZones);
    if (smLevel >= 2) return true;
    const dmLevel = engine.countAbilitiesForSchool('Decay Magic', abZones);
    if (dmLevel >= 1) return true;
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      const oi = pi === 0 ? 1 : 0;
      const ops = gs.players[oi];

      // ── Build targets: opponent heroes + their free support zones ──
      const targets = [];
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        let hasFreeZone = false;
        for (let si = 0; si < 3; si++) {
          const slot = (ops.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) {
            hasFreeZone = true;
            targets.push({
              id: `equip-${oi}-${hi}-${si}`,
              type: 'equip',
              owner: oi,
              heroIdx: hi,
              slotIdx: si,
              cardName: '',
            });
          }
        }
        if (hasFreeZone) {
          targets.push({
            id: `hero-${oi}-${hi}`,
            type: 'hero',
            owner: oi,
            heroIdx: hi,
            cardName: hero.name,
          });
        }
      }

      if (targets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Select target ──
      let targetHeroIdx, targetSlot;

      const heroTargets = targets.filter(t => t.type === 'hero');
      const zoneTargets = targets.filter(t => t.type === 'equip');
      if (heroTargets.length === 1 && zoneTargets.length === 1) {
        targetHeroIdx = heroTargets[0].heroIdx;
        targetSlot = zoneTargets[0].slotIdx;
      } else {
        const picked = await engine.promptEffectTarget(pi, targets, {
          title: 'Overheal Shock',
          description: 'Attach to an opponent\'s Hero. Healing on that Hero becomes damage.',
          confirmLabel: '⚡ Attach!',
          confirmClass: 'btn-danger',
          cancellable: true,
          exclusiveTypes: false,
          maxPerType: { hero: 1, equip: 1 },
        });

        if (!picked || picked.length === 0) {
          gs._spellCancelled = true;
          return;
        }

        const target = targets.find(t => t.id === picked[0]);
        if (!target) { gs._spellCancelled = true; return; }

        if (target.type === 'equip') {
          targetHeroIdx = target.heroIdx;
          targetSlot = target.slotIdx;
        } else {
          targetHeroIdx = target.heroIdx;
          for (let si = 0; si < 3; si++) {
            if (((ops.supportZones[targetHeroIdx] || [])[si] || []).length === 0) {
              targetSlot = si;
              break;
            }
          }
        }
      }

      const targetHero = ops.heroes[targetHeroIdx];
      if (!targetHero?.name || targetSlot === undefined) return;

      // ── First-turn protection: card is immediately discarded ──
      if (gs.firstTurnProtectedPlayer != null && oi === gs.firstTurnProtectedPlayer) {
        engine.log('equip_blocked', { card: 'Overheal Shock', target: targetHero.name, reason: 'shielded' });
        // Card goes to caster's discard (server handles hand removal via _spellPlacedOnBoard = false)
        return;
      }

      // ── Place card in opponent's Support Zone ──
      if (!ops.supportZones[targetHeroIdx]) ops.supportZones[targetHeroIdx] = [[], [], []];
      if (!ops.supportZones[targetHeroIdx][targetSlot]) ops.supportZones[targetHeroIdx][targetSlot] = [];
      ops.supportZones[targetHeroIdx][targetSlot].push('Overheal Shock');

      // Re-track the card instance in the opponent's support zone
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === 'Overheal Shock' && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard('Overheal Shock', oi, 'support', targetHeroIdx, targetSlot);

      // Tell the server NOT to discard this card — it stays on the board
      gs._spellPlacedOnBoard = true;

      // Set healReversed status on the target hero
      if (!targetHero.statuses) targetHero.statuses = {};
      targetHero.statuses.healReversed = { source: 'Overheal Shock', appliedBy: pi };

      engine.sync();

      // ── Play green+purple flash + skull particles on the target hero ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'overheal_shock_equip', owner: oi, heroIdx: targetHeroIdx, zoneSlot: -1,
      });
      await engine._delay(1000);

      // Fire zone enter hook
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine.log('overheal_shock', {
        player: ps.username, target: targetHero.name, slot: targetSlot,
      });
      engine.sync();
    },

    /**
     * When Overheal Shock leaves the zone (destroyed, bounced, etc.),
     * check if any copies remain. If not, clear healReversed.
     */
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const card = ctx.card;
      if (!card || card.name !== 'Overheal Shock') return;
      const fromHeroIdx = ctx.fromHeroIdx;
      const ownerIdx = card.owner;
      if (ownerIdx == null || fromHeroIdx == null) return;

      const ps = gs.players[ownerIdx];
      if (!ps) return;
      const hero = ps.heroes?.[fromHeroIdx];
      if (!hero) return;

      // Check if any other Overheal Shock remains in this hero's support zones
      const supportZones = ps.supportZones[fromHeroIdx] || [];
      const stillHasShock = supportZones.some(slot =>
        (slot || []).includes('Overheal Shock')
      );

      if (!stillHasShock && hero.statuses?.healReversed) {
        delete hero.statuses.healReversed;
        engine.log('heal_reversed_cleared', { hero: hero.name });
        engine.sync();
      }
    },
  },
};
