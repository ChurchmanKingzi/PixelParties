// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — POTION-DECK-KLAUSELN DER HELDEN
//
//  Manche Helden schreiben vor, WAS im Potion Deck liegt:
//    „When this is one of your starting Heroes, your Potion Deck must
//     consist of exactly 15 <Kartenart> with different names whose total
//     levels do not exceed 15."
//  (Chaos-Diamond: Normal-/Attachment-Spells, Pinta: Creatures.)
//
//  Diese Datei ist die EINE Stelle dafuer. Sie kennt keinen Spielzustand
//  und keine Oberflaeche, nur Namen und Kartendaten, und wird von BEIDEN
//  Seiten gelesen (wie `profanity.js`):
//    Server   require('./public/potion-deck-clauses.js')
//    Browser  <script src="/potion-deck-clauses.js">  → window.PotionDeckClauses
//  Deckbau (Client `app-shared.jsx`), Pruefung beim Speichern, Seiten-
//  wechsel (`server.js`) und dessen Client-Spiegel (`app-board.jsx`)
//  fragen hier nach; keiner von ihnen nennt einen Heldennamen.
//
//  ── NEUER HELD MIT POTION-DECK-KLAUSEL ────────────────────────────
//  Eine Zeile in CLAUSES, sonst nichts:
//    hero      Kartenname des Helden
//    size      genaue Kartenzahl des Potion Decks
//    maxLevel  hoechste Summe der Level
//    distinct  jeder Name hoechstens einmal
//    accepts   welche Karten ins Potion Deck duerfen (siehe `cardFits`)
//    noun      wie der Held die Karten nennt (Fehlermeldungen)
//    nounShort Kurzform davon (Meldungen des Seitenwechsels)
//  Stehen mehrere Klauseln-Helden im Team, gilt jede davon: ein Potion
//  Deck, das ALLE erfuellt, gibt es dann nur, wenn eine Karte alle
//  `accepts` zugleich erfuellt — bei Chaos-Diamond (Spells) zusammen mit
//  Pinta (Creatures) also nie, das Team ist dann nicht spielbar.
//
//  Die Laufzeit-Haelfte (Starthero-Stempel, Zieh-Sperre fuer das Potion
//  Deck) steht im Kartenskript bzw. in `cards/effects/_potion-deck-hero-
//  shared.js`, nicht hier.
// ════════════════════════════════════════════════════════════════
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PotionDeckClauses = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  // accepts: { cardType, subtypes? }  → cardType exakt (und Subtyp aus der Liste)
  //          { anyType }              → Kartenart wie `hasCardType` der Engine:
  //                                     cardType ODER Subtyp (Artifact Creature zaehlt als Creature)
  var CLAUSES = [
    {
      hero: 'Chaos-Diamond, the Cracked Keeper',
      size: 15, maxLevel: 15, distinct: true,
      accepts: { cardType: 'Spell', subtypes: ['Normal', 'Attachment'] },
      noun: 'Normal or Attachment Spells', nounShort: 'Spells',
    },
    {
      hero: 'Pinta, the Singing Ship',
      size: 15, maxLevel: 15, distinct: true,
      accepts: { anyType: 'Creature' },
      noun: 'Creatures', nounShort: 'Creatures',
    },
  ];

  /** `hasCardType` der Engine (_hooks.js): cardType ODER Subtyp, je mit „/"-Listen. */
  function hasType(card, type) {
    if (!card || !card.cardType) return false;
    if (card.cardType === type) return true;
    if (String(card.cardType).split('/').some(function (t) { return t.trim() === type; })) return true;
    if (card.subtype && String(card.subtype).split('/').some(function (t) { return t.trim() === type; })) return true;
    return false;
  }

  /** Passt diese Karte zur `accepts`-Beschreibung einer Klausel? */
  function cardFits(clause, card) {
    if (!card) return false;
    var a = clause.accepts || {};
    if (a.anyType) return hasType(card, a.anyType);
    if (card.cardType !== a.cardType) return false;
    return !a.subtypes || a.subtypes.indexOf(card.subtype) !== -1;
  }

  function heroName(h) { return typeof h === 'string' ? h : (h && h.hero) || ''; }

  /**
   * Die Klauseln, die fuer diese Starthelden gelten.
   * @param {Array} heroes   Namen oder `{ hero }`-Eintraege (`deck.heroes`)
   * @param {Function} [sameHero]  (gespeicherterName, klauselName) → bool; Standard: gleicher
   *   Name. Der Client reicht seine Kopienfamilie durch (`sameCopyFamily`).
   */
  function activeClauses(heroes, sameHero) {
    var same = sameHero || function (a, b) { return a === b; };
    var out = [];
    for (var i = 0; i < CLAUSES.length; i++) {
      var c = CLAUSES[i];
      if ((heroes || []).some(function (h) { var n = heroName(h); return !!n && same(n, c.hero); })) out.push(c);
    }
    return out;
  }

  /** Die Klausel dieses Helden (oder null) — fuer den Seitenwechsel. */
  function clauseOfHero(name) {
    for (var i = 0; i < CLAUSES.length; i++) if (CLAUSES[i].hero === name) return CLAUSES[i];
    return null;
  }

  /** Genaue Kartenzahl; -1, wenn zwei Klauseln verschiedene Zahlen verlangen. Ohne Klausel: null. */
  function requiredSize(clauses) {
    if (!clauses || clauses.length === 0) return null;
    var n = clauses[0].size;
    return clauses.every(function (c) { return c.size === n; }) ? n : -1;
  }

  /** Niedrigste Level-Grenze aller Klauseln (Infinity ohne Klausel). */
  function maxLevel(clauses) {
    var m = Infinity;
    (clauses || []).forEach(function (c) { if (c.maxLevel < m) m = c.maxLevel; });
    return m;
  }

  /** Muss jeder Name einmalig sein? */
  function needsDistinct(clauses) {
    return (clauses || []).some(function (c) { return c.distinct; });
  }

  /** Duerfen diese Karte ins Potion Deck? Mit Klauseln: alle `accepts` zugleich; sonst nur Potions. */
  function accepts(clauses, card) {
    if (!card) return false;
    if (!clauses || clauses.length === 0) return card.cardType === 'Potion';
    return clauses.every(function (c) { return cardFits(c, card); });
  }

  /** Wie die Klauseln die erlaubten Karten nennen („Normal or Attachment Spells" / „Creatures"). */
  function nounOf(clauses) {
    return (clauses || []).map(function (c) { return c.noun; }).join(' and ');
  }
  function heroesOf(clauses) {
    return (clauses || []).map(function (c) { return c.hero; }).join(' + ');
  }

  function levelOf(card) { return card && typeof card.level === 'number' ? card.level : 0; }

  /**
   * Alle Verstoesse eines Potion Decks gegen die Klauseln (leer = in Ordnung).
   * @param {Array}    names   Kartennamen im Potion Deck
   * @param {Function} cardOf  name → Kartendaten
   * @param {Function} [keyOf] name → Schluessel fuer „gleicher Name" (Kopienfamilie)
   */
  function problems(clauses, names, cardOf, keyOf) {
    var out = [];
    if (!clauses || clauses.length === 0) return out;
    var list = names || [];
    var key = keyOf || function (n) { return n; };
    var who = heroesOf(clauses), noun = nounOf(clauses);
    var size = requiredSize(clauses);
    if (size === -1) out.push('With ' + who + ' in your team the Potion Deck would need different sizes');
    else if (list.length !== size) out.push('With ' + who + ' the Potion Deck needs exactly ' + size + ' ' + noun + ' (' + list.length + '/' + size + ')');
    if (list.some(function (n) { return !accepts(clauses, cardOf(n)); })) {
      out.push('With ' + who + ' the Potion Deck may only contain ' + noun);
    }
    if (needsDistinct(clauses) && new Set(list.map(key)).size !== list.length) {
      out.push('With ' + who + ' the Potion Deck needs ' + noun + ' with different names');
    }
    var lvl = list.reduce(function (s, n) { return s + levelOf(cardOf(n)); }, 0);
    var cap = maxLevel(clauses);
    if (lvl > cap) out.push('With ' + who + ' the total levels cannot exceed ' + cap + ' (' + lvl + '/' + cap + ')');
    return out;
  }

  /** Passt ein Potion Deck ohne Groessenforderung zu den Klauseln? (Tausch mitten im Seitenwechsel.) */
  function poolOk(clauses, names, cardOf, keyOf) {
    if (!clauses || clauses.length === 0) return true;
    var list = names || [];
    var key = keyOf || function (n) { return n; };
    if (list.some(function (n) { return !accepts(clauses, cardOf(n)); })) return false;
    if (needsDistinct(clauses) && new Set(list.map(key)).size !== list.length) return false;
    return list.reduce(function (s, n) { return s + levelOf(cardOf(n)); }, 0) <= maxLevel(clauses);
  }

  /** Taugt diese Liste als vollstaendiges Potion Deck fuer genau diese Klauseln? */
  function deckOk(clauses, names, cardOf, keyOf) {
    return problems(clauses, names, cardOf, keyOf).length === 0;
  }

  /** Ist die Kartenzahl des Potion Decks regelgerecht? (Server beim Speichern: ohne Klausel 0 oder 5–15.) */
  function sizeOk(clauses, count) {
    var size = requiredSize(clauses);
    if (size === null) return count === 0 || (count >= 5 && count <= 15);
    return size !== -1 && count === size;
  }

  // ── Seitenwechsel (Bo3/Bo5): Held mit Klausel raus oder rein ───────
  // Raus: ein Potion Deck, das nur aus Karten dieser Klausel besteht, wird
  // geleert und in `deck.potionClauseMemory[Held]` gemerkt. Rein: nur mit
  // Merkliste (der Satz begann mit einem tauglichen Potion Deck) UND leerem
  // Potion Deck; genau diese Karten kehren zurueck. Ohne Merkliste bleibt
  // Einsiden gesperrt.

  /**
   * Darf der Held `neu` ins Team? Liefert den Ablehnungsgrund oder null.
   * (Das Verlassen des Teams ist nie gesperrt, siehe `applyHeroSwap`.)
   * @param {object} deck  `{ potionDeck, potionClauseMemory? }`
   */
  function heroSwapProblem(deck, neu, cardOf) {
    var c = clauseOfHero(neu);
    if (!c) return null;
    var gemerkt = deck && deck.potionClauseMemory && deck.potionClauseMemory[c.hero];
    if (!Array.isArray(gemerkt) || !deckOk([c], gemerkt, cardOf)) {
      return c.hero + ' can only be sided in if you started the set with a suitable Potion Deck of ' + c.size + ' ' + c.nounShort + '.';
    }
    if (((deck && deck.potionDeck) || []).length > 0) {
      return 'Empty your Potion Deck first: ' + c.hero + ' brings back its ' + c.size + ' ' + c.nounShort + '.';
    }
    return null;
  }

  /** Wendet den Heldentausch `alt` → `neu` auf `deck` an (mutiert): erst raus (merken + leeren), dann rein (wiederherstellen). */
  function applyHeroSwap(deck, alt, neu, cardOf) {
    if (!deck) return;
    var cAlt = clauseOfHero(alt);
    var cNeu = clauseOfHero(neu);
    if (cAlt) {
      var pd = deck.potionDeck || [];
      if (pd.length > 0 && pd.every(function (n) { return cardFits(cAlt, cardOf(n)); })) {
        var m = deck.potionClauseMemory || {};
        m[cAlt.hero] = pd.slice();
        deck.potionClauseMemory = m;
        deck.potionDeck = [];
      }
    }
    if (cNeu) {
      var mem = deck.potionClauseMemory || {};
      deck.potionDeck = (mem[cNeu.hero] || []).slice();
      delete mem[cNeu.hero];
      deck.potionClauseMemory = mem;
    }
  }

  return {
    CLAUSES: CLAUSES,
    activeClauses: activeClauses,
    clauseOfHero: clauseOfHero,
    hasType: hasType,
    cardFits: cardFits,
    accepts: accepts,
    requiredSize: requiredSize,
    maxLevel: maxLevel,
    needsDistinct: needsDistinct,
    nounOf: nounOf,
    heroesOf: heroesOf,
    levelOf: levelOf,
    problems: problems,
    poolOk: poolOk,
    deckOk: deckOk,
    sizeOk: sizeOk,
    heroSwapProblem: heroSwapProblem,
    applyHeroSwap: applyHeroSwap,
  };
});
