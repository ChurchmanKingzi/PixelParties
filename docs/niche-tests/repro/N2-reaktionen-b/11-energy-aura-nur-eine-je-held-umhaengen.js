'use strict';
// N2-11 · Inheritance Ceremony hängt eine Energy Aura auf einen Helden um, der schon eine trägt
// Kartentext (Energy Aura): „… A Hero can only have 1 "Energy Aura" attached to it at a time."
// Inheritance Ceremony: „Choose another Hero you control. Move any number of cards attached or equipped to the user to the target's free Support Zones." (Vorgabe 12.10.: Umhängen = ohne Eintritts-Effekte)
// Erwartung: Eine zweite Energy Aura wird am Ziel nicht angeboten bzw. nicht verschoben (Höchstgrenze „1 je Held", die beim Anlegen über `hostOpts().heroFilter` gilt).
// Beobachtet: Beide Auren liegen danach am Zielhelden (zwei Anhängsel derselben Karte an einem Helden).
// Ursache: energy-aura.js prüft die Grenze nur in `attachmentHosts`/`spellPlayCondition`/`onPlay` (`hatBereitsAura`), exportiert aber kein `canEquipToHero`, das `engine.canEquipCardToHero`
//   (_engine.js ~16585, von inheritance-ceremony.js zur Ziel-Prüfung benutzt) auswerten könnte.
// Gegenprobe: eine zweite Aura lässt sich nicht regulär auf den Helden spielen (Karte bleibt auf der Hand).
const H = require('../../lib/h.js');
const sup = (t, s, h) => t.gs.players[s].supportZones[h].map(z => z[0] || '');
(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    R.section(`Sitz ${me}: Aura an Held 0 und Held 1; Held 0 wirkt Inheritance Ceremony auf Held 1`);
    const t = await H.fresh({ hand: [0, 1].map(i => i === me ? ['Energy Aura', 'Energy Aura', 'Energy Aura', 'Inheritance Ceremony'] : []), deckSize: 30 });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
    await t.play(me, 'Energy Aura', { hero: 0 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 1).id];
    await t.play(me, 'Energy Aura', { hero: 1 });
    R.check('Aufbau: je eine Aura an Held 0 und Held 1', sup(t, me, 0).includes('Energy Aura') && sup(t, me, 1).includes('Energy Aura'), [sup(t, me, 0), sup(t, me, 1)]);
    // Gegenprobe: reguläres Anlegen einer zweiten Aura an Held 1 ist unmöglich
    t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === me && y.heroIdx === 1); return x ? [x.id] : null; };
    t.reset();
    const nBefore = sup(t, me, 1).filter(x => x === 'Energy Aura').length;
    await t.play(me, 'Energy Aura', { hero: 0 });
    R.check('Gegenprobe: reguläres Anlegen einer zweiten Aura an Held 1 gelingt nicht (höchstens 1 je Held)', sup(t, me, 1).filter(x => x === 'Energy Aura').length === nBefore, sup(t, me, 1));
    // jetzt Ceremony: Aura von Held 0 nach Held 1
    t.targetFn = (v) => {
      if (v.some(x => x.type === 'equip')) return v.filter(x => x.cardName === 'Energy Aura').map(x => x.id);
      return [v.find(x => x.type === 'hero' && x.heroIdx === 1).id];
    };
    const r = await t.play(me, 'Inheritance Ceremony', { hero: 0 });
    R.check('Inheritance Ceremony gewirkt', r === true, r);
    R.check('Held 1 trägt höchstens eine Energy Aura', sup(t, me, 1).filter(x => x === 'Energy Aura').length <= 1, { held0: sup(t, me, 0), held1: sup(t, me, 1) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
