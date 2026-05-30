// ═══════════════════════════════════════════
//  CARD EFFECT: "Detection"
//  Spell (Magic Arts Lv 1) — Normal.
//  Inherent additional Action.
//
//  Remove every Surprise the opponent controls
//  from the board and draw 2 cards for every
//  Surprise removed. "Surprise" = any card with
//  subtype "Surprise" the opponent owns and
//  controls, regardless of face state:
//    • face-DOWN cards in opp Surprise Zones
//      (pre-activation);
//    • face-UP cards in opp Surprise Zones
//      (Spider Silk Bridge after activation);
//    • face-DOWN Surprises sitting in opp Support
//      Zones (Bakhm-trapped, pre-activation);
//    • face-UP summoned Surprise Creatures in opp
//      Support Zones (Cybugs, Pure Advantage Camel,
//      Pollution Piranha, …).
//
//  Removed face-up Surprise Creatures fire the
//  full onCreatureDeath chain — chain triggers,
//  on-death listeners, etc. compose normally. The
//  non-Creature removals fire onCardLeaveZone only.
//
//  Defending the Gate covers Support-Zone removals
//  only. We fire `_triggerGateCheck` once up front
//  if any Support-Zone target is in scope; if the
//  gate goes up, the Support-Zone removals are
//  skipped (Surprise-Zone removals still resolve).
//  Removed Surprises contribute to the draw count,
//  gate-skipped ones do not.
//
//  Play gate: opp must control 1+ Surprises (per
//  the definition above) at play time.
// ═══════════════════════════════════════════

const { ZONES } = require('./_hooks');

const CARD_NAME = 'Detection';
const DRAW_PER_REMOVED = 2;

/**
 * All opp-controlled Surprises eligible for Detection — every card
 * with subtype "Surprise" the opponent currently controls, irrespective
 * of face state or which zone it sits in.
 */
function _getOppSurprises(engine, oppIdx) {
  const gs = engine.gs;
  const ps = gs.players[oppIdx];
  if (!ps) return [];
  const targets = [];
  const cardDB = engine._getCardDB();

  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    // Surprise Zone — face-down by default, may be face-up for cards
    // that linger after activation (Spider Silk Bridge). Always counts.
    const sz = ps.surpriseZones?.[hi] || [];
    if (sz.length > 0) {
      const cardName = sz[0];
      const inst = engine.cardInstances.find(c =>
        c.owner === oppIdx && c.zone === ZONES.SURPRISE
        && c.heroIdx === hi && c.name === cardName
      );
      targets.push({
        cardName,
        cardInstance: inst,
        heroIdx: hi,
        zoneType: 'surprise',
        zoneSlot: -1,
        isCreature: false,
        isFaceUp: inst ? !inst.faceDown : true,
      });
    }

    // Support Zones — any card with subtype "Surprise" counts. That
    // catches face-down Bakhm-trapped Surprises (any cardType) AND
    // face-up summoned Surprise Creatures (Cybugs, Pure Advantage Camel,
    // Pollution Piranha, …).
    for (let si = 0; si < (ps.supportZones?.[hi] || []).length; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) continue;
      const cardName = slot[0];
      const cd = cardDB[cardName];
      if (!cd || (cd.subtype || '').toLowerCase() !== 'surprise') continue;
      const inst = engine.cardInstances.find(c =>
        c.owner === oppIdx && c.zone === 'support'
        && c.heroIdx === hi && c.zoneSlot === si && c.name === cardName
      );
      targets.push({
        cardName,
        cardInstance: inst,
        heroIdx: hi,
        zoneType: 'support',
        zoneSlot: si,
        isCreature: cd.cardType === 'Creature',
        isFaceUp: inst ? !inst.faceDown : true,
      });
    }
  }

  return targets;
}

module.exports = {
  inherentAction: true,

  spellPlayCondition(gs, pi, engine) {
    if (!engine) return false;
    const oppIdx = pi === 0 ? 1 : 0;
    return _getOppSurprises(engine, oppIdx).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      const ops = gs.players[oppIdx];
      if (!ps || !ops) { gs._spellCancelled = true; return; }

      // Re-validate at resolution — state may have shifted between the
      // play-gate and onPlay (chain reactions, surprise auto-resolves,
      // etc.). If opp now has zero Surprises, fizzle back to hand.
      const surprises = _getOppSurprises(engine, oppIdx);
      if (surprises.length === 0) { gs._spellCancelled = true; return; }

      // Defending the Gate covers Support-Zone removals; trigger once
      // up front if any of our targets live in opp Support Zones.
      const hasSupportTarget = surprises.some(s => s.zoneType === 'support');
      if (hasSupportTarget) {
        await engine._triggerGateCheck(oppIdx, CARD_NAME);
      }
      const gateUp = engine._isGateShielded?.(oppIdx) ?? false;

      let removedCount = 0;

      for (let i = 0; i < surprises.length; i++) {
        const t = surprises[i];
        if (t.zoneType === 'support' && gateUp) {
          engine.log('detection_blocked', {
            card: t.cardName, reason: 'Defending the Gate',
          });
          continue;
        }

        // Zone-anchored pile flight BEFORE the splice — the diff
        // animator otherwise keys flights by card name and would pick
        // the leftmost duplicate.
        engine._broadcastEvent('play_pile_transfer', {
          owner: oppIdx,
          cardName: t.cardName,
          from: t.zoneType === 'support' ? 'support' : 'surprise',
          to: 'discard',
          fromHeroIdx: t.heroIdx,
          ...(t.zoneType === 'support' ? { fromSlotIdx: t.zoneSlot } : {}),
        });

        if (t.zoneType === 'surprise') {
          const sz = ops.surpriseZones?.[t.heroIdx] || [];
          const idx = sz.indexOf(t.cardName);
          if (idx >= 0) sz.splice(idx, 1);
        } else {
          const supSlot = ops.supportZones?.[t.heroIdx]?.[t.zoneSlot];
          if (supSlot) {
            const idx = supSlot.indexOf(t.cardName);
            if (idx >= 0) supSlot.splice(idx, 1);
          }
        }

        if (t.cardInstance) {
          await engine.runHooks('onCardLeaveZone', {
            card: t.cardInstance,
            leavingCard: t.cardInstance,
            fromZone: t.zoneType,
            fromHeroIdx: t.heroIdx,
            _skipReactionCheck: true,
          });

          // Face-up Surprise Creatures are Creatures on the board —
          // their removal fires onCreatureDeath so on-death chain
          // triggers, hand recomputes, etc. compose normally.
          // `instId` is load-bearing for strict-instId on-death
          // listeners (Exploding Skull pattern).
          if (t.isCreature && t.isFaceUp) {
            const deathInfo = {
              name: t.cardName,
              owner: oppIdx,
              originalOwner: t.cardInstance.originalOwner ?? oppIdx,
              heroIdx: t.heroIdx,
              zoneSlot: t.zoneSlot,
              instId: t.cardInstance.id,
            };
            await engine.runHooks('onCreatureDeath', {
              creature: deathInfo,
              source: { name: CARD_NAME, owner: pi },
              _skipReactionCheck: true,
            });
          }
        }

        const discardPs = gs.players[t.cardInstance?.originalOwner ?? oppIdx];
        if (discardPs) discardPs.discardPile.push(t.cardName);
        if (t.cardInstance) engine._untrackCard(t.cardInstance.id);

        removedCount++;
        engine.log('surprise_removed', {
          card: t.cardName, by: CARD_NAME, player: ps.username,
        });

        engine.sync();
        // Stagger so duplicate-named Surprises don't collide on one
        // client frame.
        if (i < surprises.length - 1) await engine._delay(140);
      }

      engine.log('detection', {
        player: ps.username, removed: removedCount,
      });

      if (removedCount === 0) {
        engine.sync();
        return;
      }

      const drawTotal = DRAW_PER_REMOVED * removedCount;
      for (let d = 0; d < drawTotal; d++) {
        await engine.actionDrawCards(pi, 1);
        engine.sync();
        if (d < drawTotal - 1) await engine._delay(150);
      }

      engine.sync();
    },
  },
};
