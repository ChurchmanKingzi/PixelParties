// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Amethyst"
//  Artifact (Normal, Cost 10)
//
//  Choose a Hero your opponent controls. Your
//  opponent chooses an Ability attached to that
//  Hero and discards it.
//  You may discard a card from your hand to keep
//  this card in your hand. Once per turn.
// ═══════════════════════════════════════════

const { canPlayMagicGem, maybeKeepGemInHand } = require('./_magic-gem-shared');

const CARD_NAME = 'Magic Amethyst';

/** True iff the opp hero at `hi` has at least 1 Ability stacked anywhere. */
function _heroHasAbilities(ps, hi) {
  const zones = ps.abilityZones?.[hi] || [];
  for (const slot of zones) {
    if ((slot || []).length > 0) return true;
  }
  return false;
}

/** Build the abilityChoice gallery — one entry per top-of-stack ability. */
function _buildAbilityGallery(ps, hi) {
  const zones = ps.abilityZones?.[hi] || [];
  const out = [];
  for (let z = 0; z < zones.length; z++) {
    const slot = zones[z] || [];
    if (slot.length === 0) continue;
    // Top of stack — that's what gets discarded by an "ability discard"
    // step (mirrors Noble Mummy Guards' bounce behavior).
    out.push({
      name: slot[slot.length - 1],
      source: 'ability',
      _zoneSlot: z,
      _stackHeight: slot.length,
    });
  }
  return out;
}

module.exports = {
  isTargetingArtifact: true,
  activeIn: ['hand'],

  canActivate(gs, pi) {
    if (!canPlayMagicGem(gs, pi, CARD_NAME)) return false;
    // Need at least one opp hero with at least one ability to discard.
    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    if (!ops) return false;
    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const h = ops.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (_heroHasAbilities(ops, hi)) return true;
    }
    return false;
  },

  getValidTargets(gs, pi) {
    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    const out = [];
    for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
      const h = ops.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (!_heroHasAbilities(ops, hi)) continue;
      out.push({ id: `hero-${oi}-${hi}`, type: 'hero', owner: oi, heroIdx: hi, cardName: h.name });
    }
    return out;
  },

  targetingConfig: {
    description: 'Choose an opponent Hero. They discard one of its Abilities.',
    confirmLabel: '🔮 Choose',
    confirmClass: 'btn-info',
    cancellable: true,
    maxTotal: 1,
  },

  validateSelection(selectedIds) { return selectedIds.length === 1; },

  resolve: async (engine, pi, selectedIds) => {
    const id = (selectedIds || [])[0] || '';
    const m = id.match(/^hero-(\d+)-(\d+)$/);
    if (!m) return { keepInHand: false };
    const oi = parseInt(m[1]);
    const hi = parseInt(m[2]);
    if (oi === pi) return { keepInHand: false };

    const ops = engine.gs.players[oi];
    if (!ops) return { keepInHand: false };

    // Re-build the gallery at resolve time — the board state may have
    // shifted between target pick and resolve (rare via reactions).
    const gallery = _buildAbilityGallery(ops, hi);
    if (gallery.length === 0) {
      // No abilities left → silent fizzle on the main effect.
      return await maybeKeepGemInHand(engine, pi, CARD_NAME);
    }

    // Prompt the OPPONENT to pick which Ability they sacrifice.
    // forceDiscard-style: not cancellable (the choice is forced once
    // the gem has been played and the hero has been targeted).
    const picked = await engine.promptGeneric(oi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: `Your opponent's Magic Amethyst is targeting ${ops.heroes[hi]?.name}. Choose an Ability to discard.`,
      cancellable: false,
    });

    let chosen = picked?.cardName;
    let chosenSlot = -1;
    // Match by name → pick the matching gallery entry's _zoneSlot. If
    // the engine returned no choice (CPU defer / disconnect / etc.),
    // fall back to the LAST gallery entry — symmetric to the
    // Noble-Mummy-Guards "bounce a different ability" fallback so the
    // gem still does something meaningful.
    const entry = chosen
      ? gallery.find(g => g.name === chosen)
      : gallery[gallery.length - 1];
    if (entry) {
      chosen = entry.name;
      chosenSlot = entry._zoneSlot;
    }

    if (chosen && chosenSlot >= 0) {
      const slotArr = ops.abilityZones[hi]?.[chosenSlot];
      if (slotArr && slotArr.length > 0 && slotArr[slotArr.length - 1] === chosen) {
        // Pop the top of the stack and route through the standard
        // discard pile. Untrack the ability inst so the engine's
        // tracking stays consistent.
        slotArr.pop();
        const inst = engine.cardInstances.find(c =>
          c.zone === 'ability' && c.owner === oi && c.heroIdx === hi
          && c.zoneSlot === chosenSlot && c.name === chosen
        );
        if (inst) {
          // Fire onCardLeaveZone before untracking so any per-card
          // cleanup (like Fighting's atkGranted revoke) runs.
          await engine.runHooks('onCardLeaveZone', {
            _onlyCard: inst, leavingCard: inst, fromZone: 'ability',
            fromOwner: oi, fromHeroIdx: hi, fromZoneSlot: chosenSlot,
            toZone: 'discard', _skipReactionCheck: true,
          });
          engine._untrackCard(inst.id);
        }
        ops.discardPile.push(chosen);
        await engine.runHooks('onDiscard', {
          playerIdx: oi, cardName: chosen, discardedCardName: chosen,
          _skipReactionCheck: true,
        });
        engine.log('magic_amethyst_discard', {
          player: ops.username, ability: chosen, hero: ops.heroes[hi]?.name,
        });
        engine.sync();
      }
    }

    return await maybeKeepGemInHand(engine, pi, CARD_NAME);
  },
};
