// ═══════════════════════════════════════════
//  CARD EFFECT: "Sleeping Beauty"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  Three effects:
//
//  1. LINK-ON-SUMMON (`hooks.onPlay`):
//     Prompt the controller to choose a Hero
//     they PERMANENTLY control (own + alive +
//     not charmed away). Stamp the link onto
//     `inst.counters._linkedHeroOwner` and
//     `_linkedHeroIdx`. The host hero is a legal
//     pick. If no eligible target exists, the
//     link is left unset and the borrow-effect
//     stays dormant.
//
//  2. BORROW HERO EFFECT (`creatureEffect`):
//     Once per turn, if the linked Hero has
//     used its hero-effect THIS turn (engine's
//     standard `hero-effect:${name}:${pi}:${hi}`
//     HOPT key), invoke that hero's `onHeroEffect`
//     with the linked Hero's context. Sleeping
//     Beauty's own creature HOPT is the once-
//     per-turn lock; the linked Hero's HOPT is
//     not re-stamped (it's already stamped from
//     the original use).
//
//  3. ON-DEFEAT 300 DAMAGE (`hooks.onCreatureDeath`):
//     When Sleeping Beauty leaves the board via
//     death (damage, sacrifice, destroy, future
//     deletion paths — engine safeguard auto-
//     fires onCreatureDeath for support →
//     discard/deleted Creature transitions),
//     deal 300 damage to the linked Hero.
//     Silent no-op if linked hero is already
//     dead or never linked.
// ═══════════════════════════════════════════

const CARD_NAME = 'Sleeping Beauty';
const ON_DEFEAT_DAMAGE = 300;

function _eligibleLinkHeroes(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.charmedBy != null) continue; // not "permanently controlled"
    out.push(hi);
  }
  return out;
}

function _findHeroInst(engine, owner, heroIdx) {
  return engine.cardInstances.find(c =>
    c.zone === 'hero' && c.owner === owner && c.heroIdx === heroIdx
  );
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    // ── 1. LINK-ON-SUMMON ────────────────────────────────────────
    onPlay: async (ctx) => {
      // Self-only — onPlay fires for any played card; only the just-
      // summoned Sleeping Beauty sets up the link.
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      const eligible = _eligibleLinkHeroes(gs, pi);
      if (eligible.length === 0) return; // No legal pick → effect stays dormant.

      const targets = eligible.map(hi => ({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: ps.heroes[hi].name,
      }));

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: 'Choose one of your Heroes to link with Sleeping Beauty.',
        confirmLabel: '🌹 Link!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxPerType: { hero: 1 },
        maxTotal: 1,
        minRequired: 1,
        autoConfirm: true,
      });

      // Defensive default: if the pick was somehow dismissed, link to
      // the host hero so the on-summon mandate always resolves.
      let chosenIdx = ctx.card.heroIdx;
      if (picked && picked.length > 0) {
        const found = targets.find(t => t.id === picked[0]);
        if (found) chosenIdx = found.heroIdx;
      }

      ctx.card.counters._linkedHeroOwner = pi;
      ctx.card.counters._linkedHeroIdx = chosenIdx;
      engine.log('sleeping_beauty_link', {
        player: ps.username,
        target: ps.heroes[chosenIdx]?.name || 'Hero',
      });
      engine.sync();
    },

    // ── 3. ON-DEFEAT 300 DAMAGE ──────────────────────────────────
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      // Self-detect — fire only on Sleeping Beauty's own death event.
      if (ctx.creature?.instId !== ctx.card.id) return;
      const linkedOwner = ctx.card.counters?._linkedHeroOwner;
      const linkedIdx   = ctx.card.counters?._linkedHeroIdx;
      if (linkedOwner == null || linkedIdx == null) return; // Never linked.
      const linkedHero = gs.players[linkedOwner]?.heroes?.[linkedIdx];
      if (!linkedHero?.name || linkedHero.hp <= 0) return; // Already dead.
      const source = { name: CARD_NAME, owner: ctx.cardOwner, heroIdx: -1 };
      await engine.actionDealDamage(source, linkedHero, ON_DEFEAT_DAMAGE, 'creature');
      engine.log('sleeping_beauty_death_damage', {
        owner: linkedOwner, hero: linkedHero.name,
        amount: ON_DEFEAT_DAMAGE,
      });
    },
  },

  // ── 2. BORROW HERO EFFECT (HOPT) ───────────────────────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const inst   = ctx.card;
    const linkedOwner = inst.counters?._linkedHeroOwner;
    const linkedIdx   = inst.counters?._linkedHeroIdx;
    if (linkedOwner == null || linkedIdx == null) return false;

    const linkedHero = gs.players[linkedOwner]?.heroes?.[linkedIdx];
    if (!linkedHero?.name || linkedHero.hp <= 0) return false;
    // Silenced heroes (frozen / stunned / negated) can't transfer their
    // effect — it's negated at the source.
    if (linkedHero.statuses?.frozen
        || linkedHero.statuses?.stunned
        || linkedHero.statuses?.negated) return false;

    // Linked hero's hero-effect HOPT must be stamped this turn — i.e.,
    // the hero ALREADY USED their effect, which is the trigger
    // condition for Sleeping Beauty to re-cast it.
    const hoptKey = `hero-effect:${linkedHero.name}:${linkedOwner}:${linkedIdx}`;
    if (gs.hoptUsed?.[hoptKey] !== gs.turn) return false;

    const { loadCardEffect } = require('./_loader');
    const heroScript = loadCardEffect(linkedHero.name);
    if (!heroScript?.heroEffect || typeof heroScript.onHeroEffect !== 'function') return false;

    // Defer to the linked hero's own activation gate if it has one — if
    // their effect can't run right now (e.g. hand empty for Megu-style
    // tutors), Sleeping Beauty can't run it either.
    if (heroScript.canActivateHeroEffect) {
      try {
        const heroInst = _findHeroInst(engine, linkedOwner, linkedIdx);
        if (!heroInst) return false;
        const probeCtx = engine._createContext(heroInst, { event: 'sleepingBeautyProbe' });
        if (!heroScript.canActivateHeroEffect(probeCtx)) return false;
      } catch { return false; }
    }
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const inst   = ctx.card;
    const linkedOwner = inst.counters?._linkedHeroOwner;
    const linkedIdx   = inst.counters?._linkedHeroIdx;
    if (linkedOwner == null || linkedIdx == null) return false;
    const linkedHero = gs.players[linkedOwner]?.heroes?.[linkedIdx];
    if (!linkedHero?.name || linkedHero.hp <= 0) return false;

    const { loadCardEffect } = require('./_loader');
    const heroScript = loadCardEffect(linkedHero.name);
    if (!heroScript?.onHeroEffect) return false;

    const heroInst = _findHeroInst(engine, linkedOwner, linkedIdx);
    if (!heroInst) return false;

    // Run the linked hero's effect as if THEY were activating it again.
    // The context derives from the hero's own instance, so all
    // hero-relative references (their support zones, their hand, their
    // ability slots) resolve to the linked Hero. The linked hero's HOPT
    // key is intentionally NOT re-stamped — it was stamped on the
    // original use this turn, which is what gated us here in the first
    // place. Sleeping Beauty's own creature HOPT is stamped by the
    // engine after this returns (standard behavior).
    const heroCtx = engine._createContext(heroInst, {});
    let result;
    try {
      result = await heroScript.onHeroEffect(heroCtx);
    } catch (err) {
      console.error(`[Sleeping Beauty] linked hero effect threw for ${linkedHero.name}:`, err.message);
      result = false;
    }

    engine.log('sleeping_beauty_borrow', {
      owner: linkedOwner, hero: linkedHero.name,
    });
    engine.sync();
    return result !== false;
  },
};
