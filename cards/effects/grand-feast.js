'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Grand Feast"  (W77b)
//  Spell (Reaction, Lv1, Support Magic)
//
//  „Play this card immediately when one of your Heroes defeats a Creature with an Attack or Spell. Heal all targets you control for 80 HP."
//  (Kartentext 25.10.: „a Creature" statt „an opponent's Creature" — auch eine eigene besiegte Creature zählt.)
//
//  ── FENSTER: `isTargetsDefeatedReaction` (siehe revenge.js) ─────────────
//  Am Ende des Sterbe-Vorgangs (ein Flächenschlag = EIN Vorgang) wird die Karte dem Spieler angeboten, dessen HELD eine Creature durch eine Attack oder einen Spell besiegt hat:
//  Quelle = ein Held des Spielers (nach KONTROLLE), kein Kreatureneffekt, die Quelle zählt als Attack/Spell (`quelleIstAttackOderSpell`: Kartenskript Attack/Spell, Heldeneffekte, die als
//  Attack/Spell zählen). Besiegte HELDEN lösen nichts aus („defeats a Creature"). Ein Vorgang öffnet das Fenster nur EINMAL, egal wie viele Creatures fielen.
//
//  ── WIRKUNG ─────────────────────────────────────────────────────────────
//  „Heal all targets you control for 80 HP": alle lebenden Helden (nach Kontrolle) und alle Creatures auf dem Brett, die der Spieler kontrolliert (Heilung über `actionHealHero` / `actionHealCreature`,
//  also mit allen Heil-Sperren und -Boni der Engine). Animation `grand_feast` auf JEDEM Ziel — auch auf solchen, die nichts heilen können (volle HP).
// ═══════════════════════════════════════════

const CARD_NAME = 'Grand Feast';
const HEAL = 80;
const VOR_MS = 140;      // Abstand der Gerichte zwischen den Zielen
const SHOW_MS = 1000;    // bis die Teller stehen und die Heilung einsetzt

module.exports = {
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  includesHealing: true,
  hitsMultipleTargets: true,   // heilt ALLE eigenen Ziele (Wächter check-aoe-text: AoE ohne Schaden von Hand deklariert)

  isTargetsDefeatedReaction: true,

  targetsDefeatedCondition(gs, pi, engine, info) {
    const hooks = require('./_hooks');
    return (info?.defeated || []).some(e => {
      if (e.hero) return false;                                         // „defeats a CREATURE"
      const q = e.source;
      if (!q || (q.controller ?? q.owner) !== pi) return false;         // „one of YOUR Heroes"
      if (hooks.isCreatureSource(engine, q)) return false;              // ein Held, kein Kreatureneffekt
      if (!(Number.isInteger(q.heroIdx) && q.heroIdx >= 0)) return false;
      return hooks.quelleIstAttackOderSpell(engine, q);
    });
  },

  async targetsDefeatedResolve(engine, pi) {
    const gs = engine.gs;
    const quelle = { name: CARD_NAME, owner: pi, controller: pi, cardType: 'Spell' };
    const ziele = [];
    for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(pi)) {
      if (!hero?.name || hero.hp <= 0) continue;
      ziele.push({ art: 'hero', seite: physOwner, heroIdx, hero });
    }
    for (const inst of engine.cardInstances) {
      if ((inst.controller ?? inst.owner) !== pi || inst.zone !== 'support') continue;
      const seite = engine.physicalSide(inst);
      if (!(gs.players[seite]?.heroes?.[inst.heroIdx]?.hp > 0)) continue;
      const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
      if (!cd || !engine.isChoosableAsCreature(inst, cd)) continue;
      ziele.push({ art: 'creature', seite, heroIdx: inst.heroIdx, slot: inst.zoneSlot, inst });
    }
    // Das Festmahl wird aufgetragen (auch auf Zielen, die nichts mehr heilen können) …
    for (const z of ziele) {
      engine._broadcastEvent('play_zone_animation', { type: 'grand_feast', owner: z.seite, heroIdx: z.heroIdx, zoneSlot: z.art === 'hero' ? -1 : z.slot, duration: 1500 });
      await engine._delay(VOR_MS);
    }
    await engine._delay(SHOW_MS);
    // … und heilt.
    for (const z of ziele) {
      if (z.art === 'hero') {
        const h = gs.players[z.seite]?.heroes?.[z.heroIdx];
        if (h?.name && h.hp > 0) await engine.actionHealHero(quelle, h, HEAL);
      } else if (z.inst.zone === 'support') {
        await engine.actionHealCreature(quelle, z.inst, HEAL);
      }
    }
    engine.log('grand_feast', { player: gs.players[pi]?.username, targets: ziele.length, amount: HEAL });
    engine.sync();
  },

  cpuMeta: { reactionHeuristic: () => true },
};
