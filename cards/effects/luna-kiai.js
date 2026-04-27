// ═══════════════════════════════════════════
//  CARD EFFECT: "Luna Kiai"
//  Creature (Summoning Magic Lv1) — 100 HP
//
//  Three independent features:
//
//  [A] Hand-activated reveal (reusable facility)
//      Click the ⚡ badge on Luna in hand to reveal
//      her for the rest of the turn and permanently
//      Burn one of your Heroes. Uses the shared
//      `handActivatedEffect` engine hook. HOPT'd
//      per copy per turn; the card stays in hand.
//
//  [B] Free-summon alt gate
//      When every live Hero you control is Burned,
//      summoning Luna costs an additional Action
//      slot for free (standard `inherentAction`).
//
//  [C] Board passive — Burn-tick max-HP bump
//      While Luna is in support, every Burn tick on
//      a Hero her controller owns bumps that Hero's
//      max HP by 60 (current HP is NOT healed — the
//      tick damage stands). Multiple Luna copies
//      stack. Matches card text: "While you control
//      this Creature, the max HP of Heroes you
//      control are increased by 60 everytime they
//      take Burn damage."
//
//  CPU hand-scoring (see `cpuStatusSelfValueInHand`):
//  While Luna sits in a CPU's hand, burning the
//  CPU's own Heroes registers as a net-POSITIVE
//  action for the target picker. Bigger boost for
//  the Hero whose burn completes the all-burned
//  combo (enables free summon).
// ═══════════════════════════════════════════

const CARD_NAME = 'Luna Kiai';
const HP_PER_BURN_TICK = 60;

/** Live own heroes (`hp > 0` + has a name). */
function liveOwnHeroes(ps) {
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (h?.name && h.hp > 0) out.push({ hero: h, heroIdx: hi });
  }
  return out;
}

/** Can this Hero currently receive a permanent Burn? Mirrors engine gates. */
function heroCanBeBurned(hero) {
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.burned) return false;
  if (hero.statuses?.immune) return false;
  if (hero.statuses?.charmed) return false;
  if (hero.statuses?.burn_immune) return false;
  return true;
}

module.exports = {
  // ── [A] Hand-activated reveal + permanent Burn ───────────────────────
  handActivatedEffect: true,
  handActivateLabel: 'Reveal & Burn a Hero',

  canHandActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need at least one own Hero that can still be newly Burned.
    return liveOwnHeroes(ps).some(({ hero }) => heroCanBeBurned(hero));
  },

  async onHandActivate(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    // `handIndex` is the specific hand slot the player clicked. Stamp
    // THIS index (not a count) so each copy of Luna is revealed
    // independently. The engine's splice interceptor keeps the index
    // set consistent across later hand mutations.
    const myHandIndex = ctx.handIndex;

    const burnable = liveOwnHeroes(ps)
      .filter(({ hero }) => heroCanBeBurned(hero))
      .map(({ hero, heroIdx }) => ({
        id: `hero-${pi}-${heroIdx}`,
        type: 'hero',
        owner: pi,
        heroIdx,
        cardName: hero.name,
      }));
    if (burnable.length === 0) return false;

    const picked = await engine.promptEffectTarget(pi, burnable, {
      title: CARD_NAME,
      description: 'Choose one of your Heroes to Burn for the rest of the game.',
      confirmLabel: '🌙 Burn!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!picked || picked.length === 0) return false;
    const chosen = burnable.find(t => t.id === picked[0]);
    if (!chosen) return false;

    // Commit the reveal on Luna's end BEFORE running the burn:
    //   • Stamp `_revealedHandIndices[handIndex]` so the clicked copy
    //     can't be activated again and renders semi-transparent. The
    //     reveal lasts for the rest of the turn — cleared at turn
    //     start along with other reveal state.
    //   • Broadcast `card_reveal` so BOTH players (and spectators) see
    //     the card image pop up, matching the artifact-activation feel.
    if (typeof myHandIndex === 'number' && myHandIndex >= 0) {
      if (!ps._revealedHandIndices) ps._revealedHandIndices = {};
      ps._revealedHandIndices[myHandIndex] = true;
    }
    engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });

    engine.sync();
    await engine._delay(700);

    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_strike',
      owner: chosen.owner,
      heroIdx: chosen.heroIdx,
      zoneSlot: -1,
    });
    await engine._delay(300);

    await engine.addHeroStatus(chosen.owner, chosen.heroIdx, 'burned', {
      permanent: true,
      appliedBy: pi,
    });

    engine.log('luna_kiai_reveal_burn', {
      player: ps.username,
      target: ps.heroes?.[chosen.heroIdx]?.name,
    });
    engine.sync();
    return true;
  },

  // ── [B] Free-summon alt gate ─────────────────────────────────────────
  inherentAction: (gs, pi) => {
    const ps = gs.players[pi];
    if (!ps) return false;
    const live = liveOwnHeroes(ps);
    if (live.length === 0) return false;
    return live.every(({ hero }) => !!hero.statuses?.burned);
  },

  // ── [C] Board passive — +60 max HP on Burn tick ─────────────────────
  activeIn: ['support'],

  hooks: {
    afterDamage: async (ctx) => {
      // Only Burn ticks (engine stamps `source: { name: 'Burn' }` and
      // `type: 'fire'` when dealing status damage). Non-burn fire
      // damage (Heat Wave, etc.) uses other type/source combos.
      if (ctx.source?.name !== 'Burn') return;
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      // The bump fires AFTER the burn damage applies, so a Hero that
      // dies from this exact tick MUST stay dead — Luna can't pull a
      // corpse back over the line. The 60-HP grant only lands on Heroes
      // who survived the tick.
      if (target.hp <= 0) return;
      // Only Heroes controlled by Luna's controller get the bump.
      const engine = ctx._engine;
      const gs = engine.gs;
      const ownerPs = gs.players[ctx.cardOwner];
      if (!ownerPs) return;
      const heroIdx = (ownerPs.heroes || []).indexOf(target);
      if (heroIdx < 0) return;

      // ── Explicit damage + heal popups ──────────────────────────
      // The auto HP-delta detector on the client compares the
      // pre-sync and post-sync hp values. Burn -X cancelled by
      // Kiai +60 nets to 0 (or +60*(N-1) with multiple Kiais), which
      // would render either NO popup or the wrong "+heal" popup —
      // hiding the burn from the player. Instead, emit explicit
      // popups: ONE red "burn" popup for the tick (the first Kiai to
      // react this damage event claims it via a ctx flag), plus a
      // green "+60" popup per Kiai. The client suppresses auto
      // detection for this hero on this sync so the explicit popups
      // are the sole source of truth.
      const burnAmount = ctx.amount || 0;
      if (!ctx._kiaiHpPopupEmitted && burnAmount > 0) {
        engine._broadcastEvent('kiai_hp_split', {
          owner: ctx.cardOwner, heroIdx,
          damage: burnAmount, heal: HP_PER_BURN_TICK,
        });
        ctx._kiaiHpPopupEmitted = true;
      } else {
        engine._broadcastEvent('kiai_hp_split', {
          owner: ctx.cardOwner, heroIdx,
          heal: HP_PER_BURN_TICK,
        });
      }

      // Bump max HP AND heal current HP by the same amount — the
      // 60-HP "buffer" is a real cushion against the next tick, not
      // just a paper number. Default alsoHealCurrent on the engine
      // helper is true, but make it explicit for self-documenting
      // intent.
      engine.increaseMaxHp(target, HP_PER_BURN_TICK, { alsoHealCurrent: true });
      engine.log('luna_kiai_burn_bump', {
        player: ownerPs.username,
        target: target.name,
        amount: HP_PER_BURN_TICK,
      });
    },
  },

  // ── CPU: treat "burn my own Hero" as a POSITIVE action ──────────────
  cpuStatusSelfValueInHand(statusName, ctx) {
    if (statusName !== 'burned') return 0;
    const engine = ctx?.engine;
    const owner = ctx?.owner;
    const candidateHero = ctx?.hero;
    if (!engine || owner == null || !candidateHero) return 0;
    // Already Burned — no net change, nothing for Luna to unlock here.
    if (candidateHero.statuses?.burned) return 0;
    const ps = engine.gs.players[owner];
    if (!ps) return 0;
    // Count OTHER live Heroes that are still un-Burned (excluding the
    // candidate, which would flip to Burned if chosen).
    let otherUnburned = 0;
    for (const h of (ps.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      if (h === candidateHero) continue;
      if (!h.statuses?.burned) otherUnburned++;
    }
    // Burning this Hero completes the all-burned combo → free summons.
    if (otherUnburned === 0) return 120;
    // One step from completing — strong pull.
    if (otherUnburned === 1) return 70;
    return 40;
  },
};
