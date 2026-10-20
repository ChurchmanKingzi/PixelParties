'use strict';
// N3-17 · Festive Werz: die Antwort der Betrags-Abfrage wird nicht gegen die angebotenen Stufen geprüft (Härtung, Stufe B)
// Kartentext: „When you summon this Creature, pay your opponent any amount of Gold. Then, draw a card for every 5 Gold paid that way, to a maximum of 4."
// Der Server reicht `effect_prompt_response` unverändert an die Karte (`server.js` Z. ~15842, `resolveGenericPrompt`); Festive Werz liest `Number(wahl.optionId)` und rechnet `floor(kosten / 5)` Karten –
//   ohne Obergrenze 4 und ohne Prüfung gegen die angebotenen Stufen (`maxStufen`, Schieberegler 0–20). Ein manipulierter Client (oder ein Skript-/CPU-Weg mit anderem Wert) zieht so beliebig viele Karten
//   (Betrag 100 → 20 Karten) bzw. zahlt krumme Beträge. W7b hat denselben Grundsatz für Zielwahlen eingeführt („Server prüft Client-Antworten nach", `zielAuswahlRegelverstoss`).
// Erwartet: nie mehr als 4 Karten; Beträge außerhalb der angebotenen Stufen werden abgelehnt oder auf 20 gekappt.   Beobachtet: 100 Gold → 20 Karten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(optionId) {
    const t = await H.fresh({ hand: [['Festive Werz'], []], gold: [200, 0] });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Festive Werz', answer: () => ({ optionId }) });
    const h0 = t.pile(0, 'hand').length;
    const r = await t.play(0, 'Festive Werz', { hero: 0 });
    return { r, gezogen: t.pile(0, 'hand').length - (h0 - 1), gold: [t.gs.players[0].gold, t.gs.players[1].gold], errors: t.errors };
  }
  const a = await lauf('20');
  R.check('Gegenprobe: 20 Gold angeboten → 4 Karten', a.gezogen === 4 && a.gold[1] === 20, a);
  const b = await lauf('100');
  R.check('Antwort 100 (nicht angeboten): höchstens 4 Karten', b.gezogen <= 4, b);
  R.check('Antwort 100 (nicht angeboten): zahlt höchstens 20 Gold', 200 - b.gold[0] <= 20, b);
  R.check('keine Engine-Fehler', a.errors.length + b.errors.length === 0);
  R.finish();
})();
