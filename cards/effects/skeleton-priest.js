// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Priest"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn delete a level 1 or lower Normal Destruction
//  Magic Spell from your discard pile to have this Creature use that
//  Spell as an additional Action as if it had Destruction Magic 1.
//
//  Implementation: directly fire the chosen spell's `onPlay` hook with
//  Priest's coordinates as the source. The spell's level requirement
//  is auto-met (Lv1 spell ≤ Destruction Magic 1) — we don't need to
//  patch the level-check pipeline because we're invoking onPlay
//  outside `validateActionPlay`. The cost (delete from discard) is
//  paid up front; reactions / chains are deliberately skipped because
//  the spell resolves as a direct mini-effect, mirroring how other
//  "fire a spell from a creature" archetypes work.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Skeleton Priest';

/**
 * Lv1-or-lower Normal Destruction Magic Spells in this player's
 * discard pile. Returns a deduped {name, count} list.
 */
function eligibleSpells(ps, engine) {
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const counts = new Map();
  for (const name of (ps.discardPile || [])) {
    const cd = cardDB[name];
    if (!cd) continue;
    if (cd.cardType !== 'Spell') continue;
    if ((cd.subtype || '').toLowerCase() !== 'normal') continue;
    if (cd.spellSchool1 !== 'Destruction Magic' && cd.spellSchool2 !== 'Destruction Magic') continue;
    if ((cd.level || 0) > 1) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    return eligibleSpells(ps, engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;

    const candidates = eligibleSpells(ps, engine);
    if (candidates.length === 0) return false;

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: candidates.map(c => ({ name: c.name, source: 'discard', count: c.count })),
      title: CARD_NAME,
      description: 'Delete a Lv1-or-lower Normal Destruction Magic Spell from your discard pile to cast it.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;
    const spellName = picked.cardName;
    if (!candidates.some(c => c.name === spellName)) return false;

    // Verify still in discard, then delete it.
    const discardIdx = ps.discardPile.indexOf(spellName);
    if (discardIdx < 0) return false;
    ps.discardPile.splice(discardIdx, 1);
    if (!ps.deletedPile) ps.deletedPile = [];
    ps.deletedPile.push(spellName);
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: spellName, from: 'discard', to: 'deleted',
    });
    engine.log('skeleton_priest_delete', { player: ps.username, spell: spellName });

    // Cast the spell. Track a temporary instance in 'hand' zone so the
    // spell's onPlay sees a typical-looking ctx; untrack after onPlay
    // returns so the instance never lingers.
    const inst = engine._trackCard(spellName, pi, 'hand', heroIdx, -1);
    inst.turnPlayed = gs.turn || 0;
    try {
      await engine.runHooks('onPlay', {
        _onlyCard: inst,
        playedCard: inst,
        cardName: spellName,
        zone: 'hand',
        heroIdx,
        // Skip the reaction-chain window — Priest's "use that Spell"
        // is a mini-resolution, not a full chain-eligible cast.
        _skipReactionCheck: true,
        // Tag for any downstream listener that wants to recognize
        // creature-launched spells.
        _viaSkeletonPriest: true,
      });
    } catch (err) {
      console.error(`[Skeleton Priest] spell '${spellName}' onPlay threw:`, err.message);
    } finally {
      engine._untrackCard(inst.id);
    }

    engine.log('skeleton_priest_cast', { player: ps.username, spell: spellName });
    engine.sync();
    return true;
  },
};
