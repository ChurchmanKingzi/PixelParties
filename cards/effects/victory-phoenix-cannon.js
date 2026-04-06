// ═══════════════════════════════════════════
//  CARD EFFECT: "Victory Phoenix Cannon"
//  Spell (Destruction Magic Lv3) — Deal 200
//  damage to any target (friend or foe).
//  Then, if the caster is still alive and
//  capable, may cast a Normal Lv1 or lower
//  Destruction Magic Spell from hand as an
//  additional Action. If they do, the caster
//  takes 200 recoil damage AFTER the bonus
//  spell (and all its effects, including
//  Bartas second-cast) fully resolves.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const fs = require('fs');
const path = require('path');
const { loadCardEffect } = require('./_loader');

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // ── Phase 1: Deal 200 damage to any target ──
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        title: 'Victory Phoenix Cannon',
        description: 'Deal 200 damage to any target.',
        confirmLabel: '💥 200 Damage!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!target) return;

      // Phoenix cannon projectile animation
      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Charge up at caster
      engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: pi, heroIdx, zoneSlot: -1 });
      await engine._delay(200);

      // Fire phoenix projectile
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: pi, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        emoji: '🐦‍🔥', duration: 500,
      });
      await engine._delay(400);

      // Impact explosion on target
      engine._broadcastEvent('play_zone_animation', { type: 'flame_avalanche', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtZoneSlot !== undefined ? tgtZoneSlot : -1 });
      await engine._delay(200);

      // Deal 200 damage
      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner].heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, 200, 'destruction_spell');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            { name: 'Victory Phoenix Cannon', owner: pi, heroIdx },
            inst, 200, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true }
          );
        }
      }

      engine.sync();
      await engine._delay(400);

      // ── Phase 2: Bonus spell cast ──
      // Check hero is still alive and capable
      if (hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Find eligible spells in hand: Normal Destruction Magic, level ≤ 1
      const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf-8'));
      const cardDB = {};
      allCards.forEach(c => { cardDB[c.name] = c; });

      const eligibleSpells = [];
      const seen = new Set();
      for (const cardName of (ps.hand || [])) {
        if (seen.has(cardName)) continue;
        const cd = cardDB[cardName];
        if (!cd || !hasCardType(cd, 'Spell')) continue;
        if ((cd.subtype || '').toLowerCase() !== 'normal') continue;
        if (cd.spellSchool1 !== 'Destruction Magic' && cd.spellSchool2 !== 'Destruction Magic') continue;
        if ((cd.level || 0) > 1) continue;
        // Check hero has required spell schools for this spell
        const abZones = ps.abilityZones[heroIdx] || [];
        const countAb = (school) => {
          let c = 0;
          for (const s of abZones) {
            if (!s || s.length === 0) continue;
            const base = s[0];
            for (const a of s) { if (a === school) c++; else if (a === 'Performance' && base === school) c++; }
          }
          return c;
        };
        const lvl = cd.level || 0;
        if (cd.spellSchool1 && countAb(cd.spellSchool1) < lvl) continue;
        if (cd.spellSchool2 && countAb(cd.spellSchool2) < lvl) continue;
        seen.add(cardName);
        eligibleSpells.push({ name: cardName, source: 'hand' });
      }

      if (eligibleSpells.length === 0) return;

      // Prompt: "Cast another Spell with [Hero Name] (200 recoil)?"
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Victory Phoenix Cannon',
        message: `Cast another Spell with ${hero.name} (200 recoil)?`,
      });
      if (!confirmed) return;

      // Player picks a spell from hand
      const selected = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: eligibleSpells,
        title: 'Victory Phoenix Cannon',
        description: 'Choose a Normal Lv1 or lower Destruction Magic Spell to cast.',
        cancellable: true,
      });
      if (!selected || !selected.cardName) return;

      const bonusSpellName = selected.cardName;
      const bonusScript = loadCardEffect(bonusSpellName);
      if (!bonusScript?.hooks?.onPlay) return;

      // Remove bonus spell from hand
      const handIdx = ps.hand.indexOf(bonusSpellName);
      if (handIdx < 0) return;
      ps.hand.splice(handIdx, 1);

      // Broadcast bonus spell to opponent
      const oi = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oi]?.socketId;
      if (oppSid && engine.io) {
        engine.io.to(oppSid).emit('card_reveal', { cardName: bonusSpellName });
      }
      await engine._delay(100);

      // Set up spell tracking for Bartas
      gs._spellDamageLog = [];
      gs._spellExcludeTargets = [];

      // Create temp instance and cast the bonus spell
      const bonusInst = engine._trackCard(bonusSpellName, pi, 'hand', heroIdx, -1);

      try {
        await engine.runHooks('onPlay', {
          _onlyCard: bonusInst, playedCard: bonusInst,
          cardName: bonusSpellName, zone: 'hand', heroIdx,
          _skipReactionCheck: true,
        });

        // Fire afterSpellResolved for Bartas second-cast
        const bonusCardData = cardDB[bonusSpellName];
        const uniqueTargets = [];
        const seenIds = new Set();
        for (const t of (gs._spellDamageLog || [])) {
          if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
        }
        await engine.runHooks('afterSpellResolved', {
          spellName: bonusSpellName, spellCardData: bonusCardData, heroIdx, casterIdx: pi,
          damageTargets: uniqueTargets, isSecondCast: false,
          _skipReactionCheck: true,
        });
      } catch (err) {
        console.error(`[Engine] Victory Phoenix Cannon bonus spell error:`, err.message);
      }

      // Clean up tracking
      delete gs._spellDamageLog;
      delete gs._spellExcludeTargets;
      delete gs._bartasSecondCast;

      // Clean up temp instance
      engine._untrackCard(bonusInst.id);
      ps.discardPile.push(bonusSpellName);

      engine.sync();
      await engine._delay(300);

      // ── Phase 3: 200 recoil AFTER everything resolves ──
      if (hero.hp > 0) {
        engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: pi, heroIdx, zoneSlot: -1 });
        await engine._delay(200);
        await ctx.dealDamage(hero, 200, 'other');
        engine.log('recoil', { hero: hero.name, amount: 200, by: 'Victory Phoenix Cannon' });
        engine.sync();
      }
    },
  },
};
