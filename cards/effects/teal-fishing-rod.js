'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Teal Fishing Rod"
//  Artifact — Normal, Cost 5
//
//  „Choose a level 0 Creature from your discard pile that was not sent there this turn and place it into
//   the free Support Zone of any Hero you control. You can only play 1 "Teal Fishing Rod" per turn."
//
//  ── AUSLEGUNG (Schwester von Lone Survivor) ───────────────────────
//  · „level 0": EFFEKTIVES Level in der Ablage genau 0 (`pileSide: 'discard'`); Creatures ohne Level
//    (null) zaehlen nicht. Eligibilitaet wie Lone Survivor (`isPileCreature`, `darfAusAblageAufsFeld`).
//  · „not sent there this turn": Namensschnappschuss `ps._discardNamesAtTurnStart` (wie Thep): ein Name ist
//    waehlbar, wenn er schon zu Zugbeginn in der Ablage lag UND jetzt dort liegt.
//  · „place": Platzieren ist keine Beschwoerung und kostet keine Aktion, zaehlt aber als Effekt-Beschwoerung
//    (On-Summon feuert); eine bestehende Beschwoerungssperre sperrt es (`blockedBySummonLock`).
//  · „free Support Zone of any Hero you control": lebender, kontrollierter Held (auch uebernommene), freie,
//    nicht versiegelte Zone, in der die Creature liegen darf. Nach der Wahl der Creature bei mehreren Plaetzen
//    „Which Support Zone?" (abbrechbar).
//  · „1 per turn": harte Sperre je Spieler und Zug (`gs.hoptUsed['teal-fishing-rod:<pi>']`), erst nach der
//    Bestaetigung der Wahl verbraucht — ein Abbruch verbrennt sie nicht.
// ═══════════════════════════════════════════
const { isPileCreature } = require('./_hooks');

const CARD_NAME = 'Teal Fishing Rod';
const HOPT = (pi) => `teal-fishing-rod:${pi}`;

/** Level-0-Creatures der Ablage, die nicht in diesem Zug hineinkamen; entdoppelt. */
function kandidaten(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const start = ps?._discardNamesAtTurnStart || new Set();
  const zaehler = new Map();
  for (const n of (ps?.discardPile || [])) {
    if (!start.has(n)) continue;                                  // in diesem Zug abgelegt → nicht waehlbar
    if (!engine.darfAusAblageAufsFeld(n)) continue;               // Gigantisaur, Ifrit …
    const cd = db[n];
    if (!cd || !isPileCreature(cd)) continue;
    if (cd.level == null) continue;
    if (engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' }) !== 0) continue;
    zaehler.set(n, (zaehler.get(n) || 0) + 1);
  }
  return [...zaehler.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'discard', count }));
}

/** Freie Plaetze lebender Helden, die `pi` kontrolliert, auf denen diese Creature liegen darf. */
function zonenFuer(engine, pi, cardName) {
  const out = [];
  for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(pi)) {
    if (!h?.name || h.hp <= 0) continue;
    if (engine.isSupportZoneLocked(physOwner, hi, { source: CARD_NAME, cardName, via: 'place' })) continue;
    if (cardName && !engine.isCreatureSummonable(cardName, physOwner, hi, { _bypassBeforeSummon: true })) continue;
    for (let si = 0; si < 3; si++) {
      if (engine.supportSlotBelegt(physOwner, hi, si)) continue;
      out.push({ owner: physOwner, heroIdx: hi, slotIdx: si, label: `${h.name} — Slot ${si + 1}` });
    }
  }
  return out;
}

module.exports = {
  blockedByPileLock: true,
  blockedBySummonLock: true,

  canActivate(gs, pi, engine) {
    if (!engine) return false;
    if (gs.hoptUsed?.[HOPT(pi)] === gs.turn) return false;
    const ps = gs.players[pi];
    if (!ps || ps.summonLocked) return false;
    return kandidaten(engine, pi).some(k => zonenFuer(engine, pi, k.name).length > 0);
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    if (gs.hoptUsed?.[HOPT(pi)] === gs.turn) return { cancelled: true };
    const karten = kandidaten(engine, pi).filter(k => zonenFuer(engine, pi, k.name).length > 0);
    if (karten.length === 0) return { cancelled: true };

    // ① Creature waehlen — abbrechbar, dann ist nichts verbraucht.
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
      description: 'Choose a level 0 Creature from your discard pile (not sent there this turn) to place.',
      cards: karten, confirmLabel: '🎣 Reel it in!', cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return { cancelled: true };
    const gewaehlt = wahl.cardName;
    if (!karten.some(k => k.name === gewaehlt)) return { cancelled: true };

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
      const gleich = q => q.heroIdx === z.heroIdx && q.slotIdx === z.slotIdx;
      ziel = zonen.find(q => gleich(q) && q.owner === (z.owner ?? pi))
        || (z.owner == null ? zonen.find(gleich) : null) || null;
      if (!ziel) return { cancelled: true };
    }

    // Die Wahl steht → die Sperre „1 pro Zug" ist ab jetzt verbraucht.
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[HOPT(pi)] = gs.turn;

    // ③ Platzieren ueber die Stapel-Schicht (Flug aus der Ablage, Sperren, Lethe-Stempel, On-Summon-Hooks).
    const res = await engine.placeFromPile(pi, 'discard', gewaehlt, ziel.heroIdx, ziel.slotIdx, {
      source: CARD_NAME,
      heldSeite: ziel.owner,
    });
    if (!res) {
      engine.log('teal_fishing_rod_fizzle', { player: ps.username, card: gewaehlt });
      await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'place_refused' });
      return true;   // gespielt, aber verpufft (Sperre zwischen Pruefung und Platz)
    }
    engine.log('teal_fishing_rod', {
      player: ps.username, card: CARD_NAME, target: gewaehlt,
      hero: gs.players[ziel.owner]?.heroes?.[ziel.heroIdx]?.name || null,
    });
    engine.sync();
    return true;
  },

  // CPU: die Creature mit den meisten HP.
  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME || p?.type !== 'cardGallery') return undefined;
    const db = engine._getCardDB();
    let best = null, bestWert = -Infinity;
    for (const c of (p.cards || [])) {
      const wert = (db[c.name]?.hp || 0) + (db[c.name]?.atk || 0);
      if (wert > bestWert) { bestWert = wert; best = c; }
    }
    return best ? { cardName: best.name, source: best.source } : undefined;
  },
};
