// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Ditz Monami"
//  Hero · 400 HP · 30 ATK · Starting Abilities: Charme, Support Magic
//
//  "Whenever a Hero you control takes damage from an opponent's card
//   or effect, you may place a "Cute" Creature from your hand into
//   that Hero's free Support Zone, and if you do, draw a card."
//  (Text von Al am 1.9. aktualisiert: kein „Once per turn" mehr.)
//
//  ── ALS RULINGS (1.9.), BINDEND ───────────────────────────────────
//  • PLACE, nicht summon: der getroffene Held muss NACH dem Schaden
//    nicht mehr leben und darf Frozen / Stunned / Negated sein. Die
//    Zonen kommen deshalb aus `getFreeSupportZones(pi)` OHNE
//    `livingHeroesOnly`, gefiltert auf den getroffenen Helden; und
//    `actionPlaceCreature` prueft von sich aus keinen Heldenzustand
//    (CARD_API „place vs summon"). Insel-Zonen (Flying Island) zaehlen
//    mit — der Sammler liefert sie.
//  • Keine Action, keine Level-Beschraenkung, normale Place-Regeln
//    (summonLocked, Artifact-Creature-Sperre — beides prueft
//    `actionPlaceCreature`).
//  • Kein HOPT: „Whenever" — jeder qualifizierende Treffer, auch
//    mehrere pro Zug (Mehrziel-Spell → je Held einmal).
//
//  ── UMSETZUNG ─────────────────────────────────────────────────────
//  • Hook `afterDamage`: Ziel ist ein eigener Held, `realDealt > 0`,
//    Quelle gehoert dem Gegner (`source.owner`/`controller`). Status-
//    Ticks ohne Besitzer (Burn/Poison) zaehlen NICHT als „opponent's
//    card or effect". ← LESART.
//  • „Cute" Creature: Kanon `hasCuteInName` (Wortgrenze — „Cuteness
//    Sensor" zaehlt nicht, „Cute Spider" schon).
//  • Monami selbst: lebend und nicht stummgeschaltet — das filtert
//    `runHooks` zentral.
//  • Ablauf: Galerie der Cute-Creatures (abbrechbar) → Zone (auto bei
//    genau einer, sonst Picker) → place → draw 1.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { hasCuteInName } = require('./_cute-shared');

const CARD_NAME = 'Cute Ditz Monami';

/** Cute-Creatures in der Hand, mit Anzahl (Galerie-Form wie Drill Sergeant). */
function cuteHandCards(engine, pi) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  const counts = new Map();
  for (const n of (ps?.hand || [])) {
    const cd = cardDB[n];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (!hasCuteInName(n)) continue;
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, source: 'hand', count }));
}

/** Freie Zonen GENAU des getroffenen Helden — place: ohne Lebens-/Statusfilter. */
function freieZonenDesHelden(engine, pi, heroIdx) {
  return engine.getFreeSupportZones(pi).filter(z => z.heroIdx === heroIdx);
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const ziel = ctx.target;
      if (!ziel || ziel.hp === undefined) return;                 // nur Helden
      const heroIdx = (ps?.heroes || []).indexOf(ziel);
      if (heroIdx < 0) return;                                     // eigener Held
      if (!((ctx.realDealt ?? ctx.amount) > 0)) return;            // „takes damage"
      const q = ctx.source;
      const quellSeite = q?.controller ?? q?.owner;
      if (quellSeite === undefined || quellSeite === pi) return;   // gegnerische Karte/Effekt

      const karten = cuteHandCards(engine, pi);
      if (karten.length === 0) return;
      const zonen = freieZonenDesHelden(engine, pi, heroIdx);
      if (zonen.length === 0) return;
      if (ps.summonLocked) return;                                 // normale Place-Regel

      const held = ps.heroes[heroIdx];
      const wahl = await ctx.promptCardGallery(karten, {
        title: CARD_NAME,
        description: `${held?.name || 'Your Hero'} took damage. Place a "Cute" Creature from your hand into its free Support Zone and draw a card?`,
        confirmLabel: '💕 Place!',
        confirmClass: 'btn-success',
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.cardName) return;
      const cardName = wahl.cardName;
      if ((ps.hand || []).indexOf(cardName) < 0) return;
      await engine.showTriggeredEffect(CARD_NAME);   // Regel: aktivierter Effekt zeigt seine Karte

      let dest = zonen[0];
      if (zonen.length > 1) {
        const zp = await ctx.promptZonePick(
          zonen.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, ownerIdx: pi })),
          { title: CARD_NAME, description: `Choose a free Support Zone for ${cardName}.`, cancellable: true, previewCardName: cardName },
        );
        if (!zp || zp.cancelled || typeof zp.heroIdx !== 'number' || typeof zp.slotIdx !== 'number') return;
        const m = zonen.find(z => z.heroIdx === zp.heroIdx && z.slotIdx === zp.slotIdx);
        if (!m) return;
        dest = m;
      }

      const placed = await engine.actionPlaceCreature(cardName, pi, dest.heroIdx, dest.slotIdx, {
        source: 'hand', sourceName: CARD_NAME,
      });
      if (!placed?.inst) return;

      engine.log('monami_place', {
        player: ps.username, card: cardName, hero: held?.name,
        heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx, source: q?.name,
      });
      // „and if you do, draw a card"
      await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
      engine.sync();
    },
  },
};
