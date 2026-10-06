const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// ═══════════════════════════════════════════
//  CARD EFFECT: "Monsieur Pete, the Booty Raider"
//  Hero · 450 HP · 100 ATK · Starting Abilities: Navigation, Thieving
//
//  "Whenever this Hero takes damage from an opponent's card or effect
//   or from a negative status effect inflicted by your opponent, you
//   may search your deck for any card, reveal it, and add it to your
//   hand."
//
//  ── UMSETZUNG / LESARTEN ──────────────────────────────────────────
//  • Hook `afterDamage`: Ziel ist Pete selbst (nicht irgendein Held),
//    `realDealt > 0` („takes damage" — vollstaendig verhinderter
//    Schaden loest nicht aus).
//  • Quelle 1: Karte/Effekt des Gegners (`source.controller ?? owner`).
//  • Quelle 2: Status-Ticks ohne Besitzer (Burn / Poison / Bleed) zaehlen
//    nur, wenn der Status vom Gegner stammt (`engine.statusVomGegner`,
//    erster Verursacher gilt). Selbst zugefuegte Status loesen nicht aus.
//  • Kein HOPT: „Whenever" — jeder qualifizierende Treffer, auch mehrere
//    pro Zug. Galerie ist abbrechbar („you may"); ein leeres Deck loest
//    nichts aus.
//  • Suche ohne Einschraenkung (`filter: null`), Karte wird gezeigt.
// ═══════════════════════════════════════════

const CARD_NAME = 'Monsieur Pete, the Booty Raider';

/** Ownerlose Status-Ticks → Name des Helden-Status, der sie verursacht. */
const TICK_STATUS = { Burn: 'burned', Poison: 'poisoned', Bleed: 'bleeding' };

module.exports = {
  activeIn: ['hero'],

  hooks: {
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      const ziel = ctx.target;
      if (!ps || !ziel || ziel.hp === undefined) return;          // nur Helden
      if (ziel.name !== CARD_NAME) return;                         // „this Hero"
      if (!engine.heroesControlledBy(pi).some(e => e.hero === ziel)) return;
      if (!((ctx.realDealt ?? ctx.amount) > 0)) return;            // „takes damage"

      const q = ctx.source;
      const quellSeite = q?.controller ?? q?.owner;
      let vomGegner = false;
      if (isSeat(engine, quellSeite)) {
        vomGegner = quellSeite !== pi;
      } else if (q?.name && TICK_STATUS[q.name]) {
        vomGegner = engine.statusVomGegner(ziel, TICK_STATUS[q.name], pi);
      }
      if (!vomGegner) return;

      const counts = {};
      for (const n of (ps.mainDeck || [])) counts[n] = (counts[n] || 0) + 1;
      const karten = Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));
      if (karten.length === 0) return;

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        searchToHand: true, searchPile: 'deck',
        cards: karten,
        title: CARD_NAME,
        description: `${ziel.name} took damage. Search your deck for any card, reveal it and add it to your hand?`,
        confirmLabel: '🏴‍☠️ Raid!',
        confirmClass: 'btn-success',
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.cardName) return;
      if (!(ps.mainDeck || []).includes(wahl.cardName)) return;

      await engine.showTriggeredEffect(CARD_NAME);   // Regel: aktivierter Effekt zeigt seine Karte
      await engine.actionAddCardFromDeckToHand(pi, wahl.cardName, {
        source: CARD_NAME,
        reveal: true,
        searchSpec: { label: 'card', filter: null },
      });
      engine.sync();
    },
  },
};
