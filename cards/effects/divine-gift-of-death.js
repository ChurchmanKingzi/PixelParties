// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Death"
//  Spell (Support Magic Lv1, Normal)
//
//  Once per game (shared "Divine Gift" key).
//  Choose up to 1/2/3 defeated Heroes (any side —
//  own AND opponent's are valid targets) and
//  revive them at 50 HP. Their max HP becomes 50
//  and cannot be increased — handled by the
//  generic `maxHpCap` option on actionReviveHero
//  (sets `hero.maxHpCapped = 50`, which
//  `engine.increaseMaxHp` already respects).
//
//  Scaling: max revives = casting Hero's Support
//  Magic level (capped at 3).
//
//  Two play modes:
//    • Main Phase — playable as an INHERENT
//      additional Action ONLY when:
//         - 2+ dead Heroes exist on the board
//         - the casting Hero has Support Magic ≥ 2
//      In this mode the player MUST commit to
//      reviving 2+ Heroes (`minRequired = 2`).
//      The play-time `inherentAction` gate
//      enforces the Hero's Support Magic ≥ 2
//      requirement; the prompt's `minRequired`
//      enforces the actual revive commitment.
//    • Action Phase — regular Action. The Hero
//      can revive 1+ Heroes up to their Support
//      Magic level / 3 / available-dead-count.
//
//  The two paths are differentiated at play time
//  by `gs.currentPhase`.
// ═══════════════════════════════════════════

/**
 * Walk both players' Hero rows and return all dead Heroes as
 * promptEffectTarget-shaped entries. Targets are scoped by their actual
 * owner (so reviving routes through the correct player's side).
 */
function getDeadHeroes(gs) {
  const targets = [];
  for (let pIdx = 0; pIdx < (gs.players || []).length; pIdx++) {
    const ps = gs.players[pIdx];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name) continue;
      if (hero.hp > 0) continue;
      targets.push({
        id: `hero-${pIdx}-${hi}`, type: 'hero',
        owner: pIdx, heroIdx: hi,
        cardName: hero.name,
      });
    }
  }
  return targets;
}

/** Casting Hero's Support Magic count from their own ability zones. */
function supportMagicLevelOfHero(engine, ps, heroIdx) {
  return engine.effectiveSchoolLevelForCaster('Support Magic', engine.gs.players.indexOf(ps), heroIdx, engine.gs.players.indexOf(ps));   // W4a: harte Negierung -> Stufe 0; W16g (S01-20): + Xals Support-Zonen-Stapel
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  oncePerGame: true,
  oncePerGameKey: 'divineGift',
  // `reviveCard`: Der CPU-relevante Nutzen ist das Wiederbeleben
  // EIGENER besiegter Helden — ohne tote eigene Helden deckelt
  // _cpu.js (reviveCardSituation) den Such-/Handwert hart.
  cpuMeta: { reviveCard: true },

  /**
   * Main-Phase inherent-additional gate. Returns `true` only when:
   *   • 2+ dead Heroes exist anywhere on the board, AND
   *   • the casting Hero has Support Magic ≥ 2 (so they're capable
   *     of reviving 2+).
   *
   * The engine's `getHeroPlayableCards` calls this per-hero per-card
   * to decide whether the card lights up in hand for that Hero in the
   * Main Phase. Function form lets the gate update live as Heroes
   * stack additional Support Magic mid-turn.
   */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    if (getDeadHeroes(gs).length < 2) return false;
    const ps = gs.players[pi];
    return supportMagicLevelOfHero(engine, ps, heroIdx) >= 2;
  },

  /**
   * Hand-grayout / spell-can-be-played check. At least one dead Hero
   * must exist somewhere on the board. The per-Hero level / Support-
   * Magic requirements are handled by the engine's standard spell
   * play gate plus `inherentAction` above.
   */
  spellPlayCondition(gs, pi) {
    return getDeadHeroes(gs).length >= 1;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      if (!ps) return;

      const targets = getDeadHeroes(gs);
      if (targets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // Casting Hero's Support Magic level caps the revive count
      // (matches the card's "1/2/3" scaling), further capped at 3
      // and the available dead-Hero count.
      const supportMagic = supportMagicLevelOfHero(engine, gs.players[ctx.cardHeroOwner ?? pi] || ps, heroIdx);   // Als Befund 29.9.: Zonen des Wirkers auf seiner Brettseite
      const maxPicks = Math.min(supportMagic, 3, targets.length);
      // Main Phase = inherent-additional path (commit to 2+).
      // Action Phase = regular Action (1+).
      const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
      // W16g (S01-21): „If at least 2 Heroes are revived by this effect, this counts as an additional Action.“ `inherentAction` wertet
      // VOR der Wahl aus; die Zusatzaktion traegt diesen Einsatz nur, wenn wirklich 2+ erweckt werden. Steht ein Rueckfall bereit
      // (Grund-/Bonus-/Geber-Aktion), reicht 1 Held — der Einsatz kostet dann die Aktion (`gs._spellForcesActionConsume`, s. unten);
      // sonst (Main Phase, Aktion schon verbraucht) gilt wie bisher: mindestens 2 (Muster Frost Breaker).
      const inhaerent = !gs._immediateActionContext && gs._spellWasInherent === true;
      const rueckfall = inhaerent && !!engine.hasPayableActionFor?.(pi, 'Divine Gift of Death', heroIdx);
      const minRequired = (isMainPhase || (inhaerent && !rueckfall)) ? 2 : 1;

      // Defensive: if maxPicks < minRequired (only possible if state
      // shifted between hand-grayout and resolve, e.g. a dead hero was
      // re-killed by another effect mid-turn), refund the play.
      if (maxPicks < minRequired) {
        gs._spellCancelled = true;
        return;
      }

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: 'Divine Gift of Death',
        description: isMainPhase
          ? `Choose ${minRequired === maxPicks ? `${minRequired}` : `${minRequired}–${maxPicks}`} defeated Hero${maxPicks > 1 ? 'es' : ''} (any side) to revive at 50 HP. Max HP becomes 50 and cannot be increased.`
          : `Choose 1${maxPicks > 1 ? `–${maxPicks}` : ''} defeated Hero${maxPicks > 1 ? 'es' : ''} (any side) to revive at 50 HP. Max HP becomes 50 and cannot be increased.`,
        confirmLabel: '✨ Revive!',
        confirmClass: 'btn-success',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: maxPicks },
        maxTotal: maxPicks,
        minRequired,
      });

      if (!picked || picked.length === 0 || picked.length < minRequired) {
        gs._spellCancelled = true;
        return;
      }

      let revived = 0;
      for (const id of picked) {
        const t = targets.find(tt => tt.id === id);
        if (!t) continue;
        // Eigene, grosse Erweckung statt des allgemeinen Heiligenscheins
        // (Als Vorgabe 26.9.): der Tod selbst schenkt die Seele zurueck.
        // Der Held bleibt tot, bis die Seele in ihn faehrt (≈1,25 s).
        const ok = await engine.actionReviveHero(t.owner, t.heroIdx, 50, {
          maxHpCap: 50,
          source: 'Divine Gift of Death',
          animationType: 'todesgabe_erweckung',
          animDuration: 2700,
          lebenNachMs: 1250,
          animDelay: 1900,
        });
        if (ok) revived++;
      }

      if (revived === 0) {
        // All revives failed (race with another effect). Refund.
        gs._spellCancelled = true;
        return;
      }
      // Defensive: Main-Phase inherent-additional mode requires 2+.
      // The prompt's minRequired = 2 should prevent shortfall, but a
      // race between pick and resolve could re-kill a target. Log it.
      if (isMainPhase && revived < 2) {
        engine.log('divine_gift_death_race', { revived, expected: '2+' });
      }

      // W16g (S01-21): nur 1 erweckt -> keine Zusatzaktion, der Einsatz kostet die Aktion.
      if (inhaerent && revived < 2) gs._spellForcesActionConsume = true;

      engine.log('divine_gift_death', {
        player: ps.username, revived,
        mode: isMainPhase ? 'inherent_additional' : 'regular_action',
      });
      engine.sync();
    },
  },
};
