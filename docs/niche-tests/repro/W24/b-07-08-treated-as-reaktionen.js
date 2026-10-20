'use strict';
// W24b · N2-07/N2-08 „als Attack/Spell geltende" Heldeneffekte: Alice = Spell Stufe 0 (Q108), Broghan = Attack ('attack'); Siphem = gewöhnlicher Heldeneffekt ('hero').
//   Emergency Spell Armor („Spell or Creature effect"): Alice ja, Broghan (Attack) nein, Siphem nein.
//   Flooding („Attack or Spell"): Alice ja, Broghan ja, Siphem nein.   Glass Wall („level 1 or lower Attack, Spell or Creature effect"): Alice ja (Stufe 0), Broghan ja (W26a, Al: als Attack geltende Heldeneffekte = Stufe 0), Siphem nein.
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
function wirker(t, me, held) {
  if (held === 'Alice') {
    t.setHero(me, 0, 'Alice, the Puppeteer Girl', 800);
    for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
  } else if (held === 'Broghan') t.setHero(me, 0, 'Broghan, the Frozen Guardian of the North', 800);
  else { t.setHero(me, 0, 'Siphem, the Deepsea Demon', 800); t.hero(me, 0).deepseaCounters = 2; }
}
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const held of ['Alice', 'Broghan', 'Siphem']) {
      R.section(`Sitz ${me}: ${held}-Effekt gegen Sitz ${op}`);
      // Emergency Spell Armor (tödlicher Treffer: Ziel 100 HP; Broghan 300+, Siphem 100/200 → genug)
      {
        const t = await H.fresh({ hand: me === 0 ? [[], ['Emergency Spell Armor']] : [['Emergency Spell Armor'], []], deckSize: 30 });
        t.grantFor(op, 0, 'Emergency Spell Armor');
        t.script.push({ match: d => d.title === 'Emergency Spell Armor', answer: () => ({ confirmed: true }) });
        wirker(t, me, held); t.hero(op, 0).hp = 100;
        t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
        await t.activateHero(me, 0);
        const erwartet = held === 'Alice';
        R.check(`Emergency Spell Armor ${erwartet ? 'wird angeboten' : 'bleibt in der Hand'}`, (gefragt(t, 'Emergency Spell Armor') >= 1) === erwartet, gefragt(t, 'Emergency Spell Armor'));
        R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
      }
      // Flooding
      {
        const t = await H.fresh({ hand: [[], []], deckSize: 30 });
        t.putSurprise(op, 0, 'Flooding'); t.grantFor(op, 0, 'Flooding');
        t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
        wirker(t, me, held);
        t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
        await t.activateHero(me, 0);
        const erwartet = held !== 'Siphem';
        R.check(`Flooding ${erwartet ? 'öffnet sich' : 'bleibt verdeckt'}`, (gefragt(t, 'Flooding') >= 1) === erwartet, gefragt(t, 'Flooding'));
        R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
      }
      // Glass Wall
      {   // W26a (Al, 21.10.2026): auch Broghan (als Attack geltend) zählt als Stufe 0 → Glass Wall öffnet sich
        const t = await H.fresh({ hand: [[], []], deckSize: 30 });
        t.putSurprise(op, 0, 'Glass Wall'); t.grantFor(op, 0, 'Glass Wall');
        t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
        wirker(t, me, held);
        t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
        await t.activateHero(me, 0);
        const erwartet = held !== 'Siphem';
        R.check(`Glass Wall ${erwartet ? 'öffnet sich (Stufe 0)' : 'bleibt verdeckt'}`, (gefragt(t, 'Glass Wall') >= 1) === erwartet, gefragt(t, 'Glass Wall'));
        R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
      }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
