// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Pengu"
//  Creature (Summoning Magic Lv1, 50 HP — Slippery)
//
//  At the beginning of each of your turns, place
//  this Creature into the free Support Zone of an
//  adjacent Hero, if possible.
//
//  When this Creature is moved into a different
//  Hero's Support Zone, you MAY immediately move
//  an Ability from one of your undefeated Heroes
//  to an adjacent undefeated Hero. That counts
//  as an additional attachment.
//
//  Mechanics notes:
//   • "Adjacent" Heroes are 0↔1, 1↔2 (same row
//     adjacency rule the Slippery archetype uses
//     for Creature movement).
//   • UI: the player clicks an eligible Ability in
//     play (highlighted via the `pengueAbilityMove`
//     prompt), which then highlights every legal
//     destination Ability Zone (adjacent Hero,
//     either empty or already containing that
//     Ability at Lv 1/2). Clicking the destination
//     plays a visual transfer — the Ability flies
//     from its current Ability Zone to the chosen
//     destination Ability Zone, appearing there
//     only AFTER the animation completes.
//   • Standard attachment rules — Lv 3 caps stack,
//     restricted abilities (Divinity, etc.) can't
//     be moved here, customPlacement scripts are
//     honored. Sources whose ability has zero
//     legal adjacent destinations are NOT
//     highlighted and can't be selected.
//   • "Additional attachment" means the destination
//     Hero's per-turn `abilityGivenThisTurn` slot
//     is NOT consumed — same wording / semantics
//     Alex Trainer of Heroes uses for his tutored
//     attachment.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const {
  onSlipperyTurnStart,
  slipperyOnMoveGate,
  adjacentHeroIndices,
} = require('./_slippery-shared');

const CARD_NAME = 'Slippery Pengu';

/**
 * Enumerate every legal destination Ability Zone slot for `abilityName`
 * on Hero `heroIdx` of player `pi`. Same rule the click-to-attach UI
 * (`attachPickZoneValid` in app-board.jsx) and Alex's `findTargetZone`
 * use — a Hero can hold any given Ability in AT MOST ONE zone:
 *   • If the Hero already holds `abilityName` in some zone, ONLY that
 *     zone is legal (and only if its stack is < 3). Empty zones are
 *     NOT legal — you can't open a second copy on the same Hero.
 *   • Otherwise, every empty zone is legal.
 *   • Scripts with `customPlacement` override the rules entirely
 *     (Performance, etc. — those decide per-slot via canPlace).
 *
 * `restrictedAttachment` is INTENTIONALLY NOT honored here — that flag
 * exists to prevent FRESH attachment of Divinity-class abilities via
 * generic tutors / hand-plays, but Pengu is RELOCATING an already-
 * attached Ability, which is allowed by design (per user spec: "Pengu
 * SHOULD be able to move Divinity around").
 */
function legalDropZones(engine, pi, heroIdx, abilityName) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return [];

  const script = loadCardEffect(abilityName);
  const abZones = ps.abilityZones?.[heroIdx] || [[], [], []];
  if (script?.customPlacement) {
    const out = [];
    for (let z = 0; z < 3; z++) {
      if (script.customPlacement.canPlace(abZones[z] || [])) out.push(z);
    }
    return out;
  }
  // Find a pre-existing stack of `abilityName` first — if one exists,
  // it's the ONLY legal destination (and only if it has room).
  for (let z = 0; z < 3; z++) {
    const slot = abZones[z] || [];
    if (slot.length > 0 && slot[0] === abilityName) {
      return slot.length < 3 ? [z] : [];
    }
  }
  // No existing stack — every empty zone is legal.
  const out = [];
  for (let z = 0; z < 3; z++) {
    if ((abZones[z] || []).length === 0) out.push(z);
  }
  return out;
}

/**
 * Build the eligible move list for `pi`. Each entry is one source
 * Ability slot + every legal destination Ability slot reachable from
 * it. Sources whose ability has zero legal destinations on ANY
 * adjacent live Hero are omitted — those Abilities don't get
 * highlighted on the client.
 */
function collectAbilityMoveOptions(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const heroes = ps.heroes || [];
  const out = [];

  for (let srcHi = 0; srcHi < heroes.length; srcHi++) {
    const srcHero = heroes[srcHi];
    if (!srcHero?.name || srcHero.hp <= 0) continue;
    const srcZones = ps.abilityZones?.[srcHi] || [[], [], []];

    for (let zi = 0; zi < srcZones.length; zi++) {
      const slot = srcZones[zi] || [];
      if (slot.length === 0) continue;
      const abilityName = slot[0];
      const cd = cardDB[abilityName];
      if (!cd || !hasCardType(cd, 'Ability')) continue;

      const dests = [];
      for (const destHi of adjacentHeroIndices(srcHi)) {
        if (destHi === srcHi) continue;
        const destHero = heroes[destHi];
        if (!destHero?.name || destHero.hp <= 0) continue;
        // Per-slot destination enumeration. The legality check has to
        // run against the LIVE Ability Zones (so a destination slot
        // that already holds the same Ability at Lv 1/2 counts as
        // valid, an empty slot counts as valid, Lv 3 caps it).
        for (const destZi of legalDropZones(engine, pi, destHi, abilityName)) {
          dests.push({ destHi, destZi });
        }
      }
      if (dests.length === 0) continue;
      out.push({ srcHi, srcZi: zi, abilityName, dests });
    }
  }
  return out;
}

/**
 * Perform the move. Order matters:
 *   1. Re-verify the chosen slot is still legal (state may have
 *      shifted via nested hooks).
 *   2. Broadcast the transfer animation FIRST, BEFORE mutating game
 *      state. The source card stays visible in its zone during the
 *      animation; the destination zone stays empty.
 *   3. Wait the animation duration.
 *   4. Splice from source, push to destination, rewire the
 *      `CardInstance.heroIdx` / `zoneSlot`, sync. The card now
 *      appears in its new zone — exactly when the fly animation
 *      lands. From the player's perspective: the Ability visibly
 *      moves between zones.
 *   5. Fire `onCardEnterZone` on the destination — host-Hero / arch-
 *      etype reactors react as if it were a normal attachment.
 *
 * `abilityGivenThisTurn` is intentionally untouched per card text
 * ("additional attachment").
 */
async function moveAbility(engine, pi, opt) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  const srcZones = ps.abilityZones?.[opt.srcHi] || [[], [], []];
  const srcSlot = srcZones[opt.srcZi] || [];
  const nameIdx = srcSlot.indexOf(opt.abilityName);
  if (nameIdx < 0) return false;

  // Verify destination is still legal at execution time.
  const stillLegal = legalDropZones(engine, pi, opt.destHi, opt.abilityName);
  if (!stillLegal.includes(opt.destZi)) return false;

  // Locate the underlying instance. Multi-stack: take the TOP (last)
  // copy so the animation matches the slot the player visually saw.
  const candidates = engine.cardInstances.filter(c =>
    c.zone === 'ability' && c.owner === pi &&
    c.heroIdx === opt.srcHi && c.zoneSlot === opt.srcZi &&
    c.name === opt.abilityName,
  );
  if (candidates.length === 0) return false;
  const inst = candidates[candidates.length - 1];

  if (!ps.abilityZones[opt.destHi]) ps.abilityZones[opt.destHi] = [[], [], []];
  const destZones = ps.abilityZones[opt.destHi];
  while (destZones.length < 3) destZones.push([]);

  // Pre-animation: card still in source, destination still empty.
  // The client's `play_card_transfer` handler (extended to know about
  // ability zones via `sourceZoneKind` / `targetZoneKind`) flies a
  // ghost card from the source ability slot to the destination
  // ability slot over `duration` ms.
  engine._broadcastEvent('play_card_transfer', {
    sourceOwner: pi,
    sourceHeroIdx: opt.srcHi,
    sourceZoneSlot: opt.srcZi,
    sourceZoneKind: 'ability',
    targetOwner: pi,
    targetHeroIdx: opt.destHi,
    targetZoneSlot: opt.destZi,
    targetZoneKind: 'ability',
    cardName: opt.abilityName,
    duration: 500,
    particles: null,
  });
  await engine._delay(500);

  // Post-animation: mutate + sync. Card disappears from source slot
  // and appears in destination slot in the same network round-trip,
  // matching the moment the fly animation lands.
  srcSlot.splice(nameIdx, 1);
  if (!destZones[opt.destZi]) destZones[opt.destZi] = [];
  destZones[opt.destZi].push(opt.abilityName);
  inst.heroIdx = opt.destHi;
  inst.zoneSlot = opt.destZi;

  engine.sync();

  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'ability', toHeroIdx: opt.destHi,
    _skipReactionCheck: true,
  });

  return true;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: onSlipperyTurnStart,

    onCardEnterZone: async (ctx) => {
      if (!slipperyOnMoveGate(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      const abilities = collectAbilityMoveOptions(engine, pi);
      if (abilities.length === 0) return; // No movable Ability — silent.

      // Custom interactive prompt — the client highlights every
      // eligible Ability Zone (`abilities[*]` source coords), then on
      // click highlights that source's `dests`. The server only sees
      // the final `{ srcHi, srcZi, abilityName, destHi, destZi }`
      // response (or `{ cancelled: true }` for the Skip button).
      const result = await engine.promptGeneric(pi, {
        type: 'pengueAbilityMove',
        title: CARD_NAME,
        description: 'Move an Ability from one of your Heroes to an adjacent Hero.',
        ownerIdx: pi,
        abilities,
        cancellable: true,
        cancelLabel: '✕ Skip',
      });
      if (!result || result.cancelled) return;

      const { srcHi, srcZi, abilityName, destHi, destZi } = result;
      if (srcHi == null || srcZi == null || destHi == null || destZi == null) return;
      if (!abilityName) return;

      // Re-verify the response against the originally-presented set.
      const src = abilities.find(a =>
        a.srcHi === srcHi && a.srcZi === srcZi && a.abilityName === abilityName,
      );
      if (!src) return;
      if (!src.dests.some(d => d.destHi === destHi && d.destZi === destZi)) return;

      const ok = await moveAbility(engine, pi, { srcHi, srcZi, abilityName, destHi, destZi });
      if (!ok) return;

      const heroes = ps.heroes || [];
      engine.log('slippery_pengu_ability_move', {
        player: ps.username,
        ability: abilityName,
        from: heroes[srcHi]?.name,
        to: heroes[destHi]?.name,
      });
      engine.sync();
    },
  },

  // ── CPU prompt response for the custom `pengueAbilityMove` prompt ──
  // The default brain declines cancellable prompts of unknown type,
  // which would skip Pengu's bonus every time. Pick a sensible default
  // (first eligible source + first destination). The eval delta is
  // small and stable, so a heuristic suffices; MCTS scoring can be
  // wired later if needed.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (!promptData || promptData.type !== 'pengueAbilityMove') return undefined;
    const abilities = promptData.abilities || [];
    if (abilities.length === 0) return { cancelled: true };
    const src = abilities[0];
    if (!src.dests || src.dests.length === 0) return { cancelled: true };
    const dest = src.dests[0];
    return {
      srcHi: src.srcHi,
      srcZi: src.srcZi,
      abilityName: src.abilityName,
      destHi: dest.destHi,
      destZi: dest.destZi,
    };
  },
};
