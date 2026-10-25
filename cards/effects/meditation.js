// ═══════════════════════════════════════════
//  CARD EFFECT: "Meditation"
//  Spell (Normal, Lv 2, Support Magic)
//
//  „Choose any number of Spells from your discard pile, shuffle them
//   back into your deck and draw 1 card OR choose up to 2 Spells from
//   your discard pile and add them to your hand. If the user has
//   Support Magic 3, this counts as an additional Action. Delete this
//   card. You can only play 1 "Meditation" per turn."
//
//  ── BAUFORM ───────────────────────────────────────────────────────
//  ① ZWEI Wege („OR"): ① zurückmischen + 1 Karte ziehen, ② bis zu 2
//    Spells auf die Hand. Das Menü erscheint nur, wenn beide offen
//    stehen; fehlt dem zweiten Weg die Grundlage (keine Spells in der
//    Ablage, Such-Sperre, Ablage-Sperre), läuft der erste ohne Menü.
//  ② „any number" lässt auch 0 zu: der erste Weg ist dann „zieh 1
//    Karte". (Der Text nennt kein „min. 1" wie Guard Change.) „Spells"
//    sind ALLE Karten vom Typ Spell, jede Unterart (Normal, Attachment,
//    Area, Reaction); Attacks sind keine Spells.
//  ③ Mehrere Kopien derselben Karte sind erlaubt: die Galerie führt
//    eine Karte je Kopie in der Ablage (Auswahl nach Platz, nicht nach
//    Name).
//  ④ Ablauf des ersten Wegs: Karten einzeln in die Ablage-Zeile des
//    Decks fliegen lassen → EINMAL mischen → ziehen. Meldung
//    `noteShuffledBack` (Leadership-Bonus & Co.: „2 or more durch einen
//    Effekt"). Sperren: Distracting Crystal sperrt die ganze Karte
//    (`shufflesFromHandOrDiscardIntoDeck`, der Effekt „enthält" das
//    Zurückmischen); Hatusbal (`shuffleBackIntoOwnDeckBlocked`) lässt
//    nur den Weg ohne Zurückmischen offen.
//  ⑤ Zweiter Weg: Karten einzeln auf die Hand (`addCardFromDiscardToHand`,
//    Ablage-/Such-Sperren, Bamboo-Listener), danach EIN Fenster für den
//    Gegner mit ALLEN aufgenommenen Karten (`revealSearchedCards` mit
//    `together`) — wie bei einer Suche im Deck, aber nicht nacheinander.
//  ⑥ „This counts as an additional Action": `inherentAction` als
//    FUNKTION, je Held (Support Magic 3 des Wirkers).
//  ⑦ „Delete this card": die Karte geht in den Löschstapel ihres
//    Besitzers (`deleteOnUse` + `_spellPlacedOnBoard`, Muster Liberation).
//  ⑧ „only 1 per turn": harte Rundensperre je Spieler
//    (`spell-played:Meditation`), erst NACH der letzten abbrechbaren
//    Wahl gestempelt (Abbruch kostet nichts), bei Fizzle über
//    `onFizzledPlay`.
// ═══════════════════════════════════════════

// COST-DISCARD-CHANNEL: n/a — „discard pile" im Kartentext ist die QUELLE der Karten (Ablagestapel → Deck/Hand), kein Abwurf als Kosten.
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Meditation';
const HOPT_KEY = `spell-played:${CARD_NAME}`;
const MAX_TO_HAND = 2;
const SM_SCHWELLE = 3;

const heroStufe = (engine, pi, heroIdx) => engine.heroSchoolLevel('Support Magic', pi, heroIdx);

/** Spells in der Ablage — eine Galerie-Zeile je Kopie, in Ablage-Reihenfolge. */
function spellsInAblage(engine, pi) {
  const cardDB = engine._getCardDB();
  const out = [];
  (engine.gs.players[pi]?.discardPile || []).forEach((name, idx) => {
    const cd = cardDB[name];
    if (cd && hasCardType(cd, 'Spell')) out.push({ name, source: 'discard', _discardIdx: idx });
  });
  return out;
}

/** Darf der zweite Weg („auf die Hand") gerade etwas bewirken? */
function handWegOffen(engine, pi) {
  if (engine._isSearchBlocked(pi, {}, 'discard')) return false;      // Hand-Sperre / starke Such-Sperre
  if (!engine.pileOutAllowed(pi, 'discard', { sourceOwner: pi })) return false;   // Knight of Kings [B]
  if (engine.isDiscardOutHardLocked?.(pi)) return false;             // harte Stab-Sperre
  return spellsInAblage(engine, pi).length > 0;
}

/** Darf der erste Weg Karten zurückmischen? (ohne: reines „zieh 1 Karte") */
function mischWegOffen(engine, pi) {
  if (engine.shuffleBackIntoOwnDeckBlocked(pi)) return false;        // Hatusbal
  if (!engine.pileOutAllowed(pi, 'discard', { sourceOwner: pi })) return false;
  if (engine.isDiscardOutHardLocked?.(pi)) return false;
  return spellsInAblage(engine, pi).length > 0;
}

module.exports = {
  activeIn: ['hand'],

  // „Delete this card." (der Spielweg legt die Karte nicht selbst in den Löschstapel — siehe `onPlay`)
  deleteOnUse: true,

  // Mischt (im ersten Weg) aus der Ablage ins Deck zurück — Distracting Crystal und „No Retreat!" lesen die Marke.
  shufflesFromHandOrDiscardIntoDeck: true,

  cpuMeta: { castTriggersDraw: true },

  // ⑧ Fizzle (Wirker beim Auflösen handlungsunfähig): die Karte war GESPIELT → Rundensperre.
  onFizzledPlay: ({ engine, pi }) => { engine.claimHOPT(HOPT_KEY, pi); },

  // ⑧ „You can only play 1 per turn" — grau, sobald in diesem Zug schon eine gespielt wurde.
  spellPlayCondition(gs, pi) {
    return gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] !== gs.turn;
  },

  // ⑥ „If the user has Support Magic 3, this counts as an additional Action."
  inherentAction: (gs, pi, heroIdx, engine) => !!engine && heroStufe(engine, pi, heroIdx) >= SM_SCHWELLE,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Harte Rundensperre (Zweitguss/Kette): schon gespielt → nichts passiert.
      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) { gs._spellCancelled = true; return; }

      // ── Weg wählen ──
      const handOffen = handWegOffen(engine, pi);
      let weg = 'mischen';
      if (handOffen && mischWegOffen(engine, pi)) {
        const wahl = await engine.promptGeneric(pi, {
          type: 'optionPicker', title: CARD_NAME,
          description: 'Choose one of the following effects.',
          options: [
            { id: 'mischen', label: '🔄 Shuffle any number of Spells from your discard pile into your deck and draw 1 card' },
            { id: 'hand', label: `✋ Add up to ${MAX_TO_HAND} Spells from your discard pile to your hand` },
          ],
          cancellable: true,
        });
        if (!wahl || wahl.cancelled) { gs._spellCancelled = true; return; }
        weg = (wahl.optionId || wahl.id) === 'hand' ? 'hand' : 'mischen';
      } else if (handOffen) {
        weg = 'hand';
      }

      // ── Karten wählen ──
      let gewaehlt = [];
      if (weg === 'hand' || mischWegOffen(engine, pi)) {
        const galerie = spellsInAblage(engine, pi);
        const hand = weg === 'hand';
        const picked = await engine.promptGeneric(pi, {
          type: 'cardGalleryMulti',
          cards: galerie,
          selectCount: hand ? Math.min(MAX_TO_HAND, galerie.length) : galerie.length,
          minSelect: hand ? 1 : 0,
          title: CARD_NAME,
          description: hand
            ? `Choose up to ${MAX_TO_HAND} Spells from your discard pile to add to your hand.`
            : 'Choose any number of Spells from your discard pile to shuffle back into your deck — then you draw 1 card.',
          confirmLabel: hand ? '✋ Take!' : '🔄 Shuffle & Draw!',
          ...(hand ? { searchToHand: true, searchPile: 'discard' } : {}),
          cancellable: true,
        });
        if (!picked || picked.cancelled) { gs._spellCancelled = true; return; }
        gewaehlt = (picked.selectedCards || []).slice(0, hand ? MAX_TO_HAND : galerie.length);
      }

      // ── COMMIT: ab hier gibt es keinen Abbruch mehr ──
      engine.claimHOPT(HOPT_KEY, pi);

      if (weg === 'hand') {
        const genommen = [];
        for (let i = 0; i < gewaehlt.length; i++) {
          const inst = await engine.addCardFromDiscardToHand(pi, gewaehlt[i], pi, { source: CARD_NAME });
          if (!inst) break;                       // Ablage-/Such-Sperre mitten im Effekt
          genommen.push(gewaehlt[i]);
          engine.sync();
          if (i < gewaehlt.length - 1) await engine._delay(220);
        }
        if (genommen.length > 0) {
          // „openly": EIN Fenster für den Gegner mit allen aufgenommenen Karten.
          await engine.revealSearchedCards(pi, genommen, CARD_NAME, { together: true, from: 'discard' });
        }
        engine.log('meditation', { player: ps.username, mode: 'hand', cards: genommen });
      } else {
        let zurueck = 0;
        for (const name of gewaehlt) {
          // Flug VOR der Umbuchung (sonst startet er an einem Platz, den es nicht mehr gibt).
          engine._broadcastEvent('play_pile_transfer', {
            owner: pi, cardName: name, from: 'discard', to: 'deck', sfx: 'draw',
          });
          await engine._delay(180);
          const genommen = await engine.takeFromPile(pi, 'discard', name, { source: CARD_NAME });
          if (!genommen) break;
          ps.mainDeck.push(genommen.name);
          zurueck++;
        }
        if (zurueck > 0) {
          await engine._delay(220);
          engine.shuffleDeck(pi, 'main');
          await engine.noteShuffledBack(pi, zurueck, CARD_NAME);
        }
        await engine.actionDrawCards(pi, 1);
        engine.log('meditation', { player: ps.username, mode: 'shuffle', shuffled: zurueck, cards: gewaehlt.slice(0, zurueck) });
      }

      // ── „Delete this card." ──
      // Die Standard-Ablage des Spielwegs wird über `_spellPlacedOnBoard` abgeklemmt (Muster Forbidden Zone/Liberation);
      // die Karte geht in den Löschstapel ihres PERMANENTEN Besitzers (gestohlene Handkarte!).
      const handIdx = (ps.hand || []).indexOf(CARD_NAME);
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: CARD_NAME, from: 'hand', to: 'deleted',
        ...(handIdx >= 0 ? { fromHandIdx: handIdx } : {}),
      });
      gs._spellPlacedOnBoard = true;
      engine.handKartenBesitzerPs(ps, CARD_NAME).deletedPile.push(CARD_NAME);
      if (ctx.card?.id) engine._untrackCard(ctx.card.id);
      engine.sync();
    },
  },

  /** CPU: bevorzugt „zwei Spells auf die Hand" (die stärksten zuerst); mischen nie. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'optionPicker') return { optionId: 'hand' };
    if (promptData.type === 'cardGalleryMulti') {
      const db = engine._getCardDB();
      const rang = (promptData.cards || []).map((c, i) => ({ i, name: c.name, lv: db[c.name]?.level || 0 }))
        .sort((a, b) => b.lv - a.lv).slice(0, promptData.minSelect >= 1 ? promptData.selectCount : 0);
      return { selectedCards: rang.map(r => r.name), selectedIndices: rang.map(r => r.i) };
    }
    return undefined;
  },
};
