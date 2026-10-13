'use strict';
// M02-05 · Stealth schützt den Helden weiter, wenn er gefroren / betäubt / negiert ist
// Kartentext Stealth (Lv3): „This Hero cannot be chosen by your opponent's level 3 or lower Attacks/Spells while you control other Heroes that can be chosen."
// Konvention (CARD_API.md Z. ~4364; B-querschnitt.md B-01…B-03): „runHooks filtert Abilities toter, eingefrorener, betäubter und negierter Helden zentral heraus" –
//   die Abilities eines gefrorenen/betäubten/negierten Helden sind stillgelegt. Stealth ist aber ein Dauer-Vertrag (`blocksTargeting`), der NICHT über runHooks läuft.
// Erwartung: ist der Stealth-Held gefroren, betäubt oder negiert, kann ihn eine Lv1-Attacke des Gegners wählen (der Schutz ist wie jede Ability stillgelegt).
// Beobachtet: in allen drei Zuständen wird der Held weiterhin NICHT angeboten (ausgegraut), `stealth.js:blocksTargeting` prüft keinen Heldenstatus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function angebotene(status) {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(1, 0, [['Stealth', 'Stealth', 'Stealth'], [], []]);   // Held 0 von Sitz 1: Stealth Lv3
    if (status) t.heroStatus(1, 0, status);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1); return [v.id]; };
    await t.play(0, 'Quick Attack', { hero: 1 });
    return t.targets[0].valid.filter(v => v.type === 'hero' && v.owner === 1).map(v => v.heroIdx);
  }
  const normal = await angebotene(null);
  R.check('Kontrolle: Stealth-Held (nicht gestört) wird NICHT angeboten', !normal.includes(0), normal);
  for (const st of ['frozen', 'stunned', 'negated']) {
    const l = await angebotene(st);
    R.check(`Stealth-Held ${st}: wird wieder wählbar (Schutz stillgelegt)`, l.includes(0), l);
  }
  R.finish();
})();
