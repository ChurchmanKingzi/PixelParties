'use strict';
// W74c-02 · Swarm Trap darf NICHT auf eine Heldenwahl reagieren, die nur der KOSTEN-Teil einer Karte ist (Angry Cheese: „Choose a Hero you control and deal 100 damage to it. Then search …")
const H = require('../../lib/h.js');
const TRAP = 'Flesh-Eating Swarm Trap';
const trapAngebot = (t) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === TRAP).length;

(async () => {
  const R = H.runner();
  R.section('A · Angry Cheese: Kosten-Schaden trifft, Falle wird NICHT angeboten, Suche läuft normal');
  {
    const t = await H.fresh({ hand: [[TRAP, 'ZZ Filler'], ['Angry Cheese']], gold: [50, 100], deck: [Array(10).fill('ZZ Filler'), ['Fire Bolts', ...Array(10).fill('ZZ Filler')]] });
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    const hp0 = t.hp(1, 0);
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0); return h ? [h.id] : undefined; };
    await t.play(1, 'Angry Cheese', {});
    R.check('Falle nicht angeboten', trapAngebot(t) === 0, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('Kosten: genau 100 Schaden (nicht 250)', t.hp(1, 0) === hp0 - 100, [hp0, t.hp(1, 0)]);
    R.check('Falle noch auf der Hand', t.pile(0, 'hand').includes(TRAP), t.pile(0, 'hand'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('B · Sickly Cheese (gleiche Bauart: Gift als Kosten): ebenfalls keine Falle');
  {
    const t = await H.fresh({ hand: [[TRAP, 'ZZ Filler'], ['Sickly Cheese']], gold: [50, 100], deck: [Array(10).fill('ZZ Filler'), ['Poison Touch', 'Poison Pollen', ...Array(10).fill('ZZ Filler')]] });
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    const hp0 = t.hp(1, 0);
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0); return h ? [h.id] : undefined; };
    await t.play(1, 'Sickly Cheese', {});
    R.check('Falle nicht angeboten', trapAngebot(t) === 0, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('kein Fallenschaden (150)', t.hp(1, 0) > hp0 - 150, [hp0, t.hp(1, 0)]);
    R.check('Falle noch auf der Hand', t.pile(0, 'hand').includes(TRAP), t.pile(0, 'hand'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
