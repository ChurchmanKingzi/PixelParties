// ═══════════════════════════════════════════
//  CARD EFFECT: "Alex, Trainer of Heroes"
//  Hero (500 HP, 80 ATK — Fighting + Training)
//
//  Trigger: When an Ability is attached to Alex,
//  the controller may search their deck for any
//  Ability and attach it to one of their OTHER
//  Heroes as an additional attachment (doesn't
//  consume that hero's once-per-turn
//  `abilityGivenThisTurn` slot).
//
//  Hook: `onCardEnterZone`, filtered to
//    - toZone === 'ability'
//    - toHeroIdx === Alex's own heroIdx
//    - entering.owner === Alex's controller
//      (an opponent-driven attachment, if it ever
//      happened via some exotic effect, should
//      not trigger Alex's "you" tutor).
//
//  Recursion: the follow-up attachment fires its
//  own `onCardEnterZone` for the destination
//  hero's slot. That re-entry's `toHeroIdx` is
//  some OTHER hero's index, so Alex's own hook
//  gate (`toHeroIdx === cardHeroIdx`) returns
//  false and the chain terminates after one
//  tutor. Starting abilities placed during game
//  setup use `_trackCard` directly and never fire
//  `onCardEnterZone`, so Alex doesn't self-trigger
//  on his own Fighting/Training at game start.
//
//  Gallery build: we union the set of Ability
//  cards in the deck that are attachable to ANY
//  live "other hero" — the per-hero legality is
//  re-checked after the player picks (in case the
//  only eligible hero was the one that's full on
//  that ability). If nothing qualifies, we fizzle
//  silently (no prompt).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Alex, Trainer of Heroes';

/** Pick the zone slot the tutored ability will land in on `targetHeroIdx`. */
function findTargetZone(abZones, cardName) {
  const script = loadCardEffect(cardName);
  if (script?.customPlacement) {
    for (let z = 0; z < 3; z++) {
      if (script.customPlacement.canPlace(abZones[z] || [])) return z;
    }
    return -1;
  }
  for (let z = 0; z < 3; z++) {
    const slot = abZones[z] || [];
    if (slot.length > 0 && slot[0] === cardName && slot.length < 3) return z;
  }
  for (let z = 0; z < 3; z++) {
    if ((abZones[z] || []).length === 0) return z;
  }
  return -1;
}

module.exports = {
  activeIn: ['hero'],

  // ── CPU prompt overrides ─────────────────────────────────────────────
  // Alex fires TWO prompts in sequence: a cardGallery (pick which Ability
  // to fetch from deck) followed by an abilityAttachTarget (pick which
  // other Hero to attach it to). The default brain picks the FIRST eligible
  // option for both — random Ability, first hero — which is exactly the
  // "Summoning Magic on a Hero that wanted Destruction" symptom the user
  // reported.
  //
  // The fix enumerates every (Ability × eligibleHero) pair as an MCTS
  // candidate, scores each via snapshot → attach → rollout-rest-of-turn
  // → evaluator, and picks the pair with the highest projected end-of-
  // turn value. The MCTS rollout naturally surfaces "this Hero now casts
  // a Lv3 Spell because they reached Destruction Magic 3" — no hardcoded
  // priority list, all dynamic via the score function.
  //
  // Two-prompt coordination: the cardGallery handler stashes the chosen
  // hero on `engine._alexCpuPick` so the follow-up abilityAttachTarget
  // can return it without re-running MCTS. Stash is cleared on read.
  //
  // Sync function returning a Promise from the IIFE branch only — same
  // pattern Barker uses to avoid the "Promise<undefined> != undefined"
  // wrapper bug that would kill prompts where this script doesn't apply.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    const cpuIdx = engine._cpuPlayerIdx;
    if (cpuIdx < 0) return undefined;
    if (engine._inMctsSim) return undefined; // Default brain inside rollouts.

    // ── 2nd prompt — return the stashed hero from the 1st prompt's MCTS pick.
    if (promptData.type === 'abilityAttachTarget') {
      const cache = engine._alexCpuPick;
      if (cache && Array.isArray(promptData.eligibleHeroIdxs)
          && promptData.eligibleHeroIdxs.includes(cache.heroIdx)
          && cache.cardName === promptData.cardName) {
        delete engine._alexCpuPick;
        return { heroIdx: cache.heroIdx, zoneSlot: cache.zoneSlot };
      }
      // Fall through if no cached pick — default brain picks for us.
      return undefined;
    }

    // ── 1st prompt — score every (ability, hero) pair via MCTS rollout.
    if (promptData.type !== 'cardGallery') return undefined;
    const cards = promptData.cards || [];
    if (cards.length === 0) return undefined;

    let mctsPick;
    try { ({ mctsPickFromOptions: mctsPick } = require('./_cpu')); }
    catch { mctsPick = null; }
    if (typeof mctsPick !== 'function') return undefined;

    const ps = engine.gs.players[cpuIdx];
    if (!ps) return undefined;

    // Find Alex's hero index — needed to exclude him from the eligible-
    // hero list (his text says "your OTHER Heroes").
    let alexIdx = -1;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (ps.heroes[hi]?.name === CARD_NAME) { alexIdx = hi; break; }
    }
    if (alexIdx < 0) return undefined;

    // Build (ability, hero) options. Skip pairs that fail the engine's
    // canAttachAbilityToHero gate so the picker doesn't waste rollouts
    // on impossible plans.
    const options = [];
    for (const c of cards) {
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (hi === alexIdx) continue;
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        if (!engine.canAttachAbilityToHero(cpuIdx, c.name, hi)) continue;
        options.push({ cardName: c.name, source: c.source || 'deck', heroIdx: hi });
      }
    }
    if (options.length === 0) return undefined;

    return (async () => {
      const apply = async (eng, opt) => {
        const psp = eng.gs.players[cpuIdx];
        // Splice the ability out of the deck (mirrors Alex's real placement).
        const dIdx = (psp.mainDeck || []).indexOf(opt.cardName);
        if (dIdx < 0) return false;
        psp.mainDeck.splice(dIdx, 1);
        // Resolve the destination zone (stack onto existing, then first free).
        const abZones = psp.abilityZones[opt.heroIdx] || [[], [], []];
        psp.abilityZones[opt.heroIdx] = abZones;
        const zone = findTargetZone(abZones, opt.cardName);
        if (zone < 0) return false;
        if (!abZones[zone]) abZones[zone] = [];
        abZones[zone].push(opt.cardName);
        const inst = eng._trackCard(opt.cardName, cpuIdx, 'ability', opt.heroIdx, zone);
        // Fire the standard placement hooks so any onPlay / onCardEnterZone
        // listeners (Performance's Divinity-stack snap, etc.) can affect
        // the rollout score the same way they would in real play.
        await eng.runHooks('onPlay', {
          _onlyCard: inst, playedCard: inst, cardName: opt.cardName,
          zone: 'ability', heroIdx: opt.heroIdx, _skipReactionCheck: true,
        });
        await eng.runHooks('onCardEnterZone', {
          enteringCard: inst, toZone: 'ability', toHeroIdx: opt.heroIdx,
          _skipReactionCheck: true,
        });
        return true;
      };
      let best = null;
      try { best = await mctsPick(engine, options, apply); }
      catch { best = null; }
      if (!best) {
        // Fall back to the default brain if MCTS produced nothing
        // (e.g. evaluator threw on every candidate). Return undefined
        // sync; the wrapper picks the gallery's first option.
        return undefined;
      }
      // Stash the chosen hero (and the deterministic zone) for the
      // follow-up abilityAttachTarget prompt.
      const abZones = ps.abilityZones[best.heroIdx] || [[], [], []];
      const zone = findTargetZone(abZones, best.cardName);
      engine._alexCpuPick = {
        cardName: best.cardName,
        heroIdx: best.heroIdx,
        zoneSlot: zone >= 0 ? zone : -1,
      };
      return { cardName: best.cardName, source: best.source };
    })();
  },

  hooks: {
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'ability') return;
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;
      const entering = ctx.enteringCard;
      if (!entering || entering.owner !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const pi     = ctx.cardOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      const alex = ctx.attachedHero;
      if (!alex?.name || alex.hp <= 0) return;

      // Live "other heroes" on Alex's side.
      const otherHeroIndices = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (hi === ctx.cardHeroIdx) continue;
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        otherHeroIndices.push(hi);
      }
      if (otherHeroIndices.length === 0) return;

      // Gallery: Ability cards in deck that can be attached to at least ONE
      // of the other heroes right now. Per-hero legality is re-checked after
      // the player picks, so "attachable to some hero" is enough here.
      const cardDB = engine._getCardDB();
      const eligible = {}; // cardName → bool, memoised per deck scan
      const countMap = {};
      for (const cardName of (ps.mainDeck || [])) {
        if (!(cardName in eligible)) {
          const cd = cardDB[cardName];
          eligible[cardName] = !!(cd && hasCardType(cd, 'Ability') &&
            otherHeroIndices.some(hi => engine.canAttachAbilityToHero(pi, cardName, hi)));
        }
        if (eligible[cardName]) countMap[cardName] = (countMap[cardName] || 0) + 1;
      }
      const gallery = Object.entries(countMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));
      if (gallery.length === 0) return;

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Search your deck for an Ability to attach to one of your other Heroes.',
        cancellable: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) return;
      const chosenAbility = picked.cardName;

      // Re-verify — the deck state might have shifted during the prompt
      // (unlikely mid-hook, but cheap to check).
      if ((ps.mainDeck || []).indexOf(chosenAbility) < 0) return;

      // Which other heroes can host THIS specific ability?
      const eligibleHeroes = otherHeroIndices.filter(hi =>
        engine.canAttachAbilityToHero(pi, chosenAbility, hi)
      );
      if (eligibleHeroes.length === 0) return;

      // Hero / zone pick. The `abilityAttachTarget` prompt hijacks the same
      // client-side click-to-attach machinery used for hand-driven attach
      // picks: eligible heroes and their ability zones light up, the player
      // clicks where they want the card to land. Skip the prompt entirely
      // when there's only one legal hero AND one legal zone — no UI.
      let targetHeroIdx = -1;
      let explicitZone = -1;
      if (eligibleHeroes.length === 1) {
        const onlyHero = eligibleHeroes[0];
        const abZonesCheck = ps.abilityZones[onlyHero] || [[], [], []];
        const zone = findTargetZone(abZonesCheck, chosenAbility);
        // Single hero + the placement is deterministic (stack slot or only
        // free slot) → no need to bother the player with a prompt.
        const ambiguous = zone < 0 ? false : abZonesCheck.filter((s, z) => {
          if (z === zone) return false;
          const slot = s || [];
          if (slot.length > 0 && slot[0] === chosenAbility && slot.length < 3) return true;
          return slot.length === 0;
        }).length > 0;
        if (!ambiguous) {
          targetHeroIdx = onlyHero;
          explicitZone = zone;
        }
      }
      if (targetHeroIdx < 0) {
        const pickRes = await engine.promptGeneric(pi, {
          type: 'abilityAttachTarget',
          cardName: chosenAbility,
          eligibleHeroIdxs: eligibleHeroes,
          skipAbilityGiven: true,
          title: CARD_NAME,
          description: `Attach ${chosenAbility} to one of your other Heroes.`,
          cancellable: true,
        });
        if (!pickRes || pickRes.cancelled) return;
        if (typeof pickRes.heroIdx !== 'number' || !eligibleHeroes.includes(pickRes.heroIdx)) return;
        targetHeroIdx = pickRes.heroIdx;
        explicitZone = typeof pickRes.zoneSlot === 'number' ? pickRes.zoneSlot : -1;
      }

      // ── Attach from deck ──
      // We inline the placement rather than funnelling through
      // `attachAbilityFromHand` because the source is the deck, not the
      // hand. Mirrors the Training-tutor flow end-for-end, with the one
      // difference that we deliberately do NOT flip `abilityGivenThisTurn`
      // — this is explicitly an "additional attachment" per card text.
      const deckIdx = ps.mainDeck.indexOf(chosenAbility);
      if (deckIdx < 0) return;
      ps.mainDeck.splice(deckIdx, 1);

      const abZones = ps.abilityZones[targetHeroIdx] || [[], [], []];
      ps.abilityZones[targetHeroIdx] = abZones;
      // If the player clicked a specific zone, respect it (after re-validating
      // legality). Otherwise fall back to the auto-picker.
      let targetZone = -1;
      if (explicitZone >= 0 && explicitZone < 3) {
        const slot = abZones[explicitZone] || [];
        const script = loadCardEffect(chosenAbility);
        if (script?.customPlacement) {
          if (script.customPlacement.canPlace(slot)) targetZone = explicitZone;
        } else if (slot.length === 0) {
          targetZone = explicitZone;
        } else if (slot.length > 0 && slot[0] === chosenAbility && slot.length < 3) {
          targetZone = explicitZone;
        }
      }
      if (targetZone < 0) targetZone = findTargetZone(abZones, chosenAbility);
      if (targetZone < 0) {
        // Race: the target zone filled between canAttach check and now.
        ps.mainDeck.push(chosenAbility);
        engine.shuffleDeck(pi, 'main');
        return;
      }
      if (!abZones[targetZone]) abZones[targetZone] = [];
      abZones[targetZone].push(chosenAbility);

      const inst = engine._trackCard(chosenAbility, pi, 'ability', targetHeroIdx, targetZone);
      engine._broadcastEvent('deck_search_add', { cardName: chosenAbility, playerIdx: pi });
      engine.log('alex_ability_tutor', {
        player: ps.username,
        ability: chosenAbility,
        from: alex.name,
        to: ps.heroes[targetHeroIdx]?.name,
      });

      // Fire downstream placement hooks so the new ability wires up cleanly
      // (onPlay for any self-hook, onCardEnterZone for any listener on the
      // target hero). `_skipReactionCheck: true` matches every other
      // attach-from-non-hand-source path in the engine.
      await engine.runHooks('onPlay', {
        _onlyCard: inst, playedCard: inst, cardName: chosenAbility,
        zone: 'ability', heroIdx: targetHeroIdx, _skipReactionCheck: true,
      });
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'ability', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine._broadcastEvent('ability_activated', {
        owner: pi, heroIdx: targetHeroIdx, zoneIdx: targetZone,
        abilityName: chosenAbility,
      });

      // Shuffle post-search, and reveal the pick to the opponent — standard
      // deck-search-reveal etiquette (same as Elven Druid / Elven Rider).
      engine.shuffleDeck(pi, 'main');
      const oi = pi === 0 ? 1 : 0;
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: chosenAbility,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });

      engine.sync();
    },
  },
};
