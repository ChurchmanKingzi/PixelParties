'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Tamed Hell Fox"  (v831)
//  Creature — Lv1, 10 HP, Archetyp "Tamed"
//
//  "When this Creature is summoned via an effect, you may immediately
//   search your deck for up to 2 cards with different names, reveal
//   them, and add them to your hand. If you searched 2 cards, delete
//   this Creature and you cannot play them or cards with those names
//   for the rest of the turn afterwards."
//
//  • „summoned via an effect": `onPlay` mit `playedCard === self` in einer
//    Support Zone, OHNE `_isNormalSummon` (Spieler-Beschwoerung aus der
//    Hand). Platzieren durch einen Effekt (Barker) ZAEHLT (Al 8.9.).
//  • Suche: zwei Galerien nacheinander (die zweite ohne den ersten
//    Namen), jede abbrechbar = „up to 2"; Tutor ueber
//    `actionAddCardFromDeckToHand` (Reveal, Hand-Sperre, Stapel-Sperre).
//  • Zwei gesucht → Karte wird geloescht (`_redirectToDeleted` +
//    `actionDestroyCard`, sichtbarer Flug) und die beiden Namen landen in der Namenssperre
//    des Zuges `ps._creationLockedNames` (Divine-Gift-of-Creation-
//    Vertrag: validateActionPlay, Potions, Artefakte, Client-Ausgrauen;
//    faellt am Zugbeginn).
//  • Auftritt beim Ja (★-Grundregel). CPU: abbrechbare Prompts werden
//    hier beantwortet (Ja, erste Karte).
// ═══════════════════════════════════════════

// v876: Namensvergleiche ueber den BASISNAMEN (siehe CARD_API).
const { baseCardName } = require('./_hooks');
const CARD_NAME = 'Tamed Hell Fox';

function isEffectSummon(ctx) {
  return ctx.playedCard?.id === ctx.card.id && ctx.card.zone === 'support'
    && !ctx._isNormalSummon;   // v832: Platzieren (Barker) zaehlt als Effekt-Beschwoerung (Al 8.9.)
}

async function pickOne(engine, pi, deck, exclude) {
  const names = [...new Set(deck.filter(n => n !== exclude))];
  if (names.length === 0) return null;
  const res = await engine.promptGeneric(pi, {
    type: 'cardGallery', title: CARD_NAME, showCard: CARD_NAME,
    cards: names.map(n => ({ name: n, source: 'deck' })),
    description: exclude
      ? `Search a second card with a different name than "${exclude}" — or stop here.`
      : 'Search your deck for a card, reveal it and add it to your hand.',
    confirmLabel: '🦊 Search!', cancelLabel: exclude ? 'Stop (1 card)' : 'No search', cancellable: true,
  });
  if (!res || res.cancelled || !res.cardName) return null;
  return res.cardName;
}

module.exports = {
  activeIn: ['support'],

  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || payload?.title !== CARD_NAME) return undefined;
    if (payload.type === 'confirm') return true;
    if (payload.type === 'cardGallery') {
      const cards = payload.cards || [];
      return cards.length ? { cardName: cards[0].name, source: cards[0].source } : null;
    }
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (!isEffectSummon(ctx)) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const ps = gs.players[pi];
      const inst = ctx.card;
      if (!ps) return;
      if (ps.handLocked) return;
      if (!engine.pileOutAllowed(pi, 'deck', { sourceOwner: pi })) return;
      if ((ps.mainDeck || []).length === 0) return;

      const yes = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
        message: 'Tamed Hell Fox was summoned by an effect. Search your deck for up to 2 cards with different names? (2 cards: Tamed Hell Fox is deleted and you can\'t play those names this turn.)',
        confirmLabel: '🦊 Search!', cancelLabel: 'No', cancellable: true,
      });
      if (!yes) return;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      const first = await pickOne(engine, pi, ps.mainDeck || [], null);
      if (!first) return;
      if (!(await engine.actionAddCardFromDeckToHand(pi, first, { reveal: true, source: CARD_NAME, sourceOwner: pi }))) return;
      const second = await pickOne(engine, pi, ps.mainDeck || [], first);
      if (!second) { engine.log('tamed_hell_fox', { player: ps.username, searched: [first] }); engine.sync(); return; }
      if (!(await engine.actionAddCardFromDeckToHand(pi, second, { reveal: true, source: CARD_NAME, sourceOwner: pi }))) return;

      // Zwei gesucht: Namenssperre + Selbstloeschung.
      if (!ps._creationLockedNames) ps._creationLockedNames = new Set();
      ps._creationLockedNames.add(baseCardName(first)); ps._creationLockedNames.add(baseCardName(second));   // v876
      engine.log('tamed_hell_fox', { player: ps.username, searched: [first, second], locked: true, deleted: true });
      // Sichtbar vom Brett in den Geloescht-Stapel: `_redirectToDeleted` +
      // `actionDestroyCard` (Vacarn-/Remora-Vertrag) — der Flug geht
      // direkt nach `deleted` (v833, Als Report: „erscheint einfach").
      if (inst.zone === 'support') {
        inst._redirectToDeleted = true;
        await engine.actionDestroyCard({ name: CARD_NAME, owner: pi }, inst, { source: CARD_NAME });
      }
      engine.sync();
    },
  },
};
