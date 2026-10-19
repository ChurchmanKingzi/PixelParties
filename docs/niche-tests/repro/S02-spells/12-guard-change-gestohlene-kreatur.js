'use strict';
// S02-12 · Guard Change: gestohlene Kreaturen (stehen physisch beim Gegner) dürfen in freie Zonen meiner Helden ziehen
// Kartentext: „Choose any number of Creatures you control (min. 1) and place them into free Support Zones of other Heroes you control. …"
// Entscheidung Al (19.10.2026, W18b): „Ja, sie dürfen bewegt werden (und eigene in die Zonen temporär gestohlener Heroes). Es gibt ja bereits Funktionalität für
//   Creatures, die nicht auf der Seite ihres permanenten Kontrolleurs sind." — W16g hatte gestohlene Kreaturen ausgeschlossen; das kehrt sich um.
// Aufbau: Eine Kreatur von Sitz 1 wird per `actionStealCreature(0, …)` von Sitz 0 gestohlen (controller 0, owner 1; sie bleibt physisch in der Zone von Sitz 1).
//   Sitz 0 spielt Guard Change (Mensch-Pfad: `isCpuPlayer` = false, sonst nimmt das Skript den CPU-Kurzweg) und wählt die gestohlene Kreatur samt angebotenem Ziel.
// Erwartet: die gestohlene Kreatur wird angeboten und steht danach in der Zone meines Helden (Brettseite 0, Kontrolle 0); beim Besitzer bleibt sie die Karte (originalOwner 1).
// Weitere Fälle (Zonen temporär gestohlener Helden, Tausch über die Seiten): `W18/b-2-guard-change-kontrolle.js`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Guard Change'], []] });
  t.engine.isCpuPlayer = () => false;                 // Mensch-Pfad (der Harness-Standard „beide Sitze CPU" nähme den CPU-Kurzweg)
  const Y = t.put(1, 0, 0, H.INERT.big); Y.counters.currentHp = 1000; Y.counters.maxHp = 1000;
  await t.engine.actionStealCreature(0, Y);
  await new Promise(r => setTimeout(r, 250));   // Steal-Kette (Reaktionsfenster) läuft kurz nach; sie sperrt Handkarten (_chainResolvingLock)
  const aufbauOk = Y.controller === 0 && Y.owner === 1;
  let offered = false, asked = 0;
  t.script.push({ match: d => d.type === 'guardChangeMove', answer: (d) => {
    asked++;
    const c = d.creatures.find(x => x.instId === Y.id);
    if (!c || !c.dests.length) return { done: true };
    offered = true;
    const z = c.dests.find(x => x.owner === 0) || c.dests[0];
    return { instId: Y.id, destOwner: z.owner, destHeroIdx: z.heroIdx, destSlot: z.slotIdx };
  } });
  const r = await t.play(0, 'Guard Change', { hero: 0 });
  const seite = t.engine.physicalSide(Y);
  t.say('Guard Change:', r, '| angeboten:', offered, '| Abfragen:', asked, '| Seite/Held/Zone nachher:', seite, Y.heroIdx, Y.zoneSlot);
  R.check('Aufbau: gestohlene Kreatur wird kontrolliert', aufbauOk, [Y.owner, Y.controller]);
  R.check('gestohlene Kreatur wird angeboten', offered, { offered });
  R.check('sie steht jetzt auf meiner Brettseite (Zone von Sitz 0)', seite === 0 && t.gs.players[0].supportZones[Y.heroIdx][Y.zoneSlot].includes(Y.name), { seite, hero: Y.heroIdx, slot: Y.zoneSlot });
  R.check('alte Zone beim Gegner ist leer', (t.gs.players[1].supportZones[0][0] || []).length === 0, t.gs.players[1].supportZones[0]);
  R.check('Kontrolle bleibt bei Sitz 0, Kartenbesitzer bleibt Sitz 1', Y.controller === 0 && Y.originalOwner === 1, [Y.owner, Y.controller, Y.originalOwner]);
  R.check('Abfrage wiederholt sich nicht ergebnislos (≤ 3 Abfragen)', asked <= 3, asked);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
