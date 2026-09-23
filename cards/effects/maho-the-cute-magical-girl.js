'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Maho, the Cute Magical Girl"  (v1307, neuer Text)
//  Hero — 400 HP, 40 ATK — Adventurousness / Charme — Cute
//
//  "This Hero may once per turn summon Double Creature as an additional
//   Action. Whenever this Hero summons a Creature, you may add a Double
//   Spell from your deck to your hand."
//
//  ① Heldenvertrag `grantsInherentActionForCard` (wie Baaliel): eine
//     Double Creature, die MAHO beschwoert, kostet keine Aktion — einmal
//     pro Zug, hart pro Spieler (Heldeneffekt, Als Ruling 22.9.). Die
//     Sperre setzt erst die WIRKLICH gratis erfolgte Beschwoerung.
//  ② „Whenever this Hero summons": nur, wenn Maho die Beschwoerung SELBST
//     durchfuehrt (Als Ruling 23.9.) — `onAnyActionResolved` mit
//     `actionType: 'creature'` und Mahos Platz als `heroIdx`. Kreaturen,
//     die ein Effekt nur in ihre Zonen setzt, zaehlen nicht.
//     Suche Deck → Hand: Such-Template Bauform ② (unter der Such-Sperre
//     wird nicht angeboten), Galerie als Hand-Suche gekennzeichnet.
// ═══════════════════════════════════════════
const { istDoppelKreatur, istDoppelSpell } = require('./_double-shared');
const { skipIfSearchBlocked } = require('./_search-shared');

const CARD_NAME = 'Maho, the Cute Magical Girl';
const SPERRE = (pi) => `maho-free-summon:${pi}`;

module.exports = {
  activeIn: ['hero'],

  grantsInherentActionForCard(gs, pi, heroIdx, cardData) {
    if (!istDoppelKreatur(cardData)) return false;
    return gs.hoptUsed?.[SPERRE(pi)] !== gs.turn;
  },

  hooks: {
    onAnyActionResolved: async (ctx) => {
      if (ctx.actionType !== 'creature') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      if (ctx.playerIdx !== pi || ctx.heroIdx !== ctx.cardHeroIdx) return;
      const db = engine._getCardDB();
      const hero = gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // ① Gratis-Beschwoerung verbraucht
      if (ctx.isInherent && istDoppelKreatur(db[ctx.playedCardName])) {
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[SPERRE(pi)] = gs.turn;
      }

      // ② Suche
      const ps = gs.players[pi];
      const spells = [...new Set((ps.mainDeck || []).filter(n => istDoppelSpell(db[n])))];
      if (spells.length === 0) return;
      if (skipIfSearchBlocked(engine, pi, CARD_NAME)) return;
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
        description: `${hero.name} summoned a Creature! You may add a Double Spell from your deck to your hand.`,
        cards: spells.map(name => ({ name, source: 'deck' })),
        cancellable: true, searchToHand: true, searchPile: 'deck',   // Hand-Suche (Such-Template)
      });
      const name = wahl?.cardName;
      if (!name || !spells.includes(name)) return;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      const ok = await engine.actionAddCardFromDeckToHand(pi, name, { source: CARD_NAME });
      if (ok) engine.log('double_class', { player: ps.username, card: CARD_NAME, text: `added ${name} from the deck` });
      engine.sync();
    },
  },

  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME || p?.type !== 'cardGallery') return undefined;
    const db = engine._getCardDB();
    const best = [...(p.cards || [])].sort((a, b) => (db[b.name]?.level || 0) - (db[a.name]?.level || 0))[0];
    return best ? { cardName: best.name, source: best.source } : undefined;
  },
};
