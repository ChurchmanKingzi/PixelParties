// ═══════════════════════════════════════════
//  CARD EFFECT: "Drill Sergeant"
//  (v608: Datenname korrigiert — bis v607 stand „Sergreant" in
//   cards.json, Modul und Konstante folgten dem Tippfehler.)
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//
//  „You may once per turn choose a level 1 or lower Creature from your
//   hand and place it into a free Support Zone of the corresponding
//   Hero."
//
//  ── Auslegung ─────────────────────────────────────────────────
//  · Der Effekt ist ein PLACE (Al, 29.8.: „zaehlt als place, wie
//    Cloudy Slime"). Nach Als place-Regel (18.8.) ist der Zustand des
//    Helden damit egal — tot, Frozen, Stunned, negiert: die Zone
//    bleibt gueltiges Ziel. Kein `livingHeroesOnly`, kein
//    `isCreatureSummonable`, keine Level-/Schulpruefung des Helden.
//  · „the corresponding Hero" = der Held, unter dem der Sergeant
//    liegt (`ctx.cardHeroIdx`, auf der BRETTSEITE `physicalSide`). Zielzonen
//    sind seine freien Support Zones — Basisplaetze UND Inselzonen
//    (Flying Island in the Sky; `getFreeSupportZones` zaehlt die seit
//    v607 mit).
//  · ★ Welle 11 (Al, 15.10.2026, Q74 „a"): GESTOHLENER Sergeant (Lovely
//    Teddy, Dark Gear …) legt beim Helden, UNTER DEM ER LIEGT — auf der
//    Gegnerseite. Die Kreatur kommt aus der Hand des KONTROLLEURS und
//    gehoert ihm (seitenfremd: `heldSeite`, `controller` +
//    `crossSideControlled` wie beim Beschwoeren ueber einen geliehenen
//    Helden). Vorher wurde der Index auf die EIGENE Spalte des Diebes
//    abgebildet.
//  · „level 1 or lower" liest die Stufe der Karte IN DER HAND (Welle 25,
//    N3-15, Al „ja": `effectiveCardLevel` mit `handIdx` - wie Slave Trader
//    und Psychic Scout; eine auf Stufe 1 gesenkte Embodiment of Biseria ist
//    platzierbar); nur echte Kreaturen (`isSummonablePileCreature`: keine Artifact
//    Creatures, keine Tokens).
//  · Aktiver Effekt ohne Aktionskosten (`creatureEffect`), soft once
//    per turn — die Engine stempelt `creature-effect:<id>`. Abbruch
//    in der Karten- ODER Zonenwahl kostet nichts (`return false`).
//  · Das Legen laeuft ueber `engine.actionPlaceCreature` (Quelle
//    'hand'): Instanz, `isPlacement`, Summon-Lock, Hook-Kette
//    (onPlay / onCardEnterZone) und `summon_effect`-Auftritt kommen
//    von dort — wie Deepsea Bats und Dark Gear.
// ═══════════════════════════════════════════

const { isSummonablePileCreature } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Drill Sergeant';
const MAX_LEVEL = 1;

/** Handkarten, die der Sergeant legen darf — je Name einmal, mit Anzahl. */
function eligibleHandCards(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const counts = new Map();
  const firstIdx = new Map();
  const hand = ps?.hand || [];
  for (let i = 0; i < hand.length; i++) {
    const name = hand[i];
    const cd = db[name];
    if (!cd || !isSummonablePileCreature(cd)) continue;
    if (typeof cd.level !== 'number' || engine.effectiveCardLevel(cd, pi, { handIdx: i }) > MAX_LEVEL) continue;   // N3-15: Handstufe nach Senkung
    // N3-08 (Al, Welle 25: „Korrekt"): Elusive Hind / Plant Golem („Summon this card into a free Support Zone of a Hero your opponent controls")
    // werden bei vollem Gegnerbrett gar nicht erst angeboten (wie Psychic Scout / Slave Trader) - nur dieser Teil von `canSummon` gilt beim Platzieren.
    if (loadCardEffect(name)?.playOnOppSideOnly && !engine.isCreatureSummonable(name, pi)) continue;
    if (engine.nurEinerSchonKontrolliert(pi, name)) continue;   // W16d (C02-04): „You can only control 1" - nicht anbieten
    counts.set(name, (counts.get(name) || 0) + 1);
    if (!firstIdx.has(name)) firstIdx.set(name, i);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, source: 'hand', count, handIdx: firstIdx.get(name) }));
}

/** Freie Support Zones (inkl. Insel) des Helden, unter dem der Sergeant liegt (Brettseite `seite`, Q74). */
function targetZones(engine, seite, heroIdx, pi = seite, cardName = null) {
  // W62a: mit `cardName` zaehlt — bei Alice-Teilung des Kontrolleurs `pi` — auch die Zone einer GLEICHNAMIGEN Creature (`beschwoerZonenFuer`).
  return engine.beschwoerZonenFuer(pi, cardName, { seite, heroIdx });
}

/** Handkarten, fuer die der Held des Sergeants mindestens eine Zone hat (frei oder geteilt). */
function platzierbareKarten(engine, pi, seite, heroIdx) {
  return eligibleHandCards(engine, pi).filter(c => targetZones(engine, seite, heroIdx, pi, c.name).length > 0);
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const seite = engine.physicalSide(ctx.card) ?? pi;   // Q74: Brettseite des Helden, unter dem der Sergeant liegt
    if (engine.gs.players[pi]?.summonLocked) return false;
    return platzierbareKarten(engine, pi, seite, ctx.cardHeroIdx).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];
    const seite   = engine.physicalSide(ctx.card) ?? pi;   // Q74: Brettseite des Helden, unter dem der Sergeant liegt

    const cards = platzierbareKarten(engine, pi, seite, heroIdx);   // W62a: nur Karten mit Zone (frei oder geteilt)
    if (cards.length === 0) return false;

    const picked = await ctx.promptCardGallery(cards, {
      title: CARD_NAME,
      description: `Choose a level ${MAX_LEVEL} or lower Creature from your hand to place under this Hero.`,
      confirmLabel: '🪖 Fall in!',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;
    const cardName = picked.cardName;
    if ((ps.hand || []).indexOf(cardName) < 0) return false;
    const zones = targetZones(engine, seite, heroIdx, pi, cardName);   // W62a: Zonen der gewaehlten Karte
    if (zones.length === 0) return false;

    let dest = zones[0];
    if (zones.length > 1) {
      const zonePick = await ctx.promptZonePick(
        zones.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, ownerIdx: seite, owner: seite, ...(z.shared ? { shared: true, stackDepth: z.stackDepth, label: z.label } : {}) })),   // W63a: geteilte Zone (Alice) vorn, mit Kennzeichen
        {
          title: CARD_NAME,
          description: `Choose a free Support Zone for ${cardName}.`,
          cancellable: true,
          previewCardName: cardName,
        },
      );
      if (!zonePick || zonePick.cancelled
          || typeof zonePick.heroIdx !== 'number' || typeof zonePick.slotIdx !== 'number') return false;
      const match = zones.find(z => z.heroIdx === zonePick.heroIdx && z.slotIdx === zonePick.slotIdx);
      if (!match) return false;
      dest = match;
    }

    const jetzt = eligibleHandCards(engine, pi).find(c => c.name === cardName);   // Hand kann sich waehrend der Wahl geaendert haben
    if (!jetzt) return false;
    const placed = await engine.actionPlaceCreature(cardName, pi, dest.heroIdx, dest.slotIdx, {
      source: 'hand',
      sourceIdx: jetzt.handIdx,   // N3-15: genau die Kopie, deren Handstufe <= 1 ist
      sourceName: CARD_NAME,
      ...(seite !== pi ? { heldSeite: seite } : {}),   // Q74: gestohlener Sergeant -> Zone auf der Gegnerseite, Kontrolle beim Dieb
    });
    if (!placed?.inst) return false;

    engine.log('drill_sergeant_place', {
      player: ps.username, card: cardName,
      heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx,
    });
    engine.sync();
    return true;
  },
};
