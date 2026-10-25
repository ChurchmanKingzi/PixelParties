'use strict';
// W75 · Darion (Audit P1) — Modnir, Hammer of Coolness / Swellpnir, Mount of Coolness aus dem Coolness Stack ausruesten.
// Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: Hat Darion schon einen Equip-Stapel, ist der Stapel der EINZIGE Platz (kein „no_legal_target", auch wenn alle anderen Zonen belegt sind) und die Platzwahl fragt NICHT „welches Equip?".
//           Das Equip landet im Stapel. Dasselbe gilt fuer die gemeinsame Platzwahl `waehleAusruestPlatz` (Backpack, Riffel …).
// Aufruf: node docs/niche-tests/repro/W75/h-P1-03-modnir-swellpnir-platz-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const ES = require('../../../../cards/effects/_equip-shared.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper', F = H.INERT.filler;
async function bau() {
  const t = await H.fresh({ active: 0, heroes: [[D, null, null], [T, null, null]], hand: [['Club of Gobbo', 'Cute Crown', F], [F]], gold: 900, deckSize: 30 });
  await t.play(0, 'Club of Gobbo', { hero: 0, slot: 1 });
  await t.play(0, 'Cute Crown', { hero: 0, slot: 1 });
  return t;
}
(async () => {
  const R = H.runner();
  for (const karte of ['Modnir, Hammer of Coolness', 'Swellpnir, Mount of Coolness']) {
    for (const frei of [true, false]) {
      R.section(`${karte} · ${frei ? 'andere Zonen frei' : 'alle anderen Zonen belegt'}`);
      const t = await bau();
      if (!frei) { t.put(0, 0, 0, H.INERT.creature); t.put(0, 0, 2, H.INERT.creature); }
      const ps = t.gs.players[0];
      ps.coolnessStack.push(karte); t.engine._trackCard(karte, 0, 'coolnessStack');
      let angeboten = null;
      t.targetFn = (valid) => { angeboten = valid.map(v => v.id); const e = valid.find(v => v.heroIdx === 0 && v.owner === 0 && (v.type === 'equip' || v.type === 'hero')); return e ? [e.id] : undefined; };
      t.gs.activePlayer = 0; t.phase(3);
      const r = await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
      R.check('ausgeruestet (nicht „no_legal_target")', r && r.played === true, r);
      R.check('Stapelplatz ist das einzige Zonenziel', JSON.stringify((angeboten || []).filter(i => i.startsWith('equip-'))) === '["equip-0-0-1"]', angeboten);
      R.check('Karte liegt im Stapel', ps.supportZones[0][1].includes(karte) && ps.supportZones[0][1].length === 3, ps.supportZones[0]);
      R.check('keine Rueckfrage „welches Equip?"', !t.prompts.some(p => p.d.type === 'instancePick'), t.prompts.map(p => p.d.type));
      R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
  }
  R.section('waehleAusruestPlatz (gemeinsame Platzwahl)');
  {
    const t = await bau();
    t.targetFn = (valid) => { const e = valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 0); return e ? [e.id] : undefined; };
    const r = await t.run(() => ES.waehleAusruestPlatz(t.engine, 0, 'Glass Sword'));
    R.check('Stapelplatz gewaehlt', r && r.heroIdx === 0 && r.slot === 1, r);
    R.check('keine Rueckfrage „welches Equip?"', !t.prompts.some(p => p.d.type === 'instancePick'), t.prompts.map(p => p.d.type));
  }
  R.finish();
})();
