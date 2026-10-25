'use strict';
// W75 · Darion — Audit P3b: Mine! Mine! Mine! (Charme-Zusatz „equip it to the user") legt das genommene Artefakt in den bestehenden Stapel, ohne Zonenwahl und auch bei sonst belegten Zonen.
// Kartentext Mine! Mine! Mine!: „Choose an Artifact equipped to a Hero your opponent controls and add it to your hand. If the user has Charme, you may equip it to the user without paying its Cost." (sinngemaess)
// Erwartet: Darion (Sitz 0, Held 0, Charme Lv1) traegt Blade + Crown im Platz 2. Der Gegner (Sitz 1) traegt Glass Sword. (a) Plaetze 1 und 3 frei: keine Zonenwahl, Glass Sword liegt oben im Stapel.
//          (b) Plaetze 1 und 3 sind mit Kreaturen belegt: Glass Sword liegt trotzdem im Stapel (kein „no free Support Zone").
// Aufruf: node docs/niche-tests/repro/W75/h-P3b-04-mine-mine-mine-charme-stapelplatz.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
async function lauf(belegt) {
  const t = await H.fresh({ active: 0, heroes: [[D, null, null], ['Tushu, the Knowledge Keeper', null, null]], hand: [['Mine! Mine! Mine!', F], [F]], gold: 500 });
  t.setAbilities(0, 0, [['Fighting'], ['Charme'], []]);
  const ps = t.gs.players[0];
  ps.supportZones[0][1] = [];
  ['Blade of the Frostbringer', 'Cute Crown'].forEach(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 0, 'support', 0, 1); i.turnPlayed = 1; });
  if (belegt) { t.put(0, 0, 0, 'ZZ Dummy'); t.put(0, 0, 2, 'ZZ Dummy'); }
  const gegner = t.put(1, 0, 0, 'Glass Sword'); gegner.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Mine! Mine! Mine!', answer: () => ({ optionId: 'equip' }) });
  t.targetFn = (valid, config) => {
    if (config && config.title === 'Mine! Mine! Mine!') {
      const e = valid.find(v => v.type === 'equip' && v.owner === 1);
      if (e) return [e.id];
      return [valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 0).id];   // Zonenwahl (sollte es nicht geben)
    }
    return [valid[0].id];
  };
  t.policy.confirm = true;
  await t.play(0, 'Mine! Mine! Mine!', { hero: 0 });
  await t.drain();
  const zonenFrage = t.targets.filter(x => x.config && x.config.title === 'Mine! Mine! Mine!' && x.valid.some(v => v.type === 'equip' && v.owner === 0));
  return { t, ps, zonenFrage };
}
(async () => {
  const R = H.runner();
  for (const belegt of [false, true]) {
    R.section(belegt ? '(b) Plaetze 1 und 3 mit Kreaturen belegt' : '(a) Plaetze 1 und 3 frei');
    const r = await lauf(belegt);
    R.note('lauf', JSON.stringify({ alle: r.ps.supportZones[0], gegner: r.t.gs.players[1].supportZones[0], hand: r.t.pile(0, 'hand'), zonenFrage: r.zonenFrage.length, prompts: r.t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    R.check('Glass Sword liegt oben im Stapel von Darion (Platz 2)', JSON.stringify(r.ps.supportZones[0][1]) === JSON.stringify(['Blade of the Frostbringer', 'Cute Crown', 'Glass Sword']), r.ps.supportZones[0]);
    R.check('beim Gegner ist das Schwert weg', r.t.gs.players[1].supportZones[0].flat().length === 0, r.t.gs.players[1].supportZones[0]);
    R.check('keine Zonenwahl gestellt', r.zonenFrage.length === 0, r.zonenFrage.map(x => x.valid.map(v => v.id)));
    R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);
  }
  R.finish();
})();
