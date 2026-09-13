'use strict';
// ═══════════════════════════════════════════════════════════════════
//  GEMEINSAME REGEL: welche Area darf getutort werden?
//
//  Drei Karten holen Areas aus Hand, Deck oder Ablage und sagen dabei
//  WORTGLEICH 》a level 3 or lower Area《:
//
//    · Planet in a Bottle   (Deck, Hand, Ablage)
//    · Reality Crack        (Hand, Deck)
//    · Cooldin, King of Coolness (Hand, Deck)
//
//  Sie hatten drei verschiedene Filter. Der Unterschied war nicht
//  gewollt, sondern gewachsen:
//    Planet   — nur `subtype === 'area'`, kein Typ-Tor
//               → zog Smuggler's Pier (Als Bugreport 28.8.)
//    Crack    — nur `cardType === 'Spell'`
//               → schloss Blood Rock aus, obwohl der Text ihn deckt
//    Cooldin  — Spell + Attack, kein Creature
//
//  ── DIE REGEL (Als Vorgabe 28.8.) ─────────────────────────────────
//  Waehlbar ist eine Area nur, wenn sie ein LEVEL hat — Artifacts haben
//  keins und sind deshalb illegal. Area Creatures gibt es noch nicht,
//  sollen aber schon jetzt zulaessig sein.
//
//  ── WARUM DER LEVEL-RIEGEL EXTRA STEHT ────────────────────────────
//  Smuggler's Pier traegt `level: null`, und `(cd.level || 0)` macht
//  daraus 0 — die Schwelle 》hoechstens 3《 laesst also ausgerechnet die
//  Karten passieren, die gar kein Level HABEN. Der Typ-Riegel allein
//  wuerde denselben Fehler bei einer kuenftigen levellosen Area
//  Creature wieder aufreissen, nur eine Typspalte weiter. Deshalb steht
//  die Begruendung der Regel als eigener Riegel im Code.
//
//  ACHTUNG bei `level: 0`: das ist ein ECHTES Level (203 Karten im Satz
//  haben es, darunter Black Marketeer). Geprueft wird deshalb auf
//  null/undefined, nicht auf Falsy.
// ═══════════════════════════════════════════════════════════════════

const TUTORBARE_TYPEN = ['Spell', 'Attack', 'Creature'];
const MAX_LEVEL = 3;

/**
 * Effektives Level einer Karte. Beruecksichtigt Cataclysms
 * `reduceCardLevel` fuer Area Spells im Spiel, Mana Absorbing Crystal
 * +1 in der Hand und jeden kuenftigen Area-Level-Modifikator — ohne die
 * Engine-Funktion faellt es auf den gedruckten Wert zurueck.
 */
function effectiveLevel(cd, engine, pi) {
  return engine?.effectiveCardLevel
    ? engine.effectiveCardLevel(cd, pi)
    : (cd.level || 0);
}

/**
 * Darf diese Karte von einem Area-Tutor geholt werden?
 * @param {object} cd     Kartendaten aus cards.json
 * @param {object} engine Engine (fuer das effektive Level); optional
 * @param {number} pi     Spielerindex; optional
 * @param {object} [opts] `maxLevel` ueberschreibt die Schwelle 3.
 *
 * ── OHNE SCHWELLE (v944, Aquanian Orkallion) ──────────────────────
 * Die drei Karten oben sagen 》a level 3 or lower Area《; Orkallion sagt
 * 》regardless of its level《. Der REST der Regel ist derselbe (Typ,
 * Subtyp, und vor allem: die Karte muss ueberhaupt ein Level haben —
 * sonst zoege auch er Smuggler's Pier). Deshalb ist nur die Schwelle
 * beweglich, `maxLevel: Infinity` hebt sie auf. Der Level-Riegel bleibt
 * in JEDEM Fall stehen: 》regardless of its level《 setzt ein Level
 * voraus, es hebt den Begriff nicht auf.
 */
function isTutorableArea(cd, engine, pi, opts = {}) {
  if (!cd) return false;
  if (!TUTORBARE_TYPEN.includes(cd.cardType)) return false;
  if ((cd.subtype || '').toLowerCase() !== 'area') return false;
  // Kein Level = nicht tutorbar. Steht VOR der Schwellenpruefung, weil
  // `(null || 0)` sonst als 0 durchginge.
  if (cd.level === null || cd.level === undefined) return false;
  const schwelle = opts.maxLevel ?? MAX_LEVEL;
  if (effectiveLevel(cd, engine, pi) > schwelle) return false;
  return true;
}

module.exports = { isTutorableArea, effectiveLevel, TUTORBARE_TYPEN, MAX_LEVEL };
