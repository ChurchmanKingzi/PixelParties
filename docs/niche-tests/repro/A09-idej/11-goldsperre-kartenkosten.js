'use strict';
// A09-11 · Golden Arrow: „You cannot gain or spend Gold for the rest of the turn afterwards." – Gold-KOSTEN von Karten werden trotzdem gezahlt (Regelfrage)
// Kartentext Golden Arrow: „… You cannot gain or spend Gold for the rest of the turn afterwards."
// Engine: `ps.goldLocked` wird nur in actionGainGold/actionSpendGold (_engine.js Z. 24065/24122) und von einzelnen Karten (anti-magnet.js, golden-ladybug.js, hel-the-bound-specter.js) gelesen.
// Kartenkosten laufen über `_payCardCost` (Z. 24635, 19 Aufrufstellen) – das kennt die Sperre nicht (Kommentar dort: „Kosten sind an dieser Stelle nicht mehr verhandelbar").
// Aufbau: Seed 1234. Sitz 0: Held 0 = Idej Lord Daiyo (Fighting 1), Hand [Idej Blade - Hakai (Kosten 4), Angelfeather Arrow (Kosten 5), Attack], 100 Gold; `ps.goldLocked = true` (Zustand nach Golden Arrow).
// Schritte: 1. Idej Blade - Hakai ausrüsten (Gold-Kosten 4). 2. Attack spielen und Angelfeather Arrow ketten (Reaktions-Kosten 5).
// Erwartet (Lesart „Kosten zählen als Ausgabe"): beides ist unter der Goldsperre nicht zahlbar -> Gold bleibt 100, Equipment nicht ausgerüstet, Pfeil nicht gekettet.
// Beobachtet: Equipment wird gespielt (-4 Gold), der Pfeil wird gekettet (-5 Gold).
// Frage an Al: Soll die Goldsperre auch die Gold-Kosten von Karten (Artefakte, Reaktions-Artefakte, ggf. Potions) verbieten – oder gilt sie nur für Karteneffekte, die Gold ausgeben?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Idej Blade - Hakai', 'Angelfeather Arrow', 'Attack'], []], gold: [100, 100], heroes: [['Idej Lord Daiyo', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
  t.setAbilities(0, 0, [['Fighting'], [], []]);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  t.script.push({ match: d => d.type === 'cardGallery' && /Chain a Reaction/.test(d.title || ''), answer: (d) => ({ cardName: d.cards[0].name }) });
  t.gs.players[0].goldLocked = true;
  await t.play(0, 'Idej Blade - Hakai', { hero: 0 });
  R.check('Equipment mit Gold-Kosten 4 ist unter der Goldsperre nicht spielbar (Gold bleibt 100)', t.gs.players[0].gold === 100, { gold: t.gs.players[0].gold, ausgeruestet: t.zone(0, 0, 0) });
  const g = t.gs.players[0].gold;
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Reaktions-Artefakt (Kosten 5) wird unter der Goldsperre nicht gekettet', t.gs.players[0].gold === g, { gold: t.gs.players[0].gold, vorher: g });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
