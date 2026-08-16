// ═══════════════════════════════════════════
//  CARD EFFECT: "Debt-O-Tron Model Backup Duplicator"
//  Artifact / Creature — Cost 0, 50 HP. Archetyp: Debt-O-Tron.
//
//  "You can only play this card while you have less than 0 Gold by deleting 1 card from your hand. Once per turn, when you have negative Gold after spending Gold, you may search your deck for a "Debt-O-Tron" Artifact for every 10 Gold you spent in excess of your current Gold, reveal them and add them to your hand. You can only summon 1 "Debt-O-Tron Model Backup Duplicator" per turn."
//
//  Gemeinsames Geruest in `_debt-o-tron-shared.modelBase`: spielbar nur
//  bei negativem Gold, Kosten sind 1 geloeschte Handkarte, hart einmal je Zug beschwoerbar.
//
//  ── DER AUSLOESER ─────────────────────────────────────────────
//  „when you have negative Gold after spending Gold" haengt an
//  `afterResourceSpend`. Das traegt erst seit v405/v406: davor feuerten
//  KARTENKOSTEN diesen Hook gar nicht, der Ausloeser haette also
//  ausgerechnet bei „Debt-O-Tron Damage Fees" geschwiegen — der Karte,
//  die den Archetyp ueberhaupt ins Minus bringt.
//  Die Zaehlung „for every 10 Gold you spent in excess of your current
//  Gold" macht `debtTriggerCheck` an EINER Stelle fuer alle drei
//  Modelle, nach Als Formel `Betrag − max(0, GoldVorher)`.
//
//  Der Nachschub. Gesucht werden „Debt-O-Tron"-ARTEFAKTE — das sind
//  alle sieben Karten des Archetyps ausser Kent (der ist ein Held).
//  Die Zugehoerigkeit wird ueber das `archetype`-Feld gelesen, nicht
//  ueber den Namen: „Damage Fees" heisst nicht „Model", gehoert aber
//  dazu.
// ═══════════════════════════════════════════

'use strict';

const { modelBase, debtTriggerCheck, isDebtOTron, debtChargesLeft } = require('./_debt-o-tron-shared');

const CARD_NAME = 'Debt-O-Tron Model Backup Duplicator';
// Takt, in dem die geholten Karten nacheinander auf die Hand fliegen.
// Etwas knapper als Magic Lamps 500 ms — dort sind es drei Karten mit
// Auswahlspannung, hier hoechstens zwei als Nebeneffekt einer Zahlung.
const HAND_FLUG_MS = 380;
const MAX_PER_TURN = 1;

const base = modelBase(CARD_NAME);

module.exports = {
  // Ladungsanzeige oben rechts (Als Vorgabe 16.8.): weiss, solange
  // Ladungen uebrig sind, rot bei 0. `remainingCharges` ist der
  // allgemeine Vertrag — jede Permanent-Karte mit „up to X times per
  // turn" kann ihn mit dieser einen Zeile bedienen.
  chargesPerTurn: MAX_PER_TURN,
  remainingCharges: (inst, gs) => debtChargesLeft(inst, gs, MAX_PER_TURN),
  ...base,

  hooks: {
    onPlay: async (ctx) => { await base.payHandCost(ctx); },

    afterResourceSpend: async (ctx) => {
      const treffer = debtTriggerCheck(ctx, MAX_PER_TURN, CARD_NAME);
      if (!treffer) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // ── DIE GALERIE BRAUCHT OBJEKTE, KEINE NAMEN (Als Screenshot 16.8.) ──
      // `CardGalleryMultiPrompt` liest jeden Eintrag als `entry.name`
      // und meldet die Auswahl als `cards[i].name` zurueck. Mit einer
      // Liste aus reinen STRINGS ist `entry.name` ueberall `undefined`
      // — die Galerie rendert nichts und liefert nichts zurueck, obwohl
      // die Beschreibung („Add up to 1 …") korrekt dastand. Genau das
      // war Als leere Galerie. Vorbild: Kylis `deletedPotionEntries`.
      //
      // `deckIndex` haelt zugleich Dubletten auseinander: zwei
      // „Debt-O-Tron Damage Fees" im Deck sind zwei waehlbare Eintraege.
      const cardDB = engine._getCardDB();
      const kandidaten = [];
      const deck = ps.mainDeck || [];
      for (let i = 0; i < deck.length; i++) {
        const n = deck[i];
        if (!isDebtOTron(engine, n)) continue;
        if (cardDB[n]?.cardType !== 'Artifact') continue;
        kandidaten.push({ name: n, deckIndex: i });
      }
      // Gibt es nichts zu holen, feuert der Effekt GAR NICHT — keine
      // leere Galerie (Als Vorgabe). Das HOPT ist an dieser Stelle schon
      // verbraucht; das ist gewollt, der Ausloeser hat stattgefunden.
      if (kandidaten.length === 0) return;

      const wieviele = Math.min(treffer.steps, kandidaten.length);
      if (wieviele <= 0) return;

      const gewaehlt = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        title: CARD_NAME,
        description: `You overspent by ${treffer.excess} Gold. Add up to ${wieviele} "Debt-O-Tron" Artifact${wieviele === 1 ? '' : 's'} from your deck to your hand.`,
        cards: kandidaten,
        selectCount: wieviele,
        minSelect: 1,
        confirmLabel: '🛠️ Duplicate!',
        confirmClass: 'btn-success',
        cancellable: true,
        gerrymanderEligible: true,
      });
      const namen = gewaehlt?.selectedCards || [];
      if (namen.length === 0) return;

      // Erst JETZT verbuchen — der Spieler hat zugesagt. Vorher zog
      // die Pruefung die Ladung sofort ab, ein Abbruch kostete sie
      // trotzdem (Als Report 16.8.).
      treffer.verbuche();

      // Der Client liefert nur NAMEN zurueck — Dubletten ueber eine
      // Arbeitskopie der Kandidaten abtragen (Muster aus Kyli), damit
      // zwei gleiche Namen auch zwei Karten holen.
      const offen = kandidaten.slice();
      const geholt = [];
      for (const n of namen.slice(0, wieviele)) {
        const idx = offen.findIndex(k => k.name === n);
        if (idx < 0) continue;
        geholt.push(offen[idx]);
        offen.splice(idx, 1);
      }
      if (geholt.length === 0) return;

      // Von hinten nach vorn aus dem Deck nehmen, damit die noch
      // ausstehenden `deckIndex` gueltig bleiben.
      for (const k of geholt.slice().sort((a, b) => b.deckIndex - a.deckIndex)) {
        ps.mainDeck.splice(k.deckIndex, 1);
      }
      // EINE NACH DER ANDEREN auf die Hand fliegen lassen (Als Vorgabe
      // 16.8., Vorbild Magic Lamp): Flug melden, Karte anlegen, syncen,
      // kurz warten. Alle auf einmal anzulegen liess sie schlagartig
      // erscheinen. Nach der letzten Karte KEINE Pause mehr — sonst
      // haengt der Zug am Ende grundlos nach.
      for (let i = 0; i < geholt.length; i++) {
        const k = geholt[i];
        engine._broadcastEvent('deck_search_add', { cardName: k.name, playerIdx: pi });
        ps.hand.push(k.name);
        engine._trackCard(k.name, pi, 'hand');
        engine.sync();
        if (i < geholt.length - 1) await engine._delay(HAND_FLUG_MS);
      }
      engine._broadcastEvent('card_reveal', { cardName: geholt.map(k => k.name).join(', ') });
      engine.log('debt_backup_duplicator', {
        player: ps.username, cards: geholt.map(k => k.name), excess: treffer.excess,
      });
      engine.sync();
    },
  },
};
