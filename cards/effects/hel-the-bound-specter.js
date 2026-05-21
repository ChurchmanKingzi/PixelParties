// ═══════════════════════════════════════════
//  HERO EFFECT: "Hel, the Bound Specter"
//  Hero (HP 250 / ATK 50 — Magic Arts +
//  Necromancy starting abilities)
//
//  EFFECT (per cards.json):
//   "At the start of the game, before both
//    players draw their starting hands, choose an
//    equippable Artifact with a Cost of 20 or
//    less from your deck and equip it to this
//    Hero without paying its Cost. At the end of
//    your turn, if this Hero does not have an
//    Artifact equipped to it by its own effect,
//    immediately equip an Artifact with the same
//    name from your hand or discard pile to this
//    Hero by paying its Cost. If you can't,
//    defeat this Hero. While this Hero has an
//    Artifact equipped to it by its own effect,
//    halve any damage it would take (rounded up)."
//
//  ── "equipped to it by its own effect" ──
//  Tracked by an instance marker
//  (`inst.counters._helEffectEquip = true`) set
//  ONLY when Hel's own effect places the equip
//  (game-start tutor OR the forced end-of-turn
//  re-equip). A copy the player equips manually
//  (paying its Cost themselves, normal play) is
//  NOT marked, so it does not satisfy the upkeep
//  and does not grant the damage halving — exactly
//  the text ("by its own effect").
//
//  The "same name" reference is locked in the
//  first time Hel's effect equips something —
//  stored on the Hero object as
//  `_helEffectArtifactName`. Every later forced
//  re-equip pulls a copy of that same name.
//
//  ── Game start (onBeforeHandDraw) ──
//  Mirrors Bill / Sid: wait out the GO
//  FIRST/SECOND announcement (skipped in puzzles),
//  raise the `heroEffectPending` banner, then a
//  MANDATORY single-pick gallery of every distinct
//  deck Artifact whose subtype is Equipment, Cost
//  ≤ 20, and that Hel may legitimately receive.
//  Hel may NOT bypass an Equip's own equipping
//  restrictions: Equips that aren't normally
//  Hero-equippable from hand are excluded —
//  `neverPlayable` / `playableFromCoolnessStack`
//  (Coolness-Stack-only Modnir / Swellpnir),
//  `placesOnOpponentBoard` (Powder Keg), and any
//  `canEquipToHero` gate are all honoured (see
//  `_helCanUseEquip`). The chosen copy
//  leaves the deck and is equipped to Hel WITHOUT
//  paying its Cost. If the deck holds no eligible
//  Artifact the effect simply can't start — Hel
//  then has no own-effect artifact, so her first
//  end-of-turn upkeep defeats her (rules as
//  written: "If you can't, defeat this Hero").
//
//  ── End of your turn (onTurnEnd) ──
//  Fires only on Hel's controller's own turn end,
//  Hel alive. If an own-effect artifact is still
//  equipped to her → nothing to do. Otherwise she
//  MUST re-equip a same-named Artifact from hand
//  OR discard, paying its Cost. "Can't" — and
//  therefore "defeat this Hero" — covers: no
//  reference name (never got a starting equip), no
//  copy in hand/discard, Cost unpayable (gold-
//  locked or insufficient Gold), no free Support
//  Zone on Hel, or the equip's own `canEquipToHero`
//  now rejects Hel. When a copy sits in BOTH hand
//  and discard the player chooses the source (the
//  effect is mandatory — they must pick one); when
//  only one source has it, it's automatic.
//
//  ── Damage halving (beforeDamage) ──
//  While an own-effect artifact is equipped to
//  Hel, incoming damage to Hel is halved ROUNDED
//  UP → new = ceil(amount/2), i.e. reduce by
//  floor(amount/2), via `ctx.modifyAmount`. True
//  damage (`actionDealTrueDamage`) never runs
//  BEFORE_DAMAGE, so it is correctly NOT halved
//  ("cannot be reduced or negated").
//
//  The self-defeat passes `respectFirstTurn
//  Protection:false` — it is Hel's own rule's
//  consequence (a forced self-sacrifice) and must
//  land even under the game-start grace shield.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Hel, the Bound Specter';
const MAX_START_COST = 20;

/** Equipment-subtype Artifact (honours any effective type override). */
function _isEquipmentArtifact(cd) {
  return !!cd && hasCardType(cd, 'Artifact')
    && (cd.subtype || '').toLowerCase() === 'equipment';
}

/**
 * May Hel's OWN effect legitimately equip `name` to her right now?
 *
 * Hel must NOT be allowed to bypass an Equip's own equipping
 * restrictions — an Equip she can't normally receive may not be
 * tutored / re-equipped by this effect either. Rejected (no hardcoded
 * names — driven entirely by the equip's own script flags):
 *   • `neverPlayable`            — no normal hand/equip path at all
 *                                  (Coolness-Stack-only Modnir /
 *                                  Swellpnir, and any future such Equip)
 *   • `playableFromCoolnessStack`— Coolness-Stack-only route (independent
 *                                  belt-and-suspenders to the above)
 *   • `placesOnOpponentBoard`    — cross-side-only (Powder Keg): never a
 *                                  legitimate self-equip onto Hel
 *   • `canEquipToHero` → false   — inherent per-Hero gate (one-per-Hero
 *                                  blockers, Lunatic Cycle chain, …)
 * Equips with none of these are freely equippable and allowed.
 */
function _helCanUseEquip(engine, pi, helHeroIdx, name) {
  let script;
  try { script = loadCardEffect(name); }
  catch { return false; }
  if (script) {
    if (script.neverPlayable === true) return false;
    if (script.playableFromCoolnessStack === true) return false;
    if (script.placesOnOpponentBoard === true) return false;
    if (typeof script.canEquipToHero === 'function') {
      try { return !!script.canEquipToHero(engine.gs, pi, helHeroIdx, engine); }
      catch { return false; }
    }
  }
  return true;
}

/** The live artifact instance equipped to Hel BY HER OWN EFFECT, or null. */
function _findOwnEffectArtifact(engine, ownerIdx, helHeroIdx) {
  for (const inst of engine.cardInstances || []) {
    if (!inst?.counters?._helEffectEquip) continue;
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
    if (inst.heroIdx !== helHeroIdx) continue;
    return inst;
  }
  return null;
}

/** First empty Support Zone slot index on Hel (0–2), or -1 if full. */
function _firstFreeSupportSlot(ps, helHeroIdx) {
  const zones = ps.supportZones?.[helHeroIdx] || [[], [], []];
  for (let s = 0; s < 3; s++) {
    if ((zones[s] || []).length === 0) return s;
  }
  return -1;
}

/**
 * Place `name` into Hel's first free Support Zone, mark it as equipped
 * by Hel's own effect, fire the standard placement lifecycle (so the
 * equip's own onPlay — ATK grants, etc. — applies), and animate it.
 * Returns the tracked instance, or null if no slot was free.
 */
async function _equipOnHel(engine, pi, helHeroIdx, name) {
  const ps = engine.gs.players[pi];
  const slot = _firstFreeSupportSlot(ps, helHeroIdx);
  if (slot < 0) return null;

  if (!ps.supportZones[helHeroIdx]) ps.supportZones[helHeroIdx] = [[], [], []];
  ps.supportZones[helHeroIdx][slot] = [name];

  const inst = engine._trackCard(name, pi, 'support', helHeroIdx, slot);
  if (inst) {
    if (!inst.counters) inst.counters = {};
    inst.counters._helEffectEquip = true;
  }

  engine._broadcastEvent('summon_effect', {
    owner: pi, heroIdx: helHeroIdx, zoneSlot: slot, cardName: name,
  });

  await engine.runHooks('onPlay', {
    _onlyCard: inst, playedCard: inst, cardName: name,
    zone: 'support', heroIdx: helHeroIdx, zoneSlot: slot,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'support', toHeroIdx: helHeroIdx,
  });

  engine.sync();
  await engine._delay(400);
  return inst;
}

module.exports = {
  activeIn: ['hero'],

  // CPU auto-responses for Hel's two prompts (routed here by title).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || !promptData) return undefined;

    // Game-start tutor — pick the CHEAPEST eligible Artifact. The card's
    // recurring upkeep re-pays this Artifact's Cost every time it falls
    // off, so the lowest-Cost option is the most sustainable choice.
    if (promptData.type === 'cardGallery') {
      const cards = promptData.cards || [];
      if (!cards.length) return undefined;
      const sorted = [...cards].sort((a, b) =>
        (a.cost || 0) - (b.cost || 0)
        || String(a.name).localeCompare(String(b.name)));
      return { cardName: sorted[0].name };
    }

    // Re-equip source choice — prefer the Discard Pile, preserving hand
    // cards. (cancelLabel = "From Discard Pile" → false = cancel.)
    if (promptData.type === 'confirm') return false;

    return undefined;
  },

  hooks: {
    // ── Game start: tutor + free equip ──
    onBeforeHandDraw: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      const helHeroIdx = ctx.cardHeroIdx;
      const helHero = ps.heroes?.[helHeroIdx];
      if (!helHero?.name) return;
      // Defensive: never run twice (reference already locked in).
      if (helHero._helEffectArtifactName) return;

      const cardDB = engine._getCardDB();
      const seen = new Set();
      const eligible = [];
      for (const name of (ps.mainDeck || [])) {
        if (seen.has(name)) continue;
        const cd = cardDB[name];
        if (!_isEquipmentArtifact(cd)) continue;
        if ((cd.cost || 0) > MAX_START_COST) continue;
        if (!_helCanUseEquip(engine, pi, helHeroIdx, name)) continue;
        seen.add(name);
        eligible.push({ name, source: 'deck', cost: cd.cost || 0 });
      }

      if (eligible.length === 0) {
        // No eligible Artifact → no own-effect equip established. Hel's
        // first end-of-turn upkeep will defeat her (rules as written).
        engine.log('hel_no_starting_equip', { player: ps.username });
        return;
      }

      // Let the GO FIRST/SECOND announcement clear (Bill / Sid pattern).
      engine.sync();
      if (!engine.isPuzzle) await engine._delay(3800);
      gs.heroEffectPending = { ownerIdx: pi, heroName: CARD_NAME };
      engine.sync();

      try {
        eligible.sort((a, b) =>
          (a.cost || 0) - (b.cost || 0) || a.name.localeCompare(b.name));

        const res = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: eligible,
          title: CARD_NAME,
          description: `Choose an equippable Artifact with a Cost of ${MAX_START_COST} or less from your deck to equip to ${helHero.name} without paying its Cost.`,
          confirmLabel: '⚓ Equip!',
          confirmClass: 'btn-success',
          cancellable: false,
        });

        // Mandatory pick — fall back to the cheapest on a degenerate
        // empty response so the effect always resolves.
        const chosenName = (res && res.cardName) || eligible[0].name;

        const di = (ps.mainDeck || []).indexOf(chosenName);
        if (di >= 0) ps.mainDeck.splice(di, 1);

        helHero._helEffectArtifactName = chosenName;
        engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });
        await engine._delay(300);

        const inst = await _equipOnHel(engine, pi, helHeroIdx, chosenName);
        engine.log('hel_start_equip', {
          player: ps.username, hero: helHero.name,
          artifact: chosenName, placed: !!inst,
        });
      } finally {
        gs.heroEffectPending = null;
      }
      engine.sync();
    },

    // ── End of your turn: upkeep / re-equip / defeat ──
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      if (ctx.activePlayer !== pi) return;          // "your" turn only
      const helHeroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;
      const helHero = ps.heroes?.[helHeroIdx];
      if (!helHero?.name || helHero.hp <= 0) return; // gone / already dead

      // Still wearing an own-effect artifact → nothing to do.
      if (_findOwnEffectArtifact(engine, pi, helHeroIdx)) return;

      const name = helHero._helEffectArtifactName;
      const cardDB = engine._getCardDB();
      const cd = name ? cardDB[name] : null;
      const cost = cd ? (cd.cost || 0) : 0;

      const doDefeat = async (reason) => {
        engine.log('hel_upkeep_defeat', {
          player: ps.username, hero: helHero.name,
          reason, ref: name || null,
        });
        // Dark-magic death — Hel is consumed by a violet skull-burst
        // (fits the death-goddess / Necromancy theme), not a generic
        // explosion. Same zone-animation channel Shield of Death uses.
        engine._broadcastEvent('play_zone_animation', {
          type: 'death_skulls', owner: pi, heroIdx: helHeroIdx, zoneSlot: -1,
        });
        await engine._delay(600);
        await engine.actionDefeatHero(
          { name: CARD_NAME, owner: pi, heroIdx: helHeroIdx },
          helHero,
          { reason: CARD_NAME, respectFirstTurnProtection: false },
        );
        engine.sync();
      };

      // "If you can't …" — every way the re-equip is impossible.
      const handHas = !!name && (ps.hand || []).includes(name);
      const discHas = !!name && (ps.discardPile || []).includes(name);
      if (!name || !cd) return doDefeat('no_reference');
      if (!handHas && !discHas) return doDefeat('no_copy');
      if (cost > 0 && (ps.goldLocked || (ps.gold || 0) < cost)) return doDefeat('cant_pay');
      if (_firstFreeSupportSlot(ps, helHeroIdx) < 0) return doDefeat('no_slot');
      if (!_helCanUseEquip(engine, pi, helHeroIdx, name)) return doDefeat('cant_equip');

      // Source: player chooses only when BOTH piles hold a copy
      // (mandatory effect — they must pick one). Otherwise automatic.
      let fromHand;
      if (handHas && discHas) {
        const pick = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: `${helHero.name}: equip "${name}" (Cost ${cost} Gold). Take it from your Hand or your Discard Pile?`,
          showCard: name,
          confirmLabel: '✋ From Hand',
          cancelLabel: '🗑️ From Discard Pile',
          cancellable: true,
        });
        // confirm → Hand; cancel/decline → Discard Pile (Johanna shape).
        fromHand = !!pick
          && !(typeof pick === 'object' && (pick.cancelled || pick.confirmed === false));
      } else {
        fromHand = handHas;
      }

      // Re-validate after the async prompt (defensive — nothing else
      // acts at our own turn end, but stay honest about the live piles).
      const liveHandHas = (ps.hand || []).includes(name);
      const liveDiscHas = (ps.discardPile || []).includes(name);
      if (fromHand && !liveHandHas) fromHand = liveDiscHas ? false : fromHand;
      if (!fromHand && !liveDiscHas) fromHand = liveHandHas ? true : fromHand;
      if (!liveHandHas && !liveDiscHas) return doDefeat('no_copy');
      if (_firstFreeSupportSlot(ps, helHeroIdx) < 0) return doDefeat('no_slot');

      // Pay the Cost. Only now — failure here still means "can't".
      if (cost > 0) {
        const paid = await engine.actionSpendGold(pi, cost);
        if (!paid) return doDefeat('cant_pay');
      }

      // Remove one copy from the chosen pile, then equip it.
      const pile = fromHand ? ps.hand : ps.discardPile;
      const idx = pile.indexOf(name);
      if (idx >= 0) pile.splice(idx, 1);

      const inst = await _equipOnHel(engine, pi, helHeroIdx, name);
      if (!inst) {
        // Slot vanished between the guard and placement (shouldn't
        // happen at own turn end) — Cost paid + copy consumed; the
        // re-equip still failed, so honour "defeat this Hero".
        return doDefeat('no_slot');
      }

      // Keep the reference in sync (unchanged — always the same name).
      helHero._helEffectArtifactName = name;
      engine.log('hel_reequip', {
        player: ps.username, hero: helHero.name,
        artifact: name, cost, from: fromHand ? 'hand' : 'discard',
      });
      engine.sync();
    },

    // ── Halve any damage Hel would take (rounded up) ──
    beforeDamage: async (ctx) => {
      const helInst = ctx.card;
      if (!helInst || helInst.zone !== 'hero') return;
      if (!(ctx.amount > 0)) return;
      const engine = ctx._engine;
      const ownerIdx = helInst.owner;
      const ps = engine.gs.players[ownerIdx];
      const helHero = ps?.heroes?.[helInst.heroIdx];
      if (!helHero || ctx.target !== helHero) return;       // only Hel
      if (!_findOwnEffectArtifact(engine, ownerIdx, helInst.heroIdx)) return;

      // new = ceil(amount/2)  ⇒  reduce by floor(amount/2).
      const reduction = Math.floor(ctx.amount / 2);
      if (reduction > 0) ctx.modifyAmount(-reduction);
    },
  },
};
