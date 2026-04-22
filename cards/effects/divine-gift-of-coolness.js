// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Coolness"
//  Attack (Fighting Lv1, Attachment)
//
//  Inherent unconditional additional Action.
//  Once per game (Divine Gift restriction).
//
//  Places itself in a Hero's free Support Zone.
//  Player can click a Hero (first free zone)
//  or directly click an empty zone.
//
//  Card appears on board immediately on selection,
//  THEN the sunglasses animation plays.
//
//  The Hero becomes permanently immune to all
//  negative status effects and is cleansed.
//
//  The card is immovable — cannot be removed,
//  destroyed, bounced, or moved by any effect.
// ═══════════════════════════════════════════

const { getNegativeStatuses } = require('./_hooks');

module.exports = {
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    // Need at least 1 free base Support Zone on any hero
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (!ps.heroes[hi]?.name) continue;
      for (let si = 0; si < 3; si++) {
        if (((ps.supportZones[hi] || [])[si] || []).length === 0) return true;
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

      // ── Build targets: heroes AND individual free support zones ──
      const targets = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name) continue;
        let hasFreeZone = false;
        for (let si = 0; si < 3; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) {
            hasFreeZone = true;
            targets.push({
              id: `equip-${pi}-${hi}-${si}`,
              type: 'equip',
              owner: pi,
              heroIdx: hi,
              slotIdx: si,
              cardName: '',
            });
          }
        }
        if (hasFreeZone) {
          targets.push({
            id: `hero-${pi}-${hi}`,
            type: 'hero',
            owner: pi,
            heroIdx: hi,
            cardName: hero.name,
          });
        }
      }

      if (targets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Select target (hero or zone) ──
      let targetHeroIdx, targetSlot;

      // Auto-select if only 1 hero with exactly 1 free slot
      const heroTargets = targets.filter(t => t.type === 'hero');
      const zoneTargets = targets.filter(t => t.type === 'equip');
      if (heroTargets.length === 1 && zoneTargets.length === 1) {
        targetHeroIdx = heroTargets[0].heroIdx;
        targetSlot = zoneTargets[0].slotIdx;
      } else {
        const picked = await engine.promptEffectTarget(pi, targets, {
          title: 'Divine Gift of Coolness',
          description: 'Select a Hero or Support Zone to bless with Coolness.',
          confirmLabel: '😎 Be Cool!',
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
          targetHeroIdx = target.heroIdx;
          targetSlot = target.slotIdx;
        } else {
          targetHeroIdx = target.heroIdx;
          for (let si = 0; si < 3; si++) {
            if (((ps.supportZones[targetHeroIdx] || [])[si] || []).length === 0) {
              targetSlot = si;
              break;
            }
          }
        }
      }

      const hero = ps.heroes[targetHeroIdx];
      if (!hero?.name || targetSlot === undefined) return;

      // ── Place card in Support Zone IMMEDIATELY ──
      if (!ps.supportZones[targetHeroIdx]) ps.supportZones[targetHeroIdx] = [[], [], []];
      if (!ps.supportZones[targetHeroIdx][targetSlot]) ps.supportZones[targetHeroIdx][targetSlot] = [];
      ps.supportZones[targetHeroIdx][targetSlot].push('Divine Gift of Coolness');

      // Re-track the card instance as support card
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === 'Divine Gift of Coolness' && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard('Divine Gift of Coolness', pi, 'support', targetHeroIdx, targetSlot);
      inst.counters.immovable = true;

      // Tell the server NOT to discard this card — it stays on the board
      gs._spellPlacedOnBoard = true;

      // Sync so card appears on board immediately
      engine.sync();

      // ── Play sunglasses animation AFTER card is visible (on the Hero, not the zone) ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'sunglasses_drop', owner: pi, heroIdx: targetHeroIdx, zoneSlot: -1,
      });
      await engine._delay(1800);

      // ── Apply negative_status_immune buff ──
      await engine.actionAddBuff(hero, pi, targetHeroIdx, 'negative_status_immune', {
        source: 'Divine Gift of Coolness',
        permanent: true,
      });

      // ── Cleanse all existing negative statuses ──
      const negKeys = getNegativeStatuses();
      engine.cleanseHeroStatuses(hero, pi, targetHeroIdx, negKeys, 'Divine Gift of Coolness');

      // Fire zone enter hook
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine.log('divine_gift_coolness', {
        player: ps.username, hero: hero.name, slot: targetSlot,
      });
      engine.sync();
    },
  },
};
