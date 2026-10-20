'use strict';
// N4-archetypen-06 · Skeleton Reaper: eine seitenfremd beschworene Reaper bietet sich selbst als Ziel an („a Creature your opponent controls")
// Kartentext (Skeleton Reaper): „You may once per turn choose a Creature your opponent controls and deal 50 damage to it. If this damage defeats that Creature, you may immediately use this effect again."
// Aufbau: Sitz 1 übernimmt Held 0 von Sitz 0 und beschwört dort die Reaper (Brettseite 0, Kontrolleur Sitz 1). Auf Sitz 0 liegt zusätzlich eine eigene Kreatur (Held 1).
// Erwartung: wählbar nur Kreaturen, die der Gegner (Sitz 0) KONTROLLIERT – also die Dummy-Kreatur von Held 1, nicht die Reaper selbst (Kontrolleur Sitz 1).
// Beobachtet: `promptDamageTarget({side:'enemy'})` rechnet für Kreaturen nach Brettseite; die Reaper (Brettseite 0) steht selbst in der Liste (`equip:0:0:0`). Wählt man sie, trifft der Schlag nicht
//   sichtbar (kein Schadensaufruf, kein Log) – das Angebot ist also eine Falle. Die Aktivierbarkeits-Prüfung (`canActivateCreatureEffect`) liest dagegen den Kontrolleur. Gegenprobe: normal (eigene Seite)
//   steht die Reaper nicht in der Liste; Burning Skeleton (gleiche Lage) bietet sich nicht an.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function lauf(name, modus) {
  const t = await H.fresh({ hand: [['ZZ Filler'], ['ZZ Filler']], deckSize: 30, active: 1 });
  let sk;
  if (modus === 'normal') sk = t.put(1, 0, 0, name);
  else { await t.run(() => t.engine.actionStealHero(1, 0, 0)); await sleep(300); sk = t.put(0, 0, 0, name); t.engine.markiereSeitenfremd(sk, 1); }
  sk.turnPlayed = 1;
  t.put(0, 1, 0, 'ZZ Dummy');
  t.gs.activePlayer = 1; t.phase(2);
  t.targetFn = (valid) => [valid[valid.length - 1].id];
  const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: sk.heroIdx, zoneSlot: sk.zoneSlot, charmedOwner: modus === 'normal' ? undefined : 0 }));
  const valid = (t.targets[0] && t.targets[0].valid) || [];
  const selbst = valid.some(v => v.type === 'equip' && v.cardName === name);
  return { t, r, selbst, n: valid.length };
}
(async () => {
  const R = H.runner();
  const k = await lauf('Skeleton Reaper', 'normal');
  R.check('Gegenprobe (normal): Reaper aktivierbar, steht nicht in ihrer Zielliste', k.r === true && k.n > 0 && !k.selbst, k.selbst);
  const b = await lauf('Burning Skeleton', 'seitenfremd');
  R.check('Gegenprobe (Burning Skeleton seitenfremd): bietet sich nicht selbst an', b.n > 0 && !b.selbst, b.selbst);
  const s = await lauf('Skeleton Reaper', 'seitenfremd');
  R.check('Aufbau (seitenfremd): Zielliste ist nicht leer', s.n > 0, s.n);
  R.check('seitenfremd: die Reaper steht NICHT in der Liste „Creature your opponent controls"', !s.selbst, s.selbst);
  R.check('keine Engine-Fehler', s.t.errors.length === 0, s.t.errors);
  R.finish();
})();
