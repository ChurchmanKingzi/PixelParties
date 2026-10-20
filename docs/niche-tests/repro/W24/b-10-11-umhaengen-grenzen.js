'use strict';
// W24b · N2-10/N2-11 Umhängen per Inheritance Ceremony respektiert die Anlege-Grenzen der Karte (`engine.canEquipCardToHero`).
//   N2-10 Idej Projection: nur auf "Idej"-Helden (Text: „can only be attached to an "Idej" Hero by its own effect"). Positiv: Ceremony auf einen zweiten Idej-Helden VERSCHIEBT sie (wie den Sword).
//   N2-11 Energy Aura: höchstens eine je Held. Positiv: Ceremony einer Aura auf einen Helden OHNE Aura verschiebt sie.
const H = require('../../lib/h.js');
const sup = (t, s, h) => t.gs.players[s].supportZones[h].map(z => z[0] || '');
(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    R.section(`Sitz ${me}: Idej Projection von Idej Lord Daiyo auf einen zweiten Idej-Helden`);
    {
      const heroes = [null, null]; heroes[me] = ['Idej Lord Daiyo', 'Idej Lord Nobunakin', H.BLANK_HEROES[2]];
      const t = await H.fresh({ heroes, hand: me === 0 ? [['Inheritance Ceremony'], []] : [[], ['Inheritance Ceremony']], deckSize: 30 });
      t.put(me, 0, 0, 'Idej Projection');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => v.some(x => x.type === 'equip') ? v.map(x => x.id) : [v.find(x => x.type === 'hero' && x.heroIdx === 1).id];
      const r = await t.play(me, 'Inheritance Ceremony', { hero: 0 });
      R.check('Zeremonie gewirkt', r === true, r);
      R.check('Projection liegt jetzt am zweiten Idej-Helden', sup(t, me, 1).includes('Idej Projection') && !sup(t, me, 0).includes('Idej Projection'), [sup(t, me, 0), sup(t, me, 1)]);
      R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
    R.section(`Sitz ${me}: Energy Aura per Ceremony auf einen Helden OHNE Aura`);
    {
      const t = await H.fresh({ hand: [0, 1].map(i => i === me ? ['Energy Aura', 'Inheritance Ceremony'] : []), deckSize: 30 });
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Energy Aura', { hero: 0 });
      t.targetFn = (v) => v.some(x => x.type === 'equip') ? v.filter(x => x.cardName === 'Energy Aura').map(x => x.id) : [v.find(x => x.type === 'hero' && x.heroIdx === 1).id];
      const r = await t.play(me, 'Inheritance Ceremony', { hero: 0 });
      R.check('Zeremonie gewirkt', r === true, r);
      R.check('Aura liegt jetzt an Held 1 (genau eine)', sup(t, me, 1).filter(x => x === 'Energy Aura').length === 1 && !sup(t, me, 0).includes('Energy Aura'), [sup(t, me, 0), sup(t, me, 1)]);
      R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
