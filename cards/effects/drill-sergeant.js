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
//    liegt (`ctx.cardHeroIdx`). Zielzonen sind seine freien Support
//    Zones — Basisplaetze UND Inselzonen (Flying Island in the Sky;
//    `getFreeSupportZones` zaehlt die seit v607 mit).
//  · „level 1 or lower" liest den gedruckten Level der Handkarte;
//    nur echte Kreaturen (`isPileCreature`: keine Artifact
//    Creatures, keine Tokens).
//  · Aktiver Effekt ohne Aktionskosten (`creatureEffect`), soft once
//    per turn — die Engine stempelt `creature-effect:<id>`. Abbruch
//    in der Karten- ODER Zonenwahl kostet nichts (`return false`).
//  · Das Legen laeuft ueber `engine.actionPlaceCreature` (Quelle
//    'hand'): Instanz, `isPlacement`, Summon-Lock, Hook-Kette
//    (onPlay / onCardEnterZone) und `summon_effect`-Auftritt kommen
//    von dort — wie Deepsea Bats und Dark Gear.
// ═══════════════════════════════════════════

const { isPileCreature } = require('./_hooks');

const CARD_NAME = 'Drill Sergeant';
const MAX_LEVEL = 1;

/** Handkarten, die der Sergeant legen darf — je Name einmal, mit Anzahl. */
function eligibleHandCards(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const counts = new Map();
  for (const name of (ps?.hand || [])) {
    const cd = db[name];
    if (!cd || !isPileCreature(cd)) continue;
    if (typeof cd.level !== 'number' || cd.level > MAX_LEVEL) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, source: 'hand', count }));
}

/** Freie Support Zones (inkl. Insel) des Helden, unter dem der Sergeant liegt. */
function targetZones(engine, pi, heroIdx) {
  return engine.getFreeSupportZones(pi).filter(z => z.heroIdx === heroIdx);
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (engine.gs.players[pi]?.summonLocked) return false;
    if (eligibleHandCards(engine, pi).length === 0) return false;
    return targetZones(engine, pi, ctx.cardHeroIdx).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];

    const cards = eligibleHandCards(engine, pi);
    if (cards.length === 0) return false;
    const zones = targetZones(engine, pi, heroIdx);
    if (zones.length === 0) return false;

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

    let dest = zones[0];
    if (zones.length > 1) {
      const zonePick = await ctx.promptZonePick(
        zones.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, ownerIdx: pi })),
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

    const placed = await engine.actionPlaceCreature(cardName, pi, dest.heroIdx, dest.slotIdx, {
      source: 'hand',
      sourceName: CARD_NAME,
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
