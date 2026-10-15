'use strict';
// A02-deepsea-15 · Dark Deepsea God: „once per game" fehlt – der Flächenschaden löst jeden Zug erneut aus
//
// Kartentext (Dark Deepsea God, data/cards.json): „… When this Creature is played, deal 150 damage to all targets your opponent controls.
// You can only resolve this effect of "Dark Deepsea God" once per game. This effect can only occur once per turn."
// WELLE 9: Regel geändert (siehe Prüfung unten). Alte Erwartung (überholt): Der 150-Schaden wird in der ganzen Partie nur ein einziges Mal aufgelöst (die Engine kennt dafür `oncePerGame` / `oncePerGameEffect`).
// Beobachtet: Das Skript sperrt nur „einmal pro Zug" (`claimHOPT('ddg_aoe', pi)`, Z. ~127). In einem späteren Zug (DDG wieder auf der Hand, z. B. per Shapeshift/Castle/Monstrosity
//   zurückgeholt, wieder zwei Opfer) richtet er den Schaden erneut an. Es gibt weder `oncePerGame` noch `oncePerGameEffect` im Skript, kein Ruling in CARD_API.
// Hinweis: Skript-Kommentare nennen DDG „EXTREM stark … Balancing-Mechanismus = Breite des eigenen Bretts"; ob „once per game" in der aktuellen Textfassung gewollt ist, ist die Frage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Dark Deepsea God'], []], hp: 800 });
  const a = t.put(0, 0, 0, 'Deepsea Werewolf'), b = t.put(0, 1, 0, 'Deepsea Siren');
  a.turnPlayed = b.turnPlayed = 1;
  const hpOpp = () => [0, 1, 2].map(i => t.hp(1, i));
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t.targetFn = (valid) => valid.filter(v => v.type === 'equip').map(v => v.id);
  await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 0, noGrant: true });
  const nach1 = hpOpp();
  R.note('Gegner-HP nach DDG #1', nach1);
  R.check('DDG #1 hat den Flächenschaden angerichtet (Vorbedingung)', nach1.every(h => h === 650), nach1);

  // spätere eigene Runde: DDG wieder auf der Hand, Opfer-Kreaturen wieder auf dem Brett
  await t.endTurn(); await t.endTurn();
  const ddg = t.find('Dark Deepsea God', 'support');
  await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, ddg));   // DDG verlässt das Brett (nur Aufbau)
  t.setHand(0, ['Dark Deepsea God']);
  const c = t.put(0, 1, 0, 'Deepsea Werewolf'), d = t.put(0, 2, 0, 'Deepsea Siren');
  c.turnPlayed = d.turnPlayed = 1;
  await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 0, noGrant: true });
  const nach2 = hpOpp();
  R.note('Gegner-HP nach DDG #2 (späterer Zug)', nach2);
  // Welle 9 (Al, 15.10.2026, Q11): „Ja, die once per game Klausel kann einfach weg“ / „Es sollte einmal pro Runde sein“ – der Satz ist aus data/cards.json gestrichen,
  // der Schaden löst einmal pro ZUG auf (in einem späteren Zug erneut). Das Repro prüft jetzt die Pro-Zug-Regel (früher: einmal pro Spiel).
  R.check('DDG #2 (späterer Zug): der Flächenschaden löst erneut aus (einmal pro Zug, nicht pro Spiel)', nach2.every(h => h === 500), nach2);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
