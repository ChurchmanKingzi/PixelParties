// ═══════════════════════════════════════════
//  CARD EFFECT: "Diamond, the Bulwark of Peace"
//  Ascended Hero — 600 HP / 100 ATK
//
//  „You must play this Hero from your hand on top of a \"Diamond, the
//   Keeper of Peace\" you control that has lost at least 150 HP due to
//   its own effect. Creatures you control with an original level of 0
//   do not take damage from status effects. Once per turn, when a
//   Creature you control is defeated, you may delete it to place one of
//   your deleted level 0 Creatures with a different name into the same
//   Support Zone it occupied."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Aufstieg: normaler, vom Spieler ausgeloester Aufstieg (Drag aus der
//    Hand, wie Rescued Damsel Cecilia) — „must" ist hier Wortwahl, kein
//    Zwang. Bedingung: `hero._diamondSelfLoss >= 150`, der Zaehler der
//    Basisform (HP, die sie durch ihren Schutz-Selbstschaden wirklich
//    verloren hat, ueber das ganze Spiel summiert).
//  • Die Schutz-Haelfte der Basisform hat die Bulwark-Form NICHT — nur
//    die Status-Immunitaet (Effekt 1, derselbe Code wie bei der Basis).
//  • Effekt 2: Auslöser = JEDE eigene Creature (Kontrolleur zaehlt) stirbt.
//    „delete it": der Kadaver wird aus der Ablage seines Besitzers
//    geloescht. Wurde er von einem anderen Effekt beansprucht
//    (`_deathClaim`) und liegt nicht in der Ablage, geht das nicht →
//    kein Angebot. „level 0": gedrucktes Level 0. „different name":
//    anders als die gerade geloeschte Creature. Platziert wird ueber
//    `placeFromPile` aus dem Geloescht-Stapel in genau den Platz, den
//    sie belegte; ist er wieder belegt/gesperrt → kein Angebot.
//    Einmal pro Runde und SPIELER (Heldensperre), nur gezaehlt, wenn
//    der Effekt wirklich lief. Abbruch der Wahl = „no".
//  • Aufstiegsbonus (Als Vorgabe): bis zu DREI Creatures aus Hand, Deck
//    und/oder Ablage waehlen und LOESCHEN. Je Wahl eine Galerie ueber alle
//    drei Quellen (abbrechbar = „Done"); die geloeschten Creatures speisen
//    danach Effekt 2.
// ═══════════════════════════════════════════

const { isPileCreature } = require('./_hooks');
const { heldenSperreFrei, heldenSperreSetzen } = require('./_hero-hopt-shared');

const CARD_NAME = 'Diamond, the Bulwark of Peace';
const BASIS = 'Diamond, the Keeper of Peace';
const VERLUST = 150;

/** Gedruckte Level-0-Creatures im Geloescht-Stapel, ohne `ausser`, entdoppelt (Galerie-Form). */
function kandidaten(engine, pi, ausser) {
  const db = engine._getCardDB();
  const zaehler = new Map();
  for (const n of (engine.gs.players[pi]?.deletedPile || [])) {
    if (n === ausser) continue;
    const cd = db[n];
    if (!cd || !isPileCreature(cd) || cd.level !== 0) continue;
    zaehler.set(n, (zaehler.get(n) || 0) + 1);
  }
  return [...zaehler.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'deleted', count }));
}

const BONUS_MAX = 3;

/** Alle Creatures aus Hand, Deck und Ablage, je (Quelle, Name) entdoppelt. */
function bonusKandidaten(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const out = [];
  for (const [pile, arr] of [['hand', ps.hand], ['deck', ps.mainDeck], ['discard', ps.discardPile]]) {
    if ((pile === 'deck' || pile === 'discard') && !engine.pileOutAllowed(pi, pile, { source: { name: CARD_NAME, owner: pi } })) continue;
    const zaehler = new Map();
    for (const n of arr || []) {
      if (!isPileCreature(db[n])) continue;
      zaehler.set(n, (zaehler.get(n) || 0) + 1);
    }
    for (const [name, count] of [...zaehler.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      out.push({ name, source: pile, count });
    }
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],

  cpuMeta: { dealsDamage: false },

  /** „… has lost at least 150 HP due to its own effect." */
  ascensionCondition(gs, pi, heroIdx, engine, heroOwner) {
    const hero = gs?.players?.[heroOwner ?? pi]?.heroes?.[heroIdx];
    if (!hero || hero.name !== BASIS) return false;
    return (hero._diamondSelfLoss || 0) >= VERLUST;
  },

  /** Aufstiegsbonus: bis zu 3 Creatures aus Hand/Deck/Ablage loeschen. */
  async onAscensionBonus(engine, pi, heroIdx, heroOwner) {
    const ps = engine.gs.players[pi];
    if (!ps) return;
    for (let runde = 0; runde < BONUS_MAX; runde++) {
      const karten = bonusKandidaten(engine, pi);
      if (karten.length === 0) break;
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
        description: `Ascension Bonus: choose a Creature from your hand, deck or discard pile to delete (${runde + 1}/${BONUS_MAX}).`,
        cards: karten, confirmLabel: '💎 Delete!',
        // Abbruch = „Done" („bis zu drei"); die Karte ist ohnehin schon aufgestiegen.
        cancellable: true, cancelLabel: '✔ Done',
        searchable: true, searchPlaceholder: 'Filter by name…',
      });
      if (!wahl || wahl.cancelled || !wahl.cardName) break;
      const pile = wahl.source;
      if (!karten.some(k => k.name === wahl.cardName && k.source === pile)) break;
      const ok = await engine.deleteFromPile(pi, pile, wahl.cardName, { source: CARD_NAME });
      if (!ok) break;
      engine.log('diamond_bonus_delete', { player: ps.username, card: wahl.cardName, from: pile });
    }
    engine.sync();
  },

  hooks: {
    // ── Effekt 1: Status-Schaden an Original-Level-0-Creatures → 0 ──
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const hero = ctx.attachedHero;
      // Tot wirkt nicht — AUSSER der Tod ist im laufenden Flaechenschlag
      // nur vorgemerkt (Todes-Aufschub 28.9.).
      if (!hero || (hero.hp <= 0 && !engine.heldTodAufgeschoben(hero))) return;
      for (const e of ctx.entries || []) {
        if (e.cancelled) continue;
        if ((e.inst.controller ?? e.inst.owner) !== pi) continue;
        if (!e.isStatusDamage) continue;
        if (e.originalLevel !== 0) continue;
        e.cancelled = true;
        engine.log('diamond_status_immune', { creature: e.inst.name, type: e.type, hero: hero.name });
      }
    },

    // ── Effekt 2: gefallene eigene Creature → loeschen, Level 0 nachlegen ──
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const tot = ctx.creature;
      if (!tot?.name) return;
      const hero = ctx.attachedHero;
      if (!hero || hero.hp <= 0) return;

      const pi = ctx.cardController ?? ctx.cardOwner;
      if ((tot.controller ?? tot.owner) !== pi) return;           // „you control"
      if (!heldenSperreFrei(gs, 'diamond-bulwark', pi)) return;   // einmal pro Runde

      // Der Kadaver muss in einer Ablage liegen, um geloescht zu werden.
      const besitzer = tot.originalOwner ?? tot.owner;
      if (!(gs.players[besitzer]?.discardPile || []).includes(tot.name)) return;

      // Der Platz muss frei sein: Brettseite der Zone, nicht Kontrolleur.
      const totInst = (engine.cardInstances || []).find(c => c.id === tot.instId);
      const feld = totInst ? engine.physicalSide(totInst) : tot.owner;
      const heroIdx = tot.heroIdx, slot = tot.zoneSlot;
      if (heroIdx == null || heroIdx < 0 || slot == null || slot < 0) return;
      if (engine.supportSlotBelegt(feld, heroIdx, slot)) return;
      if (engine.isSupportZoneLocked(feld, heroIdx, { source: CARD_NAME, via: 'place' })) return;

      const karten = kandidaten(engine, pi, tot.name).filter(k =>
        engine.isCreatureSummonable(k.name, feld, heroIdx, { _bypassBeforeSummon: true }));
      if (karten.length === 0) return;

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery', title: CARD_NAME, source: CARD_NAME, showCard: CARD_NAME,
        description: `${tot.name} was defeated. Delete it to place one of your deleted level 0 Creatures into the same Support Zone?`,
        cards: karten, confirmLabel: '💎 Place!', cancellable: true,
        cancelLabel: 'No',
      });
      if (!wahl || wahl.cancelled || !wahl.cardName) return;
      if (!karten.some(k => k.name === wahl.cardName)) return;

      // Nach der Frage neu pruefen.
      if (engine.supportSlotBelegt(feld, heroIdx, slot)) return;
      if (!heldenSperreFrei(gs, 'diamond-bulwark', pi)) return;
      if (!(gs.players[besitzer]?.discardPile || []).includes(tot.name)) return;

      heldenSperreSetzen(gs, 'diamond-bulwark', pi);
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // „delete it" — zuerst, dann nachlegen (die geloeschte Karte darf
      // wegen „different name" nicht selbst zurueckkommen).
      if (!(await engine.deleteFromPile(besitzer, 'discard', tot.name, { source: CARD_NAME }))) return;
      await engine.placeFromPile(pi, 'deleted', wahl.cardName, heroIdx, slot, {
        source: CARD_NAME, ...(feld !== pi ? { heldSeite: feld } : {}),
      });
      engine.sync();
    },
  },
};
