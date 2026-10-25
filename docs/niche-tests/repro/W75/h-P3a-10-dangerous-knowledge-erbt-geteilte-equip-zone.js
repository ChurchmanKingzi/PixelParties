'use strict';
// W75 · Darion (Audit P3a) — Dangerous Knowledge: wer Darions Effekt gewinnt, teilt auch SEINE Equips in einer Zone; Darion selbst behaelt seinen Stapel.
// Kartentext Dangerous Knowledge: „Choose a Hero your opponent controls with a different name from all Heroes you control (including defeated ones). The user gains that Hero's effects in addition to its own
// for the rest of the game." Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Tushu (Sitz 0) gewinnt Darions Effekte. Danach landen Club und Blade (echtes Ausruesten, zweite Karte OHNE Zonenfrage) in EINER Zone bei Tushu. Darions eigener Stapel bei Sitz 1 bleibt unberuehrt.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-10-dangerous-knowledge-erbt-geteilte-equip-zone.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const T = 'Tushu, the Knowledge Keeper';
(async () => {
  const R = H.runner();
  R.section('Dangerous Knowledge auf Darion, danach zwei Equips bei Tushu');
  const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [['Dangerous Knowledge', 'Club of Gobbo', 'Blade of the Frostbringer', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  const ps = t.gs.players[0];
  t.policy.confirm = true;
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 1) || valid[0]).id];
  await t.play(0, 'Dangerous Knowledge', { hero: 0 });
  await t.drain();
  const hero = t.hero(0, 0);
  R.note('gewonnen', JSON.stringify(hero.gainedEffectNames));
  R.check('Tushu hat Darions Effekt gewonnen', (hero.gainedEffectNames || []).includes(D), hero.gainedEffectNames);
  R.check('teilenAktiv fuer Tushu', require('../../../../cards/effects/_equip-stack-shared.js').teilenAktiv(t.engine, 0, 0) === true, null);
  const zonenFragen = [];
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { zonenFragen.push(d.zones.length); return { heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }; } });
  await t.play(0, 'Club of Gobbo', { hero: 0, slot: 0 });
  await t.play(0, 'Blade of the Frostbringer', { hero: 0, slot: 2 });
  await t.drain();
  R.note('lauf', JSON.stringify({ zonen: ps.supportZones[0], zonenFragen }));
  const belegt = ps.supportZones[0].filter(z => z.length);
  R.check('Club und Blade teilen EINE Zone bei Tushu', belegt.length === 1 && belegt[0].length === 2, ps.supportZones[0]);
  // Die unsichtbare Traegerinstanz des gewonnenen Heldeneffekts (Zone `gained`, Platz -1) meldet der Rauchmelder immer als „Geister-Instanz" — das ist keine Darion-Folge.
  const audit = t.audit().filter(x => !/slot-1\)/.test(x));
  R.check('Sauber', t.errors.length === 0 && audit.length === 0, [t.errors, audit]);
  R.finish();
})();
