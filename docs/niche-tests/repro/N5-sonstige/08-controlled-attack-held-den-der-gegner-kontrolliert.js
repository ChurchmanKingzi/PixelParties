'use strict';
// N5-08 · Controlled Attack: „Choose a Hero your opponent controls. You may use that Hero's Abilities and active effect this turn as if you controlled it."
// Die Zielwahl läuft über den generischen Picker `promptDamageTarget({ side: 'enemy' })`; dessen `addHeroes` zählt für 'enemy' nur die Helden der GEGENSPALTE
// (ohne die vom Wirker kontrollierten). Ein Held aus MEINER Spalte, den der Gegner kontrolliert (Charme/Paraseed Control), ist „a Hero your opponent controls" (W22: „Hero you control" = Kontrolleur),
// wird aber nicht angeboten. Vergleich: Magic Ruby („Choose a Hero your opponent controls", F02-08/W-Fix nach Kontrolle) bietet ihn an.
// Erwartet: Controlled Attack bietet den vom Gegner kontrollierten Held 2 der eigenen Spalte an (und nicht den vom Wirker kontrollierten Gegnerheld). Gegenprobe: normale Gegnerhelden ✓, Magic Ruby ✓.
// Aufruf: node docs/niche-tests/repro/N5-sonstige/08-controlled-attack-held-den-der-gegner-kontrolliert.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    for (const art of ['temporär (Charme)', 'dauerhaft (Paraseed Control)']) {
      const angebot = {};
      for (const card of ['Magic Ruby', 'Controlled Attack']) {
        const hand = [[], []]; hand[seat] = [card];
        const t = await H.fresh({ active: seat, hand });
        if (art.startsWith('temp')) await t.run(() => t.engine.actionStealHero(opp, seat, 2));
        else await t.run(() => t.engine.actionTakeHeroPermanently(opp, seat, 2));
        await sleep(200);
        t.targetFn = (v) => { angebot[card] = v.map(x => `${x.owner}:${x.heroIdx}`); return [v[0].id]; };
        await t.play(seat, card, { hero: 0 });
        R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
      }
      const eigener = `${seat}:2`;
      R.check(`Sitz ${seat} · ${art}: Gegenprobe Magic Ruby bietet den vom Gegner kontrollierten eigenen Held ${eigener} an`, (angebot['Magic Ruby'] || []).includes(eigener), angebot['Magic Ruby']);
      R.check(`Sitz ${seat} · ${art}: Controlled Attack bietet den vom Gegner kontrollierten Held ${eigener} an`, (angebot['Controlled Attack'] || []).includes(eigener), angebot['Controlled Attack']);
      R.check(`Sitz ${seat} · ${art}: Controlled Attack bietet die normalen Gegnerhelden an`, ['0', '1', '2'].filter(i => (angebot['Controlled Attack'] || []).includes(`${opp}:${i}`)).length >= 2, angebot['Controlled Attack']);
    }
  }
  R.finish();
})();
