'use strict';
// N4-archetypen-09 · Bomblebee: die soeben besiegte Kreatur steht noch in der Zielliste des 150-Schadens
// Kartentext (Bomblebee): „Once per turn, when a target your opponent controls is defeated, you may choose a target your opponent controls and deal 150 damage to it."
// Erwartung: Besiegt ist besiegt – die gefallene Kreatur liegt nicht mehr auf dem Brett und wird nicht von „a target your opponent controls" erfasst; sie steht nicht zur Wahl.
//   (Vergleich: Heli Troopers schließt die sterbende Kreatur ausdrücklich aus, mischief-militia-heli-troopers.js `if (inst.id === ctx.card.id) continue`.)
// Beobachtet: `opponentTargets()` (bomblebee.js) liest die Instanzliste; im Todes-Hook ist die Instanz noch `zone: 'support'` (nur der Zonen-Eintrag ist leer) → die gefallene Kreatur steht als
//   `equip-1-0-0` in der Liste. Wählt der Spieler sie, verpufft der Schlag ("bomblebee_strike" auf die tote Kreatur) und das Einmal-pro-Zug-Recht ist verbraucht. Gleiches bei Tod durch Schaden.
// Gegenprobe: die anderen Gegnerziele (zweite Kreatur, Helden) stehen zur Wahl.
const H = require('../../lib/h.js');
async function lauf(todesart) {
  const t = await H.fresh({ hand: [['ZZ Filler'], ['ZZ Filler']], deckSize: 30 });
  const b = t.put(0, 0, 0, 'Bomblebee'); b.turnPlayed = 1;
  const opfer = t.put(1, 0, 0, H.INERT.frail); opfer.turnPlayed = 1;
  const ziel = t.put(1, 1, 0, H.INERT.big); ziel.turnPlayed = 1;
  let liste = null;
  t.targetFn = (valid) => { liste = valid.map(v => `${v.type}:${v.owner}:${v.heroIdx}:${v.slotIdx ?? ''}`); return [valid[valid.length - 1].id]; };
  if (todesart === 'destroy') await t.run(() => t.engine.actionDestroyCard({ name: 'X', owner: 0 }, opfer));
  else await t.run(() => t.engine.actionDealCreatureDamage({ name: 'X', owner: 0, heroIdx: 0 }, opfer, 100, 'creature', { sourceOwner: 0 }));
  return { t, liste };
}
(async () => {
  const R = H.runner();
  for (const art of ['destroy', 'damage']) {
    const { t, liste } = await lauf(art);
    R.check(`${art}: Aufbau – Bomblebee fragt nach einem Ziel`, !!liste, liste);
    R.check(`${art}: Gegenprobe – zweite Gegnerkreatur (equip:1:1:0) und Helden sind wählbar`, !!liste && liste.includes('equip:1:1:0') && liste.some(x => x.startsWith('hero:1')), liste);
    R.check(`${art}: die gerade besiegte Kreatur (equip:1:0:0) steht NICHT zur Wahl`, !!liste && !liste.includes('equip:1:0:0'), liste);
    R.check(`${art}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
