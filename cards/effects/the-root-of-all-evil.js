'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "The Root of all Evil"
//  Creature — Normal, Lv3, 200 HP (Summoning Magic)
//
//  „You may once per turn choose a Creature from your discard pile, except "The Root of all Evil", and
//   place it into the free Support Zone of any Hero you control. Creatures that would be sent to either
//   player's discard pile are deleted instead."
//   (Kartentext gegenueber der Vorlage geaendert: der Satz „The HP of Creatures summoned this way become 1."
//   entfaellt; `data/cards.json` traegt den neuen Text.)
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Aktiver Effekt (einmal pro Zug, Engine-Sperre je Instanz): eine Creature der EIGENEN Ablage ausser
//    „The Root of all Evil" (beliebiges Level) waehlen und per `placeFromPile` in eine freie Support Zone eines
//    kontrollierten Helden legen (auch einem besiegten — nur die Hero Zone darf nicht leer sein) (Platzieren, kein Beschwoeren; On-Summon feuert). Abbrechbar — ein
//    Abbruch verbraucht den Effekt nicht.
//  • Passiv: solange diese Karte aktiv auf dem Brett steht (Support Zone, offen, nicht Frozen/Stunned/Negated),
//    werden Creatures, die in die Ablage JEDES Spielers kaemen, stattdessen geloescht:
//      – besiegte Creatures (beide Todespfade) ueber `engine._gefalleneKreaturenGeloescht()` (mit Loesch-Rettung),
//      – alle anderen Wege (Handabwurf, Mill, Abwurf-Effekte …) ueber die `push`-Umleitung der Ablage
//        (`engine._ablageUmleitungVerfolgen`) — beides prueft `engine._wurzelAktiv()`.
//    Tokens werden ohnehin geloescht. Die Karte selbst wird beim Verlassen des Bretts ebenfalls geloescht, wenn sie
//    als Creature in die Ablage ginge (solange SIE aktiv ist — sie ist ja noch auf dem Brett, wenn sie stirbt).
//  • Fluege: `engine._broadcastEvent` schreibt Fluege Creature → Ablage zentral auf Flug → Geloescht-Stapel um
//    (`play_pile_transfer`, `deck_to_discard_animation`, einzelne `mill_center_reveal`). Eine auf dem Brett besiegte
//    Creature bekommt zusaetzlich den schwarzen Nebel `root_evil_mist`; die Beschwoerung zeigt `necromancy_summon`.
// ═══════════════════════════════════════════
const { isSummonablePileCreature } = require('./_hooks');

const CARD_NAME = 'The Root of all Evil';

/** Creatures der Ablage ausser dieser Karte, entdoppelt (Galerie-Form). */
function kandidaten(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const zaehler = new Map();
  for (const n of (ps?.discardPile || [])) {
    if (n === CARD_NAME) continue;
    if (!engine.darfAusAblageAufsFeld(n)) continue;
    const cd = db[n];
    if (!cd || !isSummonablePileCreature(cd)) continue;
    zaehler.set(n, (zaehler.get(n) || 0) + 1);
  }
  return [...zaehler.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, source: 'discard', count }));
}

/** Freie Plaetze kontrollierter Helden-Zonen, auf denen diese Creature liegen darf — AUCH besiegter Helden: die Root
 *  beschwoert in IRGENDEINE freie Support Zone, solange die zugehoerige Hero Zone nicht leer ist (Name vorhanden). */
function zonenFuer(engine, pi, cardName) {
  const out = [];
  for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(pi)) {
    if (!h?.name) continue;
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
  activeIn: ['support'],
  creatureEffect: true,   // OHNE dieses Kennzeichen listet der Server die Creature nicht als aktivierbar (nicht anklickbar!)
  hooks: {},   // rein aktiver Effekt + passive Engine-Pruefung (`_wurzelAktiv`); der Lader will ein `hooks`-Feld sehen
  blockedByPileLock: true,
  blockedBySummonLock: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (engine.gs.players[pi]?.summonLocked) return false;
    return kandidaten(engine, pi).some(k => zonenFuer(engine, pi, k.name).length > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    const karten = kandidaten(engine, pi).filter(k => zonenFuer(engine, pi, k.name).length > 0);
    if (karten.length === 0) return false;

    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
      description: 'Choose a Creature from your discard pile to place into a free Support Zone.',
      cards: karten, confirmLabel: '🌳 Raise it!', cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return false;
    const gewaehlt = wahl.cardName;
    if (!karten.some(k => k.name === gewaehlt)) return false;

    const zonen = zonenFuer(engine, pi, gewaehlt);
    if (zonen.length === 0) return false;
    let ziel = zonen[0];
    if (zonen.length > 1) {
      const z = await engine.promptGeneric(pi, {
        type: 'zonePick', title: CARD_NAME, source: CARD_NAME,
        description: `Place ${gewaehlt} into which Support Zone?`, zones: zonen, cancellable: true,
      });
      if (!z || z.cancelled) return false;
      const gleich = q => q.heroIdx === z.heroIdx && q.slotIdx === z.slotIdx;
      ziel = zonen.find(q => gleich(q) && q.owner === (z.owner ?? pi))
        || (z.owner == null ? zonen.find(gleich) : null) || null;
      if (!ziel) return false;
    }

    // Necromancy-Animation auf der Ziel-Zone, dann erst platzieren (wie bei der Necromancy-Ability).
    engine._broadcastEvent('play_zone_animation', {
      type: 'necromancy_summon', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx,
    });
    await engine._delay(800);
    const res = await engine.placeFromPile(pi, 'discard', gewaehlt, ziel.heroIdx, ziel.slotIdx, {
      source: CARD_NAME, heldSeite: ziel.owner,
    });
    if (!res) {
      engine.log('root_of_all_evil_fizzle', { player: ps.username, card: gewaehlt });
      await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'place_refused' });
      return true;   // Aktivierung verbraucht, Platzieren verweigert (Sperre zwischen Pruefung und Platz)
    }
    engine.log('root_of_all_evil', { player: ps.username, target: gewaehlt, hero: gs.players[ziel.owner]?.heroes?.[ziel.heroIdx]?.name || null });
    engine.sync();
    return true;
  },
};
