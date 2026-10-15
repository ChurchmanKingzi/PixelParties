'use strict';
// W9b · Q18 (A03-futuretech-14) · Jetpack: „Stufe ≤ Anzahl“ gilt auch bei 0 Kopien in der Ablage
//
// Kartentext Jetpack: „The equipped Hero cannot be chosen or hit by Attacks whose levels are lower than or equal to the number of "Future Tech Jetpack" cards in your discard pile.“
// ENTSCHIEDEN (Al, Welle 9, Q18): „Ja, soll es!“ → bei 0 Kopien in der Ablage werden Stufe-0-Attacken abgewehrt (0 ≤ 0), wie Escape Device Stufe-0-Zauber.
// Geprüft: (a) 0 Kopien: Lv-0-Attacke „Attack“ trifft nicht; (b) 0 Kopien: Lv-1-Attacke trifft (1 > 0); (c) 1 Kopie: Lv-1-Attacke abgewehrt;
//   (d) 0 Kopien: Spell (Fireball) kommt durch (nur Attacken).
const H = require('../../lib/h.js');
const JET = 'Future Tech Jetpack';
(async () => {
  const R = H.runner();
  async function lauf(karte, kopien, spiele) {
    const t = await H.fresh({ hand: [[karte], []], discard: [[], Array(kopien).fill(JET)] });
    t.put(1, 0, 0, JET);
    t.hero(0, 0).atk = 100; t.hero(0, 0).baseAtk = 100;
    t.targetFn = (v) => { const x = v.find(z => z.type === 'hero' && z.owner === 1 && z.heroIdx === 0); return x ? [x.id] : []; };
    await t.play(0, karte, { hero: 0 });
    R.check('keine Engine-Fehler (' + karte + ', ' + kopien + ' Kopien)', t.errors.length === 0, t.errors);
    R.check('Zustand sauber (' + karte + ', ' + kopien + ' Kopien)', t.audit().length === 0, t.audit());
    return t.hp(1, 0);
  }
  R.check('(a) 0 Kopien: Lv-0-Attacke „Attack“ wird abgewehrt (800 HP)', (await lauf('Attack', 0)) === 800);
  R.check('(b) 0 Kopien: Lv-1-Attacke (Heavy Hit) trifft', (await lauf('Heavy Hit', 0)) < 800);
  R.check('(c) 1 Kopie: Lv-1-Attacke (Heavy Hit) wird abgewehrt', (await lauf('Heavy Hit', 1)) === 800);
  R.check('(d) 0 Kopien: Fireball (Spell) kommt durch', (await lauf('Fireball', 0)) < 800);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
