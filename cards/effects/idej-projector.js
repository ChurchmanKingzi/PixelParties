// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Projector"
//  Artifact / Reaction (Idej) — Cost 8
//
//  "You can use this card in reaction to an opponent's Attack, Spell
//   or Creature effect. Choose an "Idej Projection" card from your
//   hand, deck or discard pile and attach it to an "Idej" Hero you
//   control, ignoring its effect."
//
//  Wiring:
//   • Playable BOTH proactively (`proactivePlay`) and as a chain
//     reaction (`isReaction` + `reactionCondition`). The reaction is
//     restricted to chaining onto an opponent's Attack / Spell /
//     Creature link — useful because the chain resolves LIFO, so the
//     attached Idej Projection lands BEFORE the opponent's effect and
//     can shield the very hit that prompted it.
//   • `isTargetingArtifact` keeps it out of the creature / equipment
//     paths; the picking is done inside `resolve` via galleries.
//   • `resolve` runs the same effect on both paths: pick the source
//     pile of an Idej Projection, pick an Idej Hero with a free
//     Support slot, then `attachIdejCardToHero` places it there —
//     "ignoring its effect" (attached directly, never cast).
// ═══════════════════════════════════════════

const {
  PROJECTION_NAME, isIdejHero, freeSupportSlots, attachIdejCardToHero,
} = require('./_idej-shared');

const CARD_NAME = 'Idej Projector';
// Chain links the Projector may react to — opponent's Attack / Spell /
// Creature. (Hero effects, Abilities, Artifacts, Potions are excluded.)
const REACTABLE_TYPES = ['Attack', 'Spell', 'Creature'];

/** Piles (hand / deck / discard) that hold ≥1 Idej Projection. */
function projectionSources(ps) {
  const out = [];
  if ((ps.hand || []).includes(PROJECTION_NAME)) out.push('hand');
  if ((ps.mainDeck || []).includes(PROJECTION_NAME)) out.push('deck');
  if ((ps.discardPile || []).includes(PROJECTION_NAME)) out.push('discard');
  return out;
}

/** Own "Idej" Heroes that still have a free Support Zone slot. */
function eligibleIdejHeroes(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (!isIdejHero(hero.name, engine)) continue;
    if (freeSupportSlots(ps, hi).length === 0) continue;
    out.push({ heroIdx: hi, name: hero.name });
  }
  return out;
}

/** Can the Projector do anything right now — a Projection to pull and
 *  an Idej Hero with a free slot to attach it to? */
function canUseProjector(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps || !engine) return false;
  if (projectionSources(ps).length === 0) return false;
  return eligibleIdejHeroes(engine, pi).length > 0;
}

const PILE_KEY = { hand: 'hand', deck: 'mainDeck', discard: 'discardPile' };

module.exports = {
  isTargetingArtifact: true,   // keep out of creature / equipment paths
  proactivePlay: true,         // Reaction subtype — opt into proactive play
  isReaction: true,            // …and chain-reaction eligible

  // Proactive gate.
  canActivate(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    return !!eng && canUseProjector(gs, pi, eng);
  },

  // Reaction gate — only chains onto an OPPONENT's Attack / Spell /
  // Creature link, and only when the Projector can actually do
  // something. (Engine handles the gold check separately.)
  reactionCondition(gs, pi, engine, chainCtx) {
    const eng = engine || gs._engineRef;
    if (!eng || !chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (!lastLink || lastLink.owner === pi) return false;          // opponent's
    if (!REACTABLE_TYPES.includes(lastLink.cardType)) return false; // Attack/Spell/Creature
    return canUseProjector(gs, pi, eng);
  },

  // Runs on BOTH paths. `chain` is set only when resolving as a chain
  // reaction — used to make the internal picks non-cancellable then
  // (the player already committed by chaining).
  async resolve(engine, pi, selectedIds, validTargets, chain /*, myIndex */) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { aborted: true };
    const isReactionUse = Array.isArray(chain) && chain.length > 0;
    const canCancel = !isReactionUse;

    const sources = projectionSources(ps);
    if (sources.length === 0) return { aborted: true };
    const heroes = eligibleIdejHeroes(engine, pi);
    if (heroes.length === 0) return { aborted: true };

    // ── Step 1: choose which pile to pull the Idej Projection from ──
    let source = sources[0];
    if (sources.length > 1) {
      const gallery = sources.map(s => ({ name: PROJECTION_NAME, source: s }));
      const pick = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: gallery,
        selectCount: 1,
        minSelect: 1,
        title: CARD_NAME,
        description: 'Choose an "Idej Projection" to attach (from your hand, deck, or discard pile).',
        confirmLabel: '🔮 Choose!',
        cancellable: canCancel,
      });
      if (!pick || pick.cancelled || !Array.isArray(pick.selectedIndices) || pick.selectedIndices.length === 0) {
        if (canCancel) return { aborted: true };
      } else {
        source = gallery[pick.selectedIndices[0]]?.source || sources[0];
      }
    }

    // ── Step 2: choose the Idej Hero to attach it to ──
    let dest = heroes[0];
    if (heroes.length > 1) {
      const targets = heroes.map(h => ({
        id: `hero-${pi}-${h.heroIdx}`, type: 'hero',
        owner: pi, heroIdx: h.heroIdx, cardName: h.name,
      }));
      const picked = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: 'Choose an "Idej" Hero to attach the Idej Projection to.',
        confirmLabel: '🔮 Attach!',
        confirmClass: 'btn-success',
        greenSelect: true,
        cancellable: canCancel,
        maxTotal: 1,
      });
      if (!picked || picked.length === 0) {
        if (canCancel) return { aborted: true };
      } else {
        dest = heroes.find(h => `hero-${pi}-${h.heroIdx}` === picked[0]) || heroes[0];
      }
    }

    // ── Step 3: pull the Projection from its pile and attach it ──
    const pileArr = ps[PILE_KEY[source]] || [];
    const idx = pileArr.indexOf(PROJECTION_NAME);
    if (idx < 0) return { aborted: true };
    pileArr.splice(idx, 1);

    const inst = await attachIdejCardToHero(engine, pi, dest.heroIdx, PROJECTION_NAME, { fromPile: source });
    if (!inst) {
      // No free slot after all — return the Projection to its pile.
      pileArr.splice(Math.min(idx, pileArr.length), 0, PROJECTION_NAME);
      return { aborted: true };
    }

    if (source === 'deck') {
      engine.shuffleDeck(pi, 'main');
      engine._broadcastEvent('deck_search_add', { cardName: PROJECTION_NAME, playerIdx: pi });
    }

    engine.log('idej_projector', {
      player: ps.username, source, hero: dest.name, viaReaction: isReactionUse,
    });
    engine.sync();
    return true;
  },
};
