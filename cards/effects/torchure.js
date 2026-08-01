// ═══════════════════════════════════════════
//  CARD EFFECT: "Torchure"
//  Spell (Magic Arts Lv3) — Inherent additional
//  Action, Main Phase 1 only.
//  Inflict 2 Poison Stacks (permanent) on one
//  of your own unpoisoned Heroes.
//  Grants 1 bonus main Action during Action Phase.
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // ── CPU-Bewertung ────────────────────────────────────────────────
  // Als Trainings-Befund (Dance of the Butterflies, 1360 Spiele):
  // Torchure lag in 960 Spielen auf der Hand und wurde 6× gespielt
  // (0.01 Plays je Hand-Spiel — mit Abstand der niedrigste Wert des
  // Decks). Der Grund ist eine Bewertungslücke: unmittelbar nach dem
  // Cast sieht das Gate nur "eine Handkarte weniger". Die eigene
  // Vergiftung ignoriert evaluateState bewusst, solange sie nicht
  // tödlich ist, und der eigentliche Gewinn — `_bonusMainActions = 1`,
  // also eine ZWEITE Action in der Action Phase — taucht in der
  // Bewertung überhaupt nicht auf. Ergebnis: kleiner sichtbarer
  // Nachteil, unsichtbarer Vorteil, das Gate skippt zuverlässig.
  //
  // `evaluateThroughTurnEnd` spielt vor der Bewertung den Rest des
  // eigenen Zuges aus — die geschenkte Action wird dabei tatsächlich
  // genutzt und ihr Gewinn damit sichtbar. Passt exakt, weil die
  // Auszahlung im SELBEN Zug liegt (anders als bei Flashbang, wo nur
  // alwaysCommit hilft). Die höhere Schwelle dieses Modus (30) ist
  // hier erwünscht: die Vergiftung ist permanent, der Tausch soll sich
  // also spürbar lohnen und nicht bei jedem Mini-Plus stattfinden.
  cpuMeta: { evaluateThroughTurnEnd: true },

  // Inherent only during Main Phase 1
  inherentAction(gs) {
    return gs.currentPhase === 2; // PHASES.MAIN1
  },

  // Gray out when not Main Phase 1 or no unpoisoned heroes
  spellPlayCondition(gs, pi) {
    if (gs.currentPhase !== 2) return false;
    const ps = gs.players[pi];
    return (ps.heroes || []).some(h => h?.name && h.hp > 0 && !h.statuses?.poisoned);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Prompt player to pick one of their own unpoisoned heroes
      const target = await ctx.promptDamageTarget({
        side: 'my',
        types: ['hero'],
        damageType: 'status',
        dealsDamage: false, // Poison only — no damage; don't wake damage-mitigation Reactions (Spectral Armor)
        title: 'Torchure',
        description: 'Choose one of your Heroes to Poison (2 stacks, permanent).',
        confirmLabel: '\u2620\uFE0F Torchure!',
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          return h && !h.statuses?.poisoned;
        },
      });

      if (!target) {
        gs._spellCancelled = true;
        return;
      }

      // Apply 2 stacks of permanent Poison
      await engine.addHeroStatus(pi, target.heroIdx, 'poisoned', {
        stacks: 2,
        permanent: true,
      });

      engine.log('torchure_poison', {
        player: ps.username,
        hero: ps.heroes[target.heroIdx]?.name,
      });

      // Grant the second-action grace slot. Does NOT stack with itself —
      // casting Torchure multiple times still only grants ONE bonus action
      // (the second slot of Action Phase). Consumption and slot-position
      // checks are handled by the server's action handlers + engine.
      ps._bonusMainActions = 1;
    },
  },
};
