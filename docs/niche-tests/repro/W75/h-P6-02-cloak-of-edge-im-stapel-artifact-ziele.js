'use strict';
// W75 · Darion · P6 (Engine `getArtifactTargets`, `_ability-cost-shared`) — „Cloak of Edge" zaehlt in einer Support Zone als ABILITY, nicht als Artifact. Liegt sie im Equip-Stapel von Darion,
// darf sie unter den Artifact-Zielen des Platzes nicht auftauchen — und sie darf die uebrigen Equips des Stapels nicht mitreissen (vorher: war die Cloak die unterste Karte, wurde der GANZE
// Platz als „Ability" aussortiert und Club/Crown waren nicht mehr als Equip wählbar, z. B. fuer Weapon Storm / Barrier of Faith).
// Kartentext Cloak of Edge: „… This card counts as an Ability while it's in a Support Zone."  Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Stapel [Cloak, Club, Crown] bzw. [Club, Cloak, Crown] bzw. [Cloak, Club]: `getArtifactTargets` nennt EIN Ziel fuer den Platz, dessen waehlbare Karten nur Club/Crown sind;
// `getAbilityTargets` kennt die Cloak weiter als Ability; `_ability-cost-shared.sendables` liefert Club/Crown als Equips und die Cloak als Ability.
// Aufruf: node docs/niche-tests/repro/W75/h-P6-02-cloak-of-edge-im-stapel-artifact-ziele.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const AC = require(H.ROOT + '/cards/effects/_ability-cost-shared.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, T = 'Tushu, the Knowledge Keeper';
function stapel(t, seite, namen, hi = 0, slot = 1) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();
  const faelle = [
    ['Cloak unten', ['Cloak of Edge', 'Club of Gobbo', 'Cute Crown'], ['Club of Gobbo', 'Cute Crown']],
    ['Cloak in der Mitte', ['Club of Gobbo', 'Cloak of Edge', 'Cute Crown'], ['Club of Gobbo', 'Cute Crown']],
    ['Cloak oben', ['Club of Gobbo', 'Cute Crown', 'Cloak of Edge'], ['Club of Gobbo', 'Cute Crown']],
    ['Cloak + ein Equip', ['Cloak of Edge', 'Club of Gobbo'], ['Club of Gobbo']],
  ];
  for (const [titel, namen, erwartet] of faelle) {
    R.section(titel + ': ' + namen.join(' / '));
    const t = await H.fresh({ active: 0, heroes: [[D, T, null], [null, null, null]], hand: [[F], [F]] });
    const ins = stapel(t, 0, namen);
    const cloak = ins.find(i => i.name === 'Cloak of Edge');
    const ziele = t.engine.getArtifactTargets(0);
    const z = ziele.find(x => x.slotIdx === 1);
    const erlaubt = z ? (z._erlaubteInstanzen || [z.cardInstance.id]).map(id => ins.find(i => i.id === id).name) : [];
    R.note('lauf', JSON.stringify({ ziele: ziele.map(x => x.id + ':' + x.cardName), erlaubt }));
    R.check('genau ein Artifact-Ziel fuer den Platz', ziele.filter(x => x.slotIdx === 1).length === 1, ziele.map(x => x.id));
    R.check('waehlbar sind nur ' + erwartet.join(', ') + ' (nicht die Cloak)', JSON.stringify(erlaubt.slice().sort()) === JSON.stringify(erwartet.slice().sort()), erlaubt);
    R.check('die Vertreterkarte des Ziels ist nicht die Cloak', z && z.cardInstance && z.cardInstance.id !== cloak.id, z && z.cardName);
    const ab = t.engine.getAbilityTargets(0);
    R.check('getAbilityTargets kennt die Cloak weiter als Ability', ab.some(a => a.cardName === 'Cloak of Edge' && a.slotIdx === 1), ab.map(a => a.id + ':' + a.cardName));
    const s = AC.sendables(t.engine, 0, 0);
    R.check('sendables: Equips = Club/Crown, Ability = Cloak', s.equips.length === 1 && s.abilities.some(a => a.cardName === 'Cloak of Edge'), { equips: s.equips.map(e => e.cardName), abilities: s.abilities.map(a => a.cardName) });
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Ability-Ziel „Cloak of Edge" im Stapel (Charme, Memory Wipe …): keine Rueckfrage unter den Nachbar-Equips');
  {
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [[F], [F]] });
    stapel(t, 1, ['Club of Gobbo', 'Cloak of Edge', 'Cute Crown']);
    const ziel = { id: 'equip-1-0-1', type: 'equip', owner: 1, heroIdx: 0, slotIdx: 1, cardName: 'Cloak of Edge' };
    t.engine.isCpuPlayer = () => false;
    await t.run(() => t.engine._zielwahlAbschliessen(0, [ziel], { maxTotal: 1 }, [ziel.id]));
    R.check('keine Rueckfrage „welches Equip?"', t.prompts.filter(p => p.d.type === 'instancePick').length === 0, t.prompts.map(p => p.d.type));
  }
  R.finish();
})();
