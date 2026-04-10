// ═══════════════════════════════════════════
//  CARD EFFECT: "Intrude"
//  Spell (Attachment, Decay Magic Lv0)
//
//  Places itself in the caster's first free
//  Support Zone. Only one Intrude per player.
//  Cannot play if no free zones exist.
//
//  While attached: once per opponent's turn,
//  when the opponent draws 1+ cards via an
//  effect (not Resource Phase), the Intrude
//  owner is prompted to:
//    - Negate the draw (only the draw fizzles)
//    - Copy the draw (same count, same deck type)
//    - Cancel (do nothing)
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hand', 'support'],

  /**
   * Block play if:
   * 1) Player already has an Intrude in any support zone
   * 2) No alive hero with a free support zone
   */
  spellPlayCondition(gs, playerIdx, engine) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;

    // Uniqueness: only one Intrude per player
    if (engine) {
      if (engine.cardInstances.some(c =>
        c.owner === playerIdx && c.zone === 'support' && c.name === 'Intrude'
      )) return false;
    } else {
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        for (const slot of (ps.supportZones[hi] || [])) {
          if ((slot || []).includes('Intrude')) return false;
        }
      }
    }

    // Must have at least 1 alive hero with a free support zone
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const supZones = ps.supportZones[hi] || [[], [], []];
      if (supZones.some(sl => (sl || []).length === 0)) return true;
    }
    return false;
  },

  hooks: {
    // ── Placement: auto-attach to caster's first free Support Zone ──
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];

      // Find target support zone — use specific slot if provided, else auto-find
      let targetHero = -1;
      let targetSlot = -1;

      // Specific zone from drag-drop
      if (gs._attachmentZoneSlot != null && gs._attachmentZoneSlot >= 0) {
        const si = gs._attachmentZoneSlot;
        const slot = (ps.supportZones[heroIdx] || [])[si] || [];
        if (slot.length === 0) { targetHero = heroIdx; targetSlot = si; }
      }

      // Auto-find: try caster hero first
      if (targetSlot < 0) {
      const casterSup = ps.supportZones[heroIdx] || [[], [], []];
      for (let si = 0; si < casterSup.length; si++) {
        if ((casterSup[si] || []).length === 0) { targetHero = heroIdx; targetSlot = si; break; }
      }
      }

      // Fallback: any other hero
      if (targetSlot < 0) {
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          if (hi === heroIdx) continue;
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          const sz = ps.supportZones[hi] || [[], [], []];
          for (let si = 0; si < sz.length; si++) {
            if ((sz[si] || []).length === 0) { targetHero = hi; targetSlot = si; break; }
          }
          if (targetSlot >= 0) break;
        }
      }

      if (targetSlot < 0) return;

      // Place in support zone
      if (!ps.supportZones[targetHero]) ps.supportZones[targetHero] = [[], [], []];
      if (!ps.supportZones[targetHero][targetSlot]) ps.supportZones[targetHero][targetSlot] = [];
      ps.supportZones[targetHero][targetSlot].push('Intrude');

      // Re-track card instance from hand → support
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === 'Intrude' && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard('Intrude', pi, 'support', targetHero, targetSlot);
      gs._spellPlacedOnBoard = true;

      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi, heroIdx: targetHero, zoneSlot: targetSlot,
      });

      engine.log('intrude_placed', {
        player: ps.username, hero: ps.heroes[targetHero]?.name,
      });

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHero,
        _skipReactionCheck: true,
      });

      engine.sync();
    },

    // ── Core effect: intercept opponent's effect draws ──
    beforeDrawBatch: async (ctx) => {
      // Only active from support zone (not from hand)
      if (ctx.card.zone !== 'support') return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const intrudeOwner = ctx.cardOwner;
      const drawingPlayer = ctx.playerIdx;

      // Only trigger during opponent's draws
      if (drawingPlayer === intrudeOwner) return;

      // Only trigger during opponent's turn
      if (gs.activePlayer === intrudeOwner) return;

      // Recursion guard
      if (gs._intrudeResolving) return;

      // Host hero must be alive and functional
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const drawCount = ctx.amount;
      if (drawCount <= 0) return;

      // HOPT
      if (!ctx.hardOncePerTurn('intrude_intercept')) return;

      const deckType = ctx.deckType || 'main';
      const ps = gs.players[intrudeOwner];
      const deckLabel = deckType === 'potion' ? 'Potion Deck' : 'Deck';

      // Glow animation on the Intrude card
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: intrudeOwner,
        heroIdx: ctx.cardHeroIdx, zoneSlot: ctx.card.zoneSlot,
      });
      await engine._delay(300);

      // Prompt: Negate / Copy / Cancel
      const result = await engine.promptGeneric(intrudeOwner, {
        type: 'confirm',
        title: 'Intrude',
        message: `${gs.players[drawingPlayer]?.username} is drawing ${drawCount} card${drawCount > 1 ? 's' : ''} from their ${deckLabel}.\nNegate the draw or copy it?`,
        confirmLabel: `🚫 Negate Draw`,
        thirdOption: `📥 Draw ${drawCount} as well`,
        cancelLabel: '❌ Cancel',
        showCard: 'Intrude',
        cancellable: true,
      });

      if (!result || result.cancelled) {
        // Cancel — do nothing
        return;
      }

      // Stream card image to both players only on actual activation
      engine._broadcastEvent('card_reveal', {
        cardName: 'Intrude', playerIdx: intrudeOwner,
      });

      if (result.confirmed) {
        // Negate — block the draw entirely
        ctx.setAmount(0);

        engine._broadcastEvent('play_zone_animation', {
          type: 'gold_sparkle', owner: intrudeOwner,
          heroIdx: ctx.cardHeroIdx, zoneSlot: ctx.card.zoneSlot,
        });

        engine.log('intrude_negate', {
          player: ps.username, blocked: drawCount,
          target: gs.players[drawingPlayer]?.username,
        });
        engine.sync();
      } else if (result.option === 'third') {
        // Copy — draw same count from own deck of same type
        gs._intrudeResolving = true;
        try {
          if (deckType === 'potion') {
            await engine.actionDrawFromPotionDeck(intrudeOwner, drawCount);
          } else {
            await engine.actionDrawCards(intrudeOwner, drawCount, { _skipBatchHook: true });
          }
        } finally {
          delete gs._intrudeResolving;
        }

        engine._broadcastEvent('play_zone_animation', {
          type: 'gold_sparkle', owner: intrudeOwner,
          heroIdx: ctx.cardHeroIdx, zoneSlot: ctx.card.zoneSlot,
        });

        engine.log('intrude_copy', {
          player: ps.username, copied: drawCount, deckType,
          from: gs.players[drawingPlayer]?.username,
        });
        engine.sync();
      }
    },
  },
};
