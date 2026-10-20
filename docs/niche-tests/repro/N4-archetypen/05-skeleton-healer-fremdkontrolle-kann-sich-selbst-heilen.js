'use strict';
// N4-archetypen-05 · Skeleton Healer: unter fremder Kontrolle (gestohlen / seitenfremd beschworen) bietet sich die Healer selbst als Ziel an
// Kartentext (Skeleton Healer): „You may once per turn choose a different target and heal it for 100 HP."
// Aufbau (a) gestohlen: Sitz 0 hat eine Healer, Sitz 1 stiehlt sie (`actionStealCreature`, Dark Deal/Cute Conversion/Deepsea Succubus-Muster): Brettseite 0, Kontrolleur Sitz 1.
//   (b) seitenfremd: Sitz 1 übernimmt Held 0 von Sitz 0 und beschwört dort eine Healer (`markiereSeitenfremd`): Brettseite 0, Kontrolleur Sitz 1.
//   Gegenprobe: normal (eigene Seite) steht die Healer nicht in der Zielliste.
// Erwartung: Die Healer taucht in keinem Fall in der Zielliste ihrer eigenen Aktivierung auf („a different target").
// Beobachtet: skeleton-healer.js schließt sich per `t.owner === pi` (Brettseite gegen Spieler) aus – bei Fremdkontrolle ist owner=0, pi=1 → sie bietet sich selbst an (equip:0:0:0).
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function lauf(modus) {
  const t = await H.fresh({ hand: [['ZZ Filler'], ['ZZ Filler']], deckSize: 30, active: 1 });
  let sk;
  if (modus === 'normal') sk = t.put(1, 0, 0, 'Skeleton Healer');
  else if (modus === 'gestohlen') {
    sk = t.put(0, 0, 0, 'Skeleton Healer'); sk.turnPlayed = 1;
    await t.run(() => t.engine.actionStealCreature(1, sk)); await sleep(250);
  } else {
    await t.run(() => t.engine.actionStealHero(1, 0, 0)); await sleep(300);
    sk = t.put(0, 0, 0, 'Skeleton Healer'); t.engine.markiereSeitenfremd(sk, 1);
  }
  sk.turnPlayed = 1; sk.counters.currentHp = 20;
  t.put(1, 1, 0, H.INERT.big);
  t.gs.activePlayer = 1; t.phase(2);
  t.targetFn = (valid) => [valid[0].id];
  const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: sk.heroIdx, zoneSlot: sk.zoneSlot, charmedOwner: modus === 'normal' ? undefined : sk.owner }));
  const valid = (t.targets[0] && t.targets[0].valid) || [];
  const selbst = valid.some(v => v.type === 'equip' && v.owner === sk.owner && v.heroIdx === sk.heroIdx && v.slotIdx === sk.zoneSlot);
  return { t, r, selbst, n: valid.length };
}
(async () => {
  const R = H.runner();
  const k = await lauf('normal');
  R.check('Gegenprobe (normal): Aktivierung läuft, Healer steht nicht in der Zielliste', k.r === true && k.n > 0 && !k.selbst, k);
  for (const modus of ['gestohlen', 'seitenfremd']) {
    const s = await lauf(modus);
    R.check(`Aufbau (${modus}): Aktivierung läuft mit Zielliste`, s.r === true && s.n > 0, s.r);
    R.check(`${modus}: der Healer bietet sich NICHT selbst als „different target“ an`, !s.selbst, s.selbst);
    R.check(`${modus}: keine Engine-Fehler`, s.t.errors.length === 0, s.t.errors);
  }
  R.finish();
})();
