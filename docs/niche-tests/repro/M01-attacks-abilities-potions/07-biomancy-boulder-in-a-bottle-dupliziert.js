'use strict';
// M01-07 · Biomancy + Boulder in a Bottle: dieselbe Potion wird zum Fels beim Gegner UND zum Biomancy Token beim Spieler (Kartenverdopplung)
// Kartentext Biomancy 1): „You may once per turn place a Potion you play into a free Support Zone of this Hero as a Biomancy Token … instead of deleting it."
// Kartentext Boulder in a Bottle: „Place this card into the free Support Zone of a Hero your opponent controls. While it is in a Support Zone, this card is treated as a level 3 Creature with 150 HP …"
// Beide Karten wollen DIESELBE Potion behalten: Boulder legt sich selbst aufs Brett (Flag `placed` über das eigene `afterPotionUsed`, boulder-in-a-bottle.js), Biomancy (`afterPotionUsed`, biomancy.js:46)
// fragt nur `ctx.placed`. Die ältere Biomancy-Instanz feuert zuerst, sieht `placed === false` und bietet die Umwandlung an; erst danach setzt der Fels sein Flag.
// Aufbau: Sitz 0: Held 0 mit Biomancy Lv1, Boulder in a Bottle auf der Hand; Sitz 1: Held mit freien Support Zones. Biomancy-Frage: „Ja".
// Erwartet: Die Potion existiert genau einmal auf dem Brett (entweder Fels beim Gegner ODER Token bei Sitz 0; Biomancy wird gar nicht erst angeboten, weil die Potion schon liegt).
// Beobachtet: 1 Fels bei Sitz 1 (Held 0) UND 1 Biomancy Token „Boulder in a Bottle" (40 HP) bei Sitz 0 – eine Karte, zwei Brettobjekte.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Boulder in a Bottle'], []], hp: 800, abilities: { 0: { 0: [['Biomancy'], [], []] } } });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  const r = await t.play(0, 'Boulder in a Bottle');
  R.check('Boulder in a Bottle gespielt', r === true, r);
  const felsen = t.inst(c => c.name === 'Boulder in a Bottle' && c.zone === 'support' && !(c.counters && c.counters._effectOverride === 'Biomancy Token'));
  const tokens = t.inst(c => c.name === 'Boulder in a Bottle' && c.zone === 'support' && c.counters && c.counters._effectOverride === 'Biomancy Token');
  R.note('Fels-Instanzen / Token-Instanzen', { felsen: felsen.map(c => `seat${c.owner}`), tokens: tokens.map(c => `seat${c.owner}`) });
  R.check('Biomancy fragt NICHT nach einer Potion, die sich selbst aufs Brett gelegt hat', !t.prompts.some(p => p.d.title === 'Biomancy'), t.prompts.map(p => p.d.title));
  R.check('die Potion existiert genau einmal auf dem Brett', felsen.length + tokens.length === 1, { felsen: felsen.length, tokens: tokens.length });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
