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
//  Klausel-Helden schliessen einander aus, wenn kein Potion Deck beide
//  zugleich erfuellen kann (keine Karte erfuellt beide `accepts`): das Potion
//  Deck kann nur auf EINEN von ihnen zugeschnitten sein. Chaos-Diamond (Spells)
//  und Pinta (Creatures) gehen darum nie ins selbe Team — `compatible` /
//  `conflictProblem` rechnen das aus der Tabelle, kein Heldenpaar ist
//  fest verdrahtet.
//
//  Die Laufzeit-Haelfte (Starthero-Stempel, Zieh-Sperre fuer das Potion
//  Deck) steht im Kartenskript bzw. in `cards/effects/_potion-deck-hero-
//  shared.js`, nicht hier.
//
//  ── ERLAUBNISSE (laxe Klauseln) — Kerthwack ───────────────────────
//  Neben den STRENGEN Klauseln (Chaos-Diamond, Pinta: das Potion Deck MUSS aus
//  genau diesen Karten bestehen) gibt es ERLAUBNISSE:
//    „When this is one of your starting Heroes, your Potion Deck may contain
//     any card, but only up to 2 copies of each card. Copies of cards played in
//     your Potion Deck, except Potions, do not count towards the number of
//     copies of those cards in your deck."   (Kerthwack, the Reality Breaker)
//  Eine Erlaubnis VERBIETET nichts: Potions duerfen weiter ins Potion Deck, es
//  kommen nur andere Karten dazu (Tabelle PERMISSIONS, je Zeile `hero`, `accepts`,
//  `maxCopies`, `exemptsDeckCount`). Sie schreibt auch keine Kartenzahl vor — es
//  bleibt bei 0 oder 5–15.
//    • Mit einer STRENGEN Klausel im Team gilt allein die strenge: ihre Auswahl
//      (Kartenart, je Name 1x, Level-Grenze, genau 15) ueberschreibt die laxere,
//      und die Erlaubnis schliesst den Klausel-Helden nicht aus (nur strenge
//      Klauseln schliessen einander aus — `compatible` kennt Erlaubnisse nicht).
//    • Was die Erlaubnis ZUSAETZLICH tut, gilt immer, solange der Held im Team
//      steht: Kopien im Potion Deck zaehlen — ausser Potions — nicht zu den
//      Kopien dieser Karten im Deck (`potionCopyCounts`). Auch Karten einer
//      strengen Klausel tragen damit nicht zu den Main-Deck-Grenzen bei.
//    • Potions zaehlen immer mit: mit Nicolas im Team gilt weiter „hoechstens 15
//      Potions und 2 Kopien je Potion ueber Main und Potion Deck zusammen".
//  Neuer Held mit so einem Text? Eine Zeile in PERMISSIONS.
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

  // ERLAUBNISSE (laxe Klauseln): erweitern, was ins Potion Deck darf, ohne etwas zu verbieten.
  //   accepts          { any: true } = jede Karte (zusaetzlich zu Potions), sonst wie bei CLAUSES
  //   maxCopies        je Name hoechstens so oft im Potion Deck (Karten, die NUR dank der Erlaubnis dort liegen)
  //   exemptsDeckCount diese Kopien (ausser Potions) zaehlen nicht zu den Kopien im Deck
  var PERMISSIONS = [
    {
      hero: 'Kerthwack, the Reality Breaker',
      accepts: { any: true },
      maxCopies: 2,
      exemptsDeckCount: true,
      noun: 'any card',
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
  function activeOf(table, heroes, sameHero) {
    var same = sameHero || function (a, b) { return a === b; };
    var out = [];
    for (var i = 0; i < table.length; i++) {
      var c = table[i];
      if ((heroes || []).some(function (h) { var n = heroName(h); return !!n && same(n, c.hero); })) out.push(c);
    }
    return out;
  }
  function activeClauses(heroes, sameHero) {
    return activeOf(CLAUSES, heroes, sameHero);
  }

  /** Die Erlaubnisse (Kerthwack), die fuer diese Starthelden gelten — Argumente wie `activeClauses`. */
  function activePermissions(heroes, sameHero) {
    return activeOf(PERMISSIONS, heroes, sameHero);
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

  /** Passt diese Karte zu einer Erlaubnis? (`{ any: true }` = jede Karte.) */
  function permissionFits(p, card) {
    var a = p.accepts || {};
    return a.any ? !!card : cardFits(p, card);
  }

  /**
   * Duerfen diese Karte ins Potion Deck? Mit strengen Klauseln: alle `accepts` zugleich (die strenge Auswahl
   * ueberschreibt jede Erlaubnis); sonst Potions UND, was eine Erlaubnis (`permissions`, optional) zusaetzlich freigibt.
   */
  function accepts(clauses, card, permissions) {
    if (!card) return false;
    if (!clauses || clauses.length === 0) {
      if (card.cardType === 'Potion') return true;
      return (permissions || []).some(function (p) { return permissionFits(p, card); });
    }
    return clauses.every(function (c) { return cardFits(c, card); });
  }

  /**
   * Zaehlt diese Kopie im Potion Deck zu den Kopien der Karte im Deck? Mit einer Erlaubnis, die es ausnimmt (Kerthwack):
   * nur Potions zaehlen mit. Gilt auch fuer Karten einer strengen Klausel. Unbekannte Karte: zaehlt.
   */
  function potionCopyCounts(permissions, card) {
    if (!card) return true;
    var frei = (permissions || []).some(function (p) { return p.exemptsDeckCount; });
    return !frei || card.cardType === 'Potion';
  }

  /** Hoechstzahl je Name im Potion Deck fuer Karten, die nur dank einer Erlaubnis dort liegen (Potions ausgenommen). */
  function copyCap(permissions) {
    var m = 0;
    (permissions || []).forEach(function (p) { if (p.maxCopies > m) m = p.maxCopies; });
    return m;
  }

  /**
   * Verstoesse eines Potion Decks gegen die Erlaubnisse (leer = in Ordnung): Karten, die nur dank der Erlaubnis dort
   * liegen (also keine Potions), hoechstens `copyCap` je Name. Mit strenger Klausel nichts zu pruefen (dort gilt „je Name 1x").
   */
  function permissionProblems(clauses, permissions, names, cardOf, keyOf) {
    var out = [];
    if (!permissions || permissions.length === 0 || (clauses && clauses.length > 0)) return out;
    var key = keyOf || function (n) { return n; };
    var cap = copyCap(permissions);
    var n = {};
    (names || []).forEach(function (nm) {
      var c = cardOf(nm);
      if (c && c.cardType === 'Potion') return;
      var k = key(nm);
      n[k] = (n[k] || 0) + 1;
    });
    Object.keys(n).forEach(function (k) {
      if (n[k] > cap) out.push('With ' + heroesOf(permissions) + ' the Potion Deck may contain at most ' + cap + ' copies of each card (' + k + ' x' + n[k] + ')');
    });
    return out;
  }

  /** Haelt ein Potion Deck die Erlaubnis-Grenze je Name? (Tausch/Verschieben im Seitenwechsel.) */
  function permissionPoolOk(clauses, permissions, names, cardOf, keyOf) {
    return permissionProblems(clauses, permissions, names, cardOf, keyOf).length === 0;
  }

  // ── Vertraeglichkeit ──────────────────────────────────────────────
  // Das Potion Deck kann nur auf EINE Klausel zugeschnitten sein. Zwei Klausel-
  // Helden vertragen sich nur, wenn mindestens eine Karte beide `accepts`
  // erfuellt (und beide dieselbe Kartenzahl verlangen) — Chaos-Diamond (Spells)
  // und Pinta (Creatures) schliessen einander darum aus. Das Ergebnis haengt nur
  // von der Tabelle und dem (festen) Kartenbestand ab, nicht vom Deck: je Kartenbestand
  // und Klausel-Menge einmal gerechnet.
  var compatCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  /**
   * Gibt es ein Potion Deck, das ALLE diese Klauseln zugleich erfuellen koennte?
   * @param {object} db  Kartenbestand `{ name: Kartendaten }`
   */
  function compatible(clauses, db) {
    if (!clauses || clauses.length < 2) return true;
    if (requiredSize(clauses) === -1) return false;
    var key = clauses.map(function (c) { return c.hero; }).sort().join('|');
    var perDb = compatCache && db && typeof db === 'object' ? (compatCache.get(db) || compatCache.set(db, {}).get(db)) : null;
    if (perDb && key in perDb) return perDb[key];
    var names = Object.keys(db || {});
    var ok = names.some(function (n) { return accepts(clauses, db[n]); });
    if (perDb) perDb[key] = ok;
    return ok;
  }

  /** Ablehnungsgrund, wenn sich die Klausel-Helden gegenseitig ausschliessen; sonst null. */
  function conflictProblem(clauses, db) {
    if (compatible(clauses, db)) return null;
    return heroesOf(clauses).split(' + ').join(' and ') + ' exclude each other: the Potion Deck can only be tailored to one of them.';
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

  /** Die Erlaubnis dieses Helden (oder null). */
  function permissionOfHero(name) {
    for (var i = 0; i < PERMISSIONS.length; i++) if (PERMISSIONS[i].hero === name) return PERMISSIONS[i];
    return null;
  }

  /**
   * Seitenwechsel: Darf der Held `alt` (raus) gegen `neu` (rein) getauscht werden, ohne dass das Potion Deck unzulaessig wird?
   * Verlaesst ein Held mit Erlaubnis (Kerthwack) das Team, duerfen im Potion Deck nur noch Karten liegen, die dann noch
   * hineindurfen (ohne strenge Klausel: Potions, mit einer anderen Erlaubnis deren Karten) — der Spieler muss die uebrigen
   * zuerst herausnehmen, wie bei Nicolas und den Potions im Main Deck. Strenge Klausel-Helden regeln ihr Potion Deck selbst
   * (`heroSwapProblem` / `applyHeroSwap`). Liefert den Ablehnungsgrund oder null.
   * @param {Array} heroesAfter  Starthelden NACH dem Tausch (Namen oder `{ hero }`)
   */
  function swapPotionDeckProblem(deck, alt, neu, heroesAfter, cardOf, keyOf) {
    if (!alt || !permissionOfHero(alt)) return null;
    if (activeClauses(heroesAfter).length > 0) return null;     // mit strenger Klausel gilt deren eigene Regel
    var probe = { potionDeck: ((deck && deck.potionDeck) || []).slice(), potionClauseMemory: JSON.parse(JSON.stringify((deck && deck.potionClauseMemory) || {})) };
    applyHeroSwap(probe, alt, neu, cardOf);
    var perms = activePermissions(heroesAfter);
    if (probe.potionDeck.some(function (n) { return !accepts([], cardOf(n), perms); })) {
      return 'Take the non-Potion cards out of your Potion Deck first: without ' + alt + ' it may only contain Potions.';
    }
    var p = permissionProblems([], perms, probe.potionDeck, cardOf, keyOf);
    return p.length ? p[0] : null;
  }

  return {
    CLAUSES: CLAUSES,
    PERMISSIONS: PERMISSIONS,
    activeClauses: activeClauses,
    activePermissions: activePermissions,
    permissionOfHero: permissionOfHero,
    permissionFits: permissionFits,
    potionCopyCounts: potionCopyCounts,
    copyCap: copyCap,
    permissionProblems: permissionProblems,
    permissionPoolOk: permissionPoolOk,
    swapPotionDeckProblem: swapPotionDeckProblem,
    clauseOfHero: clauseOfHero,
    hasType: hasType,
    cardFits: cardFits,
    accepts: accepts,
    requiredSize: requiredSize,
    compatible: compatible,
    conflictProblem: conflictProblem,
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
