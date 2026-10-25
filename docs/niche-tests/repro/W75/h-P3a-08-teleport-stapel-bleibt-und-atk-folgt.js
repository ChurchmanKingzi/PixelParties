'use strict';
// W75 · Darion (Audit P3a) — Teleport mit Darion: der Equip-Stapel „bleibt, wo er war", Namen und Instanzen bleiben konsistent, ATK-Boni folgen dem TRAEGER.
// Kartentext Teleport: „Choose two Heroes you control and swap their positions as well as the positions of their Abilities. Any cards in their Support Zones remain where they were."
// Erwartet: Darion (Platz 0) traegt per echtem Ausruesten Club (+30 ATK) / Blade (+10 ATK) / Crown in EINER Zone; Tushu (Platz 1) traegt Glass Sword. Nach Teleport steht Darion auf Platz 1 und Tushu auf Platz 0;
//   der Stapel bleibt in Spalte 0 (jetzt bei Tushu), Glass Sword in Spalte 1 (jetzt bei Darion). Jede Karte hat den Wirt gewechselt: Darion verliert +40 ATK und gewinnt Glass Swords Bonus, Tushu bekommt +40.
//   Keine Karte geht verloren, jede Instanz zeigt auf ihre alte Spalte. Ein erneutes Teleport stellt alles zurueck.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-08-teleport-stapel-bleibt-und-atk-folgt.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const T = 'Tushu, the Knowledge Keeper';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 0, heroes: [[D, T, null], [F, null, null]], hand: [['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown', 'Glass Sword', 'Teleport', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  const ps = t.gs.players[0];
  t.policy.confirm = true;
  // echtes Ausruesten (Stapel entsteht ueber den Handweg)
  await t.play(0, 'Club of Gobbo', { hero: 0, slot: 1 });
  await t.play(0, 'Blade of the Frostbringer', { hero: 0, slot: 0 });
  await t.play(0, 'Cute Crown', { hero: 0, slot: 2 });
  await t.play(0, 'Glass Sword', { hero: 1, slot: 0 });
  await t.drain();
  const atk = () => [t.hero(0, 0).atk, t.hero(0, 1).atk];
  const namen = () => [ps.supportZones[0].map(z => z.join('+')).filter(Boolean), ps.supportZones[1].map(z => z.join('+')).filter(Boolean)];
  const vorher = { atk: atk(), namen: namen(), darion: t.hero(0, 0).name };
  R.note('vorher', JSON.stringify(vorher));
  R.check('Ausgangslage: alle drei bei Darion in einer Zone, Glass Sword bei Tushu', vorher.namen[0].length === 1 && vorher.namen[0][0].split('+').length === 3 && vorher.namen[1].join() === 'Glass Sword', vorher.namen);

  t.targetFn = (valid) => valid.filter(v => v.type === 'hero' && v.owner === 0).slice(0, 2).map(v => v.id);
  await t.play(0, 'Teleport', { hero: 0 });
  await t.drain();
  const nachher = { atk: atk(), namen: namen(), hero0: t.hero(0, 0).name, hero1: t.hero(0, 1).name };
  R.note('nachher', JSON.stringify(nachher));
  const stapelInsts = t.inst(c => c.zone === 'support' && c.owner === 0 && ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'].includes(c.name));
  R.check('Helden getauscht (Tushu Platz 0, Darion Platz 1)', nachher.hero0 === T && nachher.hero1 === D, [nachher.hero0, nachher.hero1]);
  R.check('der Stapel liegt weiter in Spalte 0, Glass Sword in Spalte 1', nachher.namen[0].join() === vorher.namen[0].join() && nachher.namen[1].join() === 'Glass Sword', nachher.namen);
  R.check('Instanzen der drei Stapelkarten zeigen alle auf Spalte 0, dieselbe Zone', stapelInsts.length === 3 && stapelInsts.every(i => i.heroIdx === 0 && i.zoneSlot === stapelInsts[0].zoneSlot), stapelInsts.map(i => [i.name, i.heroIdx, i.zoneSlot]));
  // ATK folgt dem Traeger: Darion hatte Grund-ATK + 40 (Club + Blade), Tushu seine Grund-ATK. Nach dem Tausch umgekehrt.
  const dBase = vorher.atk[0] - 40;
  R.check('Tushu (jetzt Platz 0) hat die 40 ATK des Stapels dazu', nachher.atk[0] === vorher.atk[1] + 40, [nachher.atk, vorher.atk]);
  R.check('Darion (Platz 1) hat nur noch seine Grund-ATK', nachher.atk[1] === dBase, [nachher.atk, dBase]);
  R.check('Sauber (Zustandsrauchmelder; Stapel bei Tushu ist kein Fehler: er bleibt liegen)', t.errors.length === 0, [t.errors]);
  const audit = t.audit().filter(x => !/hält 3 Karten|3 Instanzen/.test(x));
  R.check('Audit ohne Auffaelligkeiten ausser dem liegengebliebenen Stapel', audit.length === 0, audit);

  // zurueck
  await t.play(0, 'Teleport', { hero: 0, extra: 0 });
  await t.drain();
  R.note('zurueck', JSON.stringify({ atk: atk(), namen: namen() }));
  R.check('zweites Teleport stellt Wirte und ATK wieder her', t.hero(0, 0).name === D && atk()[0] === vorher.atk[0] && atk()[1] === vorher.atk[1], [atk(), vorher.atk]);
  R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
