// ═══════════════════════════════════════════
//  CARD EFFECT: „Santa Klaus"
//  Hero — Divinity / Infiltration, 400 HP / 40 ATK
//
//  "Whenever this Hero uses an Attack or Spell, you must add 2 cards
//   from your hand to your opponent's hand."
//
//  ── ZWEI HAELFTEN ─────────────────────────────────────────────────
//  ① DER PREIS IST PFLICHT, ALSO MUSS ER ZAHLBAR SEIN.
//     ★ Al 14.9.: „He cannot act while the player has fewer than 2
//     cards in hand (not counting the card used for the Action)."
//     Das ist kein Nebensatz, sondern eine Spielbarkeits-Sperre: ohne
//     sie koennte Santa einen Zauber wirken, dessen „must"-Kosten
//     danach nicht zu bezahlen waeren.
//
//     Umgesetzt ueber `canPlayCard` — den vorhandenen Helden-Riegel in
//     `validateActionPlay`.
//
//     ★ DIE SCHWELLE HAENGT AN DER HERKUNFT (Als Befund 14.9.):
//       • VON DER HAND gespielt → die Karte liegt zum Pruefzeitpunkt
//         noch mit drin und zaehlt nicht als Reserve: DREI noetig.
//       • NICHT von der Hand (Coolness-Stack, Bifab, eine Ability-
//         Aktion wie Adventurousness) → die Hand ist unangetastet:
//         ZWEI genuegen.
//
//     Dafuer reicht `validateActionPlay` seit v1077 die Herkunft als
//     sechstes Argument durch (`{ handIndex, fromHand, fromCreation }`).
//     Eine erste Fassung hatte pauschal drei verlangt und damit die
//     Nicht-Hand-Wege um eins zu streng gesperrt.
//
//  ② DER PREIS SELBST. „whenever this Hero USES" — es zaehlt der
//     Einsatz, und zwar nur ein geglueckter: `afterSpellResolved`
//     feuert nur, wenn die Karte wirklich aufgeloest hat, ein
//     negierter Zauber kostet also nichts. Dieselbe Wahl wie bei
//     „Pharaoh, the Lone Living Being", der denselben Textbaustein
//     traegt — und der Hook deckt ausdruecklich AUCH die Sonderwege ab
//     (zusaetzliche, freie, sofortige und Ersatz-Aktionen).
//
//     Der Spieler waehlt selbst, welche zwei Karten gehen.
//     `actionTransferCardToOppHand` ist der kanonische Weg (Chatty
//     Town Guard) und traegt die Handsperren der Gegenseite mit.
// ═══════════════════════════════════════════

const CARD_NAME = 'Santa Klaus';
const PREIS = 2;

module.exports = {
  activeIn: ['hero'],

  /**
   * ★ Kann Santa diese Karte ueberhaupt spielen? (Als Ruling 14.9.)
   *
   * Nur Attacks und Spells sind betroffen — eine Kreatur zu beschwoeren
   * oder eine Ability anzulegen loest den Preis nicht aus und darf
   * deshalb auch nicht gesperrt sein.
   */
  canPlayCard(gs, pi, heroIdx, cardData, engine, herkunft) {
    const typ = cardData?.cardType;
    if (typ !== 'Attack' && typ !== 'Spell') return true;
    const ps = gs.players[pi];
    if (!ps) return true;
    // Kommt die Karte von der Hand, liegt sie zum Pruefzeitpunkt noch
    // dort und zaehlt nicht als Reserve. Ohne Herkunftsangabe (alte
    // Aufrufer) wird der Hand-Fall angenommen — das ist die sichere
    // Richtung, weil ein unbezahlbarer „must" schlimmer waere.
    const ausHand = herkunft ? !!herkunft.fromHand : true;
    return (ps.hand || []).length >= (ausHand ? PREIS + 1 : PREIS);
  },

  hooks: {
    /**
     * Santa hat einen Attack oder Spell WIRKLICH aufgeloest.
     * `casterIdx`/`heroIdx` grenzen auf ihn selbst ein — genau wie bei
     * Pharaoh, der denselben Textbaustein traegt.
     */
    afterSpellResolved: async (ctx) => {
      const pi = ctx.cardOwner;
      if (ctx.casterIdx !== pi) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      const cd = ctx.spellCardData;
      if (!cd || (cd.cardType !== 'Spell' && cd.cardType !== 'Attack')) return;

      const engine = ctx._engine;
      const ps = engine.gs.players[pi];
      const ops = engine.gs.players[pi === 0 ? 1 : 0];
      if (!ps || !ops) return;

      // „you MUST add 2 cards" — kein Ausstieg. Liegen wider Erwarten
      // weniger auf der Hand (ein Effekt hat sie waehrend der
      // Aufloesung geleert), wird gegeben, was da ist.
      for (let n = 0; n < PREIS; n++) {
        const eligibleIndices = [];
        for (let i = 0; i < (ps.hand || []).length; i++) eligibleIndices.push(i);
        if (eligibleIndices.length === 0) break;

        let handIndex = eligibleIndices[0];
        if (eligibleIndices.length > 1) {
          const wahl = await engine.promptGeneric(pi, {
            type: 'pickHandCard',
            title: CARD_NAME,
            description: `Give a card to ${ops.username} (${n + 1} of ${PREIS}).`,
            eligibleIndices,
            cancellable: false,   // „must"
          });
          if (wahl && wahl.handIndex != null) handIndex = wahl.handIndex;
        }

        const ok = await engine.actionTransferCardToOppHand(pi, handIndex, {
          source: CARD_NAME,
        });
        if (!ok) break;   // Gegenseite kann nicht annehmen (handLocked)
      }

      engine.log('santa_klaus_gift', {
        player: ps.username, to: ops.username, card: ctx.spellName || null,
      });
      engine.sync();
    },
  },

  /**
   * CPU: sie muss abgeben, hat aber die Wahl. Ohne Eintrag lehnt der
   * generische Responder ab und die Engine nimmt den ersten Platz —
   * hier ist das sogar in Ordnung, aber der Prompt ist `cancellable:
   * false`, also soll die CPU ihn bewusst beantworten.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'pickHandCard') return undefined;
    const idx = (promptData.eligibleIndices || [])[0];
    return idx == null ? undefined : { handIndex: idx };
  },
};
