'use strict';
// N4-archetypen-07 · Hardy Slime: seitenfremd beschworen (über einen übernommenen Helden des Gegners) erzwingt keine Zielwahl
// Kartentext (Hardy Slime): „When you summon this Creature, your opponent has to choose it with all Attacks and Spells they use until your next turn, if possible."
// Aufbau: Sitz 0 übernimmt Held 0 von Sitz 1 (actionStealHero) und beschwört dort Hardy Slime (Brettseite 1, Kontrolleur Sitz 0). Sitz 1 greift mit „Attack" an (Held 2).
//   Gegenprobe: normal beschworen (Brettseite 0) – die Helden von Sitz 0 sind für Sitz 1 nicht mehr wählbar, der Hardy Slime schon.
// Erwartung: Auch seitenfremd muss Sitz 1 den Hardy Slime wählen (kein Held von Sitz 0 in der Zielliste).
// Beobachtet: `_applyForcesTargetingFilter` (_engine.js:~335, ~370) bildet die Ziel-ID des Spötters aus dem KONTROLLEUR (`equip-<controller>-…`), die Zielliste führt die BRETTSEITE
//   (`equip-<owner>-…`) → die ID wird nicht gefunden (`if (!targets.find(...)) continue`), der Filter greift nicht; alle Helden von Sitz 0 bleiben wählbar.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function lauf(modus) {
  const t = await H.fresh({ hand: [['Hardy Slime'], ['Attack']], deckSize: 30 });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  t.setAbilities(1, 0, [['Summoning Magic'], [], []]);
  t.put(1, 2, 0, H.INERT.big);
  if (modus === 'normal') await t.play(0, 'Hardy Slime', { hero: 0, slot: 0 });
  else {
    await t.run(() => t.engine.actionStealHero(0, 1, 0)); await sleep(300);
    await t.play(0, 'Hardy Slime', { hero: 0, slot: 0, charmedOwner: 1 });
  }
  const hardy = t.find('Hardy Slime', 'support');
  t.gs.activePlayer = 1; t.hero(1, 2).atk = 100; t.hero(1, 2).baseAtk = 100;
  t.targetFn = (valid) => [valid[0].id];
  t.setHand(1, ['Attack']);
  await t.play(1, 'Attack', { hero: 2 });
  const valid = (t.targets[t.targets.length - 1] || {}).valid || [];
  const helden0 = valid.filter(v => v.type === 'hero' && v.owner === 0).length;
  return { t, hardy, helden0, hardyDa: valid.some(v => v.type === 'equip' && v.cardName === 'Hardy Slime'), seitenfremd: !!hardy && hardy.owner !== (hardy.controller ?? hardy.owner) };
}
(async () => {
  const R = H.runner();
  const k = await lauf('normal');
  R.check('Gegenprobe (normal): Hardy wählbar, Helden von Sitz 0 nicht', k.hardyDa && k.helden0 === 0, { hardyDa: k.hardyDa, helden0: k.helden0 });
  const s = await lauf('seitenfremd');
  R.check('Aufbau: Hardy Slime steht seitenfremd (Brettseite ≠ Kontrolleur) und ist wählbar', s.seitenfremd && s.hardyDa, { seitenfremd: s.seitenfremd, hardyDa: s.hardyDa });
  R.check('seitenfremd: Sitz 1 muss den Hardy Slime wählen – keine Helden von Sitz 0 in der Zielliste', s.helden0 === 0, { helden0: s.helden0 });
  R.check('keine Engine-Fehler', s.t.errors.length === 0, s.t.errors);
  R.finish();
})();
