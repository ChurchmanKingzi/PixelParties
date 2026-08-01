// ═══════════════════════════════════════════
//  CARD EFFECT: "Rain of Arrows"
//  Spell (Destruction Magic Lv1) — Deals damage
//  equal to 30 × total Creatures you control to
//  ALL targets the opponent controls.
//  Damage type: destruction_spell.
//  Hard once per turn (1 Rain of Arrows per turn).
//
//  Uses generic ctx.aoeHit() for target collection,
//  Ida override, animations, and damage.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const HOPT_KEY = 'rain-of-arrows';

module.exports = {
  /**
   * Hand-dim + cast gate. The engine reads this both when computing
   * "blocked from hand" (greys the card if false) and when
   * validating a play attempt server-side, so a HOPT'd Rain of
   * Arrows can't sneak past either path.
   */
  /**
   * Schadensprojektion für den Impact-Lernkanal (Als Vorgabe: das Profil
   * soll selbst lernen, wie viel Hero-Kills, Creature-Kills und reiner
   * Schaden relativ zueinander wert sind).
   *
   * Nötig, weil der statische Profil-cardValue dieser Karte konstant ist,
   * ihr Schaden aber linear mit dem eigenen Board skaliert: bei null
   * eigenen Kreaturen macht sie exakt 0 Schaden und trägt trotzdem den
   * höchsten Prior im Deck. Die Priors sind verblassende PUCT-Gewichte —
   * bei knappem Rollout-Budget entscheiden sie, was überhaupt evaluiert
   * wird, also lohnt die Korrektur genau dort.
   *
   * Liefert den Schaden je Ziel plus die Zielliste; Kills leitet der
   * gemeinsame Extraktor daraus ab, damit Karten nur ihre eigene Formel
   * kennen müssen.
   *
   * @returns {{amount:number, targets:Array<{kind:string, hp:number}>}|null}
   */
  cpuProjectedDamage(gs, pi, engine) {
    try {
      const cardDB = engine._getCardDB();
      const isCreature = (inst) => {
        const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
        return cd && hasCardType(cd, 'Creature');
      };
      const creatureCount = (engine.cardInstances || []).filter(inst =>
        inst.controller === pi && inst.zone === 'support' && !inst.faceDown && isCreature(inst)
      ).length;
      const amount = 30 * creatureCount;
      const opp = 1 - pi;
      const targets = [];
      for (const h of (gs.players?.[opp]?.heroes || [])) {
        if (h && h.hp > 0 && !h.defeated) targets.push({ kind: 'hero', hp: h.hp });
      }
      for (const inst of (engine.cardInstances || [])) {
        if (inst.controller !== opp || inst.zone !== 'support' || inst.faceDown) continue;
        if (!isCreature(inst)) continue;
        const hp = inst.counters?.hp ?? cardDB[inst.name]?.hp ?? 0;
        if (hp > 0) targets.push({ kind: 'creature', hp });
      }
      return { amount, targets };
    } catch { return null; }
  },

  spellPlayCondition(gs, pi) {
    return gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] !== gs.turn;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // Stamp HOPT at the start of resolve. A negated cast (Cute
      // Camera, Ragnarock, etc.) prevents `onPlay` from firing
      // entirely, so the slot stays free — matching the codebase's
      // existing convention for spell HOPT (Acid Vial does the same).
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      engine.gs.hoptUsed[`${HOPT_KEY}:${pi}`] = engine.gs.turn;

      // Count ALL creatures the player controls (Creature/Token types only)
      const cardDB = engine._getCardDB();
      const creatureCount = engine.cardInstances.filter(inst => {
        if (inst.controller !== pi || inst.zone !== 'support') return false;
        if (inst.faceDown) return false;
        const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
        return cd && hasCardType(cd, 'Creature');
      }).length;

      const damage = 30 * creatureCount; // Can be 0 — spell still visually happens

      await ctx.aoeHit({
        side: 'enemy',
        types: ['hero', 'creature'],
        damage,
        damageType: 'destruction_spell',
        sourceName: 'Rain of Arrows',
        animationType: 'arrow_rain',
        singleTargetPrompt: {
          title: 'Rain of Arrows',
          description: damage > 0
            ? `Ida has to concentrate on one target — choose! Deal ${damage} damage (30 × ${creatureCount} Creature${creatureCount !== 1 ? 's' : ''}).`
            : 'Ida has to concentrate on one target — choose! (0 Creatures — no damage)',
          confirmLabel: damage > 0 ? `⬇️ ${damage} Damage!` : '⬇️ Fire!',
          cancellable: false,
        },
      });

      engine.log('rain_of_arrows', { damage, creatureCount, player: ctx.players[pi].username });
      engine.sync();
    },
  },
};
