// ═══════════════════════════════════════════
//  CARD EFFECT: "Pes'zet, the Plague Bringer"
//  Hero — Biomancy / Decay Magic
//
//  Whenever ANY player summons a Creature
//  (enters a Support Zone from anywhere),
//  this hero's controller may choose any
//  target on the board and inflict 1 Poison
//  Stack to it.
//
//  Animation: thick black gas/smoke.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Only trigger when a card enters a support zone
      if (ctx.toZone !== 'support') return;

      // Check that the entering card is a Creature
      const enteringCard = ctx.enteringCard || ctx.card;
      if (!enteringCard) return;
      const cd = engine.getEffectiveCardData(enteringCard) || engine._getCardDB()[enteringCard.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      // Hero must be alive
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Build target list: all living heroes + creatures on the board (both players)
      const targets = [];
      for (let pIdx = 0; pIdx < 2; pIdx++) {
        const pState = gs.players[pIdx];

        // Heroes
        for (let hi = 0; hi < (pState.heroes || []).length; hi++) {
          const h = pState.heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          targets.push({ id: `hero-${pIdx}-${hi}`, type: 'hero', owner: pIdx, heroIdx: hi, cardName: h.name });
        }

        // Creatures in support zones
        for (const inst of engine.cardInstances) {
          if (inst.owner !== pIdx || inst.zone !== 'support') continue;
          if (inst.faceDown) continue;
          const instCd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
          if (!instCd || !hasCardType(instCd, 'Creature')) continue;
          targets.push({
            id: `equip-${pIdx}-${inst.heroIdx}-${inst.zoneSlot}`,
            type: 'equip', owner: pIdx, heroIdx: inst.heroIdx,
            slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
          });
        }
      }

      if (targets.length === 0) return;

      // Prompt the Pes'zet controller to select a target (cancellable)
      const selectedIds = await engine.promptEffectTarget(pi, targets, {
        title: "Pes'zet — Plague Spread",
        description: `A Creature was summoned! Choose any target to inflict 1 Poison Stack.`,
        confirmLabel: '☠️ Poison!',
        confirmClass: 'btn-danger',
        cancellable: true,
        maxTotal: 1,
      });

      if (!selectedIds || selectedIds.length === 0) return;

      const picked = targets.find(t => t.id === selectedIds[0]);
      if (!picked) return;

      // Play black gas animation on the target
      engine._broadcastEvent('play_zone_animation', {
        type: 'plague_smoke',
        owner: picked.owner,
        heroIdx: picked.heroIdx,
        zoneSlot: picked.type === 'equip' ? picked.slotIdx : -1,
      });
      await engine._delay(500);

      // Apply 1 Poison Stack
      if (picked.type === 'hero') {
        await engine.addHeroStatus(picked.owner, picked.heroIdx, 'poisoned', {
          addStacks: 1,
          appliedBy: pi,
        });
      } else if (picked.type === 'equip' && picked.cardInstance) {
        const inst = picked.cardInstance;
        await engine.actionApplyCreaturePoison(
          { name: hero.name, owner: pi, heroIdx },
          inst,
        );
      }

      engine.log('peszet_plague', {
        player: ps.username, hero: hero.name,
        target: picked.cardName,
        trigger: enteringCard.name,
      });

      engine.sync();
    },
  },
};
