'use strict';
// W63c · Hilfen für die Besitzer-Repros (docs/niche-tests/repro/W63/c-*.js): „Karten gehören immer ihrem BESITZER".
// Eine Karte, die ein anderer Spieler hält oder kontrolliert (Charme Lv 2, Diebstahl, Geschenk …), landet beim Abwerfen/Löschen/Mischen/
// Auflösen/Zerstören in Ablage, Löschstapel oder Deck des BESITZERS — nie beim Dieb.
const H = require('./h.js');

const FILLER = 'ZZ Filler';
const PILES = ['hand', 'mainDeck', 'discardPile', 'deletedPile', 'potionDeck'];

/** Freie Ability benutzen (Charme): Sitz `seat`, Held `hi`, Zone `zi`. */
function frei(t, seat, hi, zi) {
  t.gs.activePlayer = seat; t.phase(2);
  return t.run(() => t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: zi }));
}

/**
 * Charme Lv 2: Sitz `dieb` klaut `karte` aus der Hand von Sitz `besitzer`. Danach liegt die Karte in der Hand des Diebs.
 * o: { diebHand:[…], besitzerHand:[…] (Karte wird vorn ergänzt), extra:{…H.fresh-Optionen} }
 */
async function charmeKlau(karte, dieb = 0, o = {}) {
  const besitzer = 1 - dieb;
  const hand = [[], []];
  hand[dieb] = o.diebHand || [FILLER];
  hand[besitzer] = [karte, ...(o.besitzerHand || [])];
  const abilities = { [dieb]: { 0: [['Charme', 'Charme'], [], []] } };
  const t = await H.fresh({ hand, deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')], abilities, ...(o.extra || {}) });
  t.dieb = dieb; t.besitzer = besitzer; t.karte = karte;
  t.script.push({ match: d => d.type === 'forceDiscard' && /Charme/.test(d.title || ''), answer: () => ({ cardName: karte, handIndex: t.pile(besitzer, 'hand').indexOf(karte) }) });
  await frei(t, dieb, 0, 0);
  return t;
}

/** Wo liegt die Karte? { seatN: { pile: Anzahl } } + Instanz-Zonen. */
function ort(t, karte) {
  const out = {};
  for (let s = 0; s < t.n; s++) for (const k of PILES) { const n = t.pile(s, k).filter(x => x === karte).length; if (n) (out['s' + s] = out['s' + s] || {})[k] = n; }
  return out;
}
function anzahl(t, seat, pile, karte) { return t.pile(seat, pile).filter(x => x === karte).length; }
/** Geister-Instanzen: fremde Karte noch als Handinstanz getrackt, obwohl sie nicht mehr in der Hand liegt. */
function geisterHand(t, karte) {
  return t.engine.cardInstances.filter(c => c.name === karte && c.zone === 'hand' && !t.pile(c.owner, 'hand').includes(karte));
}

/**
 * Prüft: `karte` liegt genau einmal in `pile` von Sitz `seat` (BESITZER), nirgends sonst in Stapeln/Hand, keine Geister-Handinstanz, keine Engine-Fehler.
 */
function erwarteStapel(R, t, label, karte, seat, pile) {
  const o = ort(t, karte);
  const nur = Object.keys(o).length === 1 && (o['s' + seat] || {})[pile] === 1 && Object.keys(o['s' + seat]).length === 1;
  R.check(`${label}: ${karte} im ${pile} von Sitz ${seat} (Besitzer)`, nur, o);
  R.check(`${label}: keine fremde Geister-Handinstanz`, geisterHand(t, karte).length === 0, geisterHand(t, karte).map(c => ({ owner: c.owner, orig: c.originalOwner })));
  R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
}

/** Zerstört die (einzige) Brettinstanz der Karte. */
async function zerstoere(t, karte) {
  const inst = t.engine.cardInstances.find(c => c.name === karte && ['support', 'ability', 'surprise', 'area'].includes(c.zone));
  if (!inst) return null;
  await t.run(() => t.engine.actionDestroyCard(null, inst, {}));
  return inst;
}

module.exports = { H, FILLER, PILES, frei, charmeKlau, ort, anzahl, geisterHand, erwarteStapel, zerstoere };
