// ═══════════════════════════════════════════
//  CARD EFFECT: "Lethe, the Forgetful Fixer"
//  Hero — 400 HP / 40 ATK (Divinity + Necromancy)
//
//  "This Hero cannot perform Actions if a target you control was
//   defeated since the end of your last turn. You may use this Hero's
//   Necromancy up to 3 times per turn, but after each time this Hero
//   uses Necromancy, the levels of all Creatures remaining in your
//   discard and deleted piles are increased by 1 until they are moved
//   to your hand or deck."
//
//  ── Passive: action lock ────────────────────────────────────────
//  A per-player tracker `ps._letheTargetDefeated` is set whenever a
//  target the controller controls (Hero OR Creature) is defeated. It
//  is cleared at the END of the controller's turn — that's the "end
//  of your last turn" reset boundary, so:
//    • a controlled target dying during the opponent's turn (or
//      during the controller's own turn) keeps the flag set;
//    • the flag persists into the controller's next turn and lifts
//      only when that turn ends.
//  While the flag is set, every Lethe the controller owns gets
//  `_actionLockedTurn = gs.turn` — the engine's centralized "this
//  Hero cannot perform any Action this turn" gate (covers Spell /
//  Attack / Creature plays, action-cost Abilities, Attacks, AND the
//  alt-summon below, which is itself an Action). Set at the
//  controller's turn start, and also re-applied the instant a
//  controlled target dies mid-turn so the rest of the turn is locked.
//
//  ── Necromancy extension: 3 uses + stamp wave ───────────────────
//  Listens on `onNecromancyResolved` (fired by necromancy.js). When
//  the activator is THIS Lethe instance (matched by heroIdx) on her
//  own controller's side:
//    • Der gemeinsame Rundenzaehler auf der Necromancy-Instanz
//      (Schluessel `letheNecromancy`) zaehlt hoch.
//      If it stays below 3, the engine's HOPT slot for Necromancy is
//      released so the SAME Lethe can activate again. necromancy.js's
//      generic `_necromancyLockedToHero` lock (set on every
//      activation) keeps OTHER Heroes silenced on the released slot.
//    • A "stamp wave" is then applied: every Creature currently in
//      either of the controller's piles gets `+1` to its effective
//      level, stacking across waves, until it leaves the piles for
//      hand / deck. Wired via `engine.applyLetheStampWave`.
//  When the activator is NOT Lethe, the generic lock that
//  necromancy.js sets is sufficient — Lethe is then silenced for the
//  rest of the turn (HOPT remains claimed too).
// ═══════════════════════════════════════════

const { usesLeft, spendUse, charges } = require('./_charges');

const CARD_NAME = 'Lethe, the Forgetful Fixer';
const MAX_NECROMANCY_USES = 3;
// Schluessel des gemeinsamen Rundenzaehlers. Er sitzt auf der
// NECROMANCY-INSTANZ, nicht auf Lethe: die Regel gehoert zu „this
// Hero's Necromancy", das Abzeichen zeigt Al auf der Ability, und mit
// dem Rundenstempel setzt sich der Zaehler von selbst zurueck.
const NECRO_KEY = 'letheNecromancy';

/** Die Necromancy-Instanz in der Ability-Zone dieses Lethe-Helden. */
function necromancyInstanz(engine, controller, heroIdx) {
  return (engine?.cardInstances || []).find(c => c
    && c.name === 'Necromancy' && c.zone === 'ability'
    && c.heroIdx === heroIdx
    && (c.controller ?? c.owner) === controller) || null;
}

// ─── HELPERS ─────────────────────────────────────────────────────

/** Lethe heroes the player owns (loop — defensive vs. multi-copy). */
function forEachLethe(ps, fn) {
  const heroes = ps?.heroes || [];
  for (let hi = 0; hi < heroes.length; hi++) {
    const h = heroes[hi];
    if (h?.name === CARD_NAME) fn(h, hi);
  }
}

/**
 * Lock every Lethe `ps` owns for the current turn. Sets the engine's
 * generic action lock (`_actionLockedTurn`) AND a Lethe-specific
 * marker (`_letheActionLocked`) so the UI can show a status badge
 * that means specifically "locked by Lethe's OWN effect" (a generic
 * `_actionLockedTurn` set by some opponent card is a different thing
 * and must NOT show this badge). Both auto-expire — they only count
 * while they equal `gs.turn`.
 */
function lockLethe(ps, gs) {
  forEachLethe(ps, (h) => {
    h._actionLockedTurn = gs.turn;
    h._letheActionLocked = gs.turn;
  });
}

module.exports = {
  /**
   * Ladungen fuer die Necromancy an DIESER Heldin (Als Vorgabe 16.8.:
   * Zaehler oben in der Ecke der Ability, nicht bei Lethe).
   * `necromancy.js` bleibt allgemein und weiss nichts von Lethe — die
   * Ausnahme steht hier, wo auch der Effekttext steht.
   */
  abilityCharges: (abilityName, inst, gs) => {
    if (abilityName !== 'Necromancy') return null;
    const pi = inst?.controller ?? inst?.owner;
    const ps = gs?.players?.[pi];
    const leer = { remaining: 0, max: MAX_NECROMANCY_USES };

    // ── FREMDSPERRE ZEIGT SOFORT 0 (Als Report 16.8.) ────────────────
    // Aktive Abilities sind hart einmal pro Runde: pro Spieler darf nur
    // EINE Necromancy-Instanz feuern. Lethes Ausnahme hebt das nur fuer
    // SIE auf. Nutzt also ein anderer Held Necromancy, ist Lethes fuer
    // die Runde tot — ihr Zaehler stand aber weiter auf 3, weil sie
    // selbst nichts verbraucht hatte. Die Regel selbst greift laengst
    // (necromancy.js pinnt ueber `_necromancyLockedToHero`, und der
    // HOPT-Riegel bleibt gesetzt); nur die Anzeige log.
    //
    // Beide Riegel werden geprueft, obwohl im Normalfall beide zugleich
    // greifen — die Pinnung ist die inhaltlich richtige Aussage, der
    // HOPT die technische.
    const lock = ps?._necromancyLockedToHero;
    if (lock && lock.turn === gs?.turn && lock.heroName && lock.heroName !== CARD_NAME) {
      return leer;
    }
    if (gs?.hoptUsed?.[`free-ability:Necromancy:${pi}`] === gs?.turn) return leer;

    return charges(inst, gs, { key: NECRO_KEY, max: MAX_NECROMANCY_USES });
  },

  activeIn: ['hero'],
  // Keep the bookkeeping hooks (defeat tracking + lock refresh + the
  // Necromancy-extension hook) firing even while Lethe is Frozen /
  // Stunned / Negated so the since-last-turn window and the lockout
  // stay accurate regardless of status.
  bypassStatusFilter: true,

  hooks: {
    /**
     * Controller's turn start: if a controlled target was defeated
     * since the end of the controller's last turn, lock every Lethe
     * for the whole turn. Also resets the per-turn Necromancy use
     * counter (turn-key based reset — fires on the activator's start
     * too via the controller filter).
     */
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const controller = ctx.cardController ?? ctx.cardOwner;
      if (ctx.activePlayer !== controller) return;
      const ps = gs.players[controller];
      if (!ps) return;
      // (Necromancy-Zaehler setzt sich per Rundenstempel selbst zurueck.)
      if (!ps._letheTargetDefeated) return;
      lockLethe(ps, gs);
      engine.sync();
    },

    /**
     * Controller's turn end: reset the since-last-turn window. Deaths
     * after this point (opponent's turn, then the controller's next
     * turn) re-arm the lock.
     */
    onTurnEnd: async (ctx) => {
      const controller = ctx.cardController ?? ctx.cardOwner;
      if (ctx.activePlayer !== controller) return;
      const ps = ctx._engine.gs.players[controller];
      if (!ps) return;
      delete ps._letheTargetDefeated;
    },

    /** A Creature the controller controls was defeated. */
    onCreatureDeath: async (ctx) => {
      const dead = ctx.creature;
      if (!dead) return;
      const side = dead.controller ?? dead.owner;
      _markDefeat(ctx, side);
    },

    /** A Hero the controller controls was defeated. */
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const dyingHero = ctx.hero;
      if (!dyingHero?.name) return;
      let side = -1;
      for (let p = 0; p < 2 && side < 0; p++) {
        if ((engine.gs.players[p]?.heroes || []).includes(dyingHero)) side = p;
      }
      if (side < 0) return;
      _markDefeat(ctx, side);
    },

    /**
     * Necromancy resolved — extension hook fired by necromancy.js.
     * Only the SPECIFIC Lethe instance that hosted the activation
     * does the bookkeeping (matched via `ctx.heroIdx === ctx.cardHeroIdx`
     * with name confirmation), so multi-copy scenarios don't double-
     * count or double-stamp. Non-Lethe activations on this side need
     * no work here — necromancy.js already pinned the lock to the
     * activator.
     */
    onNecromancyResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const controller = ctx.cardController ?? ctx.cardOwner;
      if (ctx.playerIdx !== controller) return;
      // Only the activating Lethe instance processes the extension.
      // NB: the payload uses `hostHeroName` / `hostHeroIdx` to dodge
      // the engine ctx's `heroName()` METHOD that would otherwise
      // shadow the field on spread.
      if (ctx.hostHeroName !== CARD_NAME) return;
      if (ctx.hostHeroIdx !== ctx.cardHeroIdx) return;

      const ps = gs.players[controller];
      if (!ps) return;

      // 1) Stamp wave — applies BEFORE the HOPT release. Bumps every
      // Creature currently sitting in either of this player's piles
      // by +1 effective level. Stacks across waves (turn-after-turn,
      // and across the 3 uses in one turn).
      engine.applyLetheStampWave(controller);

      // 2) Use count + HOPT release. necromancy.js's HOPT slot
      // (`free-ability:Necromancy:${pi}`) was claimed before
      // `onFreeActivate` ran; if Lethe still has uses left, clear it
      // so the next `doActivateFreeAbility` passes the HOPT gate.
      // After the 3rd use, we LEAVE the HOPT claimed — that's the cap.
      // Gemeinsamer Rundenzaehler auf der Necromancy-Instanz (v420).
      // Vorher lag er als `ps._letheNecromancyUsesThisTurn` am
      // Spielerzustand und wurde per `onTurnStart`/`onTurnEnd`
      // geloescht — dieselbe vergessbare Ruecksetzung, die bei Archer
      // und Golden Vermin schiefging. Der Stempel erledigt das jetzt.
      const abInst = necromancyInstanz(engine, controller, ctx.hostHeroIdx);
      if (abInst) spendUse(abInst, gs, { key: NECRO_KEY, max: MAX_NECROMANCY_USES });
      const uses = abInst
        ? MAX_NECROMANCY_USES - usesLeft(abInst, gs, { key: NECRO_KEY, max: MAX_NECROMANCY_USES })
        : MAX_NECROMANCY_USES;
      if (uses < MAX_NECROMANCY_USES) {
        const hoptKey = `free-ability:Necromancy:${controller}`;
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
      }

      engine.log('lethe_necromancy_extension', {
        player: ps.username, uses, max: MAX_NECROMANCY_USES,
      });
      engine.sync();
    },
  },
};

/**
 * Record that a target controlled by `side` was defeated. If `side`
 * is this Lethe's controller, set the tracker; and if it is currently
 * that controller's own turn, lock every Lethe immediately so the
 * rest of the turn is action-locked too.
 */
function _markDefeat(ctx, side) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const controller = ctx.cardController ?? ctx.cardOwner;
  if (side !== controller) return;
  const ps = gs.players[controller];
  if (!ps) return;
  ps._letheTargetDefeated = true;
  if (gs.activePlayer === controller) {
    lockLethe(ps, gs);
  }
}
