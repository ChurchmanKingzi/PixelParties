// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of The Light"
//  Spell (Support Magic Lv1, Normal)
//
//  Once per game (Divine Gift restriction).
//  Inherent additional Action.
//  Placed face-up as a permanent.
//
//  While active: the first time every turn a Hero
//  uses a non-healing Support Magic Spell, that
//  Spell's controller chooses a target to heal
//  for 100 HP. Per-hero HOPT.
//
//  Healing is attributed to the casting Hero
//  (matters for Nao's overheal passive).
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  oncePerGame: true,
  oncePerGameKey: 'divineGift',
  inherentAction: true,
  activeIn: ['hand', 'permanent'],

  hooks: {
    /**
     * On play: place as a permanent (face-up card in front of the player).
     */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];

      if (!ps.permanents) ps.permanents = [];
      const permId = 'perm-' + Date.now() + '-' + Math.random();
      ps.permanents.push({ name: 'Divine Gift of The Light', id: permId });

      // Re-track card instance as permanent
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === 'Divine Gift of The Light' && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard('Divine Gift of The Light', pi, 'permanent', -1, -1);
      inst.counters.permId = permId;

      // Prevent the spell handler from discarding this card
      gs._spellPlacedOnBoard = true;

      // Sync first so the permanent is rendered on the client
      engine.log('permanent_placed', { card: 'Divine Gift of The Light', player: ps.username });
      engine.sync();
      await engine._delay(200);

      // Play holy revival animation on the permanent card itself
      engine._broadcastEvent('play_permanent_animation', {
        owner: pi, permId, type: 'holy_revival',
      });
    },

    /**
     * After any spell resolves: check if it was a non-healing Support Spell,
     * and trigger the healing prompt for the caster (per-hero HOPT).
     */
    afterSpellResolved: async (ctx) => {
      // Only triggers while on the board as a permanent, not from hand
      if (ctx.card.zone !== 'permanent') return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const spellData = ctx.spellCardData;
      if (!spellData) return;

      // Don't trigger on itself being played
      if (spellData.name === 'Divine Gift of The Light' || ctx.spellName === 'Divine Gift of The Light') return;

      // Only Support Magic Spells
      if (spellData.spellSchool1 !== 'Support Magic') return;

      // Skip healing spells
      const script = loadCardEffect(spellData.name || ctx.spellName);
      if (script?.includesHealing) return;

      const spellCasterIdx = ctx.casterIdx;
      const spellHeroIdx = ctx.heroIdx;
      if (spellCasterIdx == null || spellHeroIdx == null) return;

      const ps = gs.players[spellCasterIdx];
      if (!ps) return;
      const hero = ps.heroes?.[spellHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Per-hero HOPT: each hero triggers at most once per turn
      const hoptKey = `gift-of-light:${spellCasterIdx}:${spellHeroIdx}`;
      if (!engine.claimHOPT(hoptKey, spellCasterIdx)) return;

      // Flash the permanent card itself
      const permInst = ctx.card;
      if (permInst?.counters?.permId) {
        engine._broadcastEvent('play_permanent_animation', {
          owner: permInst.owner, permId: permInst.counters.permId, type: 'holy_revival',
        });
      }

      // Prompt the spell's controller to pick any target to heal.
      // Heroes come from `getHeroTargets` (alive only); Creatures come
      // from `getCreatureTargets` (every Support Zone regardless of
      // host-Hero state — creatures are independent of their Hero).
      // The trailing filter preserves the original Light-gift contract
      // of healing pure Creatures only — Artifact-Creature hybrids
      // (Powder Keg, Pollution Spewer, …) are excluded even though
      // `getCreatureTargets` would otherwise include them.
      const cardDB = engine._getCardDB();
      const targets = [];
      for (let p = 0; p < 2; p++) {
        targets.push(...engine.getHeroTargets(p));
        targets.push(...engine.getCreatureTargets(p).filter(t => cardDB[t.cardName]?.cardType === 'Creature'));
      }

      if (targets.length === 0) return;

      const picked = await engine.promptEffectTarget(spellCasterIdx, targets, {
        title: 'Divine Gift of The Light',
        description: `${hero.name} played a Support Spell! Choose a target to heal for 100 HP.`,
        confirmLabel: '✨ Bless! (100 HP)',
        confirmClass: 'btn-success',
        cancellable: false,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });

      if (!picked || picked.length === 0) return;
      const target = targets.find(t => t.id === picked[0]);
      if (!target) return;

      // Play heal sparkle on target
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle',
        owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(300);

      // Heal — source is attributed to the casting Hero for Nao overheal
      const healSource = { name: 'Divine Gift of The Light', owner: spellCasterIdx, heroIdx: spellHeroIdx };

      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.actionHealHero(healSource, tgtHero, 100);
        }
      } else if (target.type === 'equip') {
        const inst2 = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst2) {
          await engine.actionHealCreature(healSource, inst2, 100);
        }
      }

      engine.log('gift_of_light_heal', {
        player: ps.username,
        hero: hero.name,
        target: target.cardName,
        spell: spellData.name,
      });
      engine.sync();
    },
  },
};
