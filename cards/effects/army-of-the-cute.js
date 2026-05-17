// ═══════════════════════════════════════════
//  CARD EFFECT: "Army of the Cute"
//  Spell (Summoning Magic, Lv1, Normal) — archetype Cute
//
//  "Choose "Cute" Creatures from your hand or discard pile whose
//   combined levels do not exceed 1/2/3 and place them into the
//   user's free Support Zones."
//
//  The 1/2/3 budget = the casting Hero's current Summoning Magic
//  level, clamped to [1, 3] (Performance on Summoning Magic counts
//  via the engine helper).
//
//  ── Flow ────────────────────────────────────────────────────────
//  Capped multi-pick gallery (the Timeless King Zi pattern):
//  `cardGalleryMulti` with `costKey:'level'` + `maxBudget:cap` +
//  `hideCostUI:true` greys out any pick that would push the running
//  Σlevel past the cap. One gallery entry PER COPY across hand AND
//  discard (the component selects by index, so duplicate names work).
//  `selectCount` is capped to the casting Hero's free Support Zones
//  so you can't pick more than will fit; `minSelect:1` ("Choose").
//
//  Placement mirrors Necromancy's discard-revival (direct splice →
//  Support Zone → `_trackCard` → summon counter → onPlay /
//  onCardEnterZone) but WITHOUT negation — Army of the Cute does not
//  negate the placed Creatures, so their on-summon effects fire
//  normally. Source pile is immaterial to the board result, so
//  copies are consumed hand-first then discard.
//
//  Cancel / no valid pick ⇒ `gs._spellCancelled = true` (returns the
//  Spell to hand, nothing wasted).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Army of the Cute';

/** Is `cd` a "Cute"-archetype Creature? */
function isCuteCreature(cd) {
  return !!cd && cd.archetype === 'Cute' && hasCardType(cd, 'Creature');
}

/** Casting Hero's Summoning Magic level, clamped to [1, 3]. */
function levelBudget(engine, pi, heroIdx) {
  const abZones = engine.gs.players[pi]?.abilityZones?.[heroIdx] || [];
  const sm = engine.countAbilitiesForSchool('Summoning Magic', abZones);
  return Math.max(1, Math.min(3, sm));
}

/** Free base Support slots (0–2) on a specific Hero. */
function freeSlots(ps, heroIdx) {
  const sup = ps.supportZones?.[heroIdx] || [];
  const out = [];
  for (let s = 0; s < 3; s++) {
    if ((sup[s] || []).length === 0) out.push(s);
  }
  return out;
}

/** Every Cute-Creature copy in hand then discard → gallery entries. */
function cuteGallery(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const out = [];
  for (const name of (ps.hand || [])) {
    const cd = cardDB[name];
    if (isCuteCreature(cd)) out.push({ name, level: cd.level ?? 0, source: 'hand' });
  }
  for (const name of (ps.discardPile || [])) {
    const cd = cardDB[name];
    if (isCuteCreature(cd)) out.push({ name, level: cd.level ?? 0, source: 'discard' });
  }
  return out;
}

module.exports = {
  // Loose hand-grey gate: at least one Cute Creature reachable. The
  // per-cast specifics (this Hero's budget + free zones) are resolved
  // in onPlay and cancel cleanly back to hand if unmet.
  spellPlayCondition: (gs, pi, engine) => {
    if (!engine) return true;
    return cuteGallery(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }
      const heroIdx = ctx.cardHeroIdx; // "the user" = casting Hero

      const free = freeSlots(ps, heroIdx);
      if (free.length === 0) {
        gs._spellCancelled = true;
        engine.log('army_of_the_cute_fizzle', { player: ps.username, reason: 'no_free_zones' });
        return;
      }

      const cap = levelBudget(engine, pi, heroIdx);

      // Per-copy entries; drop any single Creature already over budget
      // (it can never be part of a legal pick — keeps the gallery clean
      // on top of the client-side grey-out).
      const gallery = cuteGallery(engine, pi).filter(e => (e.level || 0) <= cap);
      if (gallery.length === 0) {
        gs._spellCancelled = true;
        engine.log('army_of_the_cute_fizzle', { player: ps.username, reason: 'no_affordable_cute' });
        return;
      }

      const result = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: gallery,                 // [{ name, level }] — level = budget cost
        selectCount: Math.min(3, free.length), // can't place more than fits
        minSelect: 1,
        maxBudget: cap,
        costKey: 'level',
        hideCostUI: true,               // budget is "levels", not gold
        title: CARD_NAME,
        description: `Choose "Cute" Creatures from your hand or discard pile whose combined levels do not exceed ${cap}. They are placed into this Hero's free Support Zones.`,
        confirmLabel: '🐾 Assemble!',
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!result || result.cancelled || !Array.isArray(result.selectedCards)
          || result.selectedCards.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const cardDB = engine._getCardDB();

      // Defensive re-validation (mirror Timeless King Zi / Magic Lamp):
      // every pick is a Cute Creature, Σlevel ≤ cap, count ≤ free zones.
      const chosen = result.selectedCards.filter(n =>
        typeof n === 'string' && isCuteCreature(cardDB[n]));
      const totalLvl = chosen.reduce((s, n) => s + (cardDB[n].level ?? 0), 0);
      if (chosen.length === 0 || totalLvl > cap || chosen.length > free.length) {
        engine.log('army_of_the_cute_invalid_pick', {
          player: ps.username, sent: result.selectedCards, accepted: chosen,
          totalLvl, cap, freeZones: free.length,
        });
        gs._spellCancelled = true;
        return;
      }

      // Place each chosen Creature into the next free Support Zone of
      // the casting Hero, ONE BY ONE with a short beat between each so
      // a 2-3 Creature army assembles sequentially rather than all
      // popping in at once. Copies consumed hand-first then discard
      // (board result is identical regardless of source pile).
      //
      // `_skipReactionCheck: true` on the per-Creature onPlay /
      // onCardEnterZone is load-bearing: WITHOUT it `runHooks` runs
      // `_checkReactionCards` for each summoned Creature, whose
      // reveal/streaming machinery would hijack the activation card-
      // image stream to show the summoned Creature instead of "Army
      // of the Cute" (and open a reaction window per summon mid-loop).
      // The Creatures' OWN on-summon hooks still fire — the flag only
      // skips the reaction/surprise window, exactly like the Slippery
      // mover and summonCreatureWithHooks's default.
      const STAGGER_MS = 300;
      let placed = 0;
      for (let ci = 0; ci < chosen.length; ci++) {
        const name = chosen[ci];
        const slots = freeSlots(ps, heroIdx);
        if (slots.length === 0) break; // ran out of zones (defensive)
        const slot = slots[0];

        let src = 'hand';
        let idx = ps.hand.indexOf(name);
        if (idx < 0) { src = 'discard'; idx = (ps.discardPile || []).indexOf(name); }
        if (idx < 0) continue; // copy gone (race) — skip
        if (src === 'hand') ps.hand.splice(idx, 1);
        else ps.discardPile.splice(idx, 1);

        if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
        if (!ps.supportZones[heroIdx][slot]) ps.supportZones[heroIdx][slot] = [];
        ps.supportZones[heroIdx][slot].push(name);

        const inst = engine._trackCard(name, pi, 'support', heroIdx, slot);
        ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

        engine._broadcastEvent('summon_effect', {
          owner: pi, heroIdx, zoneSlot: slot, cardName: name,
        });
        engine.sync(); // this Creature pops in now (one-by-one)

        const extras = { _summonedFromArmyOfTheCute: true, _skipReactionCheck: true };
        await engine.runHooks('onPlay', {
          _onlyCard: inst, playedCard: inst, cardName: name,
          zone: 'support', heroIdx, zoneSlot: slot, ...extras,
        });
        await engine.runHooks('onCardEnterZone', {
          enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, ...extras,
        });
        placed++;

        // Beat between summons (not after the last one).
        if (ci < chosen.length - 1) await engine._delay(STAGGER_MS);
      }

      if (placed === 0) { gs._spellCancelled = true; return; }

      engine.log('army_of_the_cute', {
        player: ps.username, placed, heroIdx, totalLvl, cap,
      });
      engine.sync();
    },
  },
};
