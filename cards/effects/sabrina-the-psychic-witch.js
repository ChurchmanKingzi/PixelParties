// ═══════════════════════════════════════════
//  CARD EFFECT: "Sabrina, the Psychic Witch"
//  Hero (400 HP, 40 ATK — Decay Magic + Premonition)
//
//  Hero Effect (once per turn, standard HOPT
//  enforced engine-side):
//
//    Sacrifice a Creature you control, then
//    search your deck for a Surprise whose level
//    is ≤ the sacrificed Creature's level and
//    immediately activate it as if a target /
//    player of your choice had met its
//    activation condition. The Surprise's normal
//    spell-school / level activation gates are
//    waived (per card text: "You don't need the
//    Abilities necessary to activate that
//    Surprise" — handled implicitly by the
//    `fromDeck` activation path, which doesn't
//    re-check spell-school eligibility).
//
//  Gating (per the design constraint):
//    • Effect activatable ONLY while ≥1 eligible
//      Surprise sits in the main deck.
//    • Sacrifice candidates filtered to own-side
//      Creatures whose level ≥ at least 1 deck
//      Surprise level — so picking a Creature
//      always lets you reach SOME Surprise.
//
//  Trigger-source pick:
//    Sabrina activates the chosen Surprise with
//    `sourceInfo.telekinesis: true` — the engine's
//    canonical "force-activated, player picks any
//    target" marker (shared with Telekinesis,
//    Cute Spider, and every targeting Surprise's
//    onSurpriseActivate). Each Surprise's own
//    handler reads the flag and surfaces its own
//    target-picker (Booby Trap, Firewall, Magic
//    Mirror, Frost Rune, etc.) — Sabrina doesn't
//    pre-pick the target herself. Surprises that
//    opt out via `canTelekinesisActivate: false`
//    (because they can't sensibly resolve under
//    a player-chosen trigger) are filtered out of
//    the eligible-Surprise list, matching
//    Telekinesis's gate.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Sabrina, the Psychic Witch';

/** Distinct Surprise levels present in `pi`'s main deck. */
function deckSurpriseLevels(engine, pi) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const levels = [];
  for (const cn of (ps?.mainDeck || [])) {
    if (seen.has(cn)) continue;
    const cd = cardDB[cn];
    if (!cd) continue;
    if ((cd.subtype || '').toLowerCase() !== 'surprise') continue;
    seen.add(cn);
    levels.push(cd.level || 0);
  }
  return levels;
}

/** Lowest level among Surprises in `pi`'s deck, or `Infinity` if none. */
function minDeckSurpriseLevel(engine, pi) {
  const levels = deckSurpriseLevels(engine, pi);
  return levels.length === 0 ? Infinity : Math.min(...levels);
}

/** Own-controlled Creatures (face-up, support zone) with their levels. */
function ownControlledCreatures(engine, pi) {
  const out = [];
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.faceDown) continue;
    const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push({ inst, level: cd.level || 0 });
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],
  // Targeted hero effect (target-pick prompts surface during
  // resolution) — tagged for the Blinded silence convention.
  requiresTarget: true,
  heroEffect:
    'Sacrifice a Creature you control to search your deck for a Surprise '
    + 'of equal or lower level and immediately activate it as if a target '
    + 'or player of your choice had met its activation condition.',

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const minLvl = minDeckSurpriseLevel(engine, pi);
    if (!Number.isFinite(minLvl)) return false;
    for (const { level } of ownControlledCreatures(engine, pi)) {
      if (level >= minLvl) return true;
    }
    return false;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = ctx.gameState;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;

    const minLvl = minDeckSurpriseLevel(engine, pi);
    if (!Number.isFinite(minLvl)) return false;

    // ── 1. Pick a Creature to sacrifice ──
    const candidates = ownControlledCreatures(engine, pi).filter(c => c.level >= minLvl);
    if (candidates.length === 0) return false;

    const sacTargets = candidates.map(c => ({
      id: `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`,
      type: 'equip',
      owner: c.inst.owner,
      heroIdx: c.inst.heroIdx,
      slotIdx: c.inst.zoneSlot,
      cardName: c.inst.name,
      cardInstance: c.inst,
      _meta: { level: c.level },
    }));

    const sacIds = await engine.promptEffectTarget(pi, sacTargets, {
      title: CARD_NAME,
      description: 'Sacrifice a Creature you control. You will then search your deck for a Surprise of equal or lower level.',
      confirmLabel: '🔮 Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
      redSelect: true,
    });
    if (!sacIds || sacIds.length === 0) return false;

    const sacTarget = sacTargets.find(t => t.id === sacIds[0]);
    if (!sacTarget) return false;
    const sacInst = sacTarget.cardInstance;
    const sacLevel = engine._getCardDB()[sacInst.name]?.level || 0;

    // Build the eligible-Surprise list NOW (before sacrifice) — the
    // sacrifice firing hooks shouldn't be able to change deck contents
    // mid-resolve, but reading them up-front is cheap insurance. The
    // `canTelekinesisActivate` filter mirrors Telekinesis's gate — a
    // Surprise that opts out via `canTelekinesisActivate: false`
    // can't sensibly resolve under a player-chosen trigger, so it's
    // hidden from the picker.
    const cardDB = engine._getCardDB();
    const eligibleSurprises = [];
    {
      const seen = new Set();
      for (const cn of (ps.mainDeck || [])) {
        if (seen.has(cn)) continue;
        const cd = cardDB[cn];
        if (!cd) continue;
        if ((cd.subtype || '').toLowerCase() !== 'surprise') continue;
        if ((cd.level || 0) > sacLevel) continue;
        const sScript = loadCardEffect(cn);
        if (!sScript?.onSurpriseActivate) continue;
        if (sScript.canTelekinesisActivate === false) continue;
        if (typeof sScript.canTelekinesisActivate === 'function'
            && !sScript.canTelekinesisActivate(engine, pi)) continue;
        seen.add(cn);
        eligibleSurprises.push({ name: cn, source: 'deck' });
      }
    }
    if (eligibleSurprises.length === 0) return false;

    // ── 2. Sacrifice the Creature (knife animation + ON_CREATURE_SACRIFICED + destroy) ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'knife_sacrifice',
      owner: sacInst.owner,
      heroIdx: sacInst.heroIdx,
      zoneSlot: sacInst.zoneSlot,
    });
    await engine._delay(550);
    await engine.runHooks('onCreatureSacrificed', {
      creature: sacInst, cardName: sacInst.name,
      owner: sacInst.owner, heroIdx: sacInst.heroIdx, zoneSlot: sacInst.zoneSlot,
      source: { name: CARD_NAME, owner: pi, heroIdx },
      _skipReactionCheck: true,
    });
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, heroIdx },
      sacInst,
    );
    engine.log('sabrina_sacrifice', {
      player: ps.username, victim: sacInst.name, level: sacLevel,
    });
    engine.sync();
    await engine._delay(200);

    // ── 3. Player picks a Surprise from the deck ──
    const selected = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: eligibleSurprises,
      title: CARD_NAME,
      description: `Choose a Surprise (Lv${sacLevel} or lower) from your deck to activate.`,
      cancellable: true,
    });
    if (!selected || !selected.cardName) return false;
    const surpriseName = selected.cardName;
    const surpriseScript = loadCardEffect(surpriseName);
    if (!surpriseScript?.onSurpriseActivate) return false;

    // ── 4. Build the canonical telekinesis-style sourceInfo ──
    // `telekinesis: true` opts the Surprise into its "player picks
    // any target" branch — Booby Trap, Firewall, Magic Mirror, Frost
    // Rune, Spider Avalanche, every other targeting Surprise reads
    // this flag and surfaces its own picker. `activatorIdx` mirrors
    // Telekinesis / Cute Spider so Mummy Maker Machine's "opp side"
    // logic resolves correctly. `forcedByCard` is purely informational
    // for any future debugging / display hook.
    const oppIdx = pi === 0 ? 1 : 0;
    const sourceInfo = {
      telekinesis: true,
      forcedByCard: CARD_NAME,
      activatorIdx: oppIdx,
    };

    // ── 5. Pull the Surprise from the deck and activate it ──
    const deckIdx = (ps.mainDeck || []).indexOf(surpriseName);
    if (deckIdx < 0) return false;
    ps.mainDeck.splice(deckIdx, 1);
    engine.shuffleDeck(pi, 'main');

    // Reveal the chosen Surprise to both players. `_activateSurprise`
    // emits its own opp-side card_reveal inside, but broadcasting
    // here ensures the activator sees their pick announced too (the
    // engine's reveal targets only the opp).
    engine._broadcastEvent('card_reveal', { cardName: surpriseName, playerIdx: pi });
    await engine._delay(400);

    // `fromDeck: true` — engine creates a fresh inst at zone='surprise',
    // skips the surprise-zone flip animation, runs onSurpriseActivate,
    // then routes through the standard Creature → support / non-
    // Creature → discard disposition without trying to splice from a
    // surprise zone array that never contained the card.
    await engine._activateSurprise(pi, heroIdx, surpriseName, sourceInfo, surpriseScript, {
      fromDeck: true,
    });

    engine.log('sabrina_surprise_activated', {
      player: ps.username, surprise: surpriseName,
    });
    engine.sync();
    return true;
  },
};
