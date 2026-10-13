'use strict';
// S02-12 · Guard Change bietet gestohlene Kreaturen an, kann sie aber nicht bewegen (stille Fehlzüge, bis zu 64 Wiederholungen der Abfrage)
// Kartentext: „Choose any number of Creatures you control (min. 1) and place them into free Support Zones of other Heroes you control. …"
// Aufbau: Eine Kreatur von Sitz 1 wird per `actionStealCreature(0, …)` von Sitz 0 gestohlen (controller 0, owner 1; sie bleibt physisch in der Zone von Sitz 1).
//   Sitz 0 spielt Guard Change (Mensch-Pfad: `isCpuPlayer` = false, sonst nimmt das Skript den CPU-Kurzweg) und wählt die gestohlene Kreatur samt angebotenem Ziel.
// Erwartet: entweder wird die gestohlene Kreatur gar nicht angeboten, oder sie lässt sich bewegen.
// Beobachtet: `ownSupportCreatures` bietet sie an (6 Zielzonen), `moveCreature` scheitert still (`sArr.indexOf(inst.name) < 0`, weil `ps = players[Kontrolleur]`
//   die Instanz nicht enthält); die Abfrage (`guardChangeMove`) öffnet sich immer wieder (hier bis zur Schleifenbremse 64), die Kreatur rührt sich nicht.
// Ursache: `cards/effects/guard-change.js` Z. 52-61 (Auswahl nach `controller ?? owner`) vs. Z. 105-109 und `swapCreatures` (Bewegung in den Zonen des Kontrolleurs, die gestohlene Kreatur liegt aber in der Zone des Besitzers).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Guard Change'], []] });
  t.engine.isCpuPlayer = () => false;                 // Mensch-Pfad (der Harness-Standard „beide Sitze CPU" nähme den CPU-Kurzweg)
  const Y = t.put(1, 0, 0, H.INERT.big); Y.counters.currentHp = 1000; Y.counters.maxHp = 1000;
  await t.engine.actionStealCreature(0, Y);
  await new Promise(r => setTimeout(r, 250));   // Steal-Kette (Reaktionsfenster) läuft kurz nach; sie sperrt Handkarten (_chainResolvingLock)
  let offered = false, asked = 0;
  t.script.push({ match: d => d.type === 'guardChangeMove', answer: (d) => {
    asked++;
    const c = d.creatures.find(x => x.instId === Y.id);
    if (!c || !c.dests.length) return { done: true };
    offered = true;
    return { instId: Y.id, destHeroIdx: c.dests[0].heroIdx, destSlot: c.dests[0].slotIdx };
  } });
  const before = [Y.heroIdx, Y.zoneSlot];
  const r = await t.play(0, 'Guard Change', { hero: 0 });
  t.say('Guard Change:', r, '| gestohlene Kreatur angeboten:', offered, '| Abfragen:', asked, '| Position vorher/nachher:', before, [Y.heroIdx, Y.zoneSlot]);
  R.check('Aufbau: gestohlene Kreatur wird kontrolliert', Y.controller === 0 && Y.owner === 1, [Y.owner, Y.controller]);
  R.check('wenn angeboten, dann lässt sie sich bewegen', !offered || (Y.heroIdx !== before[0] || Y.zoneSlot !== before[1]), { offered, vorher: before, nachher: [Y.heroIdx, Y.zoneSlot] });
  R.check('Abfrage wiederholt sich nicht ergebnislos (≤ 3 Abfragen)', asked <= 3, asked);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
