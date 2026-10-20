'use strict';
// N2-04 · Forbidden Curse of Aging: befristete Status (Freeze „for 1 turn") laufen am Wirt NIE aus
// Kartentext (Forbidden Curse of Aging): „The HP of the Hero this Spell is attached to cannot be healed, and its other status effects cannot be removed. …"
// Icebolt: „Deal 120 damage to it and Freeze it for 1 turn."
// Beobachtet: Ein Held mit „Aged" bleibt nach Icebolt unbegrenzt gefroren (4 Zugwechsel getestet) — `processStatusExpiry` ruft `removeHeroStatus(…,'frozen')` ohne Ausnahme, und
//   `_heroStatusRemovalBlocked` sperrt auch dieses Ablaufen. Gleichzeitig legt dieselbe Ablaufstelle den Status `immune` (Schutz nach dem Auftauen) an, obwohl `frozen` bleibt
//   (Zustand „gefroren UND frostimmun").
// ★ W25b (Al, Welle 25: „ja, die sollen normal auslaufen"): Lesart A gilt — „removed" = durch einen Effekt entfernt (Cure/Heal/Cleanse); die Dauer läuft normal ab,
// Aging sperrt nur Effekte; kein Zustand „gefroren UND frostimmun". Behoben über `natuerlichesEnde` an `removeHeroStatus` (Ablaufstellen). Exit 0 = Regel erfüllt.
// Gegenprobe: ohne Aging taut derselbe Held nach seinem Zug auf.
const H = require('../../lib/h.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} verflucht und friert Sitz ${op} ein`);
    {
      const t = await H.fresh({ hand: me === 0 ? [['Forbidden Curse of Aging', 'Icebolt'], []] : [[], ['Forbidden Curse of Aging', 'Icebolt']], deckSize: 30 });
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      await t.play(me, 'Forbidden Curse of Aging', { hero: 0 });
      await t.play(me, 'Icebolt', { hero: 0 });
      R.check('Aufbau: Held ist aged und gefroren', !!t.hero(op, 0).statuses.aged && !!t.hero(op, 0).statuses.frozen, Object.keys(t.hero(op, 0).statuses));
      for (let i = 0; i < 4; i++) await t.endTurn();   // zwei volle Runden
      const st = Object.keys(t.hero(op, 0).statuses);
      R.check('„Freeze for 1 turn" ist nach zwei vollen Runden abgelaufen', !st.includes('frozen'), st);
      R.check('kein Zustand „gefroren UND frostimmun"', !(st.includes('frozen') && st.includes('immune')), st);
    }
  }
  R.section('Gegenprobe: ohne Aging taut der Held auf');
  {
    const t = await H.fresh({ hand: [['Icebolt'], []], deckSize: 30 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Icebolt', { hero: 0 });
    for (let i = 0; i < 4; i++) await t.endTurn();
    R.check('Held ist nicht mehr gefroren', !t.hero(1, 0).statuses.frozen, Object.keys(t.hero(1, 0).statuses));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
