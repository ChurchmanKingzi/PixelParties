'use strict';
// A06-rebelliokai-21 · Pawn Sacrifice unter Handsperre (Ice Sculpture Garden): Pawn wird geopfert, Ziehen entfällt
// Kartentexte: Pawn Sacrifice: „Sacrifice a "Pawn of Kings" to draw 3 cards OR delete a "Pawn of Kings" from your discard pile to draw 2 cards …"
//   Ice Sculpture Garden: „… You cannot draw or add cards to your hand for the rest of the turn afterwards."
// Beobachtung: `ps.handLocked` (von der Garden gesetzt) sperrt Kitsune Transformation und Tanuki Escape über `spellPlayCondition` (Karte ausgegraut).
//   Pawn Sacrifice prüft die Sperre nicht: der Spieler kann spielen, der Pawn wird geopfert (Ablage), `drawWouldBeBlocked` überspringt das Ziehen.
//   Die Karte hat danach nur Kosten verbraucht (und evtl. die Zusatzaktion). Loader-Kommentar (`_loader.js` ~Z. 410): Spells werden bewusst NICHT automatisch
//   als „draw-only" gesperrt – „eine Verhaltensänderung, die Al entscheiden sollte".
// ★ W5b-Z5 (Al, Welle 5): „Pawn Sacrifice kann gespielt werden, discard/delete könnte Selbstzweck sein." -> NEUE Erwartung: spielbar (Opfer läuft), das Ziehen entfällt.
// (alte) Frage (Stufe C): Soll Pawn Sacrifice (nur Ziehen als Nutzen) bei aktiver Handsperre gesperrt/ausgegraut sein wie Kitsune Transformation und Tanuki Escape – Ja oder Nein?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const P = 'Pawn of Kings [W]';
  const t = await H.fresh({ hand: [['Ice Sculpture Garden', 'Pawn Sacrifice'], []], deck: [Array(15).fill(D), Array(15).fill(D)] });
  const a = t.put(1, 0, 0, D), b = t.put(1, 0, 1, D);
  for (const x of [a, b]) await t.run(() => t.engine.applyCreatureStatus(x, 'frozen', { duration: 3, sourceOwner: 1, source: 'repro' }));
  t.put(0, 0, 0, P);
  await t.play(0, 'Ice Sculpture Garden', { hero: 0 });
  R.check('Aufbau: Handsperre aktiv', t.gs.players[0].handLocked === true);
  const pawnVorher = t.zone(0, 0, 0);
  const handVorher0 = t.pile(0, 'hand').length;
  const r = await t.play(0, 'Pawn Sacrifice', { hero: 0 });
  const handVorher = handVorher0 - 1;   // nur die Pawn-Sacrifice-Karte selbst verlässt die Hand
  R.check('Pawn Sacrifice unter Handsperre bleibt spielbar (Opfer ist Selbstzweck): Pawn geopfert, nichts gezogen', r === true && t.zone(0, 0, 0) !== P && t.pile(0, 'hand').length <= handVorher,
    { r, pawnVorher, pawnNachher: t.zone(0, 0, 0), hand: t.pile(0, 'hand').length, handVorher });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
