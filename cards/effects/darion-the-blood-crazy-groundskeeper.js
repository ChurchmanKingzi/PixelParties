'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Darion, the Blood-Crazy Groundskeeper"
//  Hero (450 HP / 100 ATK, Startabilities Fighting + Trapping)
//
//  „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact
//   from your hand or deck and equip it to this Hero by paying half its Cost."
//
//  ── Teil 1: geteilte Equip-Zone ────────────────────────────────────
//  Das Flag `equipsShareZone` schaltet die Mechanik; sie steht in `_equip-stack-shared.js` (Stapel = ein Name je Karte + eine Instanz je Equip im selben
//  Platz). Das ist NICHT optional: das erste Equip eroeffnet den Stapel (Zonenwahl wie sonst), ab dem zweiten gibt es keine Wahl mehr
//  (`engine.equipPflichtPlatz`, gelesen von Handweg, Effekt-Ausruesten und Umhaengen). Der Effekt gilt, solange Darion lebt und nicht stummgeschaltet ist.
//
//  ── Teil 2: Ausruesten nach dem Besiegen ─────────────────────────────
//  • „Whenever this Hero defeats 1 or more targets": EIN Ausloeser je Vorgang (`onTargetsDefeated`, Kreaturen UND Helden, gesammelt je Schlag). „This Hero defeats" =
//    die Todesquelle IST Darion — Besitzer und Heldenindex stimmen, Kreaturen aus seiner Support Zone sind eigene Quellen und zaehlen nicht (Vertrag von
//    Tryse / Wanted Poster). Auch eigene Ziele zaehlen. Ein toter Darion loest nicht aus.
//  • „you may choose an equippable Artifact from your hand or deck": Equipment-Artifacts (`isEquipArtifact`), die Darion tragen kann (`canEquipToHero`,
//    Sperren, Frozen …) und deren halber Preis bezahlbar ist; Wahl per Galerie (abbrechbar = „may").
//  • „by paying half its Cost": halber Preis AUFGERUNDET (wie Lolek, the Shard Knight / Spirit of the Shattered Trident), vom wirksamen Preis. Bezahlt wird erst,
//    wenn der Platz feststeht; ein Abbruch kostet nichts. Das Equip landet im Equip-Stapel (Teil 1) und loest sein `onPlay`/`onCardEnterZone` wie jedes Ausruesten per Effekt aus.
// ═══════════════════════════════════════════

const { equipDestinations } = require('./_orchestra-shared');
const { equippableEntries, chooseAndEquip, halfCost } = require('./_lolek-shared');
const { isCreatureSource } = require('./_hooks');

const CARD_NAME = 'Darion, the Blood-Crazy Groundskeeper';

/** Ist die Todesquelle DIESER Held? (Vertrag Tryse / Wanted Poster; Kreaturen seiner Spalte sind eigene Quellen.) */
function istDieserHeld(ctx, src) {
  if (!src) return false;
  const srcOwner = src.heroOwner ?? src.controller ?? src.owner ?? -1;
  if (srcOwner !== (ctx.cardHeroOwner ?? ctx.cardOwner)) return false;
  if ((src.heroIdx ?? -1) !== ctx.cardHeroIdx) return false;
  if (isCreatureSource(ctx._engine, src)) return false;
  if (src.zone === 'support') return false;
  return true;
}

module.exports = {
  activeIn: ['hero'],

  // Teil 1: „All Artifacts equipped to this Hero share 1 Support Zone." (`_equip-stack-shared.teilenAktiv`)
  equipsShareZone: true,

  hooks: {
    onTargetsDefeated: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const feld = ctx.cardHeroOwner ?? pi;
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.attachedHero ?? gs.players[feld]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (gs.result) return;
      const defeated = ctx.defeated || [];
      if (!defeated.some(d => istDieserHeld(ctx, d.source))) return;

      const darion = { side: feld, heroIdx };
      // Equip-Artifacts aus Hand/Deck, die Darion tragen kann (Platz: sein Stapel/freie Zone) und deren halber Preis bezahlbar ist.
      const entries = equippableEntries(engine, pi, ['hand', 'deck'], (name, cd) => {
        if (!engine.canEquipCardToHero(name, feld, heroIdx, { kartenBesitzer: pi, kontrolleur: pi })) return false;
        // Platz bei Darion (sein Equip-Stapel oder eine freie Zone)
        if (!equipDestinations(engine, pi, name, { sides: [pi] }).some(d => d.side === feld && d.heroIdx === heroIdx)) return false;
        return engine.canAffordGold(pi, halfCost(cd, engine, pi), name);
      });
      if (entries.length === 0) return;

      await chooseAndEquip(engine, pi, entries, {
        title: CARD_NAME,
        source: `${CARD_NAME}:equip`,
        description: `${hero.name} defeated a target! Equip an equippable Artifact from your hand or deck to ${hero.name} by paying half its Cost.`,
        confirmLabel: '🔪 Equip!',
        costOf: (_name, cd) => halfCost(cd, engine, pi),
        nurHeld: darion,
        animationType: 'darion_equip',   // Blutspritzer + das Equip schlaegt in den Stapel (Vorlage: das Kartenbild)
      });
      engine.sync();
    },
  },

  // CPU: die Galerie (abbrechbar → die Engine-Politik lehnte sonst ab): das teuerste angebotene Equip nehmen (halber Preis = der groesste Rabatt).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery' || promptData.title !== CARD_NAME) return undefined;
    const db = engine._getCardDB();
    const liste = (promptData.cards || []).slice().sort((a, b) => (db[b.name]?.cost || 0) - (db[a.name]?.cost || 0));
    return liste.length ? { cardName: liste[0].name, source: liste[0].source } : undefined;
  },
};
