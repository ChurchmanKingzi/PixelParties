'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Midnight Assault"  (v1293)
//  Attack (Normal) — Fighting Lv3
//
//  "Choose any Creature or a Hero with 150 or less HP and defeat it.
//   This Attack's level is reduced by the level of the highest-level
//   Creature you control. Your opponent cannot react to this Attack and
//   it ignores any effect that would negate it or prevent the target
//   from being defeated."
//
//  Rulings (Al, 23.9.): „150 or less HP" (vorher 100) gilt NUR fuer Heroes —
//  Creatures koennen unabhaengig von ihren HP getoetet werden.
//
//  Bauteile:
//   • Ziele: jede Creature (beide Seiten, offen in einer Support Zone)
//     oder ein lebender Held mit ≤ 150 HP (beide Seiten). Die normalen
//     Zielregeln (Untargetable, Great Wall …) gelten — sie verhindern
//     das WAEHLEN, nicht das Besiegen.
//   • Level: `reduceCardLevel` — hoechstes Level unter den eigenen
//     Creatures; zaehlt ueber `selbstsenkungZaehlt` nur EINMAL, auch mit
//     zwei Kopien auf der Hand.
//   • „cannot react": Skript-Flag `opponentCannotReact` sperrt das
//     Kettenfenster der Karte selbst; waehrend der Aufloesung sperrt
//     `engine.ohneGegnerReaktion` jede Gegner-Reaktion (Hand, Surprise,
//     Kette, Brett-Reaktionen) — auch die auf das Besiegen (Zombified
//     Assault, Corpse Explosion …).
//   • „ignores … negate it or prevent … defeated": `cannotBeNegated`
//     (Brett-Waechter, Spell-Schilde) und `unaufhaltsam` an
//     `actionDestroyCard` / `actionDefeatHero` — keine Immunitaet, kein
//     Rettungsfenster, kein Schutz-Hook. Die Erstrunden-Schonung bleibt
//     (Spielregel, kein Effekt).
//   • Animation: `assassination_cut` — brandneu (Als Vorgabe): Schatten
//     faellt, Mondsichel blitzt, ein einziger Schnitt, der aufreisst.
// ═══════════════════════════════════════════
const { hasCardType, selbstsenkungZaehlt } = require('./_hooks');

const CARD_NAME = 'Midnight Assault';
const HELD_HP_GRENZE = 150;   // Als Aenderung 23.9.: 100 → 150
const SCHNITT_MS = 440;   // bis der Schnitt sitzt (Keyframe: Schnitt ab 280 ms)

function istKreatur(engine, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  return !!cd && hasCardType(cd, 'Creature');
}

/**
 * Alle Ziele vor den Zielregeln der Engine. Lebende Helden ueber der
 * HP-Grenze stehen MIT drin, aber als `ineligible` — der Client zeigt sie
 * ausgegraut (Als Vorgabe 23.9.), waehlen kann man sie nicht. Tote Helden
 * zeigt das Brett ohnehin als besiegt.
 */
function ziele(engine) {
  const out = [];
  for (let pi = 0; pi < 2; pi++) {
    const heroes = engine.gs.players[pi]?.heroes || [];
    heroes.forEach((h, hi) => {
      if (!h?.name || h.hp <= 0) return;
      const t = { id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name };
      if (h.hp > HELD_HP_GRENZE) t.ineligible = true;
      out.push(t);
    });
  }
  for (const inst of engine.cardInstances) {
    if (!istKreatur(engine, inst)) continue;
    const seite = inst.controller ?? inst.owner;
    out.push({
      id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
      owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return out;
}

function hoechstesKreaturLevel(engine, pi) {
  let best = 0;
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi || !istKreatur(engine, inst)) continue;
    const lv = (engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name])?.level || 0;
    if (lv > best) best = lv;
  }
  return best;
}

module.exports = {
  activeIn: ['hand'],
  requiresTarget: true,
  opponentCannotReact: true,   // Kettenfenster der Karte selbst (Engine)
  cannotBeNegated: true,       // Brett-Waechter / Spell-Schilde (Engine)

  reduceCardLevel(cardData, engine, ownerIdx, inst) {
    if (!cardData || cardData.name !== CARD_NAME) return 0;
    if (!inst || inst.zone !== 'hand') return 0;
    if (!selbstsenkungZaehlt(engine, inst, CARD_NAME, ownerIdx, { zone: 'hand' })) return 0;
    return hoechstesKreaturLevel(engine, ownerIdx);
  },

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    return !eng || ziele(eng).some(t => !t.ineligible);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx ?? ctx.card?.heroIdx ?? -1;
      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx, cardType: 'Attack' };

      await engine.ohneGegnerReaktion(pi, async () => {
        const kandidaten = ziele(engine);
        if (!kandidaten.some(t => !t.ineligible)) return;
        const gewaehlt = await engine.promptEffectTarget(pi, kandidaten, {
          title: CARD_NAME, source: CARD_NAME,
          description: 'Choose any Creature, or a Hero with 150 or less HP, and defeat it.',
          confirmLabel: '🌙 Assassinate!', confirmClass: 'btn-danger',
          // v1295 (Als Befund 23.9.): abbrechbar wie jede andere Attack —
          // Abbruch legt die Karte zurueck auf die Hand (`_spellCancelled`,
          // Wächter check-spell-cancel). Vor der Wahl ist nichts sichtbar.
          cancellable: true, maxTotal: 1, minRequired: 1,
        });
        if (!gewaehlt || gewaehlt.length === 0) { gs._spellCancelled = true; return; }
        const ziel = kandidaten.find(t => t.id === gewaehlt[0] && !t.ineligible);
        if (!ziel) return;

        engine._broadcastEvent('play_zone_animation', {
          type: 'assassination_cut', owner: ziel.owner, heroIdx: ziel.heroIdx,
          zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
        });
        await engine._delay(SCHNITT_MS);

        if (ziel.type === 'hero') {
          const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
          if (!held || held.hp <= 0) return;
          const r = await engine.actionDefeatHero(quelle, held, {
            unaufhaltsam: true, cannotBeNegated: true, skipDefeatReactions: true,
          });
          engine.log('midnight_assault', { player: gs.players[pi]?.username, target: held.name, defeated: !!r?.defeated });
        } else {
          const inst = ziel.cardInstance;
          if (!inst || inst.zone !== 'support') return;
          await engine.actionDestroyCard(quelle, inst, { unaufhaltsam: true, sourceOwner: pi, sourceName: CARD_NAME });
          engine.log('midnight_assault', { player: gs.players[pi]?.username, target: inst.name, defeated: inst.zone !== 'support' });
        }
        engine.sync();
      });
    },
  },

  // CPU: hoechsten gegnerischen Wert nehmen — ein Held (sofortiger Kill)
  // vor der Creature mit dem hoechsten Level. Eigene Ziele nie.
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const pi = payload?.playerIdx;
    const valid = (payload?.validTargets || []).filter(t => t.owner !== pi && !t.ineligible);
    if (valid.length === 0) return undefined;
    const db = engine._getCardDB();
    const wert = (t) => t.type === 'hero' ? 100 : (db[t.cardName]?.level || 0);
    valid.sort((a, b) => wert(b) - wert(a));
    return [valid[0].id];
  },
  cpuShouldPlay(engine, pi) {
    return ziele(engine).some(t => t.owner !== pi && !t.ineligible);
  },
};
