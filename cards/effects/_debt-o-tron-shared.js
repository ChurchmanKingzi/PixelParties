// ═══════════════════════════════════════════
//  GETEILT: „Debt-O-Tron" und NEGATIVES GOLD
//
//  Die einzige Auslegungsstelle fuer den Archetyp. Bis v406 konnte
//  Gold engineweit nicht unter 0 fallen (jeder Abzug klemmte, jedes
//  Bezahlbarkeits-Gate verglich gegen den Kontostand). Dieser Archetyp
//  dreht das um — aber nur unter Bedingungen, und die stehen hier.
//
//  ── WER DARF INS MINUS ────────────────────────────────────────
//  Zwei Wege, mehr nicht:
//
//   1. „Kent, the Indebted Apprentice" — „If you spend Gold on a card
//      or effect while you have 0 or more Gold, you may spend up to 20
//      Gold more than you own, going into negative Gold."
//      → Kreditrahmen KENT_OVERDRAFT, aber NUR solange das Gold noch
//        >= 0 ist. Wer schon im Minus steht, kann ueber Kent nicht
//        weiter ins Minus (Als Bestaetigung 16.8.: der Rahmen gilt
//        PRO ZAHLUNG, nicht pro Zug — dank der >= 0-Bedingung kommt
//        man ohnehin nur einmal je Solvenz-Phase dazu).
//
//   2. „Debt-O-Tron Damage Fees" — „You may play this Artifact while
//      you don't have enough Gold to pay for it (even while your Gold
//      is negative)."
//      → gilt NUR fuer diese eine Karte, dafuer ohne Obergrenze und
//        auch aus dem Minus heraus. Vertrag: `selfGoldOverdraft`.
//
//  ── DER MESSWERT „spent in excess of your current Gold" ───────
//  Drei Modelle skalieren daran. Als Ruling 16.8. (bestaetigt):
//      Ueberziehung = Betrag − max(0, Gold VOR der Zahlung)
//  Also der Teil der Zahlung, den vorhandenes Gold nicht gedeckt hat.
//    · 5 Gold, 25 bezahlt  → 20  (zwei Zehnerschritte)
//    · −5 Gold, 10 bezahlt → 10  (ein Zehnerschritt)
//  Bei Start >= 0 ist das genau der resultierende Minusbetrag.
//
//  ── WAS NEGATIVES GOLD SONST BERUEHRT ─────────────────────────
//  · `actionGainGold` addiert ohne Klemme — Rundeneinkommen tilgt
//    Schulden von selbst. Nichts zu tun.
//  · Logans „If you ever have 0 Gold" greift bei EXAKT 0 (Als Ruling
//    16.8.). Ein Sprung von +5 auf −5 raeumt seine Counter NICHT ab —
//    ausdruecklich gewollt, das macht ein Debt-O-Tron-Logan-Deck
//    moeglich. Sein Einzahl-Effekt bleibt bei <= 0 gesperrt (seine
//    `canActivateHeroEffect` verlangt `gold > 0`), er kann also nicht
//    aus dem Minus heraus investieren.
//  · Golddiebstahl nimmt weiterhin nur, was da ist: bei negativem Gold
//    gibt es nichts zu holen (`actionStealGold` klemmt selbst).
// ═══════════════════════════════════════════

'use strict';

const { usesLeft, spendUse, charges } = require('./_charges');
// Schluessel des gemeinsamen Rundenzaehlers fuer alle Debt-O-Tron-Modelle.
const DEBT_USE_KEY = 'debtTrig';

/** Kents Kreditrahmen je Zahlung. */
const KENT_OVERDRAFT = 20;
const KENT = 'Kent, the Indebted Apprentice';
const ARCHETYPE = 'Debt-O-Tron';

/** Was ein Modell kostet, statt Gold: eine Handkarte loeschen. */
const MODEL_HAND_COST = 1;

/** Schrittweite der „for every 10 Gold"-Klauseln. */
const EXCESS_STEP = 10;

/** Schuldenstand als POSITIVE Zahl (0, wenn nicht im Minus). */
function debt(ps) {
  return Math.max(0, -(ps?.gold || 0));
}

/** Steht dieser Spieler im Minus? */
function isInDebt(ps) {
  return (ps?.gold || 0) < 0;
}

/**
 * „spent in excess of your current Gold" — Als Ruling.
 * @param {number} amountPaid  was tatsaechlich abgebucht wurde
 * @param {number} goldBefore  Kontostand VOR der Zahlung
 */
function excessSpent(amountPaid, goldBefore) {
  return Math.max(0, (amountPaid || 0) - Math.max(0, goldBefore || 0));
}

/** Wie viele Zehnerschritte hat diese Zahlung ueberzogen? */
function excessSteps(amountPaid, goldBefore) {
  return Math.floor(excessSpent(amountPaid, goldBefore) / EXCESS_STEP);
}

/** Gehoert die Karte zum Archetyp? Ueber das archetype-Feld, nicht ueber Namen. */
function isDebtOTron(engine, cardName) {
  const cd = engine?._getCardDB?.()[cardName];
  return !!cd && cd.archetype === ARCHETYPE;
}

/** Lebt ein Kent auf dieser Seite? */
function hasLivingKent(engine, pi) {
  const heroes = engine?.gs?.players?.[pi]?.heroes || [];
  return heroes.some(h => h?.name === KENT && h.hp > 0);
}

/**
 * Gemeinsames Gate der fuenf Modelle: „You can only play this card
 * while you have less than 0 Gold by deleting 1 card from your hand."
 * Zwei Bedingungen — im Minus stehen UND eine loeschbare Handkarte
 * haben. Die Karte selbst zaehlt nicht als ihre eigenen Kosten.
 */
function canPlayModel(engine, pi, selfCardName) {
  const ps = engine?.gs?.players?.[pi];
  if (!ps || !isInDebt(ps)) return false;
  const hand = ps.hand || [];
  // Eine ANDERE Karte muss uebrig bleiben, die geloescht werden kann.
  const idx = hand.indexOf(selfCardName);
  const uebrig = idx >= 0 ? hand.length - 1 : hand.length;
  return uebrig >= MODEL_HAND_COST;
}

/**
 * Handkarten, die als Kosten geloescht werden duerfen — alles ausser
 * der Karte, die gerade gespielt wird.
 * @returns {number[]} Handindizes
 */
function deletableHandIndices(ps, selfCardName, resolvingIdx) {
  const out = [];
  const hand = ps?.hand || [];
  let selbstUebersprungen = false;
  for (let i = 0; i < hand.length; i++) {
    if (resolvingIdx != null) {
      if (i === resolvingIdx) continue;
    } else if (!selbstUebersprungen && hand[i] === selfCardName) {
      selbstUebersprungen = true;   // nur EINE eigene Kopie ausnehmen
      continue;
    }
    out.push(i);
  }
  return out;
}

/**
 * Der GEMEINSAME BAUKASTEN der fuenf „Model"-Karten.
 *
 * Alle fuenf teilen woertlich zwei Klauseln:
 *   · „You can only play this card while you have less than 0 Gold by
 *     deleting 1 card from your hand."
 *   · „You can only summon 1 '<Name>' per turn." (vier von fuenf;
 *     „Scrap Plow" hat stattdessen „only control 1 at a time")
 *
 * `modelBase(cardName, opts)` liefert genau diese zwei Klauseln als
 * fertiges Modul-Fragment; jede Karte legt nur noch ihren eigenen
 * Effekt daneben. So steht das Gate an EINER Stelle statt fuenfmal.
 *
 * @param {string} cardName
 * @param {object} [opts]
 * @param {boolean} [opts.oncePerTurn=true]  harte Beschwoerungssperre
 * @param {boolean} [opts.onlyOneAtATime=false] „only control 1 at a time"
 */
function modelBase(cardName, opts = {}) {
  const oncePerTurn = opts.oncePerTurn !== false;
  const hoptKey = (pi) => `debt-model-summon:${cardName}:${pi}`;

  return {
    activeIn: ['support'],

    /**
     * Spielbarkeits-Gate. Wird von der Engine beim Auflisten der Hand
     * gefragt UND (seit 16.8.) vom Artefakt-Pfad des Servers — vorher
     * war der Vertrag fuer Artefakte reine Anzeige.
     */
    canPlayWithHero(gs, playerIdx, heroIdx, cardData, engine) {
      const ps = gs.players[playerIdx];
      if (!ps) return false;
      if (!isInDebt(ps)) return false;                    // „less than 0 Gold"
      if (deletableHandIndices(ps, cardName).length < MODEL_HAND_COST) return false;
      if (oncePerTurn && gs.hoptUsed?.[hoptKey(playerIdx)] === gs.turn) return false;
      if (opts.onlyOneAtATime && engine) {
        const schonDa = (engine.cardInstances || []).some(
          i => i.name === cardName && i.owner === playerIdx && i.zone === 'support');
        if (schonDa) return false;
      }
      return true;
    },

    /**
     * Die Kosten: eine Handkarte loeschen. Laeuft ueber die
     * Engine-Abfrage `actionPromptForceDiscard(..., deleteMode: true)`,
     * dieselbe, die auch Item Lock benutzt — damit sieht der Spieler
     * die gewohnte Auswahl und der Loeschstapel bucht korrekt.
     *
     * Rueckgabe: false, wenn die Kosten nicht bezahlt werden konnten.
     */
    async payHandCost(ctx) {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return false;
      if (oncePerTurn) {
        if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
        engine.gs.hoptUsed[hoptKey(pi)] = engine.gs.turn;
      }
      if ((ps.hand || []).length === 0) return false;
      await engine.actionPromptForceDiscard(pi, MODEL_HAND_COST, {
        title: cardName,
        description: `${cardName} costs 1 card from your hand.`,
        source: cardName, deleteMode: true, selfInflicted: true,
      });
      engine.sync();
      return true;
    },

    /** Fuer Tests und Diagnose. */
    _hoptKey: hoptKey,
  };
}

/**
 * Gemeinsamer Ausloeser der drei „when you have negative Gold after
 * spending Gold"-Modelle.
 *
 * Haengt an `afterResourceSpend` — und das ist erst seit v405/v406
 * tragfaehig: davor feuerten Kartenkosten diesen Hook gar nicht, der
 * Ausloeser haette also ausgerechnet bei „Damage Fees" geschwiegen.
 *
 * @param {object} ctx        der Hook-Kontext
 * @param {number} maxPerTurn wie oft je Zug (1 oder 3)
 * @param {string} cardName
 * @returns {{steps:number, excess:number}|null} null = kein Ausloeser
 */
function debtTriggerCheck(ctx, maxPerTurn, cardName) {
  const engine = ctx._engine;
  const gs = engine?.gs;
  const pi = ctx.cardOwner;
  const ps = gs?.players?.[pi];
  if (!ps) return null;
  if (ctx.playerIdx !== pi) return null;          // nur eigene Zahlungen
  if (ctx.card?.zone !== 'support') return null;  // nur vom Brett
  if (!isInDebt(ps)) return null;                 // „when you have negative Gold"

  // `ctx.amount` ist der TATSAECHLICH gezahlte Betrag (v405). Der
  // Kontostand VORHER ergibt sich daraus rueckwaerts — der Hook feuert
  // nach der Buchung.
  const amount = ctx.amount || 0;
  const goldBefore = (ps.gold || 0) + amount;
  const steps = excessSteps(amount, goldBefore);
  if (steps <= 0) return null;

  // ── NUR PRUEFEN, NICHT VERBUCHEN (Als Report 16.8.) ────────────────
  // Hier wurde die Ladung frueher SOFORT abgezogen — noch bevor das
  // Modell seinen Prompt zeigte. Bricht der Spieler ab, war die Ladung
  // trotzdem weg. Al hat es an Money Printer gesehen; es betraf alle
  // drei Modelle, weil sie durch dieselbe Pruefung laufen.
  //
  // Jetzt liefert die Pruefung nur die Erlaubnis und ein `verbuche()`
  // dazu. Jedes Modell ruft das ERST, wenn der Spieler zugesagt hat.
  // Bewusst als Funktion am Ergebnis und nicht als zweiter Export:
  // so kann kein Modell die Verbuchung in einem anderen Zaehler oder
  // mit einem anderen Maximum vornehmen, als die Pruefung sie freigab.
  if (usesLeft(ctx.card, gs, { key: DEBT_USE_KEY, max: maxPerTurn }) <= 0) return null;

  return {
    steps,
    excess: excessSpent(amount, goldBefore),
    verbuche: () => spendUse(ctx.card, gs, { key: DEBT_USE_KEY, max: maxPerTurn }),
  };
}

/**
 * Verbleibende Ladungen dieser Instanz in DIESER Runde.
 *
 * Liest denselben Zaehler, den `debtTriggerCheck` fuehrt — ohne ihn zu
 * veraendern. Ist der Rundenstempel alt, sind alle Ladungen wieder da
 * (der Zaehler wird erst beim naechsten echten Ausloesen zurueckgesetzt,
 * die Anzeige darf darauf nicht warten).
 *
 * Erfuellt den Vertrag `remainingCharges(inst, gs)` der Engine, der die
 * Zahl oben rechts auf der Karte anzeigt (Als Vorgabe 16.8.).
 */
function debtChargesLeft(inst, gs, maxPerTurn) {
  return charges(inst, gs, { key: DEBT_USE_KEY, max: maxPerTurn });
}

module.exports = {
  KENT, KENT_OVERDRAFT, ARCHETYPE, EXCESS_STEP, MODEL_HAND_COST,
  debtChargesLeft,
  debt, isInDebt, excessSpent, excessSteps,
  isDebtOTron, hasLivingKent, canPlayModel, deletableHandIndices,
  modelBase, debtTriggerCheck,
};
