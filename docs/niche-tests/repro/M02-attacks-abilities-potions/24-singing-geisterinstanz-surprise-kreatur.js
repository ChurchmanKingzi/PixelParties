'use strict';
// M02-24 · Singing auf eine „Surprise-Kreatur" (Pure Advantage Camel, Cactus Creature, Afflicted Pests/Vermin, Mummy Maker Machine, Noble Mummy Guards) hinterlässt eine Geister-Instanz
// Kartentext Singing Lv1: „You may once per turn choose a level 1 or lower Creature your opponent controls and use its active effect as if you controlled it."
// Kartentext Pure Advantage Camel: „… You may once per turn move this Creature you control into the corresponding Hero's Surprise Zone."
// Erwartung: nach dem geliehenen Effekt stimmen Zonen-Array und Instanz überein (Kamel liegt face-down in der Surprise Zone ODER der geliehene Effekt ist wirkungslos) – `t.audit()` bleibt leer, und das Kamel zählt nicht als Kreatur auf dem Brett.
// Beobachtet: das Kamel steht in `surpriseZones[0]`, `supportZones[0]` ist leer – aber die Instanz hat weiter `zone: 'support'`, `faceDown: false` (Audit: „Geister-Instanz … Zone leer/anders").
//   Folge: Massacre („increased by 50 times the number of Creatures on the board") zählt das Kamel mit: 130 statt 80 Schaden.
// Ursache: `singing.js` `_makeBorrowInst` (Z. 71–108) reicht dem Effekt eine SCHATTEN-Instanz; `engine.surpriseCreatureReset` (`_engine.js:36789`) schreibt die Zonen-Arrays der echten Seite
//   (`ps.supportZones` / `ps.surpriseZones`), setzt `zone/faceDown` aber nur auf dem Schatten (`inst = ctx.card`). Im Normalweg (eigene Aktivierung) ist alles konsistent.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const heroT = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
  for (const name of ['Pure Advantage Camel', 'Cactus Creature']) {
    for (const mode of ['normal', 'singing']) {
      const t = await H.fresh({ hand: [[], []], hp: 800, deck: [Array(8).fill('ZZ Dummy'), Array(8).fill('ZZ Dummy')] });
      const owner = mode === 'normal' ? 0 : 1;
      if (mode === 'singing') t.setAbilities(0, 0, [['Singing', 'Singing', 'Singing'], [], []]);
      const c = t.put(owner, 0, 0, name);
      c.turnPlayed = 1;
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.gs.activePlayer = 0; t.phase(2);
      if (mode === 'normal') await t.activateCreature(0, 0, 0);
      else await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
      const imSurprise = (t.gs.players[owner].surpriseZones[0] || []).includes(name);
      R.check(`${name} (${mode}): Karte liegt in der Surprise Zone (Voraussetzung)`, imSurprise, t.gs.players[owner].surpriseZones[0]);
      R.check(`${name} (${mode}): Instanz und Zone stimmen überein (Audit leer, Instanz face-down in 'surprise')`, t.audit().length === 0 && c.zone === 'surprise', { audit: t.audit(), zone: c.zone, faceDown: c.faceDown });
      if (name === 'Pure Advantage Camel') {
        t.targetFn = heroT; t.gs.activePlayer = 0;
        await t.play(0, 'Massacre', { hero: 1 });
        R.check(`${name} (${mode}): Massacre zählt das Kamel nicht als Kreatur (80 Schaden)`, 800 - t.hp(1, 0) === 80, 800 - t.hp(1, 0));
      }
    }
  }
  R.finish();
})();
