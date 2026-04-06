// ═══════════════════════════════════════════
//  CARD EFFECT: "Initiation Ritual"
//  Artifact (Normal, 8 Gold)
//
//  Choose a dead Hero you control that wasn't
//  defeated this turn. Equip it to a living
//  Hero's free Support Zone. The living Hero
//  gains all effects of the equipped Hero.
//
//  The equipped Hero is treated as an Equipment
//  Artifact (susceptible to destruction).
//
//  The dead Hero's original zone is orphaned:
//  - Hero slot cleared (name, HP, stats removed)
//  - All Ability-type cards in its Ability AND
//    Support Zones → discard
//  - Creatures/other cards stay
//
//  Revival cannot target heroes with empty slots.
// ═══════════════════════════════════════════

// ─── HELPERS ─────────────────────────────

/** Get dead heroes NOT killed this turn. */
function getDeadHeroes(gs, pi) {
  const ps = gs.players[pi];
  const result = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;       // Empty slot
    if (hero.hp > 0) continue;       // Alive
    if (hero.diedOnTurn === gs.turn) continue; // Died this turn
    result.push({ heroIdx: hi, heroName: hero.name });
  }
  return result;
}

/** Get living heroes with at least 1 free base Support Zone. */
function getLivingHeroesWithFreeZone(ps) {
  const result = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones[hi] || [])[si] || []).length === 0) {
        result.push({ heroIdx: hi, heroName: hero.name, freeSlot: si });
        break;
      }
    }
  }
  return result;
}

// ─── MODULE EXPORTS ──────────────────────

const { hasCardType } = require('./_hooks');

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    if (getDeadHeroes(gs, pi).length === 0) return false;
    return getLivingHeroesWithFreeZone(gs.players[pi]).length > 0;
  },

  getValidTargets(gs, pi) {
    return getDeadHeroes(gs, pi).map(d => ({
      id: `hero-${pi}-${d.heroIdx}`,
      type: 'hero',
      owner: pi,
      heroIdx: d.heroIdx,
      cardName: d.heroName,
    }));
  },

  targetingConfig: {
    description: 'Select a defeated Hero to equip to a living Hero.',
    confirmLabel: '🔮 Begin Ritual!',
    confirmClass: 'btn-danger',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'none',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return { aborted: true };

    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return { aborted: true };

    const gs = engine.gs;
    const ps = gs.players[pi];
    const deadHeroIdx = target.heroIdx;
    const deadHero = ps.heroes[deadHeroIdx];
    if (!deadHero?.name) return { aborted: true };

    const deadHeroName = deadHero.name;

    // ── Select living hero with free zone ──
    const livingOptions = getLivingHeroesWithFreeZone(ps);
    if (livingOptions.length === 0) return { aborted: true };

    let livingHeroIdx, targetSlot;
    if (livingOptions.length === 1) {
      livingHeroIdx = livingOptions[0].heroIdx;
      targetSlot = livingOptions[0].freeSlot;
    } else {
      // Build both hero and zone targets (like Gift of Coolness)
      const targets2 = [];
      for (const opt of livingOptions) {
        for (let si = 0; si < 3; si++) {
          if (((ps.supportZones[opt.heroIdx] || [])[si] || []).length === 0) {
            targets2.push({
              id: `equip-${pi}-${opt.heroIdx}-${si}`,
              type: 'equip', owner: pi,
              heroIdx: opt.heroIdx, slotIdx: si, cardName: '',
            });
          }
        }
        targets2.push({
          id: `hero-${pi}-${opt.heroIdx}`,
          type: 'hero', owner: pi,
          heroIdx: opt.heroIdx, cardName: opt.heroName,
        });
      }

      const picked = await engine.promptEffectTarget(pi, targets2, {
        title: 'Initiation Ritual — Placement',
        description: `Choose a living Hero to equip ${deadHeroName} to.`,
        confirmLabel: '🔮 Equip!',
        confirmClass: 'btn-danger',
        cancellable: false,
        exclusiveTypes: false,
        maxPerType: { hero: 1, equip: 1 },
        greenSelect: true,
      });

      if (!picked || picked.length === 0) return { aborted: true };
      const pickedTarget = targets2.find(t => t.id === picked[0]);
      if (!pickedTarget) return { aborted: true };

      if (pickedTarget.type === 'equip') {
        livingHeroIdx = pickedTarget.heroIdx;
        targetSlot = pickedTarget.slotIdx;
      } else {
        livingHeroIdx = pickedTarget.heroIdx;
        const opt = livingOptions.find(o => o.heroIdx === livingHeroIdx);
        targetSlot = opt ? opt.freeSlot : 0;
      }
    }

    const livingHero = ps.heroes[livingHeroIdx];
    if (!livingHero?.name || livingHero.hp <= 0 || targetSlot === undefined) return { aborted: true };

    // ── Animation: card transfer from dead hero zone to support zone ──
    engine._broadcastEvent('play_card_transfer', {
      sourceOwner: pi, sourceHeroIdx: deadHeroIdx, sourceZoneSlot: -1,
      targetOwner: pi, targetHeroIdx: livingHeroIdx, targetZoneSlot: targetSlot,
      cardName: deadHeroName, duration: 1400, particles: 'holy_revival',
    });

    // Wait for transfer animation to mostly complete before changing state
    await engine._delay(1200);

    // ── Discard all Ability-type cards from the dead Hero's zones ──
    const cardDB = engine._getCardDB();

    // Ability Zones
    const abZones = ps.abilityZones[deadHeroIdx] || [];
    for (let zi = 0; zi < abZones.length; zi++) {
      const slot = abZones[zi] || [];
      while (slot.length > 0) {
        const cardName = slot.pop();
        ps.discardPile.push(cardName);
        // Untrack instance
        const inst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'ability' && c.heroIdx === deadHeroIdx && c.zoneSlot === zi && c.name === cardName
        );
        if (inst) {
          await engine.runHooks('onCardLeaveZone', { _onlyCard: inst, card: inst, fromZone: 'ability', fromHeroIdx: deadHeroIdx, _skipReactionCheck: true });
          engine._untrackCard(inst.id);
        }
        engine.log('discard', { card: cardName, by: 'Initiation Ritual', reason: 'zone_orphaned' });
      }
    }
    ps.abilityZones[deadHeroIdx] = [[], [], []];

    // Support Zones — only Ability-type cards
    const supZones = ps.supportZones[deadHeroIdx] || [];
    for (let zi = 0; zi < supZones.length; zi++) {
      const slot = supZones[zi] || [];
      for (let ci = slot.length - 1; ci >= 0; ci--) {
        const cardName = slot[ci];
        const cd = cardDB[cardName];
        if (!cd || !hasCardType(cd, 'Ability')) continue;
        slot.splice(ci, 1);
        ps.discardPile.push(cardName);
        const inst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'support' && c.heroIdx === deadHeroIdx && c.zoneSlot === zi && c.name === cardName
        );
        if (inst) {
          await engine.runHooks('onCardLeaveZone', { _onlyCard: inst, card: inst, fromZone: 'support', fromHeroIdx: deadHeroIdx, _skipReactionCheck: true });
          engine._untrackCard(inst.id);
        }
        engine.log('discard', { card: cardName, by: 'Initiation Ritual', reason: 'zone_orphaned' });
      }
    }

    // ── Untrack the dead Hero's card instance from the hero zone ──
    const deadHeroInst = engine.cardInstances.find(c =>
      c.owner === pi && c.zone === 'hero' && c.heroIdx === deadHeroIdx && c.name === deadHeroName
    );
    if (deadHeroInst) engine._untrackCard(deadHeroInst.id);

    // ── Place the dead Hero card in the living Hero's Support Zone ──
    if (!ps.supportZones[livingHeroIdx]) ps.supportZones[livingHeroIdx] = [[], [], []];
    if (!ps.supportZones[livingHeroIdx][targetSlot]) ps.supportZones[livingHeroIdx][targetSlot] = [];
    ps.supportZones[livingHeroIdx][targetSlot].push(deadHeroName);

    // Track as support card with livingHeroIdx
    const equippedInst = engine._trackCard(deadHeroName, pi, 'support', livingHeroIdx, targetSlot);

    // Mark as equip artifact (susceptible to destruction by Fire Bomb, etc.)
    equippedInst.counters.treatAsEquip = true;

    // Override isActiveIn so the dead Hero's hooks fire from support zone
    // This makes the living Hero gain the dead Hero's passive effects
    equippedInst.isActiveIn = () => true;

    // ── Clear the dead Hero's slot (orphan it) ──
    deadHero.name = '';
    deadHero.hp = 0;
    deadHero.maxHp = 0;
    deadHero.atk = 0;
    deadHero.baseAtk = 0;
    deadHero.statuses = {};
    deadHero.buffs = {};

    // Fire zone enter hook for the equipped hero card
    await engine.runHooks('onCardEnterZone', {
      enteringCard: equippedInst, toZone: 'support', toHeroIdx: livingHeroIdx,
      _skipReactionCheck: true,
    });

    engine.log('initiation_ritual', {
      player: ps.username,
      deadHero: deadHeroName,
      livingHero: livingHero.name,
      slot: targetSlot,
    });
    engine.sync();
    return true;
  },
};
