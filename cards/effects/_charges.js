'use strict';
/**
 * ── LADUNGSANZEIGE: GEMEINSAME LESER ─────────────────────────────────
 *
 * Karten mit „up to X times per turn" zeigen oben rechts, wie oft sie
 * in dieser Runde noch feuern koennen — weiss, solange etwas uebrig
 * ist, rot bei 0 (Als Vorgabe 16.8.).
 *
 * Der Vertrag zur Engine ist bewusst schmal:
 *
 *     chargesPerTurn: 3,
 *     remainingCharges: (inst, gs) => …  →  { remaining, max }
 *
 * Der Normalfall ist DEKLARATIV und kostet die Karte keine Funktion:
 *
 *     chargesPerTurn: 3,
 *     chargeKey: USE_KEY,
 *
 * Nur Sonderfaelle brauchen `remainingCharges(inst, gs)` — Antonia
 * etwa zeigt gar nichts, solange keine Monia unter ihr liegt.
 *
 * WICHTIG: Die Helfer LESEN nur. Sie duerfen den Zaehler nie anfassen,
 * denn sie laufen bei jedem Spielzustand-Versand — auch beim Gegner,
 * auch mitten in einer Aufloesung.
 *
 * EINMAL PRO RUNDE (max === 1) BEKOMMT KEINE ANZEIGE. Solche Karten
 * sind Schalter: einmal ausgeloest, fertig, da gibt es nichts zu
 * merken (Als Vorgabe). Die Engine filtert das zentral heraus; die
 * Helfer hier duerfen trotzdem `max: 1` melden.
 */

/* ─────────────────────────────────────────────────────────────────────
 * EINHEITLICHER ZAEHLER — ab v417 der Weg fuer ALLE „up to X times per
 * turn"-Effekte, alte und neue.
 *
 * ALS REGEL (16.8., verbindlich):
 *   „Up to X times per turn" heisst X-mal in MEINER Runde und dann
 *   FRISCHE X-mal in der Gegnerrunde.
 *
 * Vorher gab es dafuer DREI Auslegungen im Code, alle mit demselben
 * Kartentext: Stempel gegen `gs.turn` (frisch je Spielerzug), Loeschen
 * bei jedem Rundenbeginn (dasselbe), und Loeschen NUR beim eigenen
 * Rundenbeginn (ein Budget ueber beide Zuege). Die dritte Variante war
 * schlicht falsch — Archer und Golden Vermin liefen jahrelang mit dem
 * halben Kontingent.
 *
 * WARUM STEMPEL UND KEIN `onTurnStart`:
 * Der Stempel heilt sich selbst. Es gibt keinen Hook, den eine neue
 * Karte vergessen kann, keinen Pfad, auf dem die Ruecksetzung
 * ausbleibt, und keine Frage, WESSEN Rundenbeginn gemeint ist —
 * `gs.turn` zaehlt jeden Spielerzug hoch, also stimmt die Regel
 * automatisch. Genau diese Vergesslichkeit war die Fehlerquelle.
 *
 * Zwei flache Felder je Schluessel (`_ptu<Key>Turn` / `_ptu<Key>Used`)
 * statt eines verschachtelten Objekts: `counters` wird an mehreren
 * Stellen durchlaufen und kopiert, flache Zahlen sind dort
 * unauffaellig.
 * ───────────────────────────────────────────────────────────────────── */

function felder(key) {
  return { stempel: `_ptu${key}Turn`, zaehler: `_ptu${key}Used` };
}

/**
 * Wo liegen die Zaehlfelder? Karteninstanzen haben eine `counters`-Tasche,
 * HELDEN nicht — dort haengen solche Werte seit jeher direkt am
 * Heldenobjekt (`hero._kassaranUsesThisTurn` & Co.). Beide Traeger
 * duerfen denselben Zaehler nutzen (v421), sonst braeuchten Helden ein
 * eigenes Verfahren — und genau die Zersplitterung wollten wir los.
 */
function tasche(traeger, anlegen) {
  if (!traeger) return null;
  if (traeger.counters) return traeger.counters;
  // Eine Instanz OHNE Tasche bekommt eine; ein Held bleibt flach.
  if (anlegen && Object.prototype.hasOwnProperty.call(traeger, 'zone')) {
    traeger.counters = {};
    return traeger.counters;
  }
  return traeger;
}

/** Wie oft darf diese Instanz in DIESER Runde noch? (nur lesen) */
function usesLeft(traeger, gs, { key, max }) {
  const { stempel, zaehler } = felder(key);
  const c = tasche(traeger, false) || {};
  const verbraucht = c[stempel] === gs?.turn ? (c[zaehler] || 0) : 0;
  return Math.max(0, max - verbraucht);
}

/**
 * Eine Nutzung verbuchen. Gibt `false` zurueck, wenn nichts mehr frei
 * war — die Karte kann das als Gate benutzen und braucht keine eigene
 * Vorabpruefung mehr.
 */
function spendUse(traeger, gs, { key, max }) {
  if (usesLeft(traeger, gs, { key, max }) <= 0) return false;
  const { stempel, zaehler } = felder(key);
  const c = tasche(traeger, true);
  if (!c) return false;
  if (c[stempel] !== gs?.turn) {
    c[stempel] = gs?.turn;
    c[zaehler] = 0;
  }
  c[zaehler] = (c[zaehler] || 0) + 1;
  return true;
}

/**
 * Eine verbuchte Nutzung zurueckgeben — fuer Karten, die erst
 * reservieren und dann feststellen, dass der Effekt doch ausfaellt
 * (Antonia bricht ab, wenn der Spieler die Abwurfkosten verweigert).
 */
function refundUse(traeger, gs, { key }) {
  const { stempel, zaehler } = felder(key);
  const c = tasche(traeger, false);
  if (!c || c[stempel] !== gs?.turn) return;
  c[zaehler] = Math.max(0, (c[zaehler] || 0) - 1);
}

/** Fertiger `remainingCharges`-Wert fuer die Anzeige. */
function charges(traeger, gs, { key, max }) {
  return { remaining: usesLeft(traeger, gs, { key, max }), max };
}

module.exports = { usesLeft, spendUse, refundUse, charges };
