// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of the Deepsea"
//  Spell (Summoning Magic Lv1, Normal)
//
//  Once per game (shared "Divine Gift" key).
//  Inherent additional Action.
//
//  Choose any Creature you control and add it to
//  your hand. If you do, choose any Creature of
//  the same or a lower level from your deck or
//  hand and place it into the same Support Zone
//  as the bounced Creature. That Creature may
//  activate its active effect this turn (no
//  summoning sickness).
//
//  Replacement restriction: cannot summon (a copy
//  of) the bounced Creature itself. The bounce-
//  target prompt only shows Creatures that have
//  at least one DIFFERENT-named replacement of
//  level ≤ their own; `spellPlayCondition` mirrors
//  that filter, so the card greys out in hand
//  when no on-board Creature has a valid
//  replacement.
//
//  Bounce uses the canonical
//  `returnSupportCreatureToHand` helper from
//  `_deepsea-shared.js` — fires onCardLeaveZone
//  + onCardsReturnedToHand and untracks the
//  inst. Replacement is summoned via
//  `summonCreatureWithHooks` in placement mode
//  so it runs the full lifecycle including
//  beforeSummon-driven costs (DDG tribute, etc.)
//  but bypasses host-incapacitation gates.
//  Summoning sickness is bypassed by setting
//  `inst.turnPlayed = gs.turn - 1` (mirrors
//  Forceful Revival's pattern).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { returnSupportCreatureToHand } = require('./_deepsea-shared');

function getOwnControlledCreatureInsts(engine, pi) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.owner !== pi) continue; // bounce returns to original owner — own only
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

/**
 * Build the gallery of replacement candidates: distinct Creatures from
 * deck + hand at level ≤ maxLevel, EXCLUDING `excludeName` (the bounced
 * creature's name — even copies of it are off-limits).
 */
function buildReplacementGallery(engine, ps, maxLevel, excludeName) {
  const cardDB = engine._getCardDB();
  const seen = new Map();
  const tryAdd = (cn, source) => {
    if (seen.has(cn)) return;
    if (excludeName && cn === excludeName) return;
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) return;
    if (hasCardType(cd, 'Token') || cd.subtype === 'Token') return;
    if ((cd.level ?? 0) > maxLevel) return;
    seen.set(cn, { name: cn, source, level: cd.level ?? 0 });
  };
  for (const cn of (ps.mainDeck || [])) tryAdd(cn, 'deck');
  for (const cn of (ps.hand || [])) tryAdd(cn, 'hand');
  return [...seen.values()].sort(
    (a, b) => (a.level - b.level) || a.name.localeCompare(b.name)
  );
}

/**
 * `inst` is bounceable iff there's at least one different-named Creature
 * in the player's deck/hand at level ≤ inst's level. Used by both the
 * play-time gate and the bounce-target picker filter.
 */
function hasValidReplacement(engine, ps, inst) {
  const cardDB = engine._getCardDB();
  const bouncedLevel = cardDB[inst.name]?.level ?? 0;
  return buildReplacementGallery(engine, ps, bouncedLevel, inst.name).length > 0;
}

function getValidBounceTargets(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  return getOwnControlledCreatureInsts(engine, pi)
    .filter(inst => hasValidReplacement(engine, ps, inst));
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  spellPlayCondition(gs, pi, engine) {
    return getValidBounceTargets(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const cardDB = engine._getCardDB();

      // ── Step 1: pick own controlled Creature to bounce. Only show
      // Creatures that have at least one different-named replacement
      // candidate of equal-or-lower level — no point letting the
      // player commit to a bounce that will fizzle. ──
      const candidates = getValidBounceTargets(engine, pi);
      if (candidates.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const targets = candidates.map(inst => ({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip', owner: inst.owner,
        heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, cardInstance: inst,
      }));

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: 'Divine Gift of the Deepsea',
        description: 'Choose a Creature you control to add to your hand.',
        confirmLabel: '🌊 Bounce!',
        confirmClass: 'btn-info',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { equip: 1 },
        maxTotal: 1,
      });
      if (!picked || picked.length === 0) {
        gs._spellCancelled = true;
        return;
      }
      const bouncedT = targets.find(t => t.id === picked[0]);
      if (!bouncedT) { gs._spellCancelled = true; return; }

      const bouncedInst = bouncedT.cardInstance;
      const bouncedHeroIdx = bouncedInst.heroIdx;
      const bouncedSlot = bouncedInst.zoneSlot;
      const bouncedLevel = cardDB[bouncedInst.name]?.level ?? 0;

      // ── Step 2: bounce ──
      const bounceRes = await returnSupportCreatureToHand(
        engine, bouncedInst, 'Divine Gift of the Deepsea'
      );
      if (!bounceRes?.returned) {
        // Cardinal-immune or similar absolute block — refund.
        gs._spellCancelled = true;
        return;
      }

      // ── Step 3: pick replacement Creature from deck or hand.
      // Excludes the bounced Creature's name — copies of the same
      // Creature can't return to the same slot. ──
      const gallery = buildReplacementGallery(engine, ps, bouncedLevel, bouncedT.cardName);
      if (gallery.length === 0) {
        // Defensive — `getValidBounceTargets` should have filtered this
        // case out. Bounce already committed, fizzle silently.
        engine.log('deepsea_no_replacement', { player: ps.username });
        engine.sync();
        return;
      }

      const replacementPick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: 'Divine Gift of the Deepsea',
        description: `Choose a level ${bouncedLevel} or lower Creature (other than ${bouncedT.cardName}) from your deck or hand. It will be placed into the same Support Zone.`,
        confirmLabel: '🌊 Place!',
        confirmClass: 'btn-success',
        cancellable: false,
      });
      if (!replacementPick || !replacementPick.cardName) {
        engine.sync();
        return;
      }
      const repName = replacementPick.cardName;
      if (repName === bouncedT.cardName) {
        // Defensive — gallery excluded this name, but re-validate.
        engine.sync();
        return;
      }
      const repCd = cardDB[repName];
      if (!repCd || !hasCardType(repCd, 'Creature') || (repCd.level ?? 0) > bouncedLevel) {
        engine.sync();
        return;
      }

      // Pop the chosen card from its source pile.
      const deckIdx = (ps.mainDeck || []).indexOf(repName);
      if (deckIdx >= 0) {
        ps.mainDeck.splice(deckIdx, 1);
        engine.shuffleDeck(pi);
      } else {
        const handIdx = (ps.hand || []).indexOf(repName);
        if (handIdx < 0) { engine.sync(); return; }
        // Untrack the matching hand instance so the support track is clean.
        const handInst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'hand' && c.name === repName
        );
        if (handInst) engine._untrackCard(handInst.id);
        ps.hand.splice(handIdx, 1);
      }

      // ── Step 4: place into the bounced creature's slot ──
      const summonRes = await engine.summonCreatureWithHooks(
        repName, pi, bouncedHeroIdx, bouncedSlot,
        { source: 'Divine Gift of the Deepsea', isPlacement: true }
      );
      if (!summonRes?.inst) {
        // Placement fizzled (beforeSummon refused etc.) — refund the card to hand.
        ps.hand.push(repName);
        engine._trackCard(repName, pi, 'hand');
        engine.sync();
        return;
      }

      // Summoning-sickness bypass for THIS instance only — card text
      // grants "may activate its active effect this turn." Mark with
      // Haste rather than fake-aging `turnPlayed`, so genuine
      // "was summoned this turn" reads (Alice the Puppeteer Girl,
      // Hive's Crown, Singing's exclude-fresh filter, …) still see
      // this Creature as a fresh summon.
      if (!summonRes.inst.counters) summonRes.inst.counters = {};
      summonRes.inst.counters._hasHaste = true;

      // Black-water whirlpool + bubbles on the newly placed Creature.
      // Fires AFTER summon hooks resolve so any on-summon effects (Dark
      // Deepsea God's tribute trigger, etc.) don't have their own
      // animations buried by this overlay.
      engine._broadcastEvent('play_zone_animation', {
        type: 'deepsea_summon_whirlpool',
        owner: pi,
        heroIdx: bouncedHeroIdx,
        zoneSlot: summonRes.actualSlot ?? bouncedSlot,
      });
      await engine._delay(900);

      engine.log('divine_gift_deepsea', {
        player: ps.username,
        bounced: bouncedT.cardName,
        placed: repName,
        slot: { heroIdx: bouncedHeroIdx, zoneSlot: bouncedSlot },
      });
      engine.sync();
    },
  },
};
