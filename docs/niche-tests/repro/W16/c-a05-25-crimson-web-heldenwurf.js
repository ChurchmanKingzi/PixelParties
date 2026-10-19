'use strict';
// W16c · A05-25 (Gegenprobe): Crimson Web wird von einem HELDEN-Wurf (Fire Bolts) weiter an den Angreiferhelden gehängt (webbed);
// bei einem Wurf durch eine Kreatur (Skeleton Priest) wird nur negiert, nichts angehängt, das Web geht in die Ablage seines Besitzers.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // Held wirft
  let t = await H.fresh({ hand: [['Fire Bolts'], []] });
  t.setAbilities(0, 0, [['Destruction Magic'], [], []]);
  t.putSurprise(1, 0, 'Crimson Web'); t.grantFor(1, 0, 'Crimson Web');
  t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Fire Bolts', { hero: 0, noGrant: true });
  R.check('Heldenwurf: Angreiferheld ist „webbed", Web liegt bei ihm', !!t.gs.players[0].heroes[0].statuses.webbed && !!t.find('Crimson Web', 'support'));
  // Kreatur wirft
  t = await H.fresh({ discard: [['Fire Bolts'], []] });
  const p = t.put(0, 0, 0, 'Skeleton Priest'); p.turnPlayed = 1;
  t.putSurprise(1, 0, 'Crimson Web'); t.grantFor(1, 0, 'Crimson Web');
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Fire Bolts', source: 'discard' }) });
  t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Kreaturenwurf: Zauber negiert', t.hp(1, 0) === 800, t.hp(1, 0));
  R.check('Kreaturenwurf: kein Held ist „webbed", das Web liegt nicht auf dem Brett', !t.gs.players[0].heroes[0].statuses.webbed && !t.find('Crimson Web', 'support'));
  R.check('Kreaturenwurf: Web in der Ablage seines Besitzers (Seite 1)', t.pile(1, 'discardPile').includes('Crimson Web'), t.pile(1, 'discardPile'));
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
