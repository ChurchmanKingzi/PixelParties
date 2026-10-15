'use strict';
// W12a · Rückfrage 1 (Sandy Blob) · Al, 15.10.2026: „Nein, nur explizit On-Summon-Effekte triggern Blob."
//   Sandy Blob: „… when the on-summon effect of a Creature you control activates, you may choose a target your opponent controls and deal 50 damage to it."
// Erwartet: Der Blob löst NUR bei Kreaturen aus, deren KARTENTEXT einen On-Summon-Effekt hat („When you summon this Creature …", „When this Creature is
//   summoned/played …") UND der wirklich wirkt. Ein technischer onPlay-/beforeSummon-Haken im Skript ohne solchen Text (Spinnen-Kosten, Archer, Albrecht,
//   Censpartan/Cykyran War Counselor, Crum, Duigno, Lunatic Hawk, Mischief Militia, Royal Corgi, Greatmaw Remora, Deepsea Jack O' Lantern …) löst ihn nie aus
//   und verbraucht keine der drei Ladungen. Gegenprobe: Kreaturen mit On-Summon-Text (Frolake, Gravedigger, Fiery Slime, Wire Hatchling …) lösen weiter aus.
// Der Text ist die Quelle: Helfer `hatOnSummonText` (`_summon-eligibility.js`), geprüft gegen `data/cards.json`.
const H = require('../../lib/h.js');
const { hatOnSummonText } = require('../../../../cards/effects/_summon-eligibility');
const cards = require('../../../../data/cards.json');
(async () => {
  const R = H.runner();
  const blob = (t) => t.targets.filter(x => x.config && x.config.title === 'Sandy Blob').length;
  const run = async (name) => {
    const t = await H.fresh({ hand: [[name], []], deck: [Array(10).fill(H.INERT.filler), []], gold: 100 });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.put(0, 0, 2, 'Sandy Blob').turnPlayed = 1;
    t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid[0].id];
    t.policy.confirm = true;
    const r = await t.play(0, name, { hero: 0, slot: 0, extra: 3 });
    return { t, r, n: blob(t), da: !!t.find(name, 'support') };
  };

  R.section('(1) Textprüfung: hatOnSummonText gegen data/cards.json');
  const text = (n) => hatOnSummonText(cards.find(c => c.name === n));
  for (const n of ['Frolake', 'Gravedigger', 'Fiery Slime', 'Wire Hatchling', 'Black Marketeer', 'Dark Deepsea God', 'Deepsea Werewolf', 'Soul Shard Ka', 'Tamed Hell Fox', 'The Spawn Mother']) {
    R.check(`${n}: Kartentext hat On-Summon-Effekt`, text(n) === true);
  }
  for (const n of ['Archer', 'Albrecht, the Nerd', 'Brain Spider', 'Baby Spider', 'Land Sharks', 'Censpartan War Counselor', 'Crum, the Class Pet', 'Priest of Luna',
    'Deepsea Jack O\' Lantern', 'Pure Advantage Camel', 'Water Golem', 'Elusive Hind', 'Plant Golem', 'Foresta, the Guard', 'Blue-Ice Dragon', 'Mausoleum Worm']) {
    R.check(`${n}: Kartentext hat KEINEN On-Summon-Effekt`, text(n) === false);
  }

  R.section('(2) ohne On-Summon-Text: der Blob bleibt stumm (Beschwörung klappt trotzdem)');
  for (const n of ['Brain Spider', 'Baby Spider', 'Diamond Spider', 'Box Spider', 'Crimson Skull Spider', 'Archer', 'Albrecht, the Nerd', 'Censpartan War Counselor',
    'Cykyran War Counselor', 'Crum, the Class Pet', 'Duigno, the Flaming Phoenix', 'Lunatic Hawk', 'Mischief Militia - Chilly Dog', 'Mischief Militia - Thaw Blader',
    'Royal Corgi', 'Greatmaw Remora', 'Deepsea Jack O\' Lantern']) {
    const { t, r, n: k, da } = await run(n);
    R.check(`${n}: beschworen`, r === true && da, { r, da });
    R.check(`${n}: kein Sandy-Blob-Fenster (kein On-Summon-Text)`, k === 0, k);
    R.check(`${n}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(3) mit On-Summon-Text und wirkendem Effekt: der Blob löst aus (Regression)');
  for (const n of ['Frolake', 'Gravedigger', 'Fiery Slime', 'Icy Slime', 'Wire Hatchling', 'Scavenging Crane', 'Shiny Slime']) {
    const { t, r, n: k, da } = await run(n);
    R.check(`${n}: beschworen`, r === true && da, { r, da });
    R.check(`${n}: Sandy-Blob-Fenster öffnet sich`, k >= 1, k);
    R.check(`${n}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('(4) die Ladungen bleiben: erst eine Karte ohne Text, dann eine mit Text im selben Zug');
  {
    const t = await H.fresh({ hand: [['Archer', 'Frolake'], []], deck: [Array(10).fill(H.INERT.filler), []], gold: 100 });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.put(0, 0, 2, 'Sandy Blob').turnPlayed = 1;
    t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid[0].id];
    t.policy.confirm = true;
    await t.play(0, 'Archer', { hero: 0, slot: 0, extra: 3 });
    const nachArcher = blob(t);
    await t.play(0, 'Frolake', { hero: 1, slot: 0, extra: 3 });
    R.check('Archer: kein Fenster', nachArcher === 0, nachArcher);
    R.check('Frolake danach: Fenster öffnet sich (alle drei Ladungen frei)', blob(t) === 1, blob(t));
    const blobInst = t.find('Sandy Blob', 'support');
    const { usesLeft } = require('../../../../cards/effects/_charges');
    R.check('Blob hat genau eine Ladung dieses Zuges verbraucht (zwei bleiben)', blobInst && usesLeft(blobInst, t.gs, { key: 'sandyBlob', max: 3 }) === 2, blobInst && usesLeft(blobInst, t.gs, { key: 'sandyBlob', max: 3 }));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
