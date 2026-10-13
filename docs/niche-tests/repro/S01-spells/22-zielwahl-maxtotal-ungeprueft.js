'use strict';
// S01-22 · Die Antwort einer Zielwahl wird serverseitig nicht auf `maxTotal` geprüft (Beispiel Divine Gift of Death: „up to 1/2/3")
// Kartentext: „Choose up to 1/2/3 defeated Heroes and revive them." (Stufe = Support Magic des Nutzers). Das Skript fragt mit `maxTotal: min(Support Magic, 3, Ziele)`.
// `server.js` `doConfirmPotion` weist nur `ineligible`-Ziele ab (Zeile ~11210: „autoritativer Flaschenhals"), `engine.resolveEffectPrompt(selectedIds)` reicht das Array ungeprüft weiter;
//   `divine-gift-of-death.js` iteriert `for (const id of picked)` ohne `slice(0, maxPicks)`.
// Aufbau: Held 0 mit Support Magic 1 (also höchstens 1 Held), zwei gefallene eigene Helden; die Antwort (wie von einem veränderten Client) nennt beide Ids.
// Erwartet: höchstens 1 Held wird erweckt (Stufe 1).
// Beobachtet: beide werden erweckt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of Death'], []], abilities: { 0: { 0: [['Support Magic'], [], []] } } });
  t.gs.players[0].heroes[1].hp = 0; t.gs.players[0].heroes[2].hp = 0;
  let cfg = null;
  t.targetFn = (v, c) => { cfg = c; return v.map(x => x.id); };         // beide Ids, obwohl maxTotal 1
  await t.play(0, 'Divine Gift of Death', { hero: 0, noGrant: true });
  const erweckt = t.gs.players[0].heroes.filter((h, i) => i > 0 && h.hp > 0).length;
  R.check('Support Magic 1: höchstens 1 Held wird erweckt', erweckt <= 1, { erweckt, maxTotal: cfg && cfg.maxTotal });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
