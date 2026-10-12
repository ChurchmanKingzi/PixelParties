'use strict';
// A06-rebelliokai-06 · Tengu Windstorm umgeht den Area-Schutz von Pawn of Kings [B] (und jeden Area-Schutz)
// Kartentexte: Pawn of Kings [B]: „While "Board of Kings" is on the board, Areas cannot be removed from the board by
//   cards or effects of the opponent of the player who played them." · Tengu Windstorm: „Choose any card on the board
//   that is not a Hero and place it on top or bottom of its controller's deck."
// Beobachtung: Tengu Windstorm führt Areas in der Zielliste (_collectBoardTargets) und legt sie in `_bounceToDeck` über
//   `_removeCardFromState` ins Deck – ohne `engine.tryAreaProtection` (_engine.js:48119), das Pawn [B]
//   (`onAreaWouldBeAffected`), Guardian of Teocuilatl und Wowhalla bedient. Andere Area-Entferner rufen es
//   (removeArea/deleteArea/The Yeeting/Hammer Skeleton …).
// Aufbau: Sitz 1 hat Board of Kings (Area) + Pawn of Kings [B] auf dem Brett. Sitz 0 spielt Tengu Windstorm
//   (Terror Tengu in der Ablage als Kosten) auf die Area.
// Erwartung: die Area bleibt liegen (Schutz); Gegenprobe: `engine.removeArea` mit Quelle Sitz 0 wird geschützt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // Gegenprobe
  let t = await H.fresh({});
  const area = t.putArea(1, 'Board of Kings');
  t.put(1, 0, 0, 'Pawn of Kings [B]');
  await t.run(() => t.engine.removeArea(area, 'Opp Effect', { sourceOwner: 0 }));
  R.check('Gegenprobe: removeArea durch den Gegner wird von Pawn [B] verhindert', t.gs.areaZones[1].includes('Board of Kings'), t.gs.areaZones[1]);

  // Tengu Windstorm
  t = await H.fresh({ hand: [['Tengu Windstorm'], []], discard: [['Rebelliokai Terror Tengu'], []] });
  t.putArea(1, 'Board of Kings');
  t.put(1, 0, 0, 'Pawn of Kings [B]');
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'top' }) });
  t.targetFn = (valid) => { const a = valid.find(v => v.type === 'area'); return [a ? a.id : valid[0].id]; };
  const r = await t.play(0, 'Tengu Windstorm', { hero: 0 });
  R.check('Tengu Windstorm wurde ausgeführt', r === true, r);
  R.check('Board of Kings bleibt trotz Tengu Windstorm auf dem Brett (Pawn [B] schützt Areas vor Gegner-Effekten)',
    t.gs.areaZones[1].includes('Board of Kings'), { areas1: t.gs.areaZones[1], deck1Top: t.pile(1, 'mainDeck')[0] });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
