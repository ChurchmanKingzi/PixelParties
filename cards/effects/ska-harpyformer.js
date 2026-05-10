// ═══════════════════════════════════════════
//  CARD EFFECT: "Ska Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may deal 50 damage to the Hero
//    this was summoned under to search the deck
//    for a "Performance" Ability, reveal and
//    add it to hand.
//  ③ Once per turn: discard a Performance Ability
//    from hand to attach any Ability from your
//    deck to a Hero you control.
// ═══════════════════════════════════════════

const { harpyformerInherentAction, harpyformerDiscardCost } = require('./_harpyformer-shared');
const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME    = 'Ska Harpyformer';
const ABILITY_NAME = 'Performance';

module.exports = {
  inherentAction: harpyformerInherentAction,

  /**
   * CPU brain override for Ska's on-summon "Deal 50 damage to your
   * host hero to tutor Performance?" confirm. The default CPU brain
   * declines every cancellable confirm, which made Ska's tutor never
   * fire — yet Performance is a deck-defining payoff (its once-per-
   * turn effect attaches ANY Ability from the deck to ANY of our
   * heroes), so most game states clearly want the trade.
   *
   * Strategy: route the decision through `mctsPickFromOptions`. We
   * snapshot the engine, apply each option's full effect (decline =
   * no-op; confirm = 50 damage + tutor Performance into hand), let
   * the rest-of-turn rollout play out, score the resulting state
   * via `evaluateState`, and pick whichever option scores higher.
   * That captures all the downstream value the heuristic would
   * miss — turn-of-summon Performance plays, follow-up Attacks the
   * host might still take, opp counter-pressure on a wounded hero,
   * etc. — without baking any "Performance is worth N points" magic
   * number into the script.
   *
   * Same sync-return discipline as Barker / Cute Phoenix: returning
   * `undefined` lets the default brain handle non-Ska prompts. Once
   * we commit to MCTS we return a `Promise` from the IIFE — the
   * engine's CPU wrapper passes the Promise through and awaits it.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type !== 'confirm') return undefined;
    if (promptData.title !== CARD_NAME) return undefined;

    const cpuIdx = engine._cpuPlayerIdx;
    if (cpuIdx == null || cpuIdx < 0) return undefined;
    const ps = engine.gs.players[cpuIdx];
    if (!ps) return undefined;

    const skaInst = engine.cardInstances.find(c =>
      c.zone === 'support' && c.name === CARD_NAME
      && (c.controller ?? c.owner) === cpuIdx
    );
    if (!skaInst) return undefined;
    const heroIdx = skaInst.heroIdx;
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return undefined;

    // Lazy-required so card-script load doesn't depend on _cpu init.
    let mctsPick;
    try { ({ mctsPickFromOptions: mctsPick } = require('./_cpu')); }
    catch { mctsPick = null; }
    // No MCTS available (e.g. test harness, or we're already inside
    // an outer rollout that's about to recurse): defer to the engine
    // default (decline). Conservative — same as the pre-MCTS state.
    if (typeof mctsPick !== 'function' || engine._inMctsSim) {
      return undefined;
    }

    return (async () => {
      const options = [
        { confirmed: false },
        { confirmed: true },
      ];

      const apply = async (eng, opt) => {
        if (!opt.confirmed) return true; // decline → state unchanged.
        // Confirm = mirror the live `onPlay` resolve flow:
        //   1. Deal 50 to the host hero.
        //   2. If the hero survived, tutor Performance from the deck
        //      into hand and shuffle.
        // _skipReactionCheck on the damage call so the rollout
        // doesn't open nested reaction windows (which would waste
        // budget on opp's reactions to a simulated damage event).
        const psp = eng.gs.players[cpuIdx];
        const hp = psp?.heroes?.[heroIdx];
        if (!hp?.name || hp.hp <= 0) return false;
        const source = { name: CARD_NAME, owner: cpuIdx, heroIdx };
        try {
          await eng.actionDealDamage(source, hp, 50, 'other', {
            _skipReactionCheck: true,
          });
        } catch { return false; }
        if (hp.hp <= 0) return true; // dealt damage, no tutor — still a valid simulated outcome.
        if (!(psp.mainDeck || []).includes(ABILITY_NAME)) return true;
        try {
          await eng.searchDeckForNamedCard(cpuIdx, ABILITY_NAME, CARD_NAME);
        } catch { /* tutor failed mid-rollout — keep the partial state */ }
        return true;
      };

      try {
        const best = await mctsPick(engine, options, apply);
        if (best) return best;
      } catch { /* fall through — let default decline */ }
      return undefined;
    })();
  },

  // ── On summon: optional 50-damage cost to search deck for Performance ─────
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) return;

      if (!(ps.mainDeck || []).includes(ABILITY_NAME)) return;

      // Offer the 50-damage trade
      const confirm = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Deal 50 damage to ${hero.name} to search your deck for a "${ABILITY_NAME}" Ability?`,
      });
      if (!confirm) return;

      // Deal 50 to the hosting hero
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: pi, heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);
      await ctx.dealDamage(hero, 50, 'other');

      // Only search if the hero survived
      if (hero.hp <= 0) return;
      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },
  },

  // ── Once-per-turn creature effect: attach ability from deck ───────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).includes(ABILITY_NAME);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const ok = await harpyformerDiscardCost(engine, pi, ABILITY_NAME, {
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to attach any Ability from your deck to a Hero you control.`,
      source: CARD_NAME,
      logType: 'ska_discard',
    });
    if (!ok) return false;
    engine.sync();

    // Build list of living heroes that have room for at least one deck ability
    const cardDB = engine._getCardDB();
    const heroOptions = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;

      // Check there is at least one attachable ability in deck for this hero
      const hasDeckAbility = (ps.mainDeck || []).some(cn => {
        const cd = cardDB[cn];
        return cd && hasCardType(cd, 'Ability') && engine.canAttachAbilityToHero(pi, cn, hi);
      });
      if (!hasDeckAbility) continue;

      heroOptions.push({ id: String(hi), label: h.name, description: `Hero ${hi + 1}`, color: 'var(--accent)' });
    }

    if (heroOptions.length === 0) {
      // No valid hero/ability combinations — effect fizzles after discard
      engine.log('ska_no_targets', { player: ps.username });
      return true;
    }

    // If only one eligible hero, skip the picker
    let targetHeroIdx;
    if (heroOptions.length === 1) {
      targetHeroIdx = parseInt(heroOptions[0].id, 10);
    } else {
      const heroPick = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Choose a Hero to attach an Ability to.',
        options: heroOptions,
        cancellable: false, // Performance already discarded
      });
      if (!heroPick || heroPick.cancelled) return true;
      targetHeroIdx = parseInt(heroPick.optionId, 10);
    }

    // Build deduplicated gallery of attachable abilities from deck for the chosen hero
    const countMap = {};
    for (const cn of (ps.mainDeck || [])) {
      const cd = cardDB[cn];
      if (!cd || !hasCardType(cd, 'Ability')) continue;
      if (!engine.canAttachAbilityToHero(pi, cn, targetHeroIdx)) continue;
      countMap[cn] = (countMap[cn] || 0) + 1;
    }
    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) return true;

    const heroName = ps.heroes[targetHeroIdx]?.name || 'Hero';
    const abilityPick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: `Choose an Ability from your deck to attach to ${heroName}.`,
      cancellable: false,
    });
    if (!abilityPick || !abilityPick.cardName) return true;

    const chosenAbility = abilityPick.cardName;

    // Verify still in deck, move to hand temporarily, then attach via
    // engine. Route through the canonical helper so the brief hand-add
    // fires ON_CARD_ADDED_TO_HAND (Cosmic Depths Analyzer / Gatherer
    // key off this hook for any opponent search effect, including
    // Ska's tutor-then-attach flow). Helper covers deck-search anim,
    // tracking, log, hook, and opponent reveal.
    if (ps.mainDeck.indexOf(chosenAbility) < 0) return true;
    await engine.actionAddCardFromDeckToHand(pi, chosenAbility, {
      source: CARD_NAME,
      reveal: true,
    });

    const attachResult = await engine.attachAbilityFromHand(pi, chosenAbility, targetHeroIdx, {
      skipAbilityGivenCheck: true,
    });

    if (!attachResult?.success) {
      // Attachment failed — card stays in hand (player keeps it).
      engine.log('ska_attach_failed', { player: ps.username, card: chosenAbility });
    } else {
      engine.log('ska_attach', { player: ps.username, ability: chosenAbility, hero: heroName });
      engine.shuffleDeck(pi);
    }

    engine.sync();
    return true;
  },
};
