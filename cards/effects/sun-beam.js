// ═══════════════════════════════════════════
//  CARD EFFECT: "Sun Beam"
//  Spell (Destruction Magic Lv1, Normal)
//  Pollution archetype.
//
//  Choose up to 3 non-Hero cards on the board and
//  send them to the discard pile. Place the same
//  number of Pollution Tokens into your free
//  Support Zones.
//
//  Legal targets: anything in a Support, Ability,
//  Permanent, or Area zone — EXCEPT Pollution
//  Tokens (which are conceptually the spell's own
//  ammunition) and face-down Surprise cards.
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones } = require('./_pollution-shared');

const POLLUTION_TOKEN = 'Pollution Token';
const SUN_BEAM_MAX = 3;

module.exports = {
  placesPollutionTokens: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;

      // ── Collect legal targets across every non-Hero board zone ──
      // We mirror The Yeeting's `_collectBoardTargets` ID convention so the
      // existing frontend click handlers for support/ability/permanent slots
      // light up without any board-side changes (area targeting does need
      // a small frontend addition — see app-board.jsx).
      //
      // Targets in the caster's OWN support zone are tagged ownSupport:true.
      // The Pollution-archetype targeting rule (see below) exempts those
      // from the "free-zone" cap because destroying them immediately opens
      // a slot for the Pollution Token that would be placed in return.
      const targets = [];
      const seenInstIds = new Set();
      let ownSupportAvailable = 0;
      for (const inst of engine.cardInstances) {
        if (seenInstIds.has(inst.id)) continue;
        if (inst.faceDown) continue;
        if (inst.counters?.immovable) continue; // can't be destroyed → don't offer
        if (inst.name === POLLUTION_TOKEN) continue; // explicit exclusion

        if (inst.zone === 'support') {
          const isOwnSupport = inst.owner === pi;
          if (isOwnSupport) ownSupportAvailable++;
          targets.push({
            id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
            type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
            cardName: inst.name, cardInstance: inst, _cardInstance: inst,
            ownSupport: isOwnSupport,
          });
        } else if (inst.zone === 'ability') {
          // Only the top card of an ability stack is targetable.
          const slot = gs.players[inst.owner]?.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot] || [];
          if (slot.length > 0 && slot[slot.length - 1] !== inst.name) continue;
          targets.push({
            id: `ability-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
            type: 'ability', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
            cardName: inst.name, cardInstance: inst, _cardInstance: inst,
          });
        } else if (inst.zone === 'permanent') {
          targets.push({
            id: `perm-${inst.owner}-${inst.counters?.permId || inst.id}`,
            type: 'perm', owner: inst.owner, heroIdx: -1,
            cardName: inst.name, cardInstance: inst, _cardInstance: inst,
          });
        } else if (inst.zone === 'area') {
          // The BoardZone for "area" displays the top entry of areaZones[owner].
          // Filter to only that entry — a second area instance on the same side
          // isn't visually targetable with the current board layout.
          const areaArr = gs.areaZones?.[inst.owner] || [];
          if (areaArr.length > 0 && areaArr[areaArr.length - 1] !== inst.name) continue;
          targets.push({
            id: `area-${inst.owner}`,
            type: 'area', owner: inst.owner, heroIdx: -1,
            cardName: inst.name, cardInstance: inst, _cardInstance: inst,
          });
        }
        seenInstIds.add(inst.id);
      }

      // ── Pollution-cap rule ──
      // Every destroyed card places a Pollution Token into one of the
      // caster's free Support Zones, so the number of destructions cannot
      // exceed the number of slots that will actually be available to
      // receive tokens. Specifically:
      //   • non-own-support destructions ≤ freeZones (F)
      //   • own-support destructions each free a slot one-for-one, so
      //     they're uncapped beyond the card's natural 3-target max.
      // Total selection ceiling becomes min(3, F + ownSupportAvailable).
      const freeZones = countFreeZones(gs, pi);
      const maxTotal = Math.min(SUN_BEAM_MAX, freeZones + ownSupportAvailable);

      if (targets.length === 0 || maxTotal === 0) {
        engine.log('sun_beam_fizzle', {
          player: gs.players[pi].username,
          reason: targets.length === 0 ? 'no_targets' : 'no_pollution_capacity',
        });
        gs._spellCancelled = true;
        return;
      }

      // ── Prompt up to maxTotal targets on the board ──
      const selectedIds = await engine.promptEffectTarget(pi, targets, {
        title: 'Sun Beam',
        description: `Send up to ${maxTotal} non-Hero card${maxTotal === 1 ? '' : 's'} on the board to the discard pile. Pollution Tokens equal to the number hit will fill your free Support Zones.`,
        confirmLabel: '☀️ Sun Beam!',
        confirmClass: 'btn-danger',
        cancellable: true,
        maxTotal,
        // Non-own-support selections are capped at freeZones. Own-support
        // targets (ownSupport:true) are exempt from this cap. Frontend
        // enforces this in togglePotionTarget.
        maxNonOwnSupport: freeZones,
      });

      if (!selectedIds || selectedIds.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const picked = selectedIds.map(id => targets.find(t => t.id === id)).filter(Boolean);

      // ── Descending orbital beam animation on every target ──
      for (const t of picked) {
        const animEvent = { type: 'sun_beam', owner: t.owner };
        if (t.type === 'perm') {
          animEvent.heroIdx = 0;
          animEvent.zoneSlot = -1;
          animEvent.zoneType = 'permanent';
          animEvent.permId = t._cardInstance?.counters?.permId || t._cardInstance?.id;
        } else if (t.type === 'area') {
          animEvent.heroIdx = -1;
          animEvent.zoneSlot = -1;
          animEvent.zoneType = 'area';
        } else if (t.type === 'ability') {
          animEvent.heroIdx = t.heroIdx;
          animEvent.zoneSlot = t.slotIdx;
          animEvent.zoneType = 'ability';
        } else {
          animEvent.heroIdx = t.heroIdx;
          animEvent.zoneSlot = t.slotIdx ?? -1;
        }
        engine._broadcastEvent('play_zone_animation', animEvent);
      }
      // Beam descends + impact flash lasts ~800–1000ms. Wait for impact.
      await engine._delay(900);

      // ── Destroy each target via the correct removal path ──
      let destroyed = 0;
      for (const t of picked) {
        const inst = t._cardInstance;
        if (!inst) continue;
        if (inst.zone === 'area') {
          await engine.removeArea(inst, 'Sun Beam');
          destroyed++;
        } else {
          await engine.actionDestroyCard(ctx.card, inst);
          destroyed++;
        }
      }

      engine.sync();
      await engine._delay(300);

      // ── Place Pollution Tokens equal to the number destroyed ──
      if (destroyed > 0) {
        const { placed } = await placePollutionTokens(engine, pi, destroyed, 'Sun Beam', {
          promptCtx: ctx,
        });
        engine.log('sun_beam', {
          player: gs.players[pi].username,
          destroyed, tokensPlaced: placed,
        });
      }

      engine.sync();
    },
  },
};
