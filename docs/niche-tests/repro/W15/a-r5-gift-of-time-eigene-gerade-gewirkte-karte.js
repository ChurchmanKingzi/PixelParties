'use strict';
// W21a (Al, 20.10.2026): umgestellt — Divine Gift of Time braucht jetzt einen Wirker-Helden mit Magic Arts 2 (hier Sitz 0, Held 2 mit Magic Arts x2); vorher prüfte die Karte keinen Helden.
// W15a · R5 (Rückfrage 5 aus W14b) · Al, 16.10.2026: „Divine Gift of Time auch bei der gerade gewirkten eigenen Karte, die selbst in die Ablage geht?" — „Ja."
// Erwartet: Wirkt der Time-Besitzer selbst einen Zauber/Angriff, öffnet sich beim Weg dieser Karte in die Ablage die Abfrage „Divine Gift of Time"; bei „Ja" liegt die gerade gewirkte
//   Karte wieder auf der Hand (Time in der Ablage, „1 pro Spiel" verbraucht), bei „Nein" bleibt sie in der Ablage. Gilt für Zauber, Angriffe und den Fehlschlag. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const gefragt = (t) => t.prompts.filter(p => p.d.title === 'Divine Gift of Time');
(async () => {
  const R = H.runner();
  const ziel = (t) => { t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; };

  for (const karte of ['Fireball', 'Attack']) {
    R.section(`die gerade gewirkte eigene Karte (${karte}) geht in die Ablage — Ja`);
    {
      const t = await H.fresh({ abilities: { 0: { 2: [['Magic Arts', 'Magic Arts']] } }, hand: [['Divine Gift of Time', karte], []] });
      ziel(t);
      const r = await t.play(0, karte, { hero: 0 });
      await sleep(80);
      R.check(`${karte} gespielt`, r === true, r);
      R.check('genau EINE Abfrage „Divine Gift of Time"', gefragt(t).length === 1, gefragt(t).length);
      R.check(`${karte} liegt wieder auf der Hand, Time in der Ablage`, t.pile(0, 'hand').includes(karte) && !t.pile(0, 'hand').includes('Divine Gift of Time') && t.pile(0, 'discardPile').includes('Divine Gift of Time') && !t.pile(0, 'discardPile').includes(karte), { hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
      R.check('der Zauber hat trotzdem gewirkt (Ziel verlor HP)', t.hp(1, 0) < 800, t.hp(1, 0));
      R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    R.section(`… Nein: ${karte} bleibt in der Ablage, Time bleibt auf der Hand`);
    {
      const t = await H.fresh({ abilities: { 0: { 2: [['Magic Arts', 'Magic Arts']] } }, hand: [['Divine Gift of Time', karte], []] });
      ziel(t);
      t.script.push({ match: d => d.title === 'Divine Gift of Time', answer: () => null, once: true });
      await t.play(0, karte, { hero: 0 });
      await sleep(80);
      R.check('Abfrage kam, Nein: Karte in der Ablage, Time auf der Hand, kein Einmal-Stempel', gefragt(t).length === 1 && t.pile(0, 'discardPile').includes(karte) && t.pile(0, 'hand').includes('Divine Gift of Time') && !(t.gs.players[0]._oncePerGameUsed || new Set()).has('divineGift'), { f: gefragt(t).length, hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
    }
  }

  R.section('Gegenprobe: der Zauber des GEGNERS (landet in SEINER Ablage) löst die Abfrage nicht aus');
  {
    const t = await H.fresh({ abilities: { 0: { 2: [['Magic Arts', 'Magic Arts']] } }, hand: [['Divine Gift of Time'], ['Fireball']] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(1, 'Fireball', { hero: 0, active: 1 });
    await sleep(80);
    R.check('keine Abfrage', gefragt(t).length === 0, gefragt(t).length);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
