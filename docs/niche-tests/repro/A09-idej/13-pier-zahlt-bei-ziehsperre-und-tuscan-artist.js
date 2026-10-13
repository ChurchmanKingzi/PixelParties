'use strict';
// A09-13 · Smuggler's Pier: zahlt Gold für Karten, die gar nicht gezogen werden dürfen (Zieh-Sperre, Tuscan Artist)
// Kartentext Pier: „Both players may once per turn, during their turn, spend a multiple of 5 Gold to draw a card for every 5 Gold spent, up to a maximum of 6."
// Regelstand: `actionDrawCards` liefert unter `ps.drawLocked` (Sacred Jewel, Prayer) nichts (_engine.js Z. 10876). Pier prüft aber nur `ps.handLocked` (smuggler-s-pier.js `canActivateAreaEffect`/`onAreaEffect`), zahlt vorher per `_payCardCost`.
// Tuscan Artist: „any effect that would allow your opponent to draw 2 or 3 cards is negated." Ruling (_draw-block-shared.js Kopf): ist der Zug der EINZIGE Nutzen eines Effekts, ist der Effekt GESPERRT (ausgegraut), statt Kosten zu verbrauchen und nichts zu tun.
//   Die ~12 betroffenen Karten (Haste, Wheels, Creativity, Potion of Greed …) fragen dazu `drawWouldBeBlocked` – Pier nicht (und nicht in der Liste `_draw-block-shared`-Nutzer).
// Aufbau: Seed 1234. Sitz 0: Smuggler's Pier im Feld, 100 Gold, Deck 20 Karten, Main Phase 1. (A) `ps.drawLocked = true`. (B) Sitz 1 kontrolliert Tuscan Artist.
// Schritte: Pier aktivieren und 10 Gold (2 Karten) bzw. 15 Gold (3 Karten) zahlen.
// Erwartet: (A) Der Effekt ist nicht aktivierbar bzw. kostet nichts. (B) Die Stufen 2 und 3 Karten (die Artist negiert) werden nicht angeboten bzw. kosten nichts.
// Beobachtet: (A) 10 Gold weg, 0 Karten gezogen, Einmal-pro-Zug verbraucht. (B) 10 bzw. 15 Gold weg, 0 Karten. (Stufe 1 und 4+ laufen durch, korrekt.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const lauf = async (szene, karten) => {
    const t = await H.fresh({ hand: [[], []], gold: [100, 100] });
    t.putArea(0, "Smuggler's Pier");
    if (szene === 'A') t.gs.players[0].drawLocked = true;
    if (szene === 'B') t.put(1, 0, 0, 'Tuscan Artist');
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === "Smuggler's Pier", answer: () => ({ optionId: 'pay-' + karten }) });
    t.gs.activePlayer = 0; t.phase(2);
    const g0 = t.gs.players[0].gold, h0 = t.pile(0, 'hand').length;
    await t.run(() => t.engine.activateAreaEffect(0, 0, "Smuggler's Pier"));
    return { gold: g0 - t.gs.players[0].gold, gezogen: t.pile(0, 'hand').length - h0, angeboten: t.prompts.some(p => p.d.type === 'optionPicker'), errors: t.errors };
  };
  R.section('Kontrolle');
  const k = await lauf('K', 2);
  R.check('ohne Sperre: 10 Gold -> 2 Karten', k.gold === 10 && k.gezogen === 2, k);
  R.section('A: Zieh-Sperre (drawLocked)');
  const a = await lauf('A', 2);
  R.check('kein Gold ohne Gegenwert: entweder nicht angeboten oder 0 Gold gezahlt', a.gold === 0 || a.gezogen === a.gold / 5, a);
  R.section('B: Gegner kontrolliert Tuscan Artist');
  const b2 = await lauf('B', 2), b3 = await lauf('B', 3);
  R.check('2 Karten (10 Gold): nicht angeboten oder kostenlos', b2.gold === 0 || b2.gezogen === 2, b2);
  R.check('3 Karten (15 Gold): nicht angeboten oder kostenlos', b3.gold === 0 || b3.gezogen === 3, b3);
  R.check('keine Engine-Fehler', [k, a, b2, b3].every(x => x.errors.length === 0), [k, a, b2, b3].map(x => x.errors));
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
