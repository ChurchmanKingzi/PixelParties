// ═══════════════════════════════════════════
//  CARD EFFECT: "Gon, the Frostbringer"
//  Hero (400 HP, 40 ATK)
//  Starting abilities: Magic Arts, Resistance
//
//  Passive: All YOUR effects that Freeze one or
//  more targets Freeze them for an additional
//  turn. The engine's `processStatusExpiry`
//  reads `frozen.duration` to allow multi-turn
//  freezes — this listener bumps that field on
//  every Freeze application from Gon's side.
//
//  Counterpart: Goff, the Burnbringer (Creature)
//  declares `attachableHeroes: ['Gon, the
//  Frostbringer']`, so a deck-card copy of Gon
//  can be tucked underneath a Goff for Goff's
//  bonus stats / Burn-doubling effect. While
//  attached, the Hero is INERT — these hooks
//  fire only when Gon is on a hero zone (the
//  team), never when Gon is sitting under a
//  Creature (he's not tracked as an instance
//  there; the engine's runHooks listener filter
//  skips him naturally).
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * "All YOUR effects that Freeze … freeze for an additional turn."
     * The active player at the moment a Frozen status is applied is
     * the side whose effect is resolving — if that's Gon's owner, we
     * extend the Frozen duration by 1. The engine's status-expiry
     * pass at end-of-active-player's-turn already supports
     * `frozen.duration > 1` (multi-turn freezes tick down instead
     * of clearing), so all we need is to bump the field.
     *
     * "one or more TARGETS" — Creatures count too (Als Ruling). The
     * old comment here claimed creature freezes carry no duration and
     * never fire ON_STATUS_APPLIED; both statements are stale.
     * `applyCreatureStatus` fires the hook and stores a duration under
     * `inst.counters.frozenDuration` whenever `opts.duration > 1`. What
     * actually kept Gon Hero-only was the body: it read
     * `target.statuses.frozen`, which a CardInstance simply does not
     * have — Creatures keep their statuses in `counters`.
     *
     * Storage asymmetry to keep in mind: a Hero's duration always
     * exists (`statuses.frozen.duration`, default 1), a Creature's only
     * exists once it exceeds 1 — `applyCreatureStatus` skips the field
     * for the plain one-turn case. Extending a plain creature freeze
     * therefore means writing 2, not reading-then-incrementing.
     */
    onStatusApplied: async (ctx) => {
      // Beide Feldnamen lesen — siehe _engine.js, die Feuerstellen
      // sendeten historisch unterschiedliche Namen.
      const applied = ctx.statusName || ctx.status;
      if (applied !== 'frozen') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      // "Your effects" — massgeblich ist der VERURSACHER des Freeze (Spieler
      // des wirkenden Effekts), nicht wessen Zug laeuft: Surprises und
      // Reaktionen feuern im Zug des Gegners (H02-heroes-03). Nur ohne
      // Zuordnung (-1) gilt wie bisher der aktive Spieler.
      const wirker = ctx.cardController ?? ctx.cardOwner;
      const v = engine.statusVerursacher(ctx.target, 'frozen');
      if (v && v.spieler >= 0) {
        if (v.spieler !== wirker) return;
      } else if (gs.activePlayer !== wirker) return;

      const target = ctx.target;
      if (!target) return;

      // ── Hero target ──
      if (target.statuses?.frozen) {
        const cur = target.statuses.frozen.duration ?? 1;
        target.statuses.frozen.duration = cur + 1;
        engine.log('gon_freeze_extend', {
          target: target.name, newDuration: target.statuses.frozen.duration,
        });
        return;
      }

      // ── Creature target ──
      if (target.counters?.frozen) {
        const cur = target.counters.frozenDuration || 1;
        target.counters.frozenDuration = cur + 1;
        engine.log('gon_freeze_extend', {
          target: target.name, newDuration: target.counters.frozenDuration,
        });
      }
    },
  },
};
