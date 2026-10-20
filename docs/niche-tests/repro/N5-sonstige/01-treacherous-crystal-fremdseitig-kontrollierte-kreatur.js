'use strict';
// N5-01 · Treacherous Crystal: „take control of all Creatures you control" — eine Kreatur, die der Kristall-Halter KONTROLLIERT, aber auf der
// Brettseite des Gegners steht (über einen geliehenen Helden beschworen, Guard Change …: `inst.owner` = Brettseite, `inst.controller` = Halter),
// wird vom Handler übersprungen (`inst.owner !== oi`), obwohl `actionStealCreature` selbst nach dem KONTROLLEUR rechnet („bestohlen wird der Kontrolleur", Styx 28.9.).
// Kartentext: „While this card is in your hand, your opponent may take control of all Creatures you control during their turns."
// Erwartet: der Gegner (Aktivierer) übernimmt auch die Kreatur auf SEINER Seite, die der Halter kontrolliert (Gegenprobe: eigene Kreatur des Halters wird übernommen ✓).
// Hinweis: `doTriggerTreacherousCrystal` (server.js) ist nicht exportiert — der Repro schneidet die ECHTE Funktion aus server.js aus und führt sie mit Stub-Helfern aus.
// Aufruf: node docs/niche-tests/repro/N5-sonstige/01-treacherous-crystal-fremdseitig-kontrollierte-kreatur.js   (✗ = Fehler tritt auf)
const fs = require('fs'), path = require('path');
const H = require('../../lib/h.js');
const ROOT = path.resolve(__dirname, '../../../..');
function ladeTrigger() {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const i = src.indexOf('function doTriggerTreacherousCrystal(room, pi) {');
  let depth = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (depth === 0) break; } }
  const fn = new Function('require', 'opponentOfGs', 'roomPlayerCount', 'sendGameState', 'sendSpectatorGameState', src.slice(i, k + 1) + '\nreturn doTriggerTreacherousCrystal;');
  return fn((p) => require(p.startsWith('./') ? path.join(ROOT, p) : p), (gs, pi) => (pi === 0 ? 1 : 0), () => 2, () => {}, () => {});
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  const trig = ladeTrigger();
  for (const act of [0, 1]) {
    const hold = 1 - act;
    R.section(`Aktivierer Sitz ${act}, Halter Sitz ${hold}`);
    const hand = [[], []]; hand[hold] = ['Treacherous Crystal'];
    const t = await H.fresh({ active: act, hand });
    const eigene = t.put(hold, 0, 0, H.INERT.creature);                             // Kreatur des Halters auf seiner Seite
    const fremd = t.put(act, 0, 0, H.INERT.creature, { controller: hold, counters: { crossSideControlled: hold } });        // Kreatur auf MEINER Seite, vom Halter kontrolliert
    t.gs.activePlayer = act;
    const r = trig(t.room, act);
    await sleep(100);
    R.check('Gegenprobe: Kreatur des Halters auf seiner Seite wird übernommen', eigene.controller === act, { r, controller: eigene.controller });
    R.check('„all Creatures you control": auch die vom Halter kontrollierte Kreatur auf der Gegenseite wird übernommen', fremd.controller === act, { owner: fremd.owner, controller: fremd.controller });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
