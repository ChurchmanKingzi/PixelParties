'use strict';
// A02-deepsea-07 · Slippery Ice (Spielerweg): eine geliehene Kreatur auf der GEGENSEITE wird zum Verschieben angeboten
//
// Kartentext (Slippery Ice): „While this Area Spell remains on the board, both players may once per turn move as many Creatures they control
// as possible into free Support Zones of adjacent Heroes they also control."
// Erwartung: Eine mir (z. B. per Deepsea Succubus) geliehene Kreatur steht in der Zone eines GEGNERISCHEN Helden; die Nachbarn dieses Helden
//   sind nicht „Heroes they also control" → es gibt kein legales Ziel, die Kreatur wird nicht angeboten.
// Beobachtet: `ownSupportCreatures` (Kontrolle) nimmt sie auf, `destinationsFor` rechnet auf MEINER Seite (eigene Held-Spalten), die
//   Auswahl zeigt sie mit dem Namen MEINES Helden an der gleichen Position; nach der Zielwahl scheitert `moveCreature` still
//   (`srcZone.indexOf(inst.name) < 0`) – ohne `movedInstIds`-Eintrag, das Fenster öffnet sich erneut (Endlosschleife bis zum Abbruch).
//   Liegt an derselben Koordinate meiner Seite eine gleichnamige Kreatur, wird deren Name verschoben und die Instanz des Gegners zeigt
//   danach auf die falsche Seite (nicht mit-reproduziert).
// Ursache: `slippery-ice.js` Z. 78–130 (`destinationsFor`, `moveCreature`) und Z. 238–265 arbeiten ausschließlich auf `gs.players[activator]`.
//   Hinweis: die Harness meldet beide Sitze als CPU; der Spielerweg wird hier erzwungen (`isCpuPlayer` → false nur für diese Aktivierung).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  t.putArea(0, 'Slippery Ice');
  const mine = t.put(0, 1, 0, H.INERT.creature); mine.turnPlayed = 1;
  const x = t.put(1, 1, 0, H.INERT.big); x.turnPlayed = 1;
  await t.run(() => t.engine.actionStealCreature(0, x, { sourceName: 'Deepsea Succubus', damageImmune: true }));
  R.check('Vorbedingung: x gehört mir (Kontrolle), steht beim Gegner', x.owner === 1 && x.controller === 0, [x.owner, x.controller]);
  const orig = t.engine.isCpuPlayer.bind(t.engine);
  t.engine.isCpuPlayer = () => false;
  const sourcePicks = [];
  let n = 0;
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => {
    n++;
    if (/Pick a Creature|Pick another/.test(d.description || '')) sourcePicks.push(d.zones.map(z => z.label));
    if (n > 8) return null;                       // Abbruch (Notausgang gegen die Endlosschleife)
    // immer die geliehene Kreatur (Dummy Big) als Quelle wählen, erstes Ziel nehmen
    const z = d.zones.find(z => /Big/.test(z.label)) || d.zones[0];
    return { heroIdx: z.heroIdx, slotIdx: z.slotIdx };
  } });
  t.phase(2);
  await t.run(() => t.engine.activateAreaEffect(0, 0, 'Slippery Ice'));
  t.engine.isCpuPlayer = orig;
  R.note('Quellen-Auswahlen', sourcePicks);
  R.check('Die geliehene Kreatur der Gegenseite (ZZ Dummy Big) wird nicht zum Verschieben angeboten', !sourcePicks.some(p => p.some(l => /Big/.test(l))), sourcePicks);
  R.check('kein wiederholtes Auswahlfenster (≤ 2 Quellen-Fenster)', sourcePicks.length <= 2, sourcePicks.length);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
