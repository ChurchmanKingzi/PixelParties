// ═══════════════════════════════════════════
//  CARD EFFECT: "Fire Bomb"
//  Potion — Destroy 1 Ability on the board
//  OR any number of Equip Artifacts.
//  Potion goes to deleted pile after use.
//  Destroyed cards go to discard pile.
// ═══════════════════════════════════════════
const { loadCardEffect } = require('./_loader');

module.exports = {
  isPotion: true,

  /** Check if this potion can be activated (valid targets exist). */
  canActivate(gs, playerIdx) {
    return this.getValidTargets(gs, playerIdx).length > 0;
  },

  /** Compute all valid targets on the board. */
  getValidTargets(gs, playerIdx) {
    const targets = [];
    for (let pi = 0; pi < 2; pi++) {
      const ps = gs.players[pi];
      // First-turn protection: cannot target opponent's abilities for removal (generic rule)
      // See Engine.isAbilityRemovalProtected() — use in any card that removes abilities
      const isOpponentProtected = pi !== playerIdx && gs.firstTurnProtectedPlayer === pi;

      // Abilities (any non-empty ability zone)
      if (!isOpponentProtected) {
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          if (!ps.heroes[hi]?.name || ps.heroes[hi]?.hp <= 0) continue;
          for (let zi = 0; zi < (ps.abilityZones[hi] || []).length; zi++) {
            const cards = (ps.abilityZones[hi] || [])[zi] || [];
            if (cards.length > 0) {
              targets.push({
                id: `ability-${pi}-${hi}-${zi}`,
                type: 'ability',
                owner: pi,
                heroIdx: hi,
                slotIdx: zi,
                cardName: cards[cards.length - 1],
                level: cards.length,
              });
            }
          }
        }
      }
      // Equip artifacts in support zones
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (!ps.heroes[hi]?.name || ps.heroes[hi]?.hp <= 0) continue;
        for (let zi = 0; zi < (ps.supportZones[hi] || []).length; zi++) {
          const cards = (ps.supportZones[hi] || [])[zi] || [];
          for (const cardName of cards) {
            const script = loadCardEffect(cardName);
            if (script?.isEquip) {
              targets.push({
                id: `equip-${pi}-${hi}-${zi}-${cardName}`,
                type: 'equip',
                owner: pi,
                heroIdx: hi,
                slotIdx: zi,
                cardName,
              });
            }
          }
        }
      }
    }
    return targets;
  },

  /** Targeting UI configuration (sent to frontend). */
  targetingConfig: {
    description: 'Select 1 Ability or any number of Equip Artifacts to destroy.',
    confirmLabel: 'Destroy!',
    confirmClass: 'btn-danger',
    exclusiveTypes: true, // Can't mix ability and equip selections
    maxPerType: { ability: 1, equip: Infinity },
  },

  /** Validate the player's selection. */
  validateSelection(selected, validTargets) {
    if (!selected || selected.length === 0) return false;
    // All selected must be valid
    const validIds = new Set(validTargets.map(t => t.id));
    if (!selected.every(id => validIds.has(id))) return false;
    // Check exclusive types
    const selectedTargets = selected.map(id => validTargets.find(t => t.id === id));
    const types = new Set(selectedTargets.map(t => t.type));
    if (types.size > 1) return false; // Can't mix
    // Check max per type
    if (types.has('ability') && selected.length > 1) return false;
    return true;
  },

  /** Resolve the effect — destroy selected targets. */
  async resolve(engine, playerIdx, selectedIds, validTargets) {
    const targets = selectedIds.map(id => validTargets.find(t => t.id === id)).filter(Boolean);

    for (const t of targets) {
      const ps = engine.gs.players[t.owner];
      if (t.type === 'ability') {
        // Remove one copy from the ability zone stack
        const zone = (ps.abilityZones[t.heroIdx] || [])[t.slotIdx] || [];
        if (zone.length > 0) {
          const removed = zone.pop(); // Remove top copy
          // Find and fire leave hook on the card instance
          const inst = engine.cardInstances.find(c =>
            c.owner === t.owner && c.zone === 'ability' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx && c.name === removed
          );
          if (inst) {
            await engine.runHooks('onCardLeaveZone', { _onlyCard: inst, card: inst, fromZone: 'ability', fromHeroIdx: t.heroIdx });
            engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
          }
          ps.discardPile.push(removed);
          engine.log('destroy', { card: removed, by: 'Fire Bomb' });
        }
      } else if (t.type === 'equip') {
        // Remove equip from support zone — fires onCardLeaveZone
        const inst = engine.cardInstances.find(c =>
          c.owner === t.owner && c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx && c.name === t.cardName
        );
        if (inst) {
          await engine.runHooks('onCardLeaveZone', { _onlyCard: inst, card: inst, fromZone: 'support', fromHeroIdx: t.heroIdx });
          // Remove from zone
          const zone = (ps.supportZones[t.heroIdx] || [])[t.slotIdx] || [];
          const idx = zone.indexOf(t.cardName);
          if (idx >= 0) zone.splice(idx, 1);
          ps.discardPile.push(t.cardName);
          engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
          engine.log('destroy', { card: t.cardName, by: 'Fire Bomb' });
        }
      }
    }
  },
};
