'use strict';
// W16e · F01-01 Gegenprobe: Cool Repair legt Crusader's Cutlass nur an Cecilia an (Zielliste enthält Tushu nicht), die erlaubte Ausrüstung kommt an.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const CEC = 'Cecilia, the Harrowing Crusader';
  const t = await H.fresh({ heroes: [[CEC, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], undefined],
    hand: [['Cool Repair'], []], discard: [["Crusader's Cutlass"], []], gold: [100, 100] });
  let angeboten = null;
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: "Crusader's Cutlass" }) });
  t.targetFn = (valid) => { angeboten = valid.map(v => v.owner + ':' + v.heroIdx); return [valid.find(v => v.heroIdx === 0).id]; };
  const r = await t.play(0, 'Cool Repair', { hero: 0 });
  R.check('Cutlass liegt an Cecilia (Held 0)', t.gs.players[0].supportZones[0].flat().includes("Crusader's Cutlass"), { r, z: t.gs.players[0].supportZones[0] });
  R.check('angeboten wurden nur Zonen von Held 0', !!angeboten && angeboten.every(x => x === '0:0'), angeboten);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})();
