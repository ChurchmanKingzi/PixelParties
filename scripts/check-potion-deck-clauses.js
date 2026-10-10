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

console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Potion-Deck-Klauseln grün');
process.exit(fails ? 1 : 0);
