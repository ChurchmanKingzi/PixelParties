// ═══════════════════════════════════════════
//  CARD EFFECT: "Codumbus, the Clueless Voyager"
//  Hero · 400 HP · 80 ATK · Starting Abilities: Luck, Pillage
//
//  "Once per turn, when you would draw exactly 1 card through an
//   effect, you may make your opponent declare a card type (Attack/
//   Spell/Creature, Ability, Artifact, Potion, Hero) and reveal the card
//   instead. If it's a card of the declared type, add it to your hand
//   and draw 2 additional cards. Otherwise, delete it and send the top
//   4 cards of either player's deck to the discard pile."
//
//  ── UMSETZUNG / LESARTEN ──────────────────────────────────────────
//  • Hook `beforeDrawBatch` (feuert nur bei Effekt-Zuegen, nicht beim
//    Rundeneinkommen, und nur fuer die Hauptziehung): eigener Zug,
//    `amount === 1`, Deck nicht leer. Die Ziehung wird mit
//    `setAmount(0)` ersetzt („instead"); kann sie nicht reduziert werden
//    (`cannotBeReduced`), passiert nichts und das HOPT bleibt frei.
//  • HOPT wird erst nach der Zusage gestempelt. „Draw 2 additional" ist
//    eine Ziehung von 2 und loest den Effekt daher nicht erneut aus.
//  • Deklariert wird VOR der Aufdeckung; der Gegner waehlt (bei
//    fehlender Antwort, z. B. CPU, zufaellig). Die oberste Karte wird
//    beiden gezeigt.
//  • Typgruppen wie im Kartentext (Errata: „Attack/Spell/Creature").
//    Creature schliesst „Creature/Token" ein; reine Tokens zaehlen
//    nicht. „Hero" schliesst Ascended Hero ein (wie bei Great Detective
//    Doq).
//  • Treffer: Karte aus dem Deck auf die Hand (kein Tutor/Search-Signal,
//    kein Zieh-Signal) + 2 Karten ziehen. Fehlschlag: Karte in den
//    Loeschstapel, dann waehlt DU, wessen Deck die obersten 4 Karten
//    (Mill → Ablage) verliert; ist nur ein Deck nicht leer, entfaellt die
//    Frage.
// ═══════════════════════════════════════════

const CARD_NAME = 'Codumbus, the Clueless Voyager';

const TYPE_GROUPS = [
  { id: 'action', label: '⚔️ Attack / Spell / Creature', description: 'Any Attack, Spell or Creature card.',
    match: (cd) => cd?.cardType === 'Attack' || cd?.cardType === 'Spell' || /(^|\/)Creature($|\/)/.test(cd?.cardType || '') },
  { id: 'ability', label: '✨ Ability', description: 'Any Ability card.',
    match: (cd) => cd?.cardType === 'Ability' },
  { id: 'artifact', label: '🪄 Artifact', description: 'Any Artifact card.',
    match: (cd) => cd?.cardType === 'Artifact' },
  { id: 'potion', label: '🧪 Potion', description: 'Any Potion card.',
    match: (cd) => cd?.cardType === 'Potion' },
  { id: 'hero', label: '🛡️ Hero', description: 'Any Hero or Ascended Hero card.',
    match: (cd) => cd?.cardType === 'Hero' || cd?.cardType === 'Ascended Hero' },
];

module.exports = {
  activeIn: ['hero'],

  hooks: {
    beforeDrawBatch: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps || ctx.playerIdx !== pi) return;                    // „you would draw"
      if ((ctx.deckType || 'main') !== 'main') return;
      if (ctx.amount !== 1) return;                                // „exactly 1"
      if ((ps.mainDeck || []).length === 0) return;
      if (engine.gs.hoptUsed?.[`codumbus:${pi}`] === engine.gs.turn) return;

      const ok = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: 'Make your opponent declare a card type and reveal the top card of your deck instead of drawing it?',
      });
      if (!ok) return;

      ctx.setAmount(0);                                            // „instead"
      if (ctx.amount !== 0) return;                                // nicht reduzierbar → kein Effekt
      if (!engine.claimHOPT('codumbus', pi)) return;
      await engine.showTriggeredEffect(CARD_NAME);

      const oi = engine.opponentOf(pi);
      const choice = await engine.promptGeneric(oi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: `${ps.username} reveals the top card of their deck instead of drawing. Declare its card type:`,
        options: TYPE_GROUPS.map(g => ({ id: g.id, label: g.label, description: g.description })),
        cancellable: false,
      });
      let group = TYPE_GROUPS.find(g => g.id === choice?.optionId);
      if (!group) group = TYPE_GROUPS[Math.floor(Math.random() * TYPE_GROUPS.length)];

      engine.log('codumbus_declare', {
        player: engine.gs.players[oi]?.username, declared: group.label.replace(/^\S+\s/, ''), by: CARD_NAME,
      });

      const cardName = engine.revealTop(pi, 1)[0];
      if (!cardName) return;
      engine._broadcastEvent('card_reveal', { cardName, playerIdx: pi });
      await engine._delay(1000);

      const cd = engine._getCardDB()[cardName];
      const hit = !!group.match(cd);
      engine.log('codumbus_reveal', {
        player: ps.username, card: cardName, declared: group.label.replace(/^\S+\s/, ''), hit,
      });

      if (hit) {
        const taken = await engine.takeFromPile(pi, 'deck', cardName, { source: CARD_NAME });
        if (!taken) return;
        engine._pileFlight(pi, taken.name, 'deck', 'hand',
          { toHandIdx: ps.hand.length, finalHandSize: ps.hand.length + 1 });
        await engine.handZugang(pi, taken.name, { von: 'deck', source: CARD_NAME });
        engine.sync();
        await engine.actionDrawCards(pi, 2, { source: CARD_NAME });
        return;
      }

      await engine.deleteFromPile(pi, 'deck', cardName, { source: CARD_NAME });

      const kandidaten = [pi, oi].filter(i => (engine.gs.players[i]?.mainDeck || []).length > 0);
      if (kandidaten.length === 0) return;
      let ziel = kandidaten[0];
      if (kandidaten.length > 1) {
        const w = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: CARD_NAME,
          description: 'Send the top 4 cards of whose deck to the discard pile?',
          options: [
            { id: 'own', label: '🃏 Your deck' },
            { id: 'opp', label: '🃏 Opponent\'s deck' },
          ],
          cancellable: false,
        });
        ziel = w?.optionId === 'own' ? pi : oi;
      }
      await engine.actionMillCards(ziel, 4, { source: CARD_NAME, selfInflicted: ziel === pi });
      engine.sync();
    },
  },
};
