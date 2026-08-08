// ═══════════════════════════════════════════
//  CARD EFFECT: "Vinepire"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  Passive lifesteal. The corresponding Hero
//  (Vinepire's host) is healed for HALF of all
//  damage it deals to a SINGLE target the
//  opponent controls — but only when the source
//  is an Attack or a Spell, and only when that
//  Spell/Attack hit exactly one target. AoE /
//  multi-target casts (Flame Avalanche, Rain of
//  Death, etc.) heal nothing — even if they
//  happened to deal lethal damage to the lone
//  surviving opponent target.
//
//  Implementation: dual-hook accumulator.
//    1. `afterDamage` (hero targets) and
//       `afterCreatureDamageBatch` (creature
//       targets) sum host-hero-source Attack/
//       Spell damage to opponent targets into
//       `inst.counters._vinepirePendingHeal`.
//       Resets between spells via the array-
//       reference identity of `gs._spellDamageLog`
//       (each spell allocates a fresh array).
//    2. `afterSpellResolved` reads the engine's
//       `damageTargets` (the deduplicated SELECTED
//       target list) and only heals if exactly
//       one target was selected. Buffer is
//       cleared whether or not we heal.
//
//  Why the array-identity reset: a previous
//  spell that gets fully negated never fires
//  `afterSpellResolved`, so its accumulator
//  would otherwise leak into the next spell's
//  heal calculation.
// ═══════════════════════════════════════════

const CARD_NAME = 'Vinepire';

const SPELL_SCHOOL_ABILITIES = new Set([
  'Destruction Magic', 'Decay Magic', 'Magic Arts',
  'Support Magic', 'Summoning Magic', 'Performance',
]);

function _isAttackOrSpellType(t) {
  if (typeof t !== 'string') return false;
  return t === 'attack' || t.endsWith('_spell');
}

function _isFromHostHero(source, vinepireInst) {
  if (!source || typeof source !== 'object') return false;
  return source.owner === vinepireInst.owner
    && source.heroIdx === vinepireInst.heroIdx;
}

function _isOpponentHero(target, vinepireInst, gs) {
  if (!target || target.hp === undefined) return false;
  // target is a hero object — find its owner via heroes-array membership.
  for (let p = 0; p < 2; p++) {
    if ((gs.players[p]?.heroes || []).includes(target)) {
      return p !== vinepireInst.owner;
    }
  }
  return false;
}

function _isOpponentCreature(inst, vinepireInst) {
  if (!inst) return false;
  return (inst.controller ?? inst.owner) !== vinepireInst.owner;
}

// Sitzungs-Marken fuer die Spell-Damage-Logs. Siehe _resetIfNewSpell.
let _spellSessionSeq = 0;
const _spellSessionIds = new WeakMap();
function _spellSessionId(log) {
  let id = _spellSessionIds.get(log);
  if (id === undefined) {
    id = ++_spellSessionSeq;
    _spellSessionIds.set(log, id);
  }
  return id;
}

function _resetIfNewSpell(vinepireInst, gs) {
  // Pro Zauber eine Sitzungsmarke. Die Engine setzt `gs._spellDamageLog
  // = []` zu Beginn jedes Spell-/Attack-Casts (server.js doPlaySpell) —
  // ein frisches Array heisst frischer Zauber, auch wenn der vorige
  // negiert wurde und nie `afterSpellResolved` gefeuert hat.
  //
  // ── WARUM EINE ZAHL UND NICHT DAS ARRAY (7.8.) ────────────────────
  // Frueher lag das Array SELBST in `counters._vinepireSpellRef`. Das
  // sprengte den Snapshot: `_clone` serialisiert die counters mit
  // JSON.stringify, und die Log-Eintraege tragen `cardInstance` —
  // lebende CardInstance-Objekte. Enthaelt das Log die Vinepire-Instanz
  // selbst, schliesst sich der Kreis ueber ihre eigenen counters:
  //   counters._vinepireSpellRef → [ … ] → entry.cardInstance
  //     → CardInstance.counters → _vinepireSpellRef → …
  // Ergebnis war ein "Converting circular structure to JSON" mitten im
  // MCTS-Snapshot, das den ganzen CPU-Zug abbrach.
  //
  // Gebraucht wird ohnehin nur die IDENTITAET des Arrays, nie sein
  // Inhalt. Eine WeakMap vergibt je Array eine Zahl; die ist klonbar,
  // zyklenfrei und haelt das Array nicht am Leben. Verhalten identisch,
  // auch ueber Snapshot/Restore: dort entsteht ein neues Array und damit
  // eine neue Marke — genau wie vorher der Referenzvergleich fehlschlug.
  //
  // ALLGEMEIN: in `inst.counters` gehoeren nur primitive Werte. Alles
  // dort wird bei jedem Snapshot JSON-serialisiert.
  const log = gs._spellDamageLog;
  if (!log) return false;
  const sid = _spellSessionId(log);
  if (vinepireInst.counters._vinepireSpellRef !== sid) {
    vinepireInst.counters._vinepireSpellRef = sid;
    vinepireInst.counters._vinepirePendingHeal = 0;
  }
  return true;
}

module.exports = {
  activeIn: ['support'],

  /**
   * CPU summon hint. Vinepire's heal triggers when the HOST hero deals
   * single-target Attack or Spell damage to the opponent, so it's worth
   * essentially nothing on a hero who never casts either. Narrow the
   * CPU's preferred summoner pool to heroes that are plausibly going to
   * fire Attacks or single-target Spells:
   *
   *   • Has any Spell-School ability (Destruction / Decay / Magic Arts /
   *     Support / Summoning Magic / Performance) — a likely Spell caster.
   *   • OR is the top-atk hero on the team — the CPU funnels Attack
   *     cards to the highest-atk caster, so this is the team's de-facto
   *     attacker. Ties on top-atk all qualify.
   *
   * If NO hero matches, the engine falls back to the normal pool so the
   * play isn't blocked outright (the card still lands; it just won't
   * heal until it's moved or the host gains a casting ability).
   */
  cpuPrefersSummonerHero(engine, pi, hi) {
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const abZones = ps.abilityZones?.[hi] || [];
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      if (SPELL_SCHOOL_ABILITIES.has(slot[0])) return true;
    }
    let topAtk = -Infinity;
    for (const h of (ps.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      if (typeof h.atk === 'number' && h.atk > topAtk) topAtk = h.atk;
    }
    const hostAtk = ps.heroes?.[hi]?.atk;
    return typeof hostAtk === 'number' && hostAtk === topAtk;
  },

  hooks: {
    afterDamage: (ctx) => {
      const inst   = ctx.card;
      const engine = ctx._engine;
      const gs     = engine?.gs;
      if (!gs) return;
      if (!_resetIfNewSpell(inst, gs)) return; // Not in a spell context.
      if (!_isAttackOrSpellType(ctx.type)) return;
      if (!_isFromHostHero(ctx.source, inst)) return;
      if (!_isOpponentHero(ctx.target, inst, gs)) return;
      // Prefer `realDealt` (HP delta capped at pre-hit HP) over `amount`
      // (post-reduction but pre-overkill-cap) — overkill on a low-HP
      // target shouldn't inflate the heal. Falls back to `amount` for
      // safety if a future damage path forgets to populate realDealt.
      const amt = (ctx.realDealt != null ? ctx.realDealt : ctx.amount) || 0;
      if (amt <= 0) return;
      inst.counters._vinepirePendingHeal = (inst.counters._vinepirePendingHeal || 0) + amt;
    },

    afterCreatureDamageBatch: (ctx) => {
      const inst   = ctx.card;
      const engine = ctx._engine;
      const gs     = engine?.gs;
      if (!gs) return;
      if (!_resetIfNewSpell(inst, gs)) return;
      const entries = ctx.entries || [];
      for (const e of entries) {
        if (!_isAttackOrSpellType(e.type)) continue;
        if (!_isFromHostHero(e.source, inst)) continue;
        if (!_isOpponentCreature(e.inst, inst)) continue;
        // Full negation (Idej Projection, Spectral Armor zero-cap,
        // Anti Magic void) → no actual damage dealt, no heal to
        // accumulate. `e.realDealt` is undefined on cancelled entries
        // (the per-entry damage loop short-circuits before stamping
        // it), so without this gate the fallback to `e.amount` would
        // mistakenly count the would-have-dealt damage as lifesteal.
        if (e.cancelled) continue;
        // `realDealt` is the post-cap HP delta the engine stamps on each
        // entry — overkill capped at pre-hit HP. Falls back to `amount`
        // for safety if the engine ever omits the field.
        const amt = (e.realDealt != null ? e.realDealt : e.amount) || 0;
        if (amt <= 0) continue;
        inst.counters._vinepirePendingHeal = (inst.counters._vinepirePendingHeal || 0) + amt;
      }
    },

    afterSpellResolved: async (ctx) => {
      const inst   = ctx.card;
      const engine = ctx._engine;
      const gs     = engine?.gs;
      if (!gs) return;
      const pendingHeal = inst.counters._vinepirePendingHeal || 0;
      // Always clear the buffer + spell-ref so a follow-up spell starts
      // clean even if this resolution doesn't qualify for a heal.
      delete inst.counters._vinepirePendingHeal;
      delete inst.counters._vinepireSpellRef;
      if (pendingHeal <= 0) return;
      // Single-target gate: AoE / multi-target Spells & Attacks heal
      // nothing per the user's spec, even if they happened to drop
      // damage on a single survivor.
      const targets = ctx.damageTargets || [];
      if (targets.length !== 1) return;
      // Must be the host hero's cast.
      if (ctx.casterIdx !== inst.owner) return;
      if (ctx.heroIdx !== inst.heroIdx) return;
      const halfHeal = Math.floor(pendingHeal / 2);
      if (halfHeal <= 0) return;
      const hostHero = gs.players[inst.owner]?.heroes?.[inst.heroIdx];
      if (!hostHero?.name || hostHero.hp <= 0) return;
      const healSource = { name: CARD_NAME, owner: inst.owner, heroIdx: inst.heroIdx };
      await engine.actionHealHero(healSource, hostHero, halfHeal);
      engine.log('vinepire_heal', {
        owner: inst.owner, hero: hostHero.name,
        damage: pendingHeal, healed: halfHeal,
      });
    },
  },
};
