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
//    ★ Spielgestalter-Entscheidung 16.11.2026: JEDE Form von
//    Schadensimmunitaet der anderen Helden zaehlt als „immune
//    to that source". Chuck fragt dafuer das gemeinsame
//    Praedikat der Engine (`engine.heroTakesNoDamageFromSource`,
//    gespiegelt aus dem Helden-Schadenspfad): tot, Erstrunden-
//    Schutz, Storm Piano/Cheat Chair (`blocksDamage`),
//    Versteinerung (Baihu, Petrifier), Succubus-/Lyta-
//    Kontrolle, Charme Lv 3, Carris, Inyas Fantasy Buddy
//    (Heldenskript-Vertrag `heroTakesNoDamage`), Anti Magic,
//    Light Ball/Status-Immunitaet bei Burn-/Gift-Ticks,
//    Effekt-Immunitaet/Zielschutz „or HIT", Submerged,
//    Interference, `damage_immune`/Medusa's Curse usw. Ein
//    durchschlagender Quellheld (Ida) macht den Partner gegen
//    SEINE Quelle NICHT immun (K1: `piercesDamageProtection`).
//    Reine Reduktionen (Cloudy ×0.5 …) zaehlen nicht, sonst
//    verlore Chuck seinen Schild gegen jede Quelle, die sein
//    Team nur teilweise abmildert. Solange auch nur EIN anderer
//    Held gegen die Quelle verwundbar ist, bleibt Chuck
//    geschuetzt.
//    „Unreduzierbarer Schaden toppt Schilde" (Spielgestalter-
//    Entscheidung 16.11.2026): ist der Treffer unreduzierbar/
//    unnegierbar („cannot be reduced or negated": Ida, Club of
//    Gobbo …), greift Chucks Schild nicht; True Damage
//    (Rockfall, Pressure Projectile, Surefire Shot, Acid Vial)
//    laeuft ohnehin am `beforeDamage`-Pfad vorbei.
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

const CARD_NAME = 'Chuck, the Crazy Veteran';

/**
 * True iff `hero` (Brettseite/Platz in `ort`) is immune to this damage source —
 * delegiert an das gemeinsame Praedikat der Engine (siehe Kopfkommentar). Nur
 * Zustaende, die den Schaden GANZ verhindern, zaehlen; Reduktionen nicht.
 */
function _isImmuneToSource(engine, hero, ort, ctx) {
  if (!hero) return true;
  return !!engine.heroTakesNoDamageFromSource(ort.physOwner, ort.heroIdx, ctx.source, ctx.type, {
    festesZiel: ctx.festesZiel,
    cannotBeNegated: !!ctx.cannotBeNegated,
    cannotBeReduced: !!ctx.cannotBeReduced,
  });
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

      // Spielgestalter-Entscheidung 16.11.2026: „Unreduzierbarer Schaden toppt Schilde" — ist der Treffer unreduzierbar/unnegierbar, hilft Chucks Schild nicht
      // (`setAmount(0)` waere bei `cannotBeReduced` ohnehin wirkungslos; hier auch bei reinem `cannotBeNegated`, unabhaengig von der Hook-Reihenfolge).
      if (ctx.cannotBeNegated || ctx.cannotBeReduced) { _diag('schild-durchschlagen'); return; }

      // Vacuous-truth case: no other living Heroes ⇒ "all others immune"
      // is trivially true ⇒ Chuck takes the hit. Game-balance lever:
      // Chuck-alone isn't an unbreakable wall.
      let anyVulnerable = false;
      let verwundbarerName = null;
      // Kontrolle statt Seite (Styx 28.9.): „all other Heroes you control".
      const eintraege = engine.heroesControlledBy(pi)
        .filter(({ hero }) => hero !== ctx.attachedHero);
      const heroes = eintraege.map(({ hero }) => hero);
      for (let i = 0; i < heroes.length; i++) {
        const h = heroes[i];
        const ort = { physOwner: eintraege[i].physOwner, heroIdx: eintraege[i].heroIdx };
        // „Erst alle Schadensberechnungen, dann die Tode" (28.9.): ein
        // Mitspieler, der frueher im selben Flaechenschlag gefallen ist,
        // ist nur vorgemerkt und zaehlt hier noch als lebend.
        if (!h?.name || (h.hp <= 0 && !engine.heldTodAufgeschoben(h))) continue;
        if (!_isImmuneToSource(engine, h, ort, ctx)) {
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
          mitspieler: heroes.map(h => (h?.name
            ? `${h.name} hp${h.hp}${_isImmuneToSource(engine, h, { physOwner: eintraege[heroes.indexOf(h)]?.physOwner, heroIdx: eintraege[heroes.indexOf(h)]?.heroIdx }, ctx) ? ' IMMUN' : ''}` : 'leer')),
        });
      }
    },
  },
};
