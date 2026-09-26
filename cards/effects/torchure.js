// ═══════════════════════════════════════════
//  CARD EFFECT: "Torchure"
//  Spell (Magic Arts Lv1)
//
//  "Inflict 4 Stacks of Poison to a Hero you control that is not
//   Poisoned to play this card. During your next turn, if that Hero
//   is still Poisoned from this effect, you may perform an additional
//   Action during your Action Phase. This counts as an additional
//   Action."   (Text Al 26.9., v1444 — vorher Lv3, 2 Stacks, zweite
//   Action im SELBEN Zug, nur in Main Phase 1)
//
//  Das Gift traegt die Marke `_torchure = { owner, turn }`. Den
//  naechsten eigenen Zug haelt `engine._torchureZugMerken` fest, die
//  Zusatz-Action (`_bonusMainActions`, zweiter Platz der Action Phase)
//  gibt `engine._torchureZusatz` zu Beginn der Action Phase — nur wenn
//  der Held dann noch lebt und DIESES Gift noch traegt.
//
//  Torchure selbst ist eine INHAERENTE Zusatz-Action (Als Vorgabe 26.9.)
//  und verbraucht die Action des Zuges nicht.
//
//  Animation `torchure` (app-board.jsx, Kartenbild als Vorlage): das
//  Schwein frisst die Fackel und foltert damit mental seine Aufpasserin
//  — Fackel faellt ein, Schwein kaut, violette Gedankenringe ziehen sich
//  um den Kopf des Helden zusammen, dann greift das Gift.
// ═══════════════════════════════════════════

const POISON_STACKS = 4;

module.exports = {
  inherentAction: true,   // v1444: Zusatz-Action, verbraucht die Action nicht
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // Kosten: ein eigener, lebender, nicht vergifteter Held muss da sein.
  spellPlayCondition(gs, pi) {
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
        // Statusangabe fuer den LERNKANAL (Als Vorgabe 9.8.): diese Karte
        // traegt Schaden UND Status. Das Ziel-Gate filtert deshalb NICHT —
        // `classifyTargetTags` stempelt stattdessen `stat:sticks` bzw.
        // `stat:blocked`, damit `targetPriors` je Karte lernt, wie stark
        // das Haften die Schadens-Rangfolge verschiebt.
        appliesStatus: 'poisoned',
        description: `Choose one of your Heroes to Poison (${POISON_STACKS} stacks, permanent). If it is still Poisoned during your next turn, you get an additional Action.`,
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

      // Torch + Torture: erst die Szene, dann das Gift.
      engine._broadcastEvent('play_zone_animation', {
        type: 'torchure', owner: pi, heroIdx: target.heroIdx, zoneSlot: -1,
        duration: 2000,
      });
      await engine._delay(1250);

      // 4 Stacks, dauerhaft; die Marke reitet am Gift-Status mit.
      await engine.addHeroStatus(pi, target.heroIdx, 'poisoned', {
        stacks: POISON_STACKS,
        permanent: true,
        _torchure: { owner: pi, turn: gs.turn },
        appliedBy: pi,   // v1067: eigener Held — loest korrekt KEINEN Gegner-Trigger aus
      });

      engine.log('torchure_poison', {
        player: ps.username,
        hero: ps.heroes[target.heroIdx]?.name,
      });
    },
  },
};
