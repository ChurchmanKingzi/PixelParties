// ═══════════════════════════════════════════
//  CARD EFFECT: "Pressed Skill"
//  Potion (Normal) — no Cost, no board target.
//
//  "Choose an Ability from your deck, hand or discard pile and attach
//   it to a Hero you control as an additional attachment."
//
//  ── Wiring ──────────────────────────────────────────────────────
//  Pure resolve-driven Potion (no `isTargetingArtifact` — the picks
//  are a card gallery + an `abilityAttachTarget` prompt, like
//  Sacrifice to Divinity, not a board-target click). Returning
//  `{ cancelled: true }` before anything is pulled keeps the Potion
//  in hand (server's `resolveResult.cancelled` contract); a truthy
//  return consumes it (Potions delete after use).
//
//  "as an additional attachment" → the attach must NOT consume the
//  Hero's once-per-turn ability-attach slot. We reuse the engine's
//  canonical `attachAbilityFromHand(... { skipAbilityGivenCheck:
//  true })`, which is customPlacement-aware (Performance etc.),
//  fires onPlay / onCardEnterZone, tracks the instance and syncs —
//  so the only thing this card hand-rolls is moving the chosen
//  Ability into hand from deck / discard first.
//
//  Restricted Abilities (Divinity — `restrictedAttachment`) are NOT
//  selectable: this is a generic attach effect and passes no
//  `allowRestricted`, so `canAttachAbilityToHero` /
//  `attachAbilityFromHand` refuse them and they're filtered out of
//  the gallery (zero eligible Heroes). Same rule generic tutors
//  (Alex, Cute Starlet Megu) follow.
// ═══════════════════════════════════════════

const CARD_NAME = 'Pressed Skill';
const PILES = ['hand', 'deck', 'discard'];

/** Pile array for a given source key. */
function pileArr(ps, source) {
  if (source === 'hand') return ps.hand || [];
  if (source === 'deck') return ps.mainDeck || [];
  if (source === 'discard') return ps.discardPile || [];
  return [];
}

/** Living own Heroes that can receive `abilityName` as an attachment. */
function eligibleHeroIdxs(engine, pi, abilityName) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    // No `allowRestricted` — restricted Abilities (Divinity) are
    // refused here, which naturally drops them from the gallery.
    if (engine.canAttachAbilityToHero(pi, abilityName, hi)) out.push(hi);
  }
  return out;
}

/**
 * Deduplicated gallery of attachable Abilities across hand / deck /
 * discard, one entry per (name, source) with a copy count. Only
 * Abilities with at least one eligible Hero are listed.
 */
function buildGallery(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const entries = [];
  for (const source of PILES) {
    const counts = {};
    for (const name of pileArr(ps, source)) {
      const cd = cardDB[name];
      if (!cd || cd.cardType !== 'Ability') continue;
      counts[name] = (counts[name] || 0) + 1;
    }
    for (const name of Object.keys(counts)) {
      if (eligibleHeroIdxs(engine, pi, name).length === 0) continue;
      entries.push({ name, source, count: counts[name] });
    }
  }
  return entries.sort((a, b) =>
    a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}

module.exports = {
  isPotion: true,
  blockedByHandLock: true,

  canActivate(gs, pi, engine) {
    // Authoritative gate runs with the engine (server's doUsePotion
    // always passes it). Optimistic when engine is absent (CPU
    // pre-filter / rare paths) — consistent with other potions that
    // need the engine for their real viability check.
    if (!engine) return true;
    return buildGallery(engine, pi).length > 0;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const gallery = buildGallery(engine, pi);
    if (gallery.length === 0) return { cancelled: true };

    // ── Step 1: pick an Ability (name + source) ──
    const choice = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Choose an Ability from your deck, hand or discard pile to attach to one of your Heroes as an additional attachment.',
      confirmLabel: '🔧 Attach',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!choice || choice.cancelled || !choice.cardName) return { cancelled: true };

    const abilityName = choice.cardName;
    // Trust-but-verify the source: a card name can sit in multiple
    // piles; honour the one the player picked, else fall back to the
    // first pile that actually holds it.
    let source = choice.source;
    if (!source || pileArr(ps, source).indexOf(abilityName) < 0) {
      source = PILES.find(s => pileArr(ps, s).indexOf(abilityName) >= 0) || null;
    }
    if (!source) return { cancelled: true };

    // ── Step 2: pick the Hero ──
    const heroIdxs = eligibleHeroIdxs(engine, pi, abilityName);
    if (heroIdxs.length === 0) return { cancelled: true };

    let targetHeroIdx = -1;
    let explicitZone = -1;
    if (heroIdxs.length === 1) {
      targetHeroIdx = heroIdxs[0];
    } else {
      const pickRes = await engine.promptGeneric(pi, {
        type: 'abilityAttachTarget',
        cardName: abilityName,
        eligibleHeroIdxs: heroIdxs,
        // Additional attachment — bypass the client's once-per-turn
        // ability-attach highlight gate (mirrors Sacrifice to Divinity).
        skipAbilityGiven: true,
        title: CARD_NAME,
        description: `Attach "${abilityName}" to one of your Heroes as an additional attachment.`,
        cancellable: true,
      });
      if (!pickRes || pickRes.cancelled) return { cancelled: true };
      targetHeroIdx = typeof pickRes.heroIdx === 'number' ? pickRes.heroIdx : heroIdxs[0];
      explicitZone = typeof pickRes.zoneSlot === 'number' ? pickRes.zoneSlot : -1;
    }

    // Re-verify (state may have shifted across the async prompts).
    if (!engine.canAttachAbilityToHero(pi, abilityName, targetHeroIdx)) {
      return { cancelled: true };
    }

    // ── Step 3: route the chosen Ability into hand so the canonical
    //    customPlacement-aware attach helper can place it. ──
    if (source === 'deck') {
      const idx = ps.mainDeck.indexOf(abilityName);
      if (idx < 0) return { cancelled: true };
      ps.mainDeck.splice(idx, 1);
      engine._broadcastEvent('deck_search_add', { cardName: abilityName, playerIdx: pi });
      engine.shuffleDeck(pi, 'main');
      ps.hand.push(abilityName);
    } else if (source === 'discard') {
      const idx = ps.discardPile.indexOf(abilityName);
      if (idx < 0) return { cancelled: true };
      ps.discardPile.splice(idx, 1);
      ps.hand.push(abilityName);
    } else { // hand
      if (ps.hand.indexOf(abilityName) < 0) return { cancelled: true };
      // Already in hand — attachAbilityFromHand consumes it from there.
    }

    // ── Step 4: attach as an ADDITIONAL attachment ──
    // `skipAbilityGivenCheck: true` is what makes it "additional" —
    // the Hero's once-per-turn attach slot is not consumed.
    const res = await engine.attachAbilityFromHand(pi, abilityName, targetHeroIdx, {
      skipAbilityGivenCheck: true,
      targetZoneSlot: explicitZone >= 0 ? explicitZone : undefined,
    });

    if (!res?.success) {
      // Extremely defensive: zones filled between the check and now.
      // The Ability is non-destructively sitting in the player's hand
      // (attachAbilityFromHand never splices on failure) — log and
      // still consume the Potion (the player made their choices).
      engine.log('pressed_skill_fizzle', {
        player: ps.username, ability: abilityName, from: source,
      });
      engine.sync();
      return true;
    }

    // Signature visual — golden, glittering rain falling down upon
    // the target Hero as the skill is pressed onto it. `duration`
    // overrides onZoneAnim's 1000ms default so the rain + landing
    // shimmer play out fully (particles ≤ ~1560ms). zoneSlot:-1 with
    // no zoneType routes onZoneAnim to the hero-zone selector.
    engine._broadcastEvent('play_zone_animation', {
      type: 'pressed_skill_rain',
      owner: pi, heroIdx: targetHeroIdx, zoneSlot: -1,
      duration: 1700,
    });

    // Deck-search reveal etiquette — let the opponent see what was
    // pulled from the deck (mirrors Sacrifice to Divinity / Premonition).
    if (source === 'deck') {
      const oi = pi === 0 ? 1 : 0;
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: abilityName,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
    }

    // Placement sparkle on the new ability slot (parity with the
    // standard ability-attach visual).
    engine._broadcastEvent('ability_activated', {
      owner: pi, heroIdx: targetHeroIdx, zoneIdx: res.zoneSlot,
      abilityName,
    });

    engine.log('pressed_skill', {
      player: ps.username,
      ability: abilityName,
      from: source,
      to: ps.heroes[targetHeroIdx]?.name,
      zone: res.zoneSlot,
    });
    engine.sync();
    return true;
  },
};
