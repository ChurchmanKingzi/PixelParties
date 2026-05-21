// ═══════════════════════════════════════════
//  CARD EFFECT: "Shield of Wisdom"
//  Artifact (Surprise, Cost 6)
//
//  EFFECT:
//   "Activate this Surprise when the user or a
//    Creature in its Support Zones is chosen by an
//    opponent's Creature effect. Redirect that
//    effect to any target your opponent controls,
//    except the attacking Creature itself."
//
//  ── Surprise-redirect plumbing ──
//  This is an `isSurprise` + `isSurpriseRedirect`
//  card. Placed face-down in a Hero's Surprise
//  Zone like any Surprise (no gold paid — Surprises
//  never pay their cost; the cost stat is unused at
//  placement/activation, consistent with every
//  other Surprise in the engine).
//
//  The engine's `_checkTargetRedirect` (single-
//  target picker path) scans the targeted player's
//  Surprise Zones for `isSurpriseRedirect` cards
//  AFTER a target is chosen. It calls
//  `canSurpriseRedirect` to gate the trigger, then
//  (on the owner's confirm) drives the standard
//  `_activateSurprise` flow — flip / reveal / hooks
//  / discard — and propagates this script's
//  `onSurpriseActivate` → `{ redirectTo }` up to
//  the picker exactly like a hand/hero redirect.
//
//  `isSurpriseRedirect` is also in the
//  `_checkSurpriseWindow` skip-list, so this card
//  is NEVER offered through the generic hero-target
//  Surprise window — it fires ONLY via the redirect
//  path above (single-target Creature effects;
//  multi-target Creature effects don't enter the
//  redirect system — the same long-standing scope
//  Challenge / Martyry / Anti-Magnet share).
//
//  ── Trigger ──
//  Fires iff ALL hold:
//   • The source is an OPPONENT's Creature effect
//     (a Creature card instance in a Support Zone,
//     controlled by the other player).
//   • The chosen target is THIS Surprise's host
//     Hero ("the user") OR a Creature in that
//     Hero's Support Zones.
//   • The opponent controls at least one legal
//     redirect target (any Hero/Creature they
//     control EXCEPT the attacking Creature). If
//     not, the Surprise cannot activate and the
//     effect proceeds on the original target
//     (fizzle, per design).
//
//  ── Redirect ──
//  The Shield's controller chooses the new target
//  among every target the opponent controls except
//  the attacking Creature itself.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Shield of Wisdom';

/**
 * The source is an OPPONENT's Creature effect: a Creature card
 * instance sitting in a Support Zone, controlled by the other player.
 */
function isOppCreatureEffect(engine, pi, sourceCard) {
  if (!sourceCard) return false;
  const srcOwner = sourceCard.controller ?? sourceCard.owner ?? -1;
  if (srcOwner < 0 || srcOwner === pi) return false;          // opponent's only
  if (sourceCard.zone !== 'support') return false;            // a board Creature
  const cd = (engine.getEffectiveCardData ? engine.getEffectiveCardData(sourceCard) : null)
    || (sourceCard.name ? engine._getCardDB()[sourceCard.name] : null);
  return !!(cd && hasCardType(cd, 'Creature'));
}

/**
 * Every target the source's controller (the opponent) controls —
 * their living Heroes plus the Creatures they control — EXCEPT the
 * attacking Creature itself. This is both the activation gate (must
 * be non-empty) and the redirect pool.
 */
function buildOpponentTargets(engine, sourceOwner, attackingInst) {
  const gs = engine.gs;
  const ps = gs.players[sourceOwner];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const out = [];

  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    out.push({
      id: `hero-${sourceOwner}-${hi}`, type: 'hero',
      owner: sourceOwner, heroIdx: hi, cardName: h.name,
    });
  }

  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== sourceOwner) continue;
    if (inst.zone !== 'support' || inst.faceDown) continue;
    // "except the attacking Creature itself"
    if (attackingInst && inst.id === attackingInst.id) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push({
      id: `equip-${sourceOwner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
      owner: sourceOwner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return out;
}

module.exports = {
  isSurprise: true,
  // Routes through `_checkTargetRedirect`'s surprise scan, NOT the
  // generic hero-target Surprise window (see header).
  isSurpriseRedirect: true,

  /**
   * Activation gate — see header. `hostHeroIdx` is the Hero whose
   * Surprise Zone holds this card ("the user").
   * @returns {boolean}
   */
  canSurpriseRedirect(gs, pi, hostHeroIdx, selected, validTargets, config, sourceCard, engine) {
    if (!isOppCreatureEffect(engine, pi, sourceCard)) return false;

    // The chosen target must be the host Hero itself OR a Creature in
    // that Hero's Support Zones. Creature targets are type 'equip' in
    // the picker (the picker only adds actual Creatures as 'equip').
    const isHostHero = selected.type === 'hero'
      && selected.owner === pi && selected.heroIdx === hostHeroIdx;
    const isHostSupportCreature = selected.type === 'equip'
      && selected.owner === pi && selected.heroIdx === hostHeroIdx;
    if (!isHostHero && !isHostSupportCreature) return false;

    // A legal redirect target must exist (else the Surprise cannot
    // activate and the effect proceeds on the original target).
    const sourceOwner = sourceCard.controller ?? sourceCard.owner ?? -1;
    return buildOpponentTargets(engine, sourceOwner, sourceCard).length > 0;
  },

  /**
   * Redirect: the Shield's controller picks any target the opponent
   * controls (except the attacking Creature). Driven from
   * `_checkTargetRedirect` via `_activateSurprise`; returning
   * `{ redirectTo }` swaps the original effect's target.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const pi = ctx.cardController ?? ctx.cardOwner;          // Shield's controller
    if (!sourceInfo?._redirectMode) return null;

    const sourceCard = sourceInfo.cardInstance;
    const sourceOwner = sourceCard?.controller ?? sourceCard?.owner ?? sourceInfo.owner ?? -1;
    if (sourceOwner < 0) return null;

    const pool = buildOpponentTargets(engine, sourceOwner, sourceCard);
    if (pool.length === 0) return null; // Guarded by canSurpriseRedirect; belt-and-suspenders.

    // ── Shield's controller picks the new target ──
    let redirectTarget;
    if (pool.length === 1) {
      redirectTarget = pool[0];
    } else {
      const picked = await engine.promptEffectTarget(pi, pool, {
        title: CARD_NAME,
        description: `Redirect ${sourceCard?.name || 'the Creature effect'} to any target your opponent controls.`,
        confirmLabel: '🛡️ Redirect!',
        confirmClass: 'btn-info',
        cancellable: false, // Surprise already committed — redirect is mandatory.
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
        maxTotal: 1,
        minRequired: 1,
        greenSelect: true,
      });
      const id = Array.isArray(picked) ? picked[0] : null;
      redirectTarget = pool.find(t => t.id === id) || pool[0];
    }
    if (!redirectTarget) return null;

    // ── Redirect animation ──
    const origin = sourceInfo.selected;
    if (origin) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'shield_block', owner: origin.owner, heroIdx: origin.heroIdx,
        zoneSlot: origin.type === 'hero' ? -1 : (origin.slotIdx ?? -1),
      });
    }
    engine._broadcastEvent('play_zone_animation', {
      type: 'anger_mark', owner: redirectTarget.owner, heroIdx: redirectTarget.heroIdx,
      zoneSlot: redirectTarget.type === 'hero' ? -1 : (redirectTarget.slotIdx ?? -1),
    });
    await engine._delay(600);

    engine.log('shield_of_wisdom', {
      player: engine.gs.players[pi]?.username,
      originalTarget: origin?.cardName,
      newTarget: redirectTarget.cardName,
      attacker: sourceCard?.name,
    });
    engine.sync();

    return { redirectTo: redirectTarget };
  },
};
