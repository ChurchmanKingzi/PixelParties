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

  cpuMeta: {
    // ── Ausspiel-Vorfahrt: muss die ERSTE Kreatur des Zuges sein ────
    // Der Gratis-Zusatzaktions-Vertrag der Harpyformer greift NUR,
    // solange `_creaturesSummonedThisTurn === 0`. Kommt irgendeine
    // andere Kreatur zuerst, ist die Gratis-Aktion für diesen Zug
    // ersatzlos verloren — das ist keine Wertfrage, sondern eine
    // KAUSALE Bedingung, genau der Fall, für den die Vorfahrt gebaut
    // wurde (der Wert-Term geht nur mit Faktor 0.1 in den Score ein und
    // könnte ein negatives Reihenfolge-Gewicht nie überstimmen).
    // Beide Harpyformer tragen dieselbe Stufe; welcher von beiden
    // innerhalb der Stufe zuerst kommt, entscheidet das gelernte
    // Ranking.
    playOrderPriority: 100,
  },

  /**
   * CPU brain override for Ska's on-summon "Deal 50 damage to your
   * host hero to tutor Performance?" confirm.
   *
   * Heuristic: ALWAYS confirm unless the 50 damage would kill the
   * host outright OR opp's next turn would kill the host. Per the
   * user's spec — Performance is a deck-defining tutor payoff and
   * the brain consistently undervalued it through pure MCTS scoring
   * (the 50 HP loss is concrete; Performance's value is downstream
   * and gets discounted by the rollout horizon). Direct heuristic
   * instead.
   *
   * The "would opp's next turn kill the host" check runs a single
   * snapshot+rollout under MCTS/fast mode (`_inMctsSim = true`,
   * `enterFastMode`): apply 50 damage to the host, run rest-of-turn
   * (which extends through opp's full next turn via
   * `rolloutRestOfTurn`'s horizon loop, capped at 1 turn for this
   * decision), then check whether the host is still alive on the
   * other side. Tutor isn't simulated — we only care whether the
   * hero survives, not the post-tutor board.
   *
   * Same sync-return discipline as Barker / Cute Phoenix: returning
   * `undefined` lets the default brain handle non-Ska prompts. Once
   * we commit to the heuristic we return a `Promise` from the IIFE.
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

    // Response shape: `promptConfirmEffect` reads `result?.confirmed
    // === true`, so we MUST return `{ confirmed: true/false }`, NOT
    // bare booleans. Bare `true` would evaluate `true.confirmed ===
    // true` → `undefined === true` → false (decline), which is why
    // the previous bare-boolean draft never actually triggered the
    // tutor.
    const CONFIRM = { confirmed: true };
    const DECLINE = { confirmed: false };

    // Direct reject: 50 damage would directly kill the host. No
    // tutor is worth losing the Hero.
    if (hero.hp <= 50) return DECLINE;

    // Inside an outer rollout — defer to "confirm" (the heuristic's
    // baseline) so the outer rollout simulates the same future-self
    // behavior we'll actually execute live. No nested simulation.
    if (engine._inMctsSim || engine._fastMode) return CONFIRM;

    // Run a 1-turn rollout: take the 50 damage, play out the rest
    // of our turn + opp's full next turn, then check whether the
    // host is still alive. If opp kills the host, the tutor isn't
    // worth it; otherwise the trade is fine.
    let rolloutRestOfTurnFn;
    try { ({ rolloutRestOfTurn: rolloutRestOfTurnFn } = require('./_cpu')); }
    catch { rolloutRestOfTurnFn = null; }
    if (typeof rolloutRestOfTurnFn !== 'function') {
      // CPU helpers unavailable (test harness, etc.) — fall back to
      // the safe-ish default: confirm. Same baseline as inside MCTS.
      return CONFIRM;
    }

    return (async () => {
      let snap;
      try { snap = engine.snapshot(); }
      catch { return CONFIRM; } // snapshot failed — default confirm

      let hostAliveAfter = true;
      const prevInMctsSim = engine._inMctsSim;
      engine._inMctsSim = true;
      engine.enterFastMode();
      try {
        const source = { name: CARD_NAME, owner: cpuIdx, heroIdx };
        const psSim = engine.gs.players[cpuIdx];
        const hostSim = psSim?.heroes?.[heroIdx];
        if (!hostSim?.name || hostSim.hp <= 0) {
          hostAliveAfter = false;
        } else {
          await engine.actionDealDamage(source, hostSim, 50, 'other', {
            _skipReactionCheck: true,
          });
          if (hostSim.hp <= 0) {
            hostAliveAfter = false;
          } else {
            // 1-turn lookahead via rolloutRestOfTurn. Save / restore
            // the global horizon so this decision doesn't leak into
            // other rollouts.
            const cpuMod = require('./_cpu');
            const prevHorizon = cpuMod.getRolloutHorizon
              ? cpuMod.getRolloutHorizon() : 6;
            if (cpuMod.setRolloutHorizon) cpuMod.setRolloutHorizon(1);
            try {
              const helpers = engine._cpuHelpers || null;
              if (helpers) await rolloutRestOfTurnFn(engine, helpers);
            } catch { /* partial state still tells us about host HP */ }
            finally {
              if (cpuMod.setRolloutHorizon) cpuMod.setRolloutHorizon(prevHorizon);
            }
            const psAfter = engine.gs.players[cpuIdx];
            const hostAfter = psAfter?.heroes?.[heroIdx];
            hostAliveAfter = !!(hostAfter?.name && hostAfter.hp > 0);
          }
        }
      } catch {
        // Simulation crashed — be optimistic and confirm.
        hostAliveAfter = true;
      } finally {
        try { engine.restore(snap); } catch {}
        // Restore statt hart false: innerhalb eines äußeren Rollouts
        // (Gegner-Sim fragt diesen Confirm ab) darf der Sim-Marker des
        // äußeren Scopes nicht gelöscht werden — sonst greifen dessen
        // Sim-Guards (onGameOver, Driver-Sperre) nicht mehr.
        engine._inMctsSim = prevInMctsSim;
        engine.exitFastMode();
      }
      return hostAliveAfter ? CONFIRM : DECLINE;
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
      // BLEIBT `other` (Als Ruling 20.8.: „eine besondere
      // Schadensart"). Beim Typ-Grossreinemachen an 15 Kreaturen ist
      // diese Stelle bewusst AUSGENOMMEN — es ist kein Angriff auf ein
      // Ziel, sondern eine Selbstverletzung des eigenen Helden als
      // Suchkosten. Waere sie `creature`, wuerde Angler Angel die
      // eigenen Kosten um 50 verteuern. Nicht „korrigieren"!
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
