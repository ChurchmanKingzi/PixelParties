// ═══════════════════════════════════════════
//  CREATURE EFFECT: "Wildur, the Shining Coolness"
//  When this Creature is the top card of your
//  Coolness Stack, you may summon it as an
//  inherent additional Action from there.
//
//  Passive: the FIRST card that would be sent to
//  your discard pile every turn while you control
//  this Creature is placed on top of your Coolness
//  Stack instead. Multiple Wildurs do NOT stack —
//  only the first discard each turn is redirected.
//
//  Implementation
//  ──────────────
//  Same shape as `engine.enableDiscardToDelete`
//  (Forsaken): we monkey-patch the controller's
//  `discardPile.push` so EVERY push — hand discard,
//  mill, creature death, end-of-turn hand-size,
//  any future funnel — gets a chance to be
//  redirected. The override is the only way to
//  catch the discard BEFORE it lands; hooks fire
//  too late and produce the visible
//  "card lands in discard, then teleports out"
//  artifact the user reported.
//
//  The redirect:
//    • Fires on the FIRST card per turn, gated by
//      a per-controller flag reset on every turn
//      start.
//    • Only fires while a Stack visualisation
//      exists for the controller (Wowhalla in
//      their Area zone, OR the Stack array
//      already non-empty). Without that, there's
//      nothing to redirect to and the card flows
//      to discard normally.
//    • Pushes to `coolnessStack` and broadcasts
//      `coolness_stack_change` so the client
//      animates the redirect (single hop direct
//      to Stack — the card never enters discard).
//
//  Cleanup: on Wildur leaving its support zone,
//  the override is removed iff no other Wildur
//  is still in play for the same controller.
// ═══════════════════════════════════════════

const CARD_NAME      = 'Wildur, the Shining Coolness';
const TURN_FLAG      = '_wildurDiscardRedirectedThisTurn';
const INSTALLED_FLAG = '_wildurRedirectInstalled';

const hipdall = require('./hipdall-protector-of-coolness');
const summonFromStack = hipdall._summonFromStack;

/**
 * Stack visualisation lives while Wowhalla is in the controller's Area
 * OR while the coolness Stack array already has cards (puzzle init,
 * etc.). Without either, there's no Stack to redirect to.
 */
function _stackExists(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  if (Array.isArray(ps.coolnessStack) && ps.coolnessStack.length > 0) return true;
  const areaList = engine.gs.areaZones?.[pi] || [];
  return areaList.includes('Wowhalla, the Hall of the Cool');
}

/**
 * Install the discardPile.push override for this controller.
 * Idempotent — guards on `INSTALLED_FLAG`. Multiple Wildurs share one
 * install (no stacking).
 */
/**
 * Best-effort lookup of the inst that's about to be discarded so the
 * client animation can fly from its actual source rect (Support slot
 * for a dying creature, hand row for a Magenta-style hand discard,
 * area for a removed Area card, …) instead of always from the discard
 * pile. At push-time the engine hasn't re-zoned the source inst yet,
 * so we can usually find it in `cardInstances` at its source zone.
 *
 * Priority list reflects which paths actually push to the controller's
 * own discard pile:
 *   support → creature death / Hammer Skeleton / Yeeting / etc.
 *   hand    → Magenta / Wheels / forced discard / hand-size discard
 *   ability → Hammer Skeleton (ability target), Wisdom-cost discard
 *   area    → Area destroy
 *   surprise→ Surprise destroy
 *   permanent → Yeeting a permanent
 * Mill cards are usually untracked at push-time, so falling through to
 * `null` produces a fallback `from: 'deck'` which still reads naturally
 * (deck pile rect → Stack rect) instead of "popped from discard".
 */
function _findSourceInst(engine, pi, cardName) {
  const PRIORITY = ['support', 'hand', 'ability', 'area', 'surprise', 'permanent'];
  for (const z of PRIORITY) {
    const m = engine.cardInstances.find(c =>
      c.name === cardName && c.owner === pi && c.zone === z
    );
    if (m) return m;
  }
  return null;
}

function _installRedirect(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps || ps[INSTALLED_FLAG]) return;
  ps[INSTALLED_FLAG] = true;
  const originalPush = Array.prototype.push;
  const pile = ps.discardPile;
  pile.push = function (...cards) {
    if (cards.length === 0) return this.length;
    // Only redirect when (a) the per-turn slot is open, AND (b) the
    // Stack visualisation actually exists for this controller.
    if (!ps[TURN_FLAG] && _stackExists(engine, pi)) {
      const first = cards[0];
      ps[TURN_FLAG] = true;

      // Capture the source inst (its zone + position) BEFORE we mutate
      // anything — the engine hasn't re-zoned it yet at push-time.
      const srcInst = _findSourceInst(engine, pi, first);
      const fromZone = srcInst?.zone || 'deck'; // mill fallback
      const fromHeroIdx = srcInst?.heroIdx ?? -1;
      const fromZoneSlot = srcInst?.zoneSlot ?? -1;

      ps.coolnessStack.push(first);
      // Track a fresh inst at coolnessStack so any
      // `activeIn: ['coolnessStack']` listener (Hipdall's stack-leave
      // recovery, Stack-top playable cards) sees a live tracker. The
      // engine's downstream cleanup may untrack the source inst (creature
      // death does) or re-zone it to discard (hand discard); either way
      // we have a separate tracker on the new resting place.
      engine._trackCard(first, pi, 'coolnessStack');

      engine._broadcastEvent('coolness_stack_change', {
        owner: pi, mode: 'push', from: fromZone, card: first,
        fromHeroIdx, fromZoneSlot,
      });
      engine.log('wildur_discard_redirect', {
        player: ps.username, card: first, fromZone,
      });
      // Push remaining cards (multi-card batch pushes) to discardPile
      // normally — only the first qualifies under "first card per turn".
      const rest = cards.slice(1);
      if (rest.length > 0) return originalPush.apply(this, rest);
      return this.length;
    }
    return originalPush.apply(this, cards);
  };
}

/**
 * Uninstall the override iff no other Wildur is still in support for
 * this controller. Without the in-play check, removing one of two
 * Wildurs would tear down the redirect even while another copy is on
 * the board.
 */
function _uninstallRedirect(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps || !ps[INSTALLED_FLAG]) return;
  const stillActive = engine.cardInstances.some(c =>
    c.name === CARD_NAME && c.zone === 'support' && c.owner === pi
  );
  if (stillActive) return;
  delete ps[INSTALLED_FLAG];
  delete ps.discardPile.push; // Remove instance override → restores Array.prototype.push.
}

module.exports = {
  // Active in 'support' for the redirect, plus 'coolnessStack' so the
  // top-of-Stack summon UI hook can light up.
  activeIn: ['support', 'coolnessStack'],
  summonableFromCoolnessStack: true,

  async resolveFromCoolnessStack(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (engine.getCoolnessStackTop(pi) !== CARD_NAME) return { aborted: true, reason: 'not_top' };
    return summonFromStack(engine, pi, CARD_NAME);
  },

  hooks: {
    onTurnStart: async (ctx) => {
      // Reset the per-turn redirect flag for the controller, AND
      // ensure the override is installed (idempotent) — covers
      // puzzle-initialised Wildurs that never received an onPlay.
      // Reset fires for both players' turn starts so "every turn"
      // matches the card text — once per game-turn regardless of
      // whose turn it is.
      if (ctx.cardZone !== 'support') return;
      const ps = ctx._engine.gs.players[ctx.cardOwner];
      if (ps) ps[TURN_FLAG] = false;
      _installRedirect(ctx._engine, ctx.cardOwner);
    },

    onPlay: async (ctx) => {
      // Install on the actual placement firing — the placed inst is
      // the one we're scoped to via `_onlyCard` from the summon path.
      if (ctx.cardZone !== 'support') return;
      _installRedirect(ctx._engine, ctx.cardOwner);
    },

    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== undefined && ctx.fromOwner !== ctx.cardOwner) return;
      _uninstallRedirect(ctx._engine, ctx.cardOwner);
    },
  },
};
