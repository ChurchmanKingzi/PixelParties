// ═══════════════════════════════════════════
//  CARD EFFECT: "Criminal Monkee"
//  Creature (Normal, Lv1, 20 HP, Summoning Magic)
//
//  "When you pay exactly 4 Gold, you may pay 4 Gold an additional time
//   to immediately summon this Creature as an additional Action from
//   your hand. You can only summon 1 "Criminal Monkee" per turn this
//   way. You may once per turn pay 4 Gold to choose a "Non-Fungible
//   Monkee" from your deck and equip it to the corresponding Hero
//   without paying its Cost."
//
//  ── Zwei getrennte Effekte ──
//  (1) TRIGGER aus der HAND: haengt an `afterResourceSpend` — dem
//      Gegenstueck zum Gewinn-Hook, gefeuert NACH der Buchung. „exactly
//      4" heisst genau 4, nicht 4 oder mehr. Dann noch einmal 4 zahlen
//      und sich selbst beschwoeren. HART einmal je Zug und Spieler
//      („You can only summon 1 … per turn this way", Unterscheidung
//      v249). Die Sperre wird VOR der zweiten Zahlung gesetzt: das
//      Bezahlen feuert denselben Hook erneut, sonst liefe die Karte
//      sich selbst hinterher.
//  (2) AKTIVER Effekt im Feld: 4 Gold zahlen, „Non-Fungible Monkee" aus
//      dem Deck holen und an den **corresponding Hero** equippen — also
//      an den Helden, in dessen Support Zone dieser Monkee liegt (Als
//      Vokabelregel 8.8., gilt spielweit). Ohne Aktionskosten, wie jeder
//      aktive Effekt ohne ausdruecklichen Gegensatz (Als Regel 4.8.).
//
//  Equippen heisst hier dasselbe wie beim normalen Ausspielen: die Karte
//  in eine freie Support Zone des Helden legen und `onPlay` +
//  `onCardEnterZone` feuern (Vorbild: der Equipment-Zweig in
//  `doPlayArtifact`). „without paying its Cost" — die 8 Gold der Karte
//  entfallen, die 4 Gold des Effekts sind die Kosten.
// ═══════════════════════════════════════════

const { freeSlotOn, eligibleSummonZones } = require('./_monkee-shared');

const CARD_NAME = 'Criminal Monkee';
const NFM = 'Non-Fungible Monkee';
const PRICE = 4;
const HOPT_KEY = (pi) => `monkee-summon:${CARD_NAME}:${pi}`;
const RESOLVING = '_criminalMonkeeResolving';

/** Liegt ein "Non-Fungible Monkee" im Deck? */
function nfmImDeck(ps) {
  return (ps?.mainDeck || []).includes(NFM);
}

module.exports = {
  activeIn: ['hand', 'support'],
  creatureEffect: true,

  /**
   * Aktiver Effekt: 4 Gold, NFM im Deck, freier Platz beim eigenen
   * Helden. Die Einmal-pro-Zug-Sperre fuehrt die Engine (HOPT je
   * Instanz) — hier steht nur, was zusaetzlich erfuellt sein muss.
   */
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    if (ctx.card?.zone !== 'support') return false;
    if ((ps.gold || 0) < PRICE) return false;
    if (!nfmImDeck(ps)) return false;
    return freeSlotOn(ps, ctx.cardHeroIdx) >= 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;                 // der corresponding Hero
    if (!ps) return false;

    if ((ps.gold || 0) < PRICE) return false;
    if (!nfmImDeck(ps)) return false;
    if (freeSlotOn(ps, heroIdx) < 0) return false;

    const bestaetigt = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Pay ${PRICE} Gold to equip "${NFM}" from your deck to ${ps.heroes?.[heroIdx]?.name || 'this Hero'} for free?`,
      showCard: CARD_NAME,
      confirmLabel: `🐒 Pay ${PRICE} Gold!`,
      cancelLabel: 'No',
      cancellable: true,
      gerrymanderEligible: true,
    });
    // Abbruch laesst die Einmal-pro-Zug-Sperre ungestempelt.
    if (!bestaetigt || bestaetigt.cancelled) return false;

    const bezahlt = await engine.actionSpendGold(pi, PRICE);
    if (!bezahlt) return false;

    // Zustand nach der Zahlung neu pruefen — `afterResourceSpend` kann
    // dazwischen das Brett und das Deck veraendert haben.
    const deckIdx = (ps.mainDeck || []).indexOf(NFM);
    if (deckIdx < 0) {
      engine.log('criminal_monkee_fizzle', { player: ps.username, reason: 'no_nfm_in_deck' });
      return true;                                    // bezahlt ist bezahlt
    }
    const slot = freeSlotOn(ps, heroIdx);
    if (slot < 0) {
      engine.log('criminal_monkee_fizzle', { player: ps.username, reason: 'no_free_zone' });
      return true;
    }

    ps.mainDeck.splice(deckIdx, 1);
    engine.shuffleDeck(pi);
    engine._broadcastEvent('card_reveal', { cardName: NFM });
    await engine._delay(250);

    // Equippen = platzieren + die beiden Eintritts-Hooks feuern, genau
    // wie der Equipment-Zweig beim normalen Ausspielen.
    const platz = engine.safePlaceInSupport(NFM, pi, heroIdx, slot);
    if (!platz?.inst) {
      ps.discardPile.push(NFM);
      engine.log('criminal_monkee_fizzle', { player: ps.username, reason: 'place_refused' });
      return true;
    }
    await engine.runHooks('onPlay', {
      _onlyCard: platz.inst, playedCard: platz.inst, cardName: NFM,
      zone: 'support', heroIdx, zoneSlot: platz.actualSlot,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: platz.inst, toZone: 'support', toHeroIdx: heroIdx,
    });

    engine.log('criminal_monkee_equip', {
      player: ps.username, card: NFM,
      hero: ps.heroes?.[heroIdx]?.name, slot: platz.actualSlot, goldPaid: PRICE,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /** „When you pay exactly 4 Gold" — Beschwoerung aus der Hand. */
    afterResourceSpend: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      if (ctx.card?.zone !== 'hand') return;          // nur die Handkopie
      if (ctx.playerIdx !== pi) return;               // nur eigene Zahlung
      if (ctx.amount !== PRICE) return;               // „exactly 4"

      if (gs.hoptUsed?.[HOPT_KEY(pi)] === gs.turn) return;
      if (gs[RESOLVING]?.[pi]) return;
      if (!(ps.hand || []).includes(CARD_NAME)) return;
      if ((ps.gold || 0) < PRICE) return;
      if (eligibleSummonZones(engine, pi, CARD_NAME).length === 0) return;

      const bestaetigt = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `You paid ${PRICE} Gold. Pay ${PRICE} Gold again to summon ${CARD_NAME} from your hand as an additional Action?`,
        showCard: CARD_NAME,
        confirmLabel: `🐒 Pay ${PRICE} Gold!`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!bestaetigt || bestaetigt.cancelled) return;
      if (!(ps.hand || []).includes(CARD_NAME)) return;

      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[HOPT_KEY(pi)] = gs.turn;
      if (!gs[RESOLVING]) gs[RESOLVING] = {};
      gs[RESOLVING][pi] = true;
      try {
        const bezahlt = await engine.actionSpendGold(pi, PRICE);
        if (!bezahlt) {
          delete gs.hoptUsed[HOPT_KEY(pi)];
          return;
        }
        // Zielplatz nach der Zahlung neu bestimmen und den Spieler
        // waehlen lassen, wenn es mehrere Moeglichkeiten gibt — wie bei
        // einer normalen Beschwoerung (Als Vorgabe 8.8.). Nicht
        // abbrechbar: bestaetigt und bezahlt ist bereits verbindlich.
        const zonen = eligibleSummonZones(engine, pi, CARD_NAME);
        if (zonen.length === 0) {
          engine.log('criminal_monkee_fizzle', { player: ps.username, reason: 'no_eligible_caster' });
          return;
        }
        let ziel = zonen[0];
        if (zonen.length > 1) {
          const wahl = await ctx.promptZonePick(zonen, {
            title: CARD_NAME,
            description: `Choose where to summon ${CARD_NAME}.`,
            cancellable: false,
          });
          const gewaehlt = wahl && zonen.find(z =>
            z.heroIdx === wahl.heroIdx && z.slotIdx === (wahl.slotIdx ?? wahl.zoneSlot));
          if (gewaehlt) ziel = gewaehlt;
        }
        const i = (ps.hand || []).indexOf(CARD_NAME);
        if (i < 0) return;
        ps.hand.splice(i, 1);
        engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });

        const res = await engine.summonCreatureWithHooks(
          CARD_NAME, pi, ziel.heroIdx, ziel.slotIdx,
          { source: `${CARD_NAME} trigger` },
        );
        if (!res) {
          ps.hand.push(CARD_NAME);
          engine.log('criminal_monkee_fizzle', { player: ps.username, reason: 'place_refused' });
          return;
        }
        engine.log('criminal_monkee_summoned', {
          player: ps.username, goldPaid: PRICE, hero: ziel.heroIdx, slot: ziel.slotIdx,
        });
        engine.sync();
      } finally {
        gs[RESOLVING][pi] = false;
      }
    },
  },
};
