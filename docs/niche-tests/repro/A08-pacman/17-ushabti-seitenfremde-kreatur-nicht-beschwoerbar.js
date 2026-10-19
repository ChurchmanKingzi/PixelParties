// A08-17 · Ushabti + seitenfremd beschworene Kreatur (Plant Golem): liegt verdeckt in der Surprise Zone des Gegners und kann von KEINEM Spieler mehr beschworen werden
//
// Kartentext: „Choose any Creature on the board and place it face-down into the Surprise Zone of the corresponding Hero. A player may summon a Creature placed by this effect
// as an additional Action during their turn with the corresponding Hero."
// Aufbau: Sitz 0 spielt Plant Golem (Besitzer 0, landet als Kontrolleur 1 auf Seite 1). Danach spielt Sitz 0 (bzw. 1) Ushabti auf den Golem.
// Erwartung: der Golem liegt in der Surprise Zone von Seite 1 / Held 0; der Spieler dieses Helden (Sitz 1) darf ihn später beschwören („a player ... with the corresponding Hero").
// Beobachtet: Zustand ✓ (Golem in `surpriseZones[1][0]`, `owner` 0, `controller` 1). Der Beschwörungsweg `socket 'summon_ushabti'` (server.js ~15055-15075) und die Anzeige
//   `ushabtiSummonable` (server.js ~5822-5830) verlangen `inst.owner === playerIdx` UND lesen `ps.surpriseZones[heroIdx]` desselben Spielers: für Sitz 1 scheitert `inst.owner === 1`
//   (Besitzer ist 0), für Sitz 0 ist dessen eigene Surprise Zone leer. Beide Prädikate unten 1:1 nachgebildet (der Socket-Handler selbst ist headless nicht aufrufbar).
//   Folge: die Karte ist dauerhaft verloren und blockiert die Surprise Zone von Held 0 der Gegenseite.
// Aufruf: node docs/niche-tests/repro/A08-pacman/17-ushabti-seitenfremde-kreatur-nicht-beschwoerbar.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], []] });
  t.grantFor(0, 0, 'Plant Golem');
  await t.play(0, 'Plant Golem', { hero: 0 });
  t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.cardName === 'Plant Golem').id];
  t.gs.players[0].heroesActedThisTurn = [];
  await t.play(0, 'Ushabti of the Great Pharaoh', {});
  const g = t.inst(x => x.name === 'Plant Golem' && x.zone === 'surprise')[0];
  R.check('Aufbau: Golem liegt verdeckt in der Surprise Zone von Seite 1', !!g && t.gs.players[1].surpriseZones[0][0] === 'Plant Golem', g && g.zone);
  R.note('Instanz', JSON.stringify({ owner: g && g.owner, controller: g && g.controller, ushabtiPlaced: g && g.ushabtiPlaced }));
  // Prädikate des Servers (server.js ~15067-15070 bzw. ~5828) für beide Sitze:
  const summonableBy = (pi) => {
    const sz = t.gs.players[pi].surpriseZones?.[0] || [];
    if (sz.length === 0) return false;
    return !!t.engine.ushabtiEingelagert(pi, 0);   // W16d: der Server-Handler nutzt jetzt diese Engine-Methode (Seite der Zone statt Besitzer)
  };
  R.check('Sitz 1 (Spieler des Helden, in dessen Surprise Zone der Golem liegt) darf ihn beschwören', summonableBy(1), 'Handler lehnt ab');
  R.check('oder wenigstens Sitz 0 (Besitzer) darf ihn beschwören', summonableBy(0) || summonableBy(1), 'Handler lehnt ab');   // W16d: der Spieler des Helden genügt („A player … with the corresponding Hero")
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
