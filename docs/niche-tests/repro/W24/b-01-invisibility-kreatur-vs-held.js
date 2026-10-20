'use strict';
// W24b · N2-01 Invisibility: nur der HELD wirft die Karte ab, nicht der Schaden einer Kreatur im Support des Trägers.
// Kartentext: „If the Hero chooses a target your opponent controls with an Attack or Spell, deals damage to 1 or more targets …, send this card to your discard pile."
// Gegenproben: Mr. Jiggles unter dem Träger (Held und Kreatur als Ziel) → Invisibility bleibt; ein Zauber des Trägers (Burning Finger) wirft ab;
// ein Heldeneffekt des Trägers, der Schaden macht (Alice), wirft ab (der HELD wählt/trifft).
const H = require('../../lib/h.js');
const sup = (t, s, h) => t.gs.players[s].supportZones[h].map(z => z[0] || '');
(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    for (const ziel of ['Held', 'Kreatur']) {
      R.section(`Sitz ${me}: Jiggles unter dem Träger trifft ${ziel}`);
      const t = await H.fresh({ hand: me === 0 ? [['Invisibility'], []] : [[], ['Invisibility']], deckSize: 30 });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Invisibility', { hero: 0 });
      const mj = t.put(me, 0, 1, 'Mr. Jiggles'); mj.turnPlayed = 1; t.grantFor(me, 0, 'Mr. Jiggles');
      t.put(op, 0, 0, H.INERT.creature);
      t.targetFn = (v) => v.filter(x => x.owner === op && (ziel === 'Held' ? x.type === 'hero' : x.type === 'equip')).slice(0, 1).map(x => x.id);
      t.gs.activePlayer = me; t.phase(2);
      await t.activateCreature(me, 0, 1);
      R.check('Invisibility bleibt liegen', sup(t, me, 0).includes('Invisibility'), sup(t, me, 0));
      R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
    R.section(`Sitz ${me}: Heldeneffekt Alice des Trägers wirft Invisibility ab (Held schadet)`);
    {
      const t = await H.fresh({ hand: me === 0 ? [['Invisibility'], []] : [[], ['Invisibility']], deckSize: 30 });
      t.setHero(me, 0, 'Alice, the Puppeteer Girl', 800);
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Invisibility', { hero: 0 });
      for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      await t.activateHero(me, 0);
      R.check('Held hat Schaden gemacht', t.hp(op, 0) < 800, t.hp(op, 0));
      R.check('Invisibility liegt in der Ablage', !sup(t, me, 0).includes('Invisibility'), sup(t, me, 0));
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
