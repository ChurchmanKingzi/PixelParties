'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Lone Survivor"  (v1354)
//  Artifact — Normal, Cost 8 (gebannt — implementiert trotzdem, Als Regel 17.8.)
//
//  "You can only play this card while you control no Creatures. Choose a
//   level 3 or lower Creature from your discard pile and place it into the
//   free Support Zone of an undefeated Hero you control. You cannot summon
//   Creatures for the rest of the turn afterwards."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  · „control no Creatures": offene Creatures unter eigener Kontrolle
//    (Controller zaehlt, gestohlene also mit; Artefakt-Creatures sind
//    Creatures; Tokens und verdeckte Surprise-Creatures nicht).
//  · „level 3 or lower": EFFEKTIVES Level in der Ablage
//    (`pileSide: 'discard'` — Lethes Aufschlaege zaehlen mit).
//  · „place": Platzieren ist keine Beschwoerung und kostet keine Aktion,
//    zaehlt aber als Effekt-Beschwoerung (On-Summon feuert, Als Ruling).
//    Eine BESTEHENDE Beschwoerungssperre sperrt auch das Platzieren
//    (Regelwerk) — dann ist die Karte grau (`blockedBySummonLock`).
//  · „undefeated Hero you control" + freie Support Zone: lebender eigener
//    Held, Platz frei und nicht versiegelt (`supportSlotBelegt`), keine
//    Spaltensperre, und die Creature duerfte dort liegen
//    (`isCreatureSummonable` ohne `beforeSummon`, wie Create Illusion).
//  · Danach: Beschwoerungssperre bis Zugende (`ps.summonLocked`, faellt
//    beim Zugbeginn).
//  · Einziger Effekt ist eine Entnahme aus der Ablage → `blockedByPileLock`.
// ═══════════════════════════════════════════
const { isPileCreature, hasCardType } = require('./_hooks');

const CARD_NAME = 'Lone Survivor';
const MAX_LEVEL = 3;

/** Kontrolliert `pi` eine offene Creature? */
function kontrolliertKreatur(engine, pi) {
  const db = engine._getCardDB();
  return (engine.cardInstances || []).some(inst => {
    if (inst.zone !== 'support' || inst.faceDown) return false;
    if ((inst.controller ?? inst.owner) !== pi) return false;
    const cd = engine.getEffectiveCardData?.(inst) || db[inst.name];
    return !!cd && hasCardType(cd, 'Creature');
  });
}

/** Creatures der Ablage mit effektivem Level ≤ 3, entdoppelt (Galerie-Form: name rein). */
function kandidaten(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const zaehler = new Map();
  for (const n of (ps?.discardPile || [])) {
    if (!engine.darfAusAblageAufsFeld(n)) continue;   // v1389: Gigantisaur, Ifrit
    const cd = db[n];
    if (!cd || !isPileCreature(cd)) continue;
    if (engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' }) > MAX_LEVEL) continue;
    zaehler.set(n, (zaehler.get(n) || 0) + 1);
  }
  return [...zaehler.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'discard', count }));
}

/** Freie Plaetze lebender eigener Helden, auf denen diese Creature liegen darf. */
function zonenFuer(engine, pi, cardName) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (engine.isSupportZoneLocked(pi, hi, { source: CARD_NAME, cardName, via: 'place' })) continue;
    if (cardName && !engine.isCreatureSummonable(cardName, pi, hi, { _bypassBeforeSummon: true })) continue;
    for (let si = 0; si < 3; si++) {
      if (engine.supportSlotBelegt(pi, hi, si)) continue;
      out.push({ heroIdx: hi, slotIdx: si, label: `${h.name} — Slot ${si + 1}` });
    }
  }
  return out;
}

module.exports = {
  blockedByPileLock: true,
  blockedBySummonLock: true,

  canActivate(gs, pi, engine) {
    if (!engine) return false;
    const ps = gs.players[pi];
    if (!ps || ps.summonLocked) return false;
    if (kontrolliertKreatur(engine, pi)) return false;
    // Irgendeine taugliche Creature MIT irgendeinem tauglichen Platz.
    return kandidaten(engine, pi).some(k => zonenFuer(engine, pi, k.name).length > 0);
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    if (kontrolliertKreatur(engine, pi)) return { cancelled: true };
    const karten = kandidaten(engine, pi).filter(k => zonenFuer(engine, pi, k.name).length > 0);
    if (karten.length === 0) return { cancelled: true };

    // ① Creature waehlen — abbrechbar, dann ist nichts verbraucht.
    let gewaehlt = null;
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
      description: 'Choose a level 3 or lower Creature from your discard pile to place.',
      cards: karten, confirmLabel: '🕯️ Place!', cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return { cancelled: true };
    gewaehlt = wahl.cardName;

    // ② Platz waehlen (bei nur einem ohne Rueckfrage).
    const zonen = zonenFuer(engine, pi, gewaehlt);
    if (zonen.length === 0) return { cancelled: true };
    let ziel = zonen[0];
    if (zonen.length > 1) {
      const z = await engine.promptGeneric(pi, {
        type: 'zonePick', title: CARD_NAME, source: CARD_NAME,
        description: `Place ${gewaehlt} into which Support Zone?`,
        zones: zonen, cancellable: true,
      });
      if (!z || z.cancelled) return { cancelled: true };
      ziel = zonen.find(q => q.heroIdx === z.heroIdx && q.slotIdx === z.slotIdx) || null;
      if (!ziel) return { cancelled: true };
    }

    // ③ Platzieren ueber die Stapel-Schicht (Flug aus der Ablage, Sperren,
    // Lethe-Stempel, On-Summon-Hooks mit `_isPlacement`).
    const res = await engine.placeFromPile(pi, 'discard', gewaehlt, ziel.heroIdx, ziel.slotIdx, {
      source: CARD_NAME,
    });
    if (!res) {
      engine.log('lone_survivor_fizzle', { player: ps.username, card: gewaehlt });
      await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'place_refused' });   // v1359
      return true;   // gespielt, aber verpufft (Sperre zwischen Pruefung und Platz)
    }

    // ④ „You cannot summon Creatures for the rest of the turn afterwards."
    ps.summonLocked = true;
    engine.log('lone_survivor', {
      player: ps.username, card: CARD_NAME, target: gewaehlt,
      hero: ps.heroes[ziel.heroIdx]?.name || null,
    });
    engine.sync();
    return true;
  },

  // CPU: die staerkste Creature (hoechstes Level, dann HP).
  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME || p?.type !== 'cardGallery') return undefined;
    const db = engine._getCardDB();
    const pi = engine._cpuPlayerIdx;
    let best = null, bestWert = -Infinity;
    for (const c of (p.cards || [])) {
      const cd = db[c.name];
      if (!cd) continue;
      const wert = (engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' }) || 0) * 1000 + (cd.hp || 0);
      if (wert > bestWert) { bestWert = wert; best = c; }
    }
    return best ? { cardName: best.name, source: best.source } : undefined;
  },
};
