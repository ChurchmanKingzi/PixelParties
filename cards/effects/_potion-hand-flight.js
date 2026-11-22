'use strict';
/**
 * ── POTION-PROJEKTIL STARTET AUF DER HANDKARTE (app-fx-70) ────────────────────────────────────────────────
 *
 * Nutzer-Vorgabe (13.11.): „Bei den Potions soll der Effekt AUF DER HANDKARTE DER POTION beginnen! Diese Karte soll die Hand dann erst nach Beginn der Animation
 * (aber schon während die Animation noch läuft) verlassen."
 *
 * Die gespielte Potion liegt bis zum Ende der Auflösung in `ps.hand` (`ps._resolvingCard`, ausgegraut — siehe `_hand-resolve.js`); `server.js` (`doConfirmPotion`) schickt ihren
 * Flug Hand → „Gelöscht" erst NACH `resolve`, also nach dem Einschlag. Dieser Helfer zieht genau diesen Flug vor:
 *   • `quelle()`  liefert das `von` für die Zonen-Animation (Handplatz der Karte; der Client findet das Element, Rückfall: der „Gelöscht"-Stapel des Spielers)
 *   • `warteMitAbflug()` wartet die Gesamtzeit bis zum Einschlag, schickt nach `abflugMs` das `play_pile_transfer` (Hand → Gelöscht) und merkt es am Marker
 *     (`ps._resolvingCard.fruehFlug` = Besitzer des Zielstapels), damit `server.js` am Ende KEINEN zweiten Flug schickt und dieselbe Herkunft/Stapelwahl benutzt.
 * Der Zustand ändert sich dadurch nicht: die Karte bleibt bis zum normalen Ende in `ps.hand` (Hooks, `afterPotionUsed`, Stapel-Buchung laufen unverändert danach);
 * der Client verdeckt den Handplatz ab dem Flug (`play_pile_transfer`, „Flug vor Entnahme").
 */
const { getResolvingHandIndex } = require('./_hand-resolve');

/** `von` für `play_zone_animation`: Handplatz der gerade aufgelösten Potion (Rückfall: Stapel „Gelöscht"). */
function quelle(engine, pi, cardName) {
  const ps = engine.gs.players[pi];
  const rc = ps?._resolvingCard;
  const hi = rc && !rc.fromCreation && rc.name === cardName ? getResolvingHandIndex(ps) : -1;
  return { owner: pi, pile: 'deleted', ...(hi >= 0 ? { handIdx: hi } : null) };
}

/** Schickt den Abflug der Handkarte jetzt (einmal je Auflösung). @returns {boolean} true, wenn der Flug gesendet wurde */
function fruehAbflug(engine, pi, cardName) {
  const ps = engine.gs.players[pi];
  const rc = ps?._resolvingCard;
  if (!rc || rc.fromCreation || rc.name !== cardName || rc.fruehFlug != null) return false;
  const hi = getResolvingHandIndex(ps);
  if (hi < 0) return false;
  const pileOwner = engine._consumeHandCardOrigin(pi, cardName, hi);   // wie server.js: Herkunft VOR dem Flug lesen (gestohlene Karte → Stapel des Besitzers)
  engine._broadcastEvent('play_pile_transfer', { fromOwner: pi, toOwner: pileOwner, cardName, from: 'hand', to: 'deleted', fromHandIdx: hi });
  rc.fruehFlug = pileOwner;
  return true;
}

/** Wartet insgesamt `gesamtMs`; nach `abflugMs` fliegt die Handkarte ab. */
async function warteMitAbflug(engine, pi, cardName, gesamtMs, abflugMs) {
  const bis = Math.min(abflugMs, gesamtMs);
  await engine._delay(bis);
  fruehAbflug(engine, pi, cardName);
  if (gesamtMs - bis > 0) await engine._delay(gesamtMs - bis);
}

/**
 * Mindest-Sichtbarkeit der Handkarte nach Effektbeginn (Nutzer 13.11.: „Die Potion verlässt die Hand bereits, bevor die Animation zu sehen ist. Sie sollte für wenigstens
 * ein Drittel der Animationszeit in der Hand verweilen"). Richtwert für Potions mit KURZEM Effekt: Mount-Vorlauf des Clients (120 ms) + 350 ms sichtbarer Effekt.
 * Längere Effekte (Life Serum, Acid Vial, Skripte mit eigenen Wartezeiten) erfüllen das über ihre Auflösungszeit selbst: Abflug bei 1/3 der Gesamtanimation (`abflugNachDrittel`).
 */
const HAND_MIN_MS = 120 + 350;

/** Abflugzeitpunkt (ms nach dem Ereignis) für einen Effekt mit Animationsdauer `animMs`: Vorlauf + ein Drittel der Animation (aufgerundet). */
function abflugNachDrittel(vorlaufMs, animMs) { return vorlaufMs + Math.ceil(animMs / 3); }

/** Der Standardweg (`doConfirmPotion`, server.js): hält die Karte in der Hand, bis seit Beginn der Auflösung (`t0`, Date.now()) `HAND_MIN_MS` vergangen sind. */
async function haltBisSichtbar(engine, t0, minMs) {
  if (!t0) return;
  const rest = (minMs || HAND_MIN_MS) - (Date.now() - t0);
  if (rest > 0) await engine._delay(rest);
}

module.exports = { quelle, fruehAbflug, warteMitAbflug, abflugNachDrittel, haltBisSichtbar, HAND_MIN_MS };
