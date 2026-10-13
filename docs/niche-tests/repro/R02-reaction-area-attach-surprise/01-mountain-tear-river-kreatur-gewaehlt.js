'use strict';
// R02-01 · Mountain Tear River: „… or a Creature in one of its Support Zones is chosen" öffnet nie das Fenster
// Kartentext: „Activate this Surprise when the user or a Creature in one of its Support Zones is chosen by an Attack, Spell or Creature effect. Burn the attacker."
// Skriptkopf (mountain-tear-river.js, v703): `surpriseFiresOnSupportCreature: true` – das Fenster `_checkSurpriseWindow` soll bei einem Kreaturenziel öffnen.
// Aufbau: Sitz 1 hat Mountain Tear River in Held 0 (Destruction Magic 1) und eine Kreatur in Support Zone 1 von Held 0. Sitz 0 wählt diese Kreatur mit
//   (a) Burning Finger (Spell, Einzelziel), (b) Fireball (Spell, bis 2 Ziele), (c) Pusher (Attack), (d) Cannon Tower (Kreatureneffekt, 150 Schaden).
// Erwartet: in allen vier Fällen kommt die Ja/Nein-Frage „Mountain Tear River", und der Angreifer (Held bzw. Cannon Tower) brennt.
// Beobachtet: nie eine Frage, nie ein Brand. Die Zielwahl-Eingänge geben das Kreaturenziel als `type: 'equip'` zurück; `_checkSurpriseWindow`
//   (`_engine.js` ~34974) lässt aber nur `type === 'creature'` ein. Gegenprobe: wird der HELD gewählt, feuert die Karte (Frage + Brand).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const tgtCre = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0 && x.slotIdx === 1); return v ? [v.id] : null; };
  for (const card of ['Burning Finger', 'Fireball', 'Pusher', 'Cannon Tower']) {
    const spell = card !== 'Cannon Tower';
    const t = await H.fresh({ hand: [spell ? [card] : [], []] });
    t.grantFor(1, 0, 'Mountain Tear River');
    t.putSurprise(1, 0, 'Mountain Tear River');
    t.put(1, 0, 1, H.INERT.creature);
    t.targetFn = tgtCre;
    if (spell) await t.play(0, card, { hero: 0 });
    else { const ct = t.put(0, 0, 1, card); ct.turnPlayed = 1; t.gs.activePlayer = 0; t.phase(2); await t.activateCreature(0, 0, 1); }
    const fragen = t.prompts.filter(p => p.d.title === 'Mountain Tear River').length;
    const brennt = !!t.hero(0, 0).statuses.burned || t.inst(i => i.name === 'Cannon Tower').some(i => i.counters.burned);
    R.check(`${card} wählt die Kreatur: Mountain Tear River wird angeboten und der Angreifer brennt`, fragen === 1 && brennt, { fragen, brennt });
    R.check(`${card}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  // Gegenprobe: Held gewählt
  const t = await H.fresh({ hand: [['Burning Finger'], []] });
  t.grantFor(1, 0, 'Mountain Tear River'); t.putSurprise(1, 0, 'Mountain Tear River');
  t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Burning Finger', { hero: 0 });
  R.check('Gegenprobe: Held gewählt → Karte feuert, Angreifer brennt', t.prompts.some(p => p.d.title === 'Mountain Tear River') && !!t.hero(0, 0).statuses.burned);
  R.finish();
})();
