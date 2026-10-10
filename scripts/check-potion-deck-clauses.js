'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Prueft die Potion-Deck-Klauseln der Helden (public/potion-deck-clauses.js):
//  Chaos-Diamond (15 Normal-/Attachment-Spells) und Pinta (15 Creatures).
//  Reine Regelfunktionen, ohne Server und Browser — dieselbe Datei liest
//  der Deckbau im Client und der Server.
//
//    node scripts/check-potion-deck-clauses.js   (Exit 1 bei Verstoss)
// ═══════════════════════════════════════════════════════════════════
const P = require('../public/potion-deck-clauses.js');
const { getCardDB } = require('../cards/effects/_card-db');

let fails = 0;
const check = (name, cond, info) => {
  if (cond) console.log('  ✓', name);
  else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); }
};

const DB = getCardDB();
const cardOf = (n) => DB[n];
const CHAOS = 'Chaos-Diamond, the Cracked Keeper';
const PINTA = 'Pinta, the Singing Ship';
const OTHER = 'Reiza, the Chief Tormentor';

/** Karten einer Art, nach Level sortiert (damit die Summen im Test planbar bleiben). */
const pick = (pred, n) => Object.values(DB).filter(pred).sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name)).slice(0, n).map(c => c.name);
const normalSpells = pick(c => c.cardType === 'Spell' && (c.subtype === 'Normal' || c.subtype === 'Attachment') && c.level === 0, 20);
const creatures0 = pick(c => c.cardType === 'Creature' && c.level === 0, 20);
const creatures3 = pick(c => c.cardType === 'Creature' && c.level === 3, 6);
const artifactCreature = 'Powder Keg';

console.log('Die Tabelle');
check('Chaos-Diamond und Pinta stehen drin', !!P.clauseOfHero(CHAOS) && !!P.clauseOfHero(PINTA));
check('Held ohne Klausel: keine', P.clauseOfHero(OTHER) === null && P.activeClauses([OTHER, PINTA]).length === 1);
check('activeClauses liest Namen UND { hero }-Eintraege', P.activeClauses(['x', { hero: CHAOS }]).length === 1);
check('Kopienfamilie: eigener Vergleich wird benutzt', P.activeClauses([{ hero: PINTA + ' [B]' }], (a, b) => a.replace(/ \[B\]$/, '') === b).length === 1);

console.log('Welche Karten duerfen ins Potion Deck');
const chaos = P.activeClauses([CHAOS]);
const pinta = P.activeClauses([PINTA]);
const beide = P.activeClauses([CHAOS, PINTA]);
check('ohne Klausel: nur Potions', P.accepts([], cardOf('Planet in a Bottle')) && !P.accepts([], cardOf(creatures0[0])) && !P.accepts([], cardOf(normalSpells[0])));
check('Chaos: Normal-Spell ja, Creature nein, Potion nein', P.accepts(chaos, cardOf(normalSpells[0])) && !P.accepts(chaos, cardOf(creatures0[0])) && !P.accepts(chaos, cardOf('Planet in a Bottle')));
const reaktion = pick(c => c.cardType === 'Spell' && c.subtype === 'Reaction', 1)[0];
const area = pick(c => c.cardType === 'Spell' && c.subtype === 'Area', 1)[0];
const attack = pick(c => c.cardType === 'Attack' && c.subtype === 'Normal', 1)[0];
check('Chaos: Reaction-/Area-Spells und Attacks nein', !P.accepts(chaos, cardOf(reaktion)) && !P.accepts(chaos, cardOf(area)) && !P.accepts(chaos, cardOf(attack)));
check('Pinta: Creature ja (auch mit Subtyp Reaction/Surprise), Spell nein, Potion nein',
  P.accepts(pinta, cardOf(creatures0[0])) && !P.accepts(pinta, cardOf(normalSpells[0])) && !P.accepts(pinta, cardOf('Planet in a Bottle')));
check('Pinta: auch Artifact-Creatures (Powder Keg) zaehlen als Creature, wie `hasCardType` der Engine', P.accepts(pinta, cardOf(artifactCreature)));
check('Pinta: gewoehnliche Artifacts und Heroes nein', !P.accepts(pinta, cardOf(pick(c => c.cardType === 'Artifact' && c.subtype === 'Equipment', 1)[0])) && !P.accepts(pinta, cardOf(OTHER)));
check('beide Klauseln zugleich: GAR keine Karte passt (Spells ⊥ Creatures)',
  Object.values(DB).every(c => !P.accepts(beide, c)));

console.log('Groesse, Level, Namen');
check('Groesse: 15 bei Klausel, ohne Klausel 0 oder 5–15',
  P.requiredSize(chaos) === 15 && P.requiredSize(pinta) === 15 && P.requiredSize([]) === null);
check('sizeOk: ohne Klausel 0 und 5–15', [0, 5, 10, 15].every(n => P.sizeOk([], n)) && [1, 4, 16].every(n => !P.sizeOk([], n)));
check('sizeOk: mit Klausel genau 15', P.sizeOk(pinta, 15) && !P.sizeOk(pinta, 14) && !P.sizeOk(pinta, 0) && !P.sizeOk(chaos, 16));
check('Level-Grenze 15', P.maxLevel(pinta) === 15 && P.maxLevel([]) === Infinity);

const gut = creatures0.slice(0, 15);
check('15 verschiedene Level-0-Creatures: legal fuer Pinta', P.problems(pinta, gut, cardOf).length === 0, P.problems(pinta, gut, cardOf));
check('…aber nicht fuer Chaos (Creatures sind keine Spells)', P.problems(chaos, gut, cardOf).some(t => /may only contain/.test(t)));
check('14 Karten: zu wenig', P.problems(pinta, gut.slice(0, 14), cardOf).some(t => /exactly 15/.test(t) && /14\/15/.test(t)));
const doppelt = gut.slice(0, 14).concat([gut[0]]);
check('Namen doppelt: abgelehnt', P.problems(pinta, doppelt, cardOf).some(t => /different names/.test(t)));
check('Kopienfamilie zaehlt als derselbe Name (keyOf)', P.problems(pinta, gut.slice(0, 14).concat([gut[1] + ' [W]']), cardOf, n => n.replace(/ \[W\]$/, '')).length > 0);
const zuHoch = creatures3.slice(0, 5).concat(creatures0.slice(0, 10));   // 5 × Level 3 = 15 → genau an der Grenze
check('Gesamtlevel 15 ist erlaubt', P.problems(pinta, zuHoch, cardOf).length === 0, P.problems(pinta, zuHoch, cardOf));
const zuHoch2 = creatures3.slice(0, 6).concat(creatures0.slice(0, 9));  // 6 × 3 = 18 > 15
check('Gesamtlevel 18: abgelehnt', P.problems(pinta, zuHoch2, cardOf).some(t => /cannot exceed 15/.test(t) && /18\/15/.test(t)));
check('Karten ohne Level (Artifact Creature) zaehlen 0', P.problems(pinta, creatures0.slice(0, 14).concat([artifactCreature]), cardOf).length === 0);
const spells15 = normalSpells.slice(0, 15);
check('Chaos: 15 verschiedene Level-0-Normal-Spells legal', P.problems(chaos, spells15, cardOf).length === 0, P.problems(chaos, spells15, cardOf));
check('beide Klauseln: jedes Potion Deck hat Verstoesse', P.problems(beide, spells15, cardOf).length > 0 && P.problems(beide, gut, cardOf).length > 0);
check('poolOk (ohne Groessenforderung): 3 Creatures ok, doppelter Name nicht', P.poolOk(pinta, gut.slice(0, 3), cardOf) && !P.poolOk(pinta, [gut[0], gut[0]], cardOf));
check('poolOk: Level-Grenze', !P.poolOk(pinta, creatures3.slice(0, 6), cardOf) && P.poolOk(pinta, creatures3.slice(0, 5), cardOf));
check('ohne Klausel ist nichts zu pruefen', P.problems([], ['egal'], cardOf).length === 0 && P.poolOk([], ['egal'], cardOf));

console.log('Ausschluss: das Potion Deck passt nur zu EINEM Klausel-Helden');
check('Chaos-Diamond + Pinta vertragen sich nicht (keine Karte erfuellt beide accepts)', P.compatible(beide, DB) === false);
check('…die Meldung nennt beide Helden', /Chaos-Diamond, the Cracked Keeper and Pinta, the Singing Ship exclude each other/.test(P.conflictProblem(beide, DB) || ''), P.conflictProblem(beide, DB));
check('…zweimal gefragt (Zwischenspeicher): dasselbe Ergebnis', P.compatible(beide, DB) === false && P.conflictProblem(beide, DB) === P.conflictProblem(beide, DB));
check('ein einzelner Klausel-Held oder keiner: kein Ausschluss', P.compatible(chaos, DB) && P.compatible(pinta, DB) && P.compatible([], DB) && P.conflictProblem(pinta, DB) === null);
check('Held ohne Klausel neben Pinta: kein Ausschluss', P.compatible(P.activeClauses([OTHER, PINTA]), DB));
{
  // Zwei erfundene Klauseln mit ueberlappender Kartenart vertragen sich, mit verschiedener Groesse nicht.
  const a = { hero: 'A', size: 15, maxLevel: 15, distinct: true, accepts: { anyType: 'Creature' }, noun: 'x', nounShort: 'x' };
  const b = { hero: 'B', size: 15, maxLevel: 15, distinct: true, accepts: { cardType: 'Creature', subtypes: ['Normal'] }, noun: 'y', nounShort: 'y' };
  const c = { hero: 'C', size: 10, maxLevel: 15, distinct: true, accepts: { anyType: 'Creature' }, noun: 'z', nounShort: 'z' };
  check('ueberlappende Kartenarten vertragen sich', P.compatible([a, b], DB) === true);
  check('verschiedene Kartenzahlen vertragen sich nie', P.compatible([a, c], DB) === false);
}

console.log('Seitenwechsel: Held raus / rein');
{
  const deck = { potionDeck: gut.slice() };
  check('Pinta rein ohne Merkliste: gesperrt', /sided in/.test(P.heroSwapProblem(deck, PINTA, cardOf) || ''));
  check('Held ohne Klausel rein: nie gesperrt', P.heroSwapProblem(deck, OTHER, cardOf) === null);
  P.applyHeroSwap(deck, PINTA, OTHER, cardOf);
  check('Pinta raus: Potion Deck leer, Karten gemerkt', deck.potionDeck.length === 0 && deck.potionClauseMemory[PINTA].length === 15);
  check('Pinta wieder rein bei LEEREM Potion Deck: erlaubt', P.heroSwapProblem(deck, PINTA, cardOf) === null);
  deck.potionDeck = [creatures0[0]];
  check('…bei gefuelltem Potion Deck: gesperrt', /Empty your Potion Deck/.test(P.heroSwapProblem(deck, PINTA, cardOf) || ''));
  deck.potionDeck = [];
  P.applyHeroSwap(deck, OTHER, PINTA, cardOf);
  check('Pinta rein: dieselben 15 Karten kehren zurueck, Merkliste ist verbraucht', JSON.stringify(deck.potionDeck) === JSON.stringify(gut) && !deck.potionClauseMemory[PINTA]);
  const chaosDeck = { potionDeck: spells15.slice() };
  P.applyHeroSwap(chaosDeck, CHAOS, OTHER, cardOf);
  check('Chaos raus: Spells werden gemerkt und geleert (wie bisher)', chaosDeck.potionDeck.length === 0 && chaosDeck.potionClauseMemory[CHAOS].length === 15);
  const fremd = { potionDeck: ['Planet in a Bottle'] };
  P.applyHeroSwap(fremd, PINTA, OTHER, cardOf);
  check('Held raus, Potion Deck besteht NICHT aus Klauselkarten: bleibt unberuehrt', fremd.potionDeck.length === 1 && !fremd.potionClauseMemory);
  check('Merkliste mit ungueltigem Inhalt zaehlt nicht', /sided in/.test(P.heroSwapProblem({ potionDeck: [], potionClauseMemory: { [PINTA]: gut.slice(0, 5) } }, PINTA, cardOf) || ''));
  check('Merkliste eines ANDEREN Klausel-Helden hilft nicht', /sided in/.test(P.heroSwapProblem({ potionDeck: [], potionClauseMemory: { [CHAOS]: spells15 } }, PINTA, cardOf) || ''));
}

// ════════════════════════════════════════════════════════════════
//  ERLAUBNISSE — Kerthwack, the Reality Breaker (10.10.)
//  „… your Potion Deck may contain any card, but only up to 2 copies of each card. Copies of cards played in your Potion
//   Deck, except Potions, do not count towards the number of copies of those cards in your deck."
// ════════════════════════════════════════════════════════════════
const KERTH = 'Kerthwack, the Reality Breaker';
const POTION = 'Planet in a Bottle';
const heroCard = OTHER;
console.log('Erlaubnis: Kerthwack');
{
  const erl = P.activePermissions([KERTH]);
  check('die Tabelle kennt Kerthwack, die strengen Klauseln nicht', erl.length === 1 && P.clauseOfHero(KERTH) === null && P.permissionOfHero(KERTH) === erl[0]);
  check('activePermissions liest Namen UND { hero }-Eintraege, Kopienfamilie wird benutzt',
    P.activePermissions(['x', { hero: KERTH }]).length === 1 && P.activePermissions([{ hero: KERTH + ' [B]' }], (a, b) => a.replace(/ \[B\]$/, '') === b).length === 1);
  check('Held ohne Erlaubnis: keine', P.activePermissions([OTHER, PINTA, CHAOS]).length === 0);
  check('Kerthwack ist KEINE strenge Klausel (activeClauses bleibt leer, kein Ausschluss, keine feste Kartenzahl)',
    P.activeClauses([KERTH]).length === 0 && P.requiredSize(P.activeClauses([KERTH])) === null && P.sizeOk(P.activeClauses([KERTH]), 0) && P.sizeOk(P.activeClauses([KERTH]), 5) && !P.sizeOk(P.activeClauses([KERTH]), 3));

  console.log('Was ins Potion Deck darf');
  check('ohne Erlaubnis bleibt es dabei: nur Potions', !P.accepts([], cardOf(creatures0[0]), []) && P.accepts([], cardOf(POTION), []));
  check('mit Erlaubnis: JEDE Karte (Creature, Spell, Attack, Artifact, Held …)',
    [creatures0[0], normalSpells[0], attack, reaktion, area, artifactCreature, 'The Sacred Jewel', heroCard].every(n => P.accepts([], cardOf(n), erl)));
  check('…und Potions bleiben erlaubt (Erlaubnis, kein Verbot)', P.accepts([], cardOf(POTION), erl));
  check('Zwei Argumente wie bisher: Erlaubnis nicht gereicht = nur Potions', !P.accepts([], cardOf(creatures0[0])));

  console.log('Kopien');
  check('Potions zaehlen zu den Kopien im Deck, alles andere im Potion Deck nicht', P.potionCopyCounts(erl, cardOf(POTION)) === true && P.potionCopyCounts(erl, cardOf(creatures0[0])) === false && P.potionCopyCounts(erl, cardOf(heroCard)) === false);
  check('ohne Erlaubnis zaehlt jede Kopie', P.potionCopyCounts([], cardOf(creatures0[0])) === true && P.potionCopyCounts(null, cardOf(POTION)) === true);
  check('unbekannte Karte zaehlt (nichts erfinden)', P.potionCopyCounts(erl, undefined) === true);
  check('Grenze je Name: 2', P.copyCap(erl) === 2 && P.copyCap([]) === 0);
  const zwei = [creatures0[0], creatures0[0], creatures0[1], POTION, POTION, POTION];
  check('zwei Kopien je Karte: in Ordnung; Potions fallen NICHT unter diese Grenze (ihre eigene gilt: 2 ueber beide Decks)', P.permissionProblems([], erl, zwei, cardOf).length === 0, P.permissionProblems([], erl, zwei, cardOf));
  check('drei Kopien einer Nicht-Potion: abgelehnt, mit Namen und Zahl', P.permissionProblems([], erl, [creatures0[0], creatures0[0], creatures0[0]], cardOf).some(t => /at most 2 copies/.test(t) && t.includes(creatures0[0]) && /x3/.test(t)));
  check('Kopienfamilie zaehlt als derselbe Name (keyOf)', P.permissionProblems([], erl, [creatures0[0], creatures0[0] + ' [W]', creatures0[0]], cardOf, n => n.replace(/ \[W\]$/, '')).length > 0);
  check('permissionPoolOk: dieselbe Rechnung als Ja/Nein', P.permissionPoolOk([], erl, zwei, cardOf) && !P.permissionPoolOk([], erl, [heroCard, heroCard, heroCard], cardOf));
  check('ohne Erlaubnis nichts zu pruefen', P.permissionProblems([], [], [creatures0[0], creatures0[0], creatures0[0]], cardOf).length === 0);

  console.log('Strenge Klausel ueberschreibt die laxe');
  const mitChaos = P.activeClauses([CHAOS, KERTH]);
  const mitPinta = P.activeClauses([PINTA, KERTH]);
  check('Kerthwack schliesst Chaos-Diamond / Pinta NICHT aus (kein Konflikt, vertraeglich)', P.compatible(mitChaos, DB) && P.compatible(mitPinta, DB) && P.conflictProblem(mitChaos, DB) === null);
  check('Chaos-Diamond + Kerthwack: es gilt allein Chaos — Spells ja, Creatures nein, auch Potions nein',
    P.accepts(mitChaos, cardOf(normalSpells[0]), erl) && !P.accepts(mitChaos, cardOf(creatures0[0]), erl) && !P.accepts(mitChaos, cardOf(POTION), erl));
  check('Pinta + Kerthwack: Creatures ja, Spells und Potions nein', P.accepts(mitPinta, cardOf(creatures0[0]), erl) && !P.accepts(mitPinta, cardOf(normalSpells[0]), erl) && !P.accepts(mitPinta, cardOf(POTION), erl));
  check('…Groesse (genau 15), je Name 1x und Gesamtlevel bleiben streng', P.requiredSize(mitPinta) === 15 && P.problems(mitPinta, gut.slice(0, 14), cardOf).some(t => /exactly 15/.test(t)) && P.problems(mitPinta, doppelt, cardOf).some(t => /different names/.test(t)));
  check('…die Erlaubnis-Pruefung schweigt dann (die strenge sagt „je Name 1x")', P.permissionProblems(mitPinta, erl, doppelt, cardOf).length === 0);
  check('Chaos + Pinta + Kerthwack: Chaos und Pinta schliessen einander weiter aus', P.compatible(P.activeClauses([CHAOS, PINTA, KERTH]), DB) === false);

  console.log('Seitenwechsel: Kerthwack raus');
  const cd = (pd) => ({ potionDeck: pd.slice() });
  const ohneKerth = [{ hero: OTHER }, { hero: 'x' }];
  check('Potion Deck nur aus Potions: Kerthwack darf raus', P.swapPotionDeckProblem(cd([POTION, POTION]), KERTH, OTHER, ohneKerth, cardOf) === null);
  check('mit einer Nicht-Potion darin: gesperrt, die Meldung nennt Kerthwack', /Take the non-Potion cards out.*without Kerthwack/.test(P.swapPotionDeckProblem(cd([POTION, creatures0[0]]), KERTH, OTHER, ohneKerth, cardOf) || ''));
  check('leeres Potion Deck: frei', P.swapPotionDeckProblem(cd([]), KERTH, OTHER, ohneKerth, cardOf) === null);
  check('Strenge Klausel bleibt im Team (Chaos-Diamond): deren Karten bleiben liegen, kein Hinderungsgrund', P.swapPotionDeckProblem(cd(spells15), KERTH, OTHER, [{ hero: CHAOS }, { hero: OTHER }], cardOf) === null);
  check('anderer Held geht raus: Kerthwack-Regel greift nicht (auch bei schon unzulaessigem Deck)', P.swapPotionDeckProblem(cd([creatures0[0]]), OTHER, 'x', ohneKerth, cardOf) === null);
  check('Kerthwack rein: nie gesperrt', P.swapPotionDeckProblem(cd([creatures0[0]]), OTHER, KERTH, [{ hero: KERTH }], cardOf) === null);
  check('das Potion Deck wird beim Pruefen nicht veraendert', (() => { const d = cd([POTION, creatures0[0]]); P.swapPotionDeckProblem(d, KERTH, OTHER, ohneKerth, cardOf); return d.potionDeck.length === 2 && !d.potionClauseMemory; })());
  check('Kerthwack raus, aber ein zweiter Erlaubnis-Held bliebe: Karten bleiben erlaubt', (() => {
    // Eine erfundene zweite Erlaubnis ueber dieselbe Tabelle: darf Kerthwacks Karten uebernehmen.
    P.PERMISSIONS.push({ hero: 'Zweiter', accepts: { any: true }, maxCopies: 2, exemptsDeckCount: true, noun: 'any card' });
    try { return P.swapPotionDeckProblem(cd([creatures0[0]]), KERTH, OTHER, [{ hero: 'Zweiter' }], cardOf) === null; } finally { P.PERMISSIONS.pop(); }
  })());
}

console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Potion-Deck-Klauseln grün');
process.exit(fails ? 1 : 0);
