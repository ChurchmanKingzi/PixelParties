// ═══════════════════════════════════════════
//  CARD EFFECT: "Mischief Militia - Chilly Wizard"
//  Creature — Decay+Summoning Magic Lv2, 50 HP
//
//  • Summon onto ANY Hero's Support Zone (either
//    player). The hand-play UI lights up EVERY
//    free Support Zone (own + opp side) while the
//    card is being dragged, as long as at least
//    one OWN Hero would normally qualify to host
//    him. Drop = direct summon, no extra prompt.
//
//  • Cross-side drops emit `play_creature` with a
//    `crossSideHost` payload field; server stashes
//    it as `gs._chillyWizardHint[pi]` before the
//    Creature is placed. The placement still uses
//    a qualifying OWN Hero (engine's
//    `validateActionPlay` requires this), but
//    `onPlay` immediately moves the inst to the
//    requested opp-side slot and flips
//    `inst.controller`. The brief own-side glow is
//    intentional — it visualises the caster.
//
//  • Free Action — `inherentAction: true`. Summon
//    never consumes the player's main Action.
//
//  • Level-req bypass — eligibility passes as
//    long as ANY of the player's OWN alive Heroes
//    meets the Decay+Summoning Lv2 requirement.
//    The drag-target Hero itself does NOT need
//    to qualify, per card text. We implement
//    this via `canBypassLevelReq` which the
//    engine consults inside `_testLevelReqForZones`.
//
//  • Status mirror — while in play, any negative
//    status applied to Chilly Wizard is mirrored
//    to the corresponding Hero (the Hero whose
//    Support Zone Chilly Wizard occupies). Per
//    card text: "this effect cannot be negated"
//    AND it works while Chilly Wizard is itself
//    Frozen / Stunned / Negated. We use the
//    creature-side onStatusApplied hook (fired by
//    the engine's `applyCreatureStatus` helper)
//    plus `bypassStatusFilter: true` so the hook
//    keeps firing even when Chilly Wizard is CC'd.
//
//  • Control transfer — Chilly Wizard placed on
//    opp's zone becomes opp's Creature
//    (inst.controller = oppIdx). It counts for
//    their Alice / sacrifice fodder / etc. — per
//    user spec.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mischief Militia - Chilly Wizard';

const BASE_LEVEL = 2;
const SCHOOLS = ['Decay Magic', 'Summoning Magic'];

/**
 * Count combined Decay+Summoning Magic on the given hero's ability
 * zones (Performance copies on a school base count as that school).
 */
function _combinedSchoolLevel(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  const abZones = ps?.abilityZones?.[heroIdx] || [];
  let total = 0;
  for (const s of SCHOOLS) total += engine.countAbilitiesForSchool(s, abZones);
  return total;
}

/**
 * Validate a destination hint stashed by the server before `onPlay`
 * fires. Returns the parsed `{ ownerIdx, heroIdx, slotIdx }` iff:
 *   • the hint addresses a free Support Zone on an alive Hero, AND
 *   • the destination differs from where the engine already placed the
 *     Creature (the chosen summoner's slot).
 *
 * Same-side hints are also honoured — they let the player drop onto
 * Hero X's slot while crediting a different own Hero Y as the summoner
 * (the engine puts the Creature on Y's slot, the hint relocates it
 * over to X's slot). When the hint matches the initial placement
 * exactly, returns null and we leave the Creature in place.
 */
function _consumeCrossSideHint(engine, casterPi, inst) {
  const hint = engine.gs._chillyWizardHint?.[casterPi];
  if (!hint) return null;
  delete engine.gs._chillyWizardHint[casterPi];
  if (typeof hint.ownerIdx !== 'number'
      || typeof hint.heroIdx !== 'number'
      || typeof hint.slotIdx !== 'number') return null;
  const currentOwner = inst.controller ?? inst.owner;
  if (hint.ownerIdx === currentOwner
      && hint.heroIdx === inst.heroIdx
      && hint.slotIdx === inst.zoneSlot) return null;
  const toPs = engine.gs.players[hint.ownerIdx];
  if (!toPs) return null;
  const toHero = toPs.heroes?.[hint.heroIdx];
  if (!toHero?.name || toHero.hp <= 0) return null;
  const zones = toPs.supportZones?.[hint.heroIdx] || [];
  if (hint.slotIdx < 0 || hint.slotIdx >= Math.max(zones.length, 3)) return null;
  const slot = zones[hint.slotIdx];
  if (slot && slot.length > 0) return null;
  return hint;
}

module.exports = {
  inherentAction: true,
  bypassStatusFilter: true,
  // ^ Lets the onStatusApplied hook fire even when Chilly Wizard is
  //   Frozen / Stunned / Negated — required by "this effect cannot be
  //   negated" per card text.
  // Cross-side hand-play: as long as ANY of the player's own Heroes
  // could legally summon him, dragging Chilly Wizard from hand lights
  // up EVERY free Support Zone on the board (both sides). Dropping
  // onto an opp-side zone summons him there and flips
  // `inst.controller` to that side (handled in `onPlay` below; the
  // engine's hand-play path honours this flag in `doPlayCreature` /
  // `validateActionPlay`).
  playOnAnyHeroSide: true,
  activeIn: ['support'],

  /**
   * "Any Hero on the board is just an address" — Chilly Wizard doesn't
   * care whether the host Hero is alive, frozen, stunned, bound, or has
   * empty Support Zones available specifically. The engine consults
   * this hook in two places:
   *   • `getHeroPlayableCards` — the dead/paralysed-hero gate AND the
   *     "Hero needs a free zone" gate.
   *   • `validateActionPlay` — the incapacitation gate.
   * Returning `true` flat-out lets the player drag Chilly Wizard onto
   * ANY Hero's Support Zone, mirroring his text ("any Hero").
   */
  canBypassFreeZoneRequirement() {
    return true;
  },

  cpuMeta: {
    onDeathBenefit: 0,
    // CPU placement hint — see `_cpu.js` (Chilly Wizard prefers landing
    // on an opp Hero's Support Zone because the status mirror funnels
    // negative statuses to whoever owns the zone). Future CPU bot reads
    // this flag from the script to pick the cross-side destination.
    preferOpponentSupportZone: true,
  },

  /**
   * Engine consults this inside `_testLevelReqForZones`. Returns true
   * if any OWN alive Hero meets Decay+Summoning Lv2 — the dragged-
   * target Hero gets a pass.
   */
  canBypassLevelReq(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (hi === heroIdx) continue;
      const sibling = ps.heroes[hi];
      if (!sibling?.name || sibling.hp <= 0) continue;
      if (sibling.statuses?.frozen || sibling.statuses?.stunned
          || sibling.statuses?.negated || sibling.statuses?.bound) continue;
      if (_combinedSchoolLevel(engine, pi, hi) >= BASE_LEVEL) return true;
    }
    return false;
  },

  hooks: {
    // ── On entry: consume a cross-side destination hint ──
    // The new hand-play UI lets the player drag Chilly Wizard onto ANY
    // free Support Zone on the board. Same-side drops are placed
    // normally by the engine — no work here. Cross-side drops stash a
    // `{ ownerIdx, heroIdx, slotIdx }` hint on `gs._chillyWizardHint[pi]`
    // (set by the `play_creature` socket handler before validation), and
    // we splice the freshly-placed inst from the caster's own Hero over
    // to the opp-side destination, flipping `inst.controller`. Without
    // a hint, the placement IS the destination — nothing to relocate.
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id) return;
      if (inst.zone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      const hint = _consumeCrossSideHint(engine, pi, inst);
      if (!hint) return; // no relocation needed — placement IS the destination

      const fromOwner = inst.controller ?? inst.owner;
      const fromPs = engine.gs.players[fromOwner];
      const toPi = hint.ownerIdx;
      const toPs = engine.gs.players[toPi];

      // Splice old slot (wherever the engine initially placed us — the
      // chosen summoner's first free Support Zone on their side).
      const fromSlot = fromPs.supportZones?.[inst.heroIdx];
      if (fromSlot) {
        const idx = (fromSlot[inst.zoneSlot] || []).indexOf(CARD_NAME);
        if (idx >= 0) fromSlot[inst.zoneSlot].splice(idx, 1);
      }
      // Insert into the chosen destination slot
      if (!toPs.supportZones[hint.heroIdx]) toPs.supportZones[hint.heroIdx] = [[], [], []];
      toPs.supportZones[hint.heroIdx][hint.slotIdx] = [CARD_NAME];

      // Update instance bookkeeping. Per the engine's owner/controller
      // model:
      //   • `inst.originalOwner` (the DECK side, frozen at creation —
      //     where the corpse goes on death) stays the caster.
      //   • `inst.controller` (GAMEPLAY-SIDE owner — "Creatures you
      //     control" / "your opponent controls" filters key off this)
      //     flips to the destination side.
      //   • `inst.owner` (PHYSICAL-SIDE tracker that engine internals
      //     use for hand-limit iteration, hook gates, etc.) follows
      //     the physical move so the card's slot lives on the new
      //     side consistently with every other permanent-relocate
      //     mechanic (Diplomacy / Dark Gear / Molinda steal). The
      //     user-facing notion of "owner" is captured by
      //     `originalOwner`, which stays the caster — so destruction
      //     correctly returns the corpse to the caster's discard pile.
      inst.heroIdx = hint.heroIdx;
      inst.zoneSlot = hint.slotIdx;
      inst.controller = toPi;
      inst.owner = toPi;

      // Visual: replay the summon glow on the new slot so the player
      // sees Chilly Wizard "land" on the destination.
      engine._broadcastEvent('summon_effect', {
        owner: toPi, heroIdx: hint.heroIdx, zoneSlot: hint.slotIdx,
        cardName: CARD_NAME,
      });
      await engine._delay(200);
      engine.log('chilly_wizard_relocate', {
        player: engine.gs.players[pi]?.username,
        ownerSide: toPi, heroIdx: hint.heroIdx, slotIdx: hint.slotIdx,
      });
      engine.sync();
    },

    // ── Status mirror ──
    // Fires when ANY status is applied to this Creature. Bypass-status-
    // filter keeps the hook firing even when Chilly Wizard is CC'd —
    // the engine's per-listener gate (`runHooks`) honours
    // `script.bypassStatusFilter === true`.
    onStatusApplied: async (ctx) => {
      // Engine fires this hook for both heroes AND creatures (post-
      // extension). `_onCreature` discriminates the creature path.
      if (!ctx._onCreature) return;
      if (!ctx.target || ctx.target.id !== ctx.card.id) return;

      const statusName = ctx.statusName || ctx.status;
      if (!statusName) return;
      // Mirror only NEGATIVE statuses, per card text.
      const { STATUS_EFFECTS } = require('./_hooks');
      if (!STATUS_EFFECTS[statusName]?.negative) return;

      const engine = ctx._engine;
      const inst = ctx.card;
      const hostPi = inst.controller ?? inst.owner;
      const hostHero = engine.gs.players[hostPi]?.heroes?.[inst.heroIdx];
      if (!hostHero?.name || hostHero.hp <= 0) return;
      if (hostHero.statuses?.[statusName]) return; // already has it

      // Mirror via the standard hero-status apply path so the engine
      // emits the right animations / hook fires / immunity gates.
      // We pass `appliedBy` = whoever applied the status to the
      // Creature, so opp-targeted immunities (Sparkfly Attendant gift,
      // etc.) trip correctly on the Hero too.
      const appliedBy = ctx.opts?.sourceOwner ?? -1;
      await engine.addHeroStatus(hostPi, inst.heroIdx, statusName, {
        appliedBy,
        duration: ctx.opts?.duration,
        // Animation already played on the Creature; sibling animation
        // on the Hero is helpful so the player can see the spread.
        animationType: statusName === 'frozen' ? 'freeze' : undefined,
        _viaChillyWizard: true,
      });
      engine.log('chilly_wizard_mirror', {
        target: hostHero.name, status: statusName,
      });
    },
  },
};
