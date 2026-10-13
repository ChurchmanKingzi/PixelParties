// A08-29 · Ushabti: das spätere Beschwören der eingelagerten Kreatur (`summon_ushabti`) fragt weder Grinning Cat noch die Beschwörungssperre ab
//
// Kartentexte: Grinning Cat: „While this card is in your hand, you cannot summon any Creatures except "Grinning Cat"." Ushabti: „A player may summon a Creature placed by this effect as an additional Action …"
// Aufbau: Sitz 0 legt die eigene „ZZ Dummy" per Ushabti in die Surprise Zone (echter Spielweg), ein Zug später hält er eine Grinning Cat auf der Hand.
// Messung 1 (dynamisch): `engine.getSummonBlocked(0)` listet den Namen der Kreatur als gesperrt (so lehnt `doPlayCreature` ihn ab; die Liste kennt nur Handkarten, daher eine gleichnamige Handkopie).
// Messung 2 (statisch, weil der Socket-Handler headless nicht aufrufbar ist): der Quelltext von `socket.on('summon_ushabti')` (server.js) enthält weder `getSummonBlocked` noch `summonLocked`
//   (anders als `doPlayCreature`, server.js ~9804-9806); auch die Anzeigeliste `ushabtiSummonable` fragt sie nicht ab.
// Erwartung: Beschwören aus der Surprise Zone ist unter derselben Sperre nicht möglich wie das Ausspielen aus der Hand.
// Aufruf: node docs/niche-tests/repro/A08-pacman/29-ushabti-beschwoerung-umgeht-beschwoerungssperren.js   (✗ = Fehler tritt auf)
const fs = require('fs');
const path = require('path');
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, F = H.INERT.filler;
  const t = await H.fresh({ hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
  const c = t.put(0, 0, 0, D); c.turnPlayed = 1;
  t.targetFn = (v) => [v.find(x => x.type === 'equip').id];
  await t.play(0, 'Ushabti of the Great Pharaoh', {});
  R.check('Aufbau: Kreatur liegt per Ushabti in der Surprise Zone', c.zone === 'surprise' && c.ushabtiPlaced === true, c.zone);
  t.engine.handZugangSync(0, 'Grinning Cat');
  t.engine.handZugangSync(0, D);      // eine gleichnamige Handkopie macht die Sperre in `getSummonBlocked` (listet nur Handkarten) sichtbar
  const blockiert = t.engine.getSummonBlocked(0).includes(D);
  R.check('Messung 1: Grinning Cat sperrt das Beschwören der Dummy (getSummonBlocked)', blockiert, t.engine.getSummonBlocked(0));

  const src = fs.readFileSync(path.join(__dirname, '../../../../server.js'), 'utf8');
  const a = src.indexOf("socket.on('summon_ushabti'");
  const b = src.indexOf("socket.on('activate_ability'", a);
  const handler = src.slice(a, b);
  R.check('Messung 2: Handler summon_ushabti gefunden', a > 0 && b > a, { a, b });
  R.check('Messung 2: Handler fragt getSummonBlocked ab', /getSummonBlocked/.test(handler), 'fehlt');
  R.check('Messung 2: Handler fragt ps.summonLocked ab', /summonLocked/.test(handler), 'fehlt');
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
