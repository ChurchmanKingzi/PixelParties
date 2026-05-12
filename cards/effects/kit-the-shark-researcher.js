// ═══════════════════════════════════════════
//  CARD EFFECT: "Kit, the Shark Researcher"
//  Hero — 400 HP, 80 ATK
//  Starting abilities: Creativity + Summoning Magic
//
//  Whenever an Ability is attached to this Hero,
//  you may reveal a Creature from your deck and
//  choose one of these effects:
//    • Add the Creature to your hand.
//    • Make your opponent choose 2 targets they
//      control and deal 50 damage to them.
//    • Your opponent must discard a random card
//      from their hand.
//  You can only choose each effect once per turn.
//  If the selected Creature is not added to your
//  hand, send it to your discard pile.
//
//  Implementation
//  ──────────────
//  • Trigger via `onCardEnterZone`, gated to
//    `toZone === 'ability'` + `toHeroIdx === ctx.
//    cardHeroIdx` + `entering.owner === ctx.
//    cardOwner`. Starting abilities placed during
//    game setup use `_trackCard` directly and
//    never fire this hook (engine convention,
//    matching Alex, Trainer of Heroes).
//  • Three independent per-turn HOPT keys —
//    `kit-mode-A:${pi}` (hand), `kit-mode-B:${pi}`
//    (opp damage), `kit-mode-C:${pi}` (opp
//    discard). Each mode resets at turn start
//    via `gs.turn` rollover.
//  • Mode picker filters out exhausted modes AND
//    modes that can't legally resolve right now
//    (Mode B needs ≥2 opp targets; Mode C needs
//    ≥1 opp hand card). If all modes are
//    unavailable, no reveal prompt is shown at
//    all — the trigger silently skips.
//  • Deck-reveal flow: player picks a Creature
//    from a cardGallery of every Creature in
//    their main deck. Cancelling the gallery
//    skips the whole trigger (no creature
//    moved, no mode burned). After a mode runs,
//    the revealed Creature lands in HAND
//    (Mode A) or DISCARD (Modes B, C).
//  • `deck_search_add` broadcast on reveal so
//    both players see the picked Creature flip
//    face-up. Standard deck-search etiquette
//    matches Alex / Training / Kassaran.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Kit, the Shark Researcher';
const HOPT_A = 'kit-mode-A';
const HOPT_B = 'kit-mode-B';
const HOPT_C = 'kit-mode-C';
const MODE_B_DAMAGE = 50;
const MODE_B_TARGET_COUNT = 2;

function _hoptUsed(gs, pi, key) {
  return gs.hoptUsed?.[`${key}:${pi}`] === gs.turn;
}
function _stampHopt(gs, pi, key) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${key}:${pi}`] = gs.turn;
}

/** Every face-up Creature/Hero target on `targetPi`'s side of the board. */
function _collectOppTargets(engine, targetPi) {
  const out = [];
  const tps = engine.gs.players[targetPi];
  if (!tps) return out;
  for (let hi = 0; hi < (tps.heroes || []).length; hi++) {
    const h = tps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    out.push({
      id: `hero-${targetPi}-${hi}`,
      type: 'hero', owner: targetPi, heroIdx: hi,
      cardName: h.name,
    });
  }
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== targetPi) continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return out;
}

/** Group the controller's main-deck Creatures by name → count for gallery. */
function _collectDeckCreatures(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps?.mainDeck) return [];
  const cardDB = engine._getCardDB();
  const counts = {};
  for (const cn of ps.mainDeck) {
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    counts[cn] = (counts[cn] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, source: 'deck', count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      // Gate: an Ability entered Kit's own ability zone, attached by
      // Kit's controller. Other-hero attachments, opp-driven exotic
      // attaches, and game-setup `_trackCard` placements all bypass
      // this hook by definition.
      if (ctx.toZone !== 'ability') return;
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;
      const entering = ctx.enteringCard;
      if (!entering || entering.owner !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      const kit = ctx.attachedHero;
      if (!kit?.name || kit.hp <= 0) return;

      const oppPi = pi === 0 ? 1 : 0;
      const ops   = gs.players[oppPi];
      if (!ops) return;

      // Compute mode availability up-front. A mode is "available" iff
      // its HOPT slot is unused AND the mode can legally resolve right
      // now (Mode B needs ≥2 opp targets; Mode C needs ≥1 opp hand
      // card). If no modes are available, skip the trigger entirely —
      // no creature reveal, no log line, just a silent no-op.
      const modeAFree = !_hoptUsed(gs, pi, HOPT_A);
      const oppTgts = _collectOppTargets(engine, oppPi);
      const modeBFree = !_hoptUsed(gs, pi, HOPT_B) && oppTgts.length >= MODE_B_TARGET_COUNT;
      const modeCFree = !_hoptUsed(gs, pi, HOPT_C) && (ops.hand?.length || 0) > 0;
      if (!modeAFree && !modeBFree && !modeCFree) return;

      // Deck must have at least one Creature to reveal. If the deck is
      // dry of Creatures, the trigger does nothing — text says "may
      // reveal a Creature from your deck", so a zero-Creature deck is
      // a hard no.
      const gallery = _collectDeckCreatures(engine, pi);
      if (gallery.length === 0) return;

      // ── Step 1: optional deck-Creature reveal ────────────────────
      // The whole trigger is opt-in ("you may"). Cancelling the
      // gallery skips everything — no creature moved, no mode
      // committed, the hand-card that just entered the ability zone
      // resolves normally.
      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Reveal a Creature from your deck. You will then choose what to do with it.',
        cancellable: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) return;
      const revealedName = picked.cardName;

      // Defensive re-check — the deck could have been mutated by an
      // interleaved effect mid-prompt (unlikely inside this hook, but
      // cheap to guard).
      const deckIdx = (ps.mainDeck || []).indexOf(revealedName);
      if (deckIdx < 0) return;

      // Pull the Creature out of the deck and reveal it face-up. The
      // card sits OUTSIDE any zone for the brief mode-pick window; if
      // the player ultimately picks Mode A we re-route it to hand,
      // otherwise it lands in discard. `deck_search_add` is the
      // canonical reveal animation used by Alex / Training /
      // Kassaran — both players see the picked Creature flip face-up.
      ps.mainDeck.splice(deckIdx, 1);
      engine._broadcastEvent('deck_search_add', { cardName: revealedName, playerIdx: pi });

      // Reveal to opp via the standard `deckSearchReveal` prompt so
      // they get to acknowledge the search result (same etiquette as
      // Elven Druid / Alex's tutor).
      const revealAck = engine.promptGeneric(oppPi, {
        type: 'deckSearchReveal',
        cardName: revealedName,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
      // Fire the reveal prompt asynchronously — don't await it yet,
      // we want the mode picker to come up on the activator's side
      // simultaneously. The await happens at end-of-trigger.

      // ── Step 2: mode pick ────────────────────────────────────────
      // Re-compute Mode B availability fresh — `oppTgts` snapshot
      // from above might have shifted if the ability-attach hook
      // chain interleaved a board change. Mode C's hand-size check
      // is also re-evaluated.
      const oppTgtsNow = _collectOppTargets(engine, oppPi);
      const modeBNow = !_hoptUsed(gs, pi, HOPT_B) && oppTgtsNow.length >= MODE_B_TARGET_COUNT;
      const modeCNow = !_hoptUsed(gs, pi, HOPT_C) && (ops.hand?.length || 0) > 0;

      const options = [];
      if (modeAFree) {
        options.push({
          id: 'A',
          label: `🃏 Add ${revealedName} to Your Hand`,
          description: 'Place the revealed Creature into your hand.',
          color: 'var(--accent)',
        });
      }
      if (modeBNow) {
        options.push({
          id: 'B',
          label: `💥 Opp Picks 2 — ${MODE_B_DAMAGE} Damage Each`,
          description: `Your opponent chooses ${MODE_B_TARGET_COUNT} targets they control; each takes ${MODE_B_DAMAGE} damage.`,
          color: 'var(--danger)',
        });
      }
      if (modeCNow) {
        options.push({
          id: 'C',
          label: '🗑️ Opp Discards Random',
          description: 'Your opponent discards 1 random card from their hand.',
          color: 'var(--warning)',
        });
      }

      // Always show the mode picker, even when only one effect is
      // available. The player still needs the chance to informedly
      // opt out of the last remaining effect (Cancel returns the
      // revealed Creature to the deck without burning a mode).
      let chosenMode = null;
      const modeChoice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: `You revealed ${revealedName}. Choose one effect:`,
        options,
        cancellable: true,
      });
      if (modeChoice && !modeChoice.cancelled && modeChoice.optionId) {
        chosenMode = modeChoice.optionId;
      }

      // ── Step 3: execute chosen mode ──
      // The revealed Creature ends up in one of three places:
      //   • Mode A → hand.
      //   • Modes B / C → discard (carrying out the "if not added to
      //     hand, send to discard pile" clause; both modes consume
      //     the reveal even though they don't add the card).
      //   • Cancelled mode picker → back into the deck unchanged.
      //     Per the user's spec: discarding only happens with the
      //     damage and discard modes; a pure cancel does NOT dump
      //     the Creature.
      if (chosenMode === 'A') {
        // Add the revealed Creature to hand. Routes through the
        // engine's canonical "card enters hand" path so fire-on-add
        // hooks (any future "when X enters your hand" listener)
        // compose correctly.
        ps.hand.push(revealedName);
        engine._trackCard(revealedName, pi, 'hand', -1, -1);
        await engine.runHooks('onCardAddedToHand', {
          playerIdx: pi, cardName: revealedName, _skipReactionCheck: true,
        });
        _stampHopt(gs, pi, HOPT_A);
        engine.log('kit_mode_a', {
          player: ps.username, card: revealedName,
        });
      } else if (chosenMode === 'B') {
        _stampHopt(gs, pi, HOPT_B);
        await _runModeB(engine, pi, oppPi, ctx.cardHeroIdx);
        ps.discardPile.push(revealedName);
        engine.log('kit_creature_discarded', {
          player: ps.username, card: revealedName,
        });
      } else if (chosenMode === 'C') {
        _stampHopt(gs, pi, HOPT_C);
        await _runModeC(engine, pi, oppPi);
        ps.discardPile.push(revealedName);
        engine.log('kit_creature_discarded', {
          player: ps.username, card: revealedName,
        });
      } else {
        // Cancelled — restore the revealed Creature to the deck.
        // We've already spliced it out (Step 2 pulled it from the
        // deck array). Push it back; the shuffle below randomises
        // its position so its location stays unknown to opp.
        ps.mainDeck.push(revealedName);
        engine.log('kit_cancelled_returned', {
          player: ps.username, card: revealedName,
        });
      }

      // Shuffle deck post-search (standard search etiquette — the
      // remaining order is now non-secret if we don't shuffle). Also
      // randomises the just-returned Creature on the cancel branch.
      engine.shuffleDeck(pi, 'main');

      // Await the opp's reveal-ack so the search-result prompt
      // closes cleanly before the trigger returns.
      try { await revealAck; } catch { /* ignore */ }

      engine.sync();
    },
  },
};

/**
 * Mode B — Opponent picks {N} of their own targets; each takes 50
 * damage. Source is Kit (the activating Hero) so on-damage hooks
 * attribute the hit correctly to the controller's side. Fizzles
 * silently if opp suddenly has fewer than N targets when the
 * picker opens (race-safe).
 */
async function _runModeB(engine, pi, oppPi, kitHeroIdx) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const ops = gs.players[oppPi];
  if (!ps || !ops) return;

  const tgts = _collectOppTargets(engine, oppPi);
  if (tgts.length < MODE_B_TARGET_COUNT) {
    engine.log('kit_mode_b_fizzle', { player: ps.username, reason: 'not-enough-targets' });
    return;
  }

  // Opp picks EXACTLY 2 of their own targets. Non-cancellable — Kit's
  // trigger has already committed at this point (HOPT stamped).
  const picked = await engine.promptEffectTarget(oppPi, tgts, {
    title: CARD_NAME,
    description: `${ps.username}'s Kit triggered! Choose ${MODE_B_TARGET_COUNT} of your targets — each takes ${MODE_B_DAMAGE} damage.`,
    confirmLabel: '⚔️ Confirm Picks',
    confirmClass: 'btn-danger',
    cancellable: false,
    exclusiveTypes: false,
    maxTotal: MODE_B_TARGET_COUNT,
    minRequired: MODE_B_TARGET_COUNT,
    maxPerType: { hero: MODE_B_TARGET_COUNT, equip: MODE_B_TARGET_COUNT },
  });
  if (!picked || picked.length < MODE_B_TARGET_COUNT) {
    engine.log('kit_mode_b_fizzle', { player: ps.username, reason: 'no-confirm' });
    return;
  }

  const source = { name: CARD_NAME, owner: pi, heroIdx: kitHeroIdx };

  // Consolidated post-target reaction window — same pattern as every
  // other multi-target damage card. Lets SG / SA / BS / HR / CIB on
  // OPP's side react once per source to the upcoming 2-hit batch.
  await engine.preDamageMultiTargetWindow(source, picked.map(id => {
    const t = tgts.find(x => x.id === id);
    if (!t) return null;
    return t.type === 'hero'
      ? { type: 'hero', owner: t.owner, heroIdx: t.heroIdx, cardName: t.cardName }
      : { type: 'creature', owner: t.owner, heroIdx: t.heroIdx, slotIdx: t.slotIdx, cardName: t.cardName };
  }).filter(Boolean));

  // Deal damage to each picked target. Sequential so afterDamage
  // hooks settle per target. Hero damage = 'other' type (this is
  // Hero-effect damage, not Spell / Attack).
  for (const id of picked) {
    const t = tgts.find(x => x.id === id);
    if (!t) continue;
    if (t.type === 'hero') {
      const hero = ops.heroes?.[t.heroIdx];
      if (!hero?.name || hero.hp <= 0) continue;
      await engine.actionDealDamage(source, hero, MODE_B_DAMAGE, 'other');
    } else if (t.cardInstance) {
      await engine.actionDealCreatureDamage(
        source, t.cardInstance, MODE_B_DAMAGE, 'other',
        { sourceOwner: pi, canBeNegated: true },
      );
    }
  }

  engine.log('kit_mode_b', {
    player: ps.username,
    targets: picked.length, damage: MODE_B_DAMAGE,
  });
}

/**
 * Mode C — Opp discards 1 random card from their hand. Routes through
 * `actionDiscardHandCard` so on-discard hooks (Glass of Marbles,
 * Skull Necklace, etc.) compose correctly.
 */
async function _runModeC(engine, pi, oppPi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const ops = gs.players[oppPi];
  if (!ops || (ops.hand?.length || 0) === 0) {
    engine.log('kit_mode_c_fizzle', { player: ps?.username, reason: 'empty-hand' });
    return;
  }

  const randomIdx = Math.floor(Math.random() * ops.hand.length);
  const discardedName = ops.hand[randomIdx];
  await engine.actionDiscardHandCard(oppPi, discardedName, randomIdx, {
    source: CARD_NAME,
  });

  engine.log('kit_mode_c', {
    player: ps?.username, opponent: ops?.username,
    discarded: discardedName,
  });
}
