'use strict';
// W24b · N2-02 Fireshield: Heldeneffekt (Siphem, Typ 'hero') öffnet kein Fenster; als Attack geltender (Broghan) und als Spell geltender (Alice) schon.
// Kartentext: „… takes damage from an opponent's Attack, Spell or Creature effect …"; CARD_API „Treated as an Attack" → Schadenstyp 'attack'; Q108 Alice = Spell.
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const held of ['Alice', 'Broghan', 'Kreatur']) {
      R.section(`Sitz ${me}: ${held} gegen Fireshield-Halter Sitz ${op}`);
      const t = await H.fresh({ hand: me === 0 ? [[], ['Fireshield']] : [['Fireshield'], []], deckSize: 30 });
      t.grantFor(op, 0, 'Fireshield');
      t.script.push({ match: d => d.title === 'Fireshield', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      if (held === 'Alice') {
        t.setHero(me, 0, 'Alice, the Puppeteer Girl', 800);
        for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
        await t.activateHero(me, 0);
      } else if (held === 'Broghan') {
        t.setHero(me, 0, 'Broghan, the Frozen Guardian of the North', 800);
        await t.activateHero(me, 0);
      } else {
        const mj = t.put(me, 0, 1, 'Mr. Jiggles'); mj.turnPlayed = 1; t.grantFor(me, 0, 'Mr. Jiggles');
        t.gs.activePlayer = me; t.phase(2);
        await t.activateCreature(me, 0, 1);
      }
      R.check('Fireshield-Fenster geht auf', gefragt(t, 'Fireshield') >= 1, gefragt(t, 'Fireshield'));
      R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
