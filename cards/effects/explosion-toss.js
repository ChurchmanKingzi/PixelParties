'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Explosion Toss"  (W75d)
//  Spell (Reaction, Lv1, Destruction Magic)
//
//  „Play this card immediately when a Creature is moved from one of your Heroes' Support Zones to an opponent's Hero's Support Zone. Defeat that Creature and deal 100/200/300 damage
//   to the opponent's Hero, depending on the Creature's level."
//
//  ── FENSTER: `isCreatureMovedReaction` (neu, 24.10.) ───────────────────
//  Hand-Fenster nach jedem echten Zonenwechsel einer Kreatur über die Seiten (`engine._checkCreatureMovedHandReactions`, gerufen aus `actionTransferCreature` — Dark Gear, Diplomacy, Capture,
//  Jumper Spider … — und vom Weiterreichen der Hot Skull Potato). Es geht nur an den BISHERIGEN Kontrolleur. Bedingung (`creatureMovedCondition`): die Kreatur kam aus der Zone eines Helden,
//  den der Spieler kontrolliert, und steht jetzt in der Zone eines Helden, den ein Gegner kontrolliert (und die Kreatur steht noch auf dem Brett). Eine bloß vorübergehende Kontrolle ohne
//  Zonenwechsel (Aligning Goals, Deepsea Succubus) ist keine Bewegung und löst nichts aus.
//
//  ── WIRKUNG ─────────────────────────────────────────────────────────────
//  „Defeat that Creature": `actionDestroyCard` in der Zone des Gegners (Todes-Hooks, Schutz — Cardinal Beasts, Defending the Gate — lassen sie stehen; die Hot Skull Potato nennt die Toss als Ausnahme ihres „unaffected" [`unaffectedExcept`] und fällt).
//  „the opponent's Hero": der HELD, in dessen Support Zone die Kreatur gelandet ist (der Gastgeber der Zielzone). Schaden 100/200/300 nach der Stufe der Kreatur (Stufe ≤ 1 → 100, 2 → 200,
//  ab 3 → 300; Kreaturen ohne Stufe zählen als ≤ 1), Typ `destruction_spell`, Quelle = die Karte mit dem WIRKER als Held. Der Schaden fällt auch dann, wenn die Kreatur sich dem Besiegen entzieht
//  (die beiden Teile sind getrennte Anweisungen).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_zone_animation` `explosion_toss_blast` (Client: dieselbe große Pixel-Explosion wie die Hot Skull Potato) auf der Kreatur, ihr Mittelpunkt ist die Kartenmitte; Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { hasNumericCreatureLevel } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Explosion Toss';
const BLAST_MS = 1500;
const KNALL_MS = 420;    // bis der Feuerball die Kreatur verschluckt hat

function stufeDerKreatur(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || !hasNumericCreatureLevel(cd)) return 0;
  return engine.effectiveCardLevel(cd, inst.controller ?? inst.owner, { heroIdx: inst.heroIdx, inst }) || 0;
}
const schadenFuerStufe = (lv) => (lv >= 3 ? 300 : lv === 2 ? 200 : 100);

module.exports = {
  // Reaction-Karte: nie aktiv aus der Hand spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isCreatureMovedReaction: true,

  creatureMovedCondition(gs, pi, engine, info) {
    const inst = info?.inst;
    if (!inst || inst.zone !== 'support') return false;
    const von = gs.players[info.fromSeite]?.heroes?.[info.fromHeroIdx];
    if (!von?.name || engine.heroSideOf(info.fromSeite, von) !== pi) return false;          // „one of YOUR Heroes' Support Zones"
    const nach = gs.players[info.toSeite]?.heroes?.[info.toHeroIdx];
    if (!nach?.name || nach.hp <= 0) return false;
    return engine.heroSideOf(info.toSeite, nach) !== pi;                                    // „an OPPONENT'S Hero's Support Zone"
  },

  async creatureMovedResolve(engine, pi, info, opts = {}) {
    const gs = engine.gs;
    const inst = info.inst;
    const casterIdx = Number.isInteger(opts.casterIdx) ? opts.casterIdx : -1;
    const nach = gs.players[info.toSeite]?.heroes?.[info.toHeroIdx];
    const lv = inst ? stufeDerKreatur(engine, inst) : 0;
    const betrag = schadenFuerStufe(lv);
    const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: casterIdx };

    if (inst && inst.zone === 'support') {
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion_toss_blast', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, duration: BLAST_MS + 200,
      });
      await engine._delay(KNALL_MS);
      if (inst.zone === 'support') {
        // Hot Skull Potato („unaffected by all OTHER cards and effects") nennt diese Karte als Ausnahme (`unaffectedExcept`): ihr Schild fällt für den Augenblick des Besiegens (Al, 25.10.).
        const ausnahme = !!inst.counters?._cardinalImmune && (loadCardEffect(inst.name)?.unaffectedExcept || []).includes(CARD_NAME);
        if (ausnahme) delete inst.counters._cardinalImmune;
        try {
          await engine.actionDestroyCard(quelle, inst, { sourceOwner: pi, sourceName: CARD_NAME, fireCreatureDeath: true });
        } finally {
          if (ausnahme && inst.zone === 'support' && inst.counters) inst.counters._cardinalImmune = 1;   // blieb sie stehen (anderer Schutz), gilt der Schild weiter
        }
      }
    }
    if (nach?.name && nach.hp > 0) {
      await engine.actionDealDamage(quelle, nach, betrag, 'destruction_spell');
    }
    engine.log('explosion_toss', { player: gs.players[pi]?.username, creature: info.creatureName, level: lv, damage: betrag, hero: nach?.name });
    engine.sync();
    await engine._delay(BLAST_MS - KNALL_MS - 300);
  },

  /** CPU: nimmt jede Gelegenheit (die gegnerische Übernahme wird zur Explosion); wirft die Karte nicht als Kosten der Hot Skull Potato ab (die Übergabe löst sie ja gleich aus). */
  cpuMeta: { reactionHeuristic: () => true, keepOnDiscardFor: ['Hot Skull Potato'] },
};
