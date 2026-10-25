'use strict';
// W75 · Darion · P6 (gemeinsame Bausteine/Engine) — Die ZONENWAHL fuer ein NEUES Equip (Cool Repair, Weapon Collecting Wight, Backpack, Looting, Lolek …) darf auf dem Stapelplatz von Darion
// keine Rueckfrage „welches Equip des Stapels meinst du?" ausloesen: das Ziel ist der Platz, nicht eine Karte.
// Kartentext Cool Repair: „Choose an equippable Artifact from your discard pile and equip it to a Hero you control without paying its Cost."  Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Darion (Held 0) traegt Club / Blade / Crown in Platz 1, der zweite Held ist frei. Wird der Stapelplatz als Ziel angeklickt, kommt KEIN `instancePick` — Cool Repair legt
// das Equip oben auf den Stapel; ebenso `waehleAusruestPlatz` / `chooseAndEquip`. (Eine echte Kartenwahl im Stapel — Fire Bomb, Disarm … — fragt weiter.)
// Aufruf: node docs/niche-tests/repro/W75/h-P6-01-zonenwahl-auf-stapelplatz-keine-kartenrueckfrage.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const ES = require(H.ROOT + '/cards/effects/_equip-shared.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, T = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, namen = NAMEN, hi = 0, slot = 1) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const fragen = (t) => t.prompts.filter(p => p.d.type === 'instancePick').map(p => p.d.title || '');
(async () => {
  const R = H.runner();

  R.section('1) Cool Repair (echter Spielweg): Zonenwahl auf den Stapelplatz');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, T, null], [null, null, null]], hand: [['Cool Repair'], [F]], discard: [['Glass Sword'], []], gold: 500 });
    stapel(t, 0);
    t.script.push({ match: d => d.type === 'cardGallery' || d.type === 'cardGalleryMulti', answer: () => ({ cardName: 'Glass Sword', selectedCards: ['Glass Sword'], source: 'discard' }) });
    t.targetFn = (valid) => { const z = valid.find(x => x.type === 'equip' && x.owner === 0 && x.heroIdx === 0 && x.slotIdx === 1); return [(z || valid[0]).id]; };
    await t.play(0, 'Cool Repair', { hero: 1 });
    await t.drain();
    R.note('lauf', JSON.stringify({ zone: t.gs.players[0].supportZones[0], prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')), ziele: t.targets.map(x => x.valid.map(v => v.id)) }));
    R.check('keine Rueckfrage „welches Equip?"', fragen(t).length === 0, fragen(t));
    // (Ob Cool Repair das Equip danach tatsaechlich auf den Stapel legt, ist Sache der Karte selbst — siehe Bericht P6: ihre „Slot still free?"-Pruefung bricht bei einem belegten Stapelplatz ab.)
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('2) waehleAusruestPlatz (Mensch-Pfad): Klick auf den Stapelplatz');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, T, null], [null, null, null]], hand: [[F], [F]] });
    stapel(t, 0);
    t.engine._fastMode = false; t.engine.isCpuPlayer = () => false;
    t.engine.promptEffectTarget = async (pi, ziele, cfg) => {
      const id = ziele.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 0 && v.slotIdx === 1).id;
      const res = await t.engine._zielwahlAbschliessen(pi, ziele, cfg, [id]);
      return Array.isArray(res) ? res : [id];
    };
    const r = await t.run(() => ES.waehleAusruestPlatz(t.engine, 0, 'Cute Wings', {}));
    R.check('Ergebnis: Darion, Stapelplatz 1', r && r.heroIdx === 0 && r.slot === 1, r);
    R.check('keine Rueckfrage „welches Equip?"', fragen(t).length === 0, fragen(t));
  }

  R.section('3) Gegenprobe: eine echte Kartenwahl im Stapel fragt weiter (Fire Bomb auf einen Gegner-Darion)');
  {
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [['Fire Bomb', F], [F]], gold: 500 });
    const ins = stapel(t, 1);
    t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: ins[1].id }) });
    t.targetFn = (valid) => { const eq = valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1); return [(eq || valid[0]).id]; };
    t.policy.confirm = true;
    await t.play(0, 'Fire Bomb', { hero: 0 });
    await t.drain();
    R.check('Fire Bomb fragt „welches Equip?" und trifft die gewaehlte Karte (Mitte)', fragen(t).length >= 1 && JSON.stringify(t.gs.players[1].supportZones[0][1]) === JSON.stringify([NAMEN[0], NAMEN[2]]), [fragen(t), t.gs.players[1].supportZones[0]]);
  }
  R.finish();
})();
