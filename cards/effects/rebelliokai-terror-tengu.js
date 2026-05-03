// ═══════════════════════════════════════════
//  CARD EFFECT: "Rebelliokai Terror Tengu"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Rebelliokai. BANNED.
//
//  Self-deletes when sent to discard from
//  outside hand or board.
//
//  When you summon this Creature, you may
//  immediately summon up to 3 "Rebelliokai"
//  Creatures with different names from your
//  discard pile as additional Actions. Then
//  immediately end your turn.
//
//  Wiring:
//    • onPlay self-detect — only fires for
//      THIS Tengu's own summon. Other tracked
//      copies of Tengu (in hand / discard) don't
//      re-trigger off the same event.
//    • Multi-pick gallery (`cardGalleryMulti`)
//      filtered to differently-named Rebelliokai
//      Creatures in own discard pile, capped at
//      min(3, available).
//    • Each picked name is spliced from the
//      discard pile and routed through
//      `summonCreatureWithHooks` so onPlay /
//      onCardEnterZone fire for the chained
//      summons (their own ETB triggers chain
//      cleanly off Tengu's effect).
//    • After all summons resolve (or the player
//      cancels the gallery), advance to End
//      Phase via `engine.advanceToPhase(pi,
//      PHASES.END)` — the turn ends regardless
//      of whether any chain-summon actually
//      landed (the rule's "Immediately end your
//      turn afterwards" reads as unconditional).
// ═══════════════════════════════════════════

const {
  isRebelliokaiCreature,
  getDifferentRebelliokaiInDiscard,
} = require('./_rebelliokai-shared');
const { PHASES } = require('./_hooks');

const CARD_NAME = 'Rebelliokai Terror Tengu';
const MAX_SUMMONS = 3;

/**
 * Is this Hero in a state where it can act as a SUMMONER for a
 * normal-summoning play right now? Mirrors the engine-wide gate the
 * standard hand-play path applies (alive + not Frozen / Stunned /
 * Negated / Bound). Spell-school / level requirements are checked
 * separately per Creature via `engine.heroMeetsLevelReq`.
 */
function _heroCanSummon(hero) {
  if (!hero?.name || hero.hp <= 0) return false;
  const s = hero.statuses || {};
  if (s.frozen || s.stunned || s.negated || s.bound) return false;
  return true;
}

/**
 * Build the list of (heroIdx, slotIdx) destinations on `pi`'s side
 * where `cardName` can be NORMALLY summoned right now. A destination
 * is valid only if:
 *   • The host hero is `_heroCanSummon` (alive + not CC'd).
 *   • The host hero satisfies the Creature's spell-school / level
 *     requirement via `engine.heroMeetsLevelReq`.
 *   • The slot is currently empty.
 *
 * Returns an array sorted leftmost-hero-first, leftmost-zone-first.
 */
function _eligibleDestinations(engine, pi, cardName) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  if (!cd) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!_heroCanSummon(h)) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cd)) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        out.push({ heroIdx: hi, slotIdx: zi });
      }
    }
  }
  return out;
}

/**
 * Total free Support Zones across `pi`'s heroes that could host
 * AT LEAST ONE of the Creatures named in `eligibleNames`. Used to
 * cap the multi-pick gallery's `selectCount` so the player can't
 * pick more Creatures than can actually land.
 *
 * A Hero's free zones only count when that Hero meets the spell-
 * school / level requirement for at least one of the eligible
 * Creatures (in addition to being alive + non-CC'd via
 * `_heroCanSummon`). Heroes that pass `_heroCanSummon` but lack
 * the abilities to summon ANY of the discard-pool Creatures are
 * excluded — their zones are dead weight for this effect.
 *
 * This is an upper bound, not a perfect bipartite-matching count.
 * For Rebelliokai specifically every Creature is Lv1 Summoning
 * Magic, so any Hero that satisfies one Creature's gate satisfies
 * all of them — which makes the heuristic exact in this archetype.
 */
function _totalUsableSummonZones(engine, pi, eligibleNames) {
  const ps = engine.gs.players[pi];
  if (!ps || !eligibleNames || eligibleNames.length === 0) return 0;
  const cardDB = engine._getCardDB();
  let n = 0;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!_heroCanSummon(h)) continue;
    const heroCanHostSomething = eligibleNames.some(name => {
      const cd = cardDB[name];
      return cd && engine.heroMeetsLevelReq(pi, hi, cd);
    });
    if (!heroCanHostSomething) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) n++;
    }
  }
  return n;
}

module.exports = {
  selfDeleteOnExternalDiscard: true,
  activeIn: ['support'],

  cpuMeta: {
    // Tengu nets a board-wide chain-summon (up to 3 free Creatures
    // from the graveyard) but ends the turn immediately. The chained
    // creatures' own ETB / onPlay effects fire — Bakus recur, Cute
    // Cat self-mill, Cosmic Manipulation drops, etc. — so the value
    // depends heavily on what's in discard. Keep neutral on death;
    // Tengu's value is in the play.
    onDeathBenefit: 0,
  },

  hooks: {
    onPlay: async (ctx) => {
      // Self-detect — only THIS Tengu's own summon triggers the
      // chain. Other listeners (e.g. a Tengu copy in hand) skip.
      if (!ctx.playedCard || ctx.playedCard.id !== ctx.card.id) return;
      // Only fire when Tengu lands in the support zone (its onPlay
      // dispatch comes through that zone, not from being mid-flight
      // anywhere else).
      if (ctx.cardZone !== 'support') return;

      const engine = ctx._engine;
      const pi     = ctx.cardOriginalOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      // Build differently-named Rebelliokai Creatures from own discard.
      // Filter further to those that could land SOMEWHERE on the board
      // — a Creature with no eligible host (no hero meets its level
      // requirement, or all eligible heroes are full) shouldn't even
      // appear in the gallery.
      const allDiscardNames = getDifferentRebelliokaiInDiscard(ps, engine);
      const discardNames = allDiscardNames.filter(n => _eligibleDestinations(engine, pi, n).length > 0);
      if (discardNames.length === 0) {
        // No eligible summons — the chain-summon clause fizzles
        // entirely. Per the rules text, the "Immediately end your
        // turn afterwards" clause only triggers off the chain-summon
        // happening. Skip the turn-end and just log the fizzle.
        engine.log('rebelliokai_terror_tengu_fizzle', {
          player: ps.username, reason: 'no_eligible_discard_summons',
        });
        return;
      }

      // Cap the multi-pick at min(3, eligible-creature-count, total
      // USABLE Support Zones). "Usable" means the Hero hosting the
      // zone meets the level / school requirement for at least one
      // of the discard-pool Creatures — Heroes whose abilities can't
      // summon ANY Rebelliokai Creature in the discard pile shouldn't
      // contribute to the cap, even if their zones are physically
      // empty. Otherwise the player could pick 3 Creatures only to
      // see one or two fizzle because their hosts didn't qualify.
      const totalFreeZones = _totalUsableSummonZones(engine, pi, discardNames);
      const maxPick = Math.min(MAX_SUMMONS, discardNames.length, totalFreeZones);
      if (maxPick === 0) {
        engine.log('rebelliokai_terror_tengu_fizzle', {
          player: ps.username, reason: 'no_free_summon_zones',
        });
        return;
      }

      const cardDB = engine._getCardDB();
      const gallery = discardNames.map(name => ({
        name,
        source: 'discard',
        level:  cardDB[name]?.level ?? 1,
      }));

      const result = await engine.promptGeneric(pi, {
        type:        'cardGalleryMulti',
        cards:       gallery,
        selectCount: maxPick,
        minSelect:   0,
        title:       CARD_NAME,
        description: `Choose up to ${maxPick} different "Rebelliokai" Creatures from your discard pile to summon as additional Actions. Your turn ends afterwards.`,
        confirmLabel: '🌪️ Summon!',
        cancellable: true,
        gerrymanderEligible: true,
      });

      const chosen = (result && !result.cancelled && Array.isArray(result.selectedCards))
        ? result.selectedCards
        : [];

      // Sequentially summon each chosen Creature. Splice from
      // discardPile FIRST so onPlay / onCardEnterZone listeners reading
      // pile state (Tanuki's draw scaling, Bakus's "is in discard"
      // check, etc.) see the post-summon state for the just-placed
      // creature.
      //
      // Per-creature destination: re-evaluate `_eligibleDestinations`
      // each iteration — earlier summons consume slots and may have
      // taken the only valid one for a later pick. If 0 → skip; if
      // 1 → auto; if 2+ → prompt the player to pick the exact slot.
      let summonsLanded = 0;
      for (const name of chosen) {
        if (!isRebelliokaiCreature(name, engine)) continue;
        const dIdx = (ps.discardPile || []).indexOf(name);
        if (dIdx < 0) continue;

        const eligibleDests = _eligibleDestinations(engine, pi, name);
        if (eligibleDests.length === 0) continue;

        let dest;
        if (eligibleDests.length === 1) {
          dest = eligibleDests[0];
        } else {
          // Build a zonePick prompt. The frontend renders these as
          // clickable Support Zones — one option per (hero, slot)
          // pair. Mandatory pick: the player already committed to
          // summoning this Creature when they confirmed the gallery,
          // so cancelling would leave the chain in an awkward half-
          // resolved state. Default to the first option if the
          // prompt is somehow declined.
          const heroes = ps.heroes || [];
          const zones = eligibleDests.map(d => ({
            heroIdx: d.heroIdx,
            slotIdx: d.slotIdx,
            label:   `${heroes[d.heroIdx]?.name || 'Hero'} — Support ${d.slotIdx + 1}`,
          }));
          const picked = await engine.promptGeneric(pi, {
            type:        'zonePick',
            zones,
            title:       `${CARD_NAME} — Summon ${name}`,
            description: `Choose a Support Zone to summon ${name}.`,
            cancellable: false,
          });
          if (picked && picked.heroIdx != null && picked.slotIdx != null) {
            dest = eligibleDests.find(d =>
              d.heroIdx === picked.heroIdx && d.slotIdx === picked.slotIdx,
            ) || eligibleDests[0];
          } else {
            dest = eligibleDests[0];
          }
        }

        // Splice from discard. Untrack any stale discard-zone listener
        // for this name (the pile-listener safety net might have
        // tracked one; we want the new support-zone summon to be the
        // canonical inst from here on).
        ps.discardPile.splice(dIdx, 1);
        const stale = engine.cardInstances.find(c =>
          c.owner === pi && c.name === name && c.zone === 'discard',
        );
        if (stale) engine._untrackCard(stale.id);

        // Visual: card flies from discard into the support slot. The
        // pile-transfer broadcast also pre-registers via the receiving
        // hand-pending counter when destination is hand; for support
        // destinations the auto-detector doesn't apply, so this is
        // purely cosmetic.
        engine._broadcastEvent('play_pile_transfer', {
          owner:       pi,
          cardName:    name,
          from:        'discard',
          to:          'support',
          toHeroIdx:   dest.heroIdx,
          toSlotIdx:   dest.slotIdx,
        });
        await engine._delay(200);

        const placed = await engine.summonCreatureWithHooks(name, pi, dest.heroIdx, dest.slotIdx, {
          source: CARD_NAME,
        });
        if (placed) summonsLanded++;
        engine.sync();
        await engine._delay(150);
      }

      engine.log('rebelliokai_terror_tengu', {
        player:     ps.username,
        summoned:   chosen,
        landed:     summonsLanded,
        endingTurn: summonsLanded > 0,
      });

      // Conditional turn-end. The "Immediately end your turn
      // afterwards" clause only triggers off a chain-summon actually
      // happening — if the player cancelled the gallery, picked zero
      // creatures, or every chosen summon failed mid-flight (board
      // filled up, etc.), the turn proceeds normally.
      if (summonsLanded > 0) {
        await engine.advanceToPhase(pi, PHASES.END);
      }
    },
  },
};
