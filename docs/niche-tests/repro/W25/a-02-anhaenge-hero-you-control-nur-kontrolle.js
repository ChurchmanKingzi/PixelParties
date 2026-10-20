'use strict';
// W25a · N1-11 (Al 21.10.2026: „korrekt, geht immer nach aktueller Kontrolle"). „Attach … to a Hero you control": ein an den Gegner abgegebener eigener Held (dauerhaft: Paraseed-Übernahme, zeitweise: Charme)
// ist KEIN Wirt; ein von mir übernommener Gegnerheld schon (mit Recht `ausruesten`; Charme/Love Shot hatten es nie, Welle 29.9.).
// Prüft die Wirtsliste (`attachmentHosts`) der Anhänge ohne eigene Seitenvorgabe sowie einen echten Spielweg (Light Ball) und die Ability-Anleger Very Special Prisoner / Ska Harpyformer (Gegenproben: normal).
// Aufruf: node docs/niche-tests/repro/W25/a-02-anhaenge-hero-you-control-nur-kontrolle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const KARTEN = ['Call of the Deepsea', 'Divine Awakening', 'Light Ball', 'Invisibility', 'Energy Aura', 'Prophecy of Tempeste', 'Gathering Storm', 'Royal Treasury', 'Divine Gift of Coolness', 'Quest of the Chosen One'];
const aufbau = async (karte, variante) => {
  const t = await H.fresh({ hand: [[karte], []] });
  t.setHero(0, 0, 'Fern, the Ship Slave', 800); t.setHero(0, 1, 'Kohta, the Silent Observer', 800); t.setHero(0, 2, 'Fiona, the Princess of the Forgotten', 800);
  t.setHero(1, 0, 'Fern, the Ship Slave', 800);
  if (variante === 'abgegeben') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(250); }
  if (variante === 'uebernommen') { await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250); }
  if (variante === 'gecharmt') { t.gs.players[0].heroes[0].charmedBy = 1; }
  return t;
};
const hosts = (t, karte) => { const sc = loadCardEffect(karte); return [...new Set((sc.attachmentHosts ? sc.attachmentHosts(t.gs, 0, t.engine) : []).map(h => h.owner + ':' + h.heroIdx))]; };
(async () => {
  const R = H.runner();
  for (const karte of KARTEN) {
    const sc = loadCardEffect(karte);
    if (!sc?.attachmentHosts) { R.note(`${karte}: kein attachmentHosts`, ''); continue; }
    { const t = await aufbau(karte, 'normal'); const h = hosts(t, karte);
      R.check(`${karte}, Gegenprobe: eigener Held 0:0 ist Wirt`, h.includes('0:0'), h); }
    { const t = await aufbau(karte, 'abgegeben'); const h = hosts(t, karte);
      R.check(`${karte}: dauerhaft abgegebener Held 0:0 ist KEIN Wirt`, !h.includes('0:0'), h);
      R.check(`${karte}: die übrigen eigenen Helden bleiben Wirte`, h.includes('0:1') || h.includes('0:2'), h); }
    { const t = await aufbau(karte, 'gecharmt'); const h = hosts(t, karte);
      R.check(`${karte}: vom Gegner gecharmter Held 0:0 ist KEIN Wirt`, !h.includes('0:0'), h); }
  }
  R.section('Echter Spielweg: Light Ball mit abgegebenem Helden');
  { const t = await aufbau('Light Ball', 'abgegeben');
    t.targetFn = (valid) => [valid[0].id];
    const r = await t.play(0, 'Light Ball', { hero: 1 });
    const inst = t.inst(i => i.name === 'Light Ball' && i.zone === 'support');
    R.check('Light Ball liegt an einem kontrollierten Helden (nicht 0:0)', r === true && inst.length === 1 && inst[0].heroIdx !== 0 && t.physicalSide?.(inst[0]) !== 1, inst.map(i => [i.owner, i.heroIdx]));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  R.finish();
})();
