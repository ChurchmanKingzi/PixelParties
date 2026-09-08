// ═══════════════════════════════════════════
//  CARD EFFECT: "Riffel, Master of the Ultimate Gun"
//  Ascended Hero — 700 HP / 90 ATK — Ascension bonus: Fighting 3
//
//  "You must play this Hero from your hand on top of a 'Future Tech
//   Gunslinger Riffel' you control that is equipped with 'Ancient Tech
//   Infinite Energy Core' and 'Future Tech Gun'. You may once per turn
//   choose a card from your deck, reveal it and add it to your hand.
//   Then, send as many copies of that card from your deck to the
//   discard pile as possible."
//
//  Aufstieg: Bedingung in `_riffel-shared.js` (Basisheld pflegt die
//  Bereitschaft), Bonus wie Arthor ueber `performAscensionBonus`.
//
//  Heldeneffekt (kein Aktionsverbrauch): Galerie ueber ALLE Deckkarten
//  (je Name ein Eintrag, stabile `source` fuers CPU-Tutor-Lernen) →
//  `actionAddCardFromDeckToHand` (zeigt die Karte dem Gegner, feuert
//  den Tutor-Hook, respektiert die Handsperre) → jede weitere Kopie
//  des Namens per `actionMillCards(targetCardNames)` in die Ablage
//  (selbst zugefuegt, Mill-Animation, Rettungs-/Umleitungs-Wege).
//  Genau das fuettert Future Tech Gun (+40 je Kopie in der Ablage).
// ═══════════════════════════════════════════

const { ASCEND_TARGET, riffelAscensionMet } = require('./_riffel-shared');

const CARD_NAME = ASCEND_TARGET;

function deckNames(ps) {
  return [...new Set(ps.mainDeck || [])].sort();
}

/** Kopien je Name im Deck — steht als Zahl auf jeder Galeriekarte (Al 30.8.). */
function copiesInDeck(ps, name) {
  let n = 0;
  for (const x of (ps.mainDeck || [])) if (x === name) n++;
  return n;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  ascensionCondition(gs, pi, heroIdx, engine) {
    return riffelAscensionMet(engine, pi, heroIdx, null);
  },

  async onAscensionBonus(engine, pi, heroIdx) {
    await engine.performAscensionBonus(pi, heroIdx, ['Fighting']);
  },

  supportYield() {
    return { drawsPerTurn: 1 };
  },

  canActivateHeroEffect(ctx) {
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    if (!ps || ps.handLocked) return false;
    return (ps.mainDeck || []).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps || ps.handLocked) return false;
    const names = deckNames(ps);
    if (names.length === 0) return false;

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      // `count` → das kleine „×N"-Badge, das auch Loyal Shepherd, Raise the
      // Minions & Co. in ihren Galerien zeigen (Al 30.8.: nicht die grosse
      // Layn-Variante).
      cards: names.map(name => ({ name, source: 'deck', count: copiesInDeck(ps, name) })),
      title: CARD_NAME,
      source: CARD_NAME,
      description: 'Choose a card from your deck. It is revealed and added to your hand; every other copy of it in your deck goes to the discard pile. The number shows how many copies are in your deck.',
      confirmLabel: '🔫 Take it!',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;
    const name = picked.cardName;
    if (!ps.mainDeck.includes(name)) return false;

    await engine.effectSourceGlow(pi, CARD_NAME);
    const ok = await engine.actionAddCardFromDeckToHand(pi, name, { source: CARD_NAME });
    if (!ok) return false;

    const rest = (ps.mainDeck || []).filter(n => n === name).length;
    if (rest > 0) {
      await engine.actionMillCards(pi, rest, {
        targetCardNames: Array(rest).fill(name), source: CARD_NAME, selfInflicted: true,
      });
    }
    engine.log('riffel_ultimate', { player: ps.username, card: name, milled: rest });
    engine.shuffleDeck(pi, 'main');
    engine.sync();
    return true;
  },
};
