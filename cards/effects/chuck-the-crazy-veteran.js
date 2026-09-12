// ═══════════════════════════════════════════
//  CARD EFFECT: "Chuck, the Crazy Veteran"
//  Hero — 150 HP, 20 ATK (Leadership + Training)
//
//  ① Damage shield: Chuck takes no damage from
//    any source UNLESS every other Hero this
//    controller controls is immune to that source
//    of damage. With at least one vulnerable
//    teammate alive, Chuck soaks; with no other
//    living Heroes (or every survivor immune to
//    THIS source), the damage lands on Chuck.
//
//    "Immune to that source" matches the engine's
//    own immunity catalogue:
//     • dead (hp ≤ 0) — counted as immune (can't
//       take damage)
//     • full damage protections: shielded (turn-1),
//       buffs.gou_protected, buffs.submerged
//     • generic CC immune (statuses.immune)
//     • per-status `_immune` flags routed by the
//       damage type → STATUS_EFFECTS lookup
//       (burn → burn_immune, poison → poison_immune,
//       etc.)
//
//  ② `ignoresOppUntargetable`: a generic engine
//    flag (consumed in `_engine.js` ~line 2748)
//    that forces every Hero on Chuck's side to be
//    a valid opponent-target, ignoring
//    `untargetable` protections on his allies.
//    Without this, a player could lock down
//    their team (Untargetable on Heroes A and B)
//    and rely on Chuck's invulnerability to
//    completely wall off the board — Chuck's
//    text says "Ignore any effects that would
//    prevent other Heroes you control from being
//    chosen by your opponent's Attacks, Spells
//    and Creature effects." Engine-side flag is
//    the most surgical fix (single targeting site
//    for hero `untargetable`).
//
//  bypassStatusFilter is deliberately NOT set —
//  Chuck's effects (damage shield + ignore-opp-
//  untargetable) shut off while he's frozen /
//  stunned / negated, matching standard hero-
//  effect-suppression rules. The engine's hook
//  filter (`_engine.js` ~line 1744) skips
//  beforeDamage automatically; the engine's
//  Chuck-active probe in the targeting filter
//  mirrors that with its own status check.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS } = require('./_hooks');

const CARD_NAME = 'Chuck, the Crazy Veteran';

/**
 * True iff `hero` is immune to damage of `type`. Mirrors the engine's
 * own check sites — we deliberately keep this conservative: only flags
 * the engine ALREADY uses to fully suppress damage are counted as
 * "immune". Buffs that merely reduce damage (Cloudy ×0.5, etc.) don't
 * qualify, otherwise Chuck would lose his shield against any source
 * his team has even partial mitigation for.
 */
function _isImmuneToSource(hero, type) {
  if (!hero || hero.hp <= 0) return true;
  // Full damage protections — every one of these makes the hero take
  // 0 damage from the engine's pipeline.
  if (hero.statuses?.shielded) return true;
  if (hero.buffs?.gou_protected) return true;
  if (hero.buffs?.submerged) return true;
  // Generic immune (post-CC `immune` status, e.g. after a Frozen wears off).
  if (hero.statuses?.immune) return true;
  // Per-status immune flag, routed via the damage type. STATUS_EFFECTS
  // is keyed by status NAME (e.g. 'burned'); the damage type tag is
  // the past-tense root (e.g. 'burn'), so we match either the type
  // itself or the type+'ed' form.
  const statusByType = STATUS_EFFECTS?.[type] || STATUS_EFFECTS?.[type + 'ed'];
  if (statusByType?.immuneKey && hero.statuses?.[statusByType.immuneKey]) return true;
  return false;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hero'],
  // Engine flag (consumed in promptDamageTarget's `untargetable` filter):
  // forces opp's targeting to ignore `untargetable` protections on
  // heroes on Chuck's side. The engine's probe checks Chuck's status
  // before honoring this flag — frozen / stunned / negated Chuck
  // doesn't suppress his teammates' protections.
  ignoresOppUntargetable: true,

  hooks: {
    /**
     * Damage shield. Fires for every damage event in the engine's
     * `_actionDealDamageImpl` flow. Returns early when target isn't
     * Chuck. Walks the controller's heroes and asks "is at least one
     * other Hero NOT immune to this source?" — if yes, Chuck's
     * damage is pinned to 0; if no (all others immune or dead, OR
     * Chuck is alone), the damage lands.
     */
    beforeDamage: (ctx) => {
      // ── DIAGNOSE (v854, Als Befund 11.9.) ───────────────────────────
      // Chuck nahm im Mitschnitt 240 Schaden von einer Quick Attack,
      // obwohl Melissa und Tryse lebten und ungeschuetzt waren. Der
      // Schild haelt in JEDER Nachstellung am echten Engine-Pfad
      // (direkter Aufruf, Angriffsquelle mit `usesHeroAtk`, nach
      // `_fireAttackDeclare`, mit belegten Ability-Zonen) — die Ursache
      // liegt also in etwas, das die Nachstellung nicht enthielt
      // (Verdacht: die Pfeil-Reaktionskette Angelfeather/Bomb/Arrow
      // Slit). Diese Zeilen landen im Demo-Mitschnitt und beantworten
      // beim naechsten Auftreten die einzige offene Frage: Ist der Hook
      // ueberhaupt gelaufen, und wen hat er als verwundbar gesehen?
      // Nach der Klaerung ersatzlos entfernen.
      const _diag = (grund, extra) => {
        try {
          ctx._engine?.log?.('chuck_shield', {
            grund, source: ctx.source?.name || '?', type: ctx.type,
            amount: ctx.amount, ...(extra || {}),
          });
        } catch { /* Diagnose darf nie etwas kaputt machen */ }
      };

      // Only protect Chuck himself.
      if (ctx.target !== ctx.attachedHero) {
        // Nur melden, wenn das Ziel ueberhaupt Chuck HEISST — sonst
        // schreibt jede Schadensinstanz im Spiel eine Zeile.
        if (ctx.target?.name === CARD_NAME) _diag('ziel-identitaet-weicht-ab');
        return;
      }
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      // Vacuous-truth case: no other living Heroes ⇒ "all others immune"
      // is trivially true ⇒ Chuck takes the hit. Game-balance lever:
      // Chuck-alone isn't an unbreakable wall.
      let anyVulnerable = false;
      let verwundbarerName = null;
      const heroes = ps.heroes || [];
      for (let i = 0; i < heroes.length; i++) {
        if (i === heroIdx) continue;
        const h = heroes[i];
        if (!h?.name || h.hp <= 0) continue;
        if (!_isImmuneToSource(h, ctx.type)) {
          anyVulnerable = true;
          verwundbarerName = h.name;
          break;
        }
      }
      if (anyVulnerable) {
        ctx.setAmount(0);
        _diag('schild-greift', { verwundbar: verwundbarerName });
      } else {
        _diag('schild-faellt', {
          mitspieler: heroes.map((h, i) => (i === heroIdx ? null : (h?.name
            ? `${h.name} hp${h.hp}${_isImmuneToSource(h, ctx.type) ? ' IMMUN' : ''}` : 'leer'))).filter(Boolean),
        });
      }
    },
  },
};
