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

const { freeSlotOn, eligibleSummonZones,
  investHoptUsed, markInvestHopt, payInvestCounters, heroesWithInvest,
} = require('./_monkee-shared');

const CARD_NAME = 'Criminal Monkee';
const { heroCanBeEquipped } = require('./_hooks');

const NFM = 'Non-Fungible Monkee';
const PRICE = 4;          // Gold — nur fuer den Beschwoerungs-Trigger
const INVEST_COST = 4;    // Invest Counter — Kosten der 2. Faehigkeit (v343)
const HOPT_KEY = (pi) => `monkee-summon:${CARD_NAME}:${pi}`;
const RESOLVING = '_criminalMonkeeResolving';

/** Liegt ein "Non-Fungible Monkee" im Deck? */
function nfmImDeck(ps) {
  return (ps?.mainDeck || []).includes(NFM);
}

/**
 * Darf an den corresponding Hero ausgeruestet werden?
 * (v338, praezisiert v340/v341 nach Als Rulings)
 *
 * „Corresponding Hero" ist der Held, in dessen Support Zone die Karte
 * liegt (Spielvokabular).
 *
 * DIE REGEL DAHINTER ist nicht „Kreaturen brauchen einen lebenden
 * Wirt" — Kreatur-Effekte funktionieren bei totem Wirt ausdruecklich
 * weiter („Creatures are independent of their slot's Hero", server.js).
 * Massgeblich ist vielmehr: **an einen toten Helden kann nichts
 * ausgeruestet werden.** Der normale Artefakt-Weg setzt das laengst
 * durch (server.js `doPlayArtifact`: `if (isEquip) { if (hero.hp <= 0)
 * return false; … }`, direkt neben den Frozen- und Charmed-Sperren).
 *
 * Criminal Monkee ist die AUSNAHME, die diesen Weg umgeht: sie holt
 * „Non-Fungible Monkee" aus dem Deck und setzt es per
 * `safePlaceInSupport` direkt, also an der Pruefung vorbei. Deshalb
 * muss die Karte sie selbst nachziehen.
 *
 * v341: Und zwar VOLLSTAENDIG. Meine erste Fassung prueft nur auf tot —
 * Al: „Frozen Heroes duerfen ja nicht equipped werden." Richtig, und
 * bezaubert ebenfalls nicht. Deshalb liegt die Regel jetzt in
 * `_hooks.heroCanBeEquipped` und wird hier nur noch gelesen.
 */
function wirtKannAusgeruestetWerden(ps, heroIdx) {
  return heroCanBeEquipped(ps?.heroes?.[heroIdx]);
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
    // Toter corresponding Hero → kein Effekt: an einen toten Helden
    // kann nichts ausgeruestet werden (siehe `istWirtAmLeben`).
    if (!wirtKannAusgeruestetWerden(ps, ctx.cardHeroIdx)) return false;
    // v343 (Als Auftrag): die zweite Faehigkeit kostet 4 INVEST COUNTER
    // statt 4 Gold. Der Beschwoerungs-Trigger unten bleibt bei Gold.
    if (investHoptUsed(engine.gs, ctx.card)) return false;
    if (heroesWithInvest(ps, INVEST_COST).length === 0) return false;
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

    // Zweite Sperre am Ausfuehrungsweg: `canActivateCreatureEffect` ist
    // nur das Angebot, ein manipulierter Client koennte die Aktivierung
    // trotzdem schicken.
    if (!wirtKannAusgeruestetWerden(ps, heroIdx)) return false;
    if (investHoptUsed(gs, ctx.card)) return false;
    if (heroesWithInvest(ps, INVEST_COST).length === 0) return false;
    if (!nfmImDeck(ps)) return false;
    if (freeSlotOn(ps, heroIdx) < 0) return false;

    const bestaetigt = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Remove ${INVEST_COST} Invest Counters from a Hero you control to equip "${NFM}" from your deck to ${ps.heroes?.[heroIdx]?.name || 'this Hero'} for free?`,
      showCard: CARD_NAME,
      confirmLabel: `🐒 Remove ${INVEST_COST} Invest Counters!`,
      cancelLabel: 'No',
      cancellable: true,
      gerrymanderEligible: true,
    });
    // Abbruch laesst die Einmal-pro-Zug-Sperre ungestempelt.
    if (!bestaetigt || bestaetigt.cancelled) return false;

    const bezahlt = await payInvestCounters(engine, pi, INVEST_COST, CARD_NAME);
    if (bezahlt) markInvestHopt(gs, ctx.card);
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
      hero: ps.heroes?.[heroIdx]?.name, slot: platz.actualSlot, investPaid: INVEST_COST,
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
