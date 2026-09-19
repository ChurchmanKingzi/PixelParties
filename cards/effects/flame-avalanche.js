// ═══════════════════════════════════════════
//  CARD EFFECT: "Flame Avalanche"
//  Spell (Destruction Magic Lv3) — Deals 150
//  damage to ALL targets the opponent controls.
//  After resolving, the player cannot deal any
//  more damage to opponent's targets this turn
//  (absolute lock — overrides everything).
//
//  Cannot be played if the player already dealt
//  damage to opponent's targets this turn.
//
//  Uses generic ctx.aoeHit() for target collection,
//  Ida override, animations, and damage.
// ═══════════════════════════════════════════

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  // ★★ v1213: Der abgewehrte Guss zeigt NICHT die Lawine, sondern
  // Flammen, die auf den Zielen aufflackern und verloeschen — eine
  // Lawine, die ueber alles hinwegrollt und dann nichts tut, waere das
  // falsche Bild fuer „negiert".
  spellVisual: {
    impact: { type: 'flame_strike' }, impactMs: 260,
  },

  hooks: {
    onPlay: async (ctx) => {
      const ps = ctx.players[ctx.cardOwner];

      // Safety: if already dealt damage this turn, fizzle
      if (ps.dealtDamageToOpponent) return;

      const result = await ctx.aoeHit({
        side: 'enemy',
        types: ['hero', 'creature'],
        damage: 150,
        damageType: 'destruction_spell',
        sourceName: 'Flame Avalanche',
        // ★★ v1213 (Als Vorgabe 18.9.): „zeigt aktuell einfach nur
        // Flammen auf ihren Zielen an — sollte aber eine Lawine aus
        // Flammen zeigen, die vom Caster ausgehen und alle Ziele
        // ueberwalzen." Genau das macht `waveAnimation`: eine Front,
        // die beim wirkenden Helden losbricht und ueber das Brett
        // laeuft. Die Einzeltreffer-Animation faellt dafuer weg — die
        // Lawine IST das Bild, Flammen auf jedem Ziel obendrauf waeren
        // nur Rauch. Die Schadenszahlen laufen unveraendert weiter.
        animationType: null,
        waveAnimation: { type: 'flame_avalanche', duration: 1600, delay: 520 },
        singleTargetPrompt: {
          title: 'Flame Avalanche',
          description: 'Ida has to concentrate on one target — choose! Deal 150 damage.',
          confirmLabel: '🔥 150 Damage!',
        },
      });

      // Skip the lock if the cast didn't actually land. `aoeHit` returns
      // `{ cancelled: true }` on surprise negation (Frost Rune, …) and on
      // single-target-prompt cancellation; `gs._spellCancelled` is the
      // single-target prompt's cancel signal; `gs._spellNegatedByEffect`
      // covers any reaction that flagged the cast as negated. Without
      // this guard a negated Flame Avalanche would still apply the
      // "no more damage this turn" debuff for free.
      const gs = ctx._engine.gs;
      if (result?.cancelled || gs._spellCancelled || gs._spellNegatedByEffect) return;

      // Lock: no more damage to opponent's targets this turn (absolute)
      ps.damageLocked = true;
      ctx._engine.log('damage_locked', { player: ps.username, by: 'Flame Avalanche' });
      ctx._engine.sync();
    },
  },

  /**
   * Play condition: cannot play if player already dealt damage
   * to opponent's targets this turn.
   */
  spellPlayCondition(gs, playerIdx) {
    return !gs.players[playerIdx]?.dealtDamageToOpponent;
  },
};
