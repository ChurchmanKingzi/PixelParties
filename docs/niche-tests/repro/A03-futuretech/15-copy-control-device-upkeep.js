'use strict';
// A03-futuretech-15 · Copy Device als Control Device: der Unterhalt am Zugende löscht eine ECHTE Control Device aus der Ablage, obwohl die Kopie im selben Moment abfällt (Stufe C – Regelfrage)
//
// Kartentext Control Device: „At the end of each of your opponent's turns, they must delete a "Future Tech Control Device" from their discard pile, or this equipped card is sent to their discard pile.“
// Kartentext Copy Device: „… become that Artifact's original name, Cost and effect for the rest of the turn.“
// Ablauf: Zugende-Hook `onTurnEnd` der kopierten Control Device läuft VOR dem Identitäts-Ablauf (`_expireBorrowedIdentities`) → Unterhalt wird bezahlt (echte Karte
//   aus der Ablage gelöscht, `deletedPile`), danach fällt die Kopie ab und die Copy Device geht trotzdem in die Ablage. Ergebnis: eine echte Control Device verloren für nichts.
// Frage an Al: Soll die Copy Device am Zugende die Unterhaltskosten der kopierten Control Device noch zahlen (Karte wird gelöscht) oder soll sie ohne Unterhalt abfallen – „zahlen“ oder „abfallen“?
// ENTSCHIEDEN (Al, Welle 9, Q19): „Ja, muss bezahlen, bevor sie abfällt“ → die als Control Device kopierte Copy Device zahlt am Zugende ZUERST den Unterhalt
//   (eine Control Device aus der Ablage wird gelöscht) und fällt DANACH ab. Dieses Repro prüft seitdem die NEUE Regel (umgestellt von „es wird keine echte Control Device
//   gelöscht“): genau eine echte Control Device gelöscht, und zum Zeitpunkt der Zahlung liegt die Kopie noch am Brett. Weitere Fälle: b-q19-copy-control-unterhalt-reihenfolge.js.
const H = require('../../lib/h.js');
const CD = 'Future Tech Copy Device', CTL = 'Future Tech Control Device';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[CD], []], discard: [[CTL, CTL, CTL], []], gold: 100 });
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: CTL }), once: true });
  await t.play(0, CD, { hero: 0, targetOwner: 1 });
  R.check('Copy Device liegt als Control Device an Sitz 1 Held 0', t.zone(1, 0, 0) === CD);
  const geloeschtVorher = t.pile(0, 'deletedPile').length;
  await t.endTurn();
  R.check('Copy Device ist abgefallen und in der Ablage von Sitz 0', t.pile(0, 'discardPile').includes(CD) && t.zone(1, 0, 0) === null);
  R.check('der Unterhalt wurde bezahlt: genau eine echte Control Device gelöscht (Al Q19)', t.pile(0, 'deletedPile').length === geloeschtVorher + 1 && t.pile(0, 'deletedPile').slice(-1)[0] === CTL, { geloescht: t.pile(0, 'deletedPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
