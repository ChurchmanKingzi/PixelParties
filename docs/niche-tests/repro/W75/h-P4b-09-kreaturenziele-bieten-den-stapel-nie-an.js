'use strict';
// W75 · Darion — Kreaturen, die „ein Ziel" (Held/Kreatur) waehlen, bieten einen Equip-Stapel NIE als Ziel an (Audit P4b, Klasse A, Gegenprobe der als „irrelevant" eingestuften Skripte).
// Kartentexte: Burning Skeleton „… choose a target your opponent controls and Burn it …", Skeleton Healer „… choose a different target and heal it for 100 HP", Sarcophagus of Sealed Magic „… choose a target and deal damage …",
//   Mr. Jiggles „… up to 2 targets your opponent controls", Phatnir „… choose a target and deal 300 damage to it", Slimy/Fiery Slime „When you summon this Creature, choose any target on the board …", Lovely Teddy „… choose a Creature your opponent controls".
// Erwartet: in keiner Zielliste steht die Ziel-ID des Stapelplatzes (`equip-<Seite>-<Held>-<Platz>`); ein Artefakt ist kein „target". Aufruf: node docs/niche-tests/repro/W75/h-P4b-09-kreaturenziele-bieten-den-stapel-nie-an.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();
  const AKTIV = ['Burning Skeleton', 'Skeleton Healer', 'Sarcophagus of Sealed Magic', 'Mr. Jiggles', 'Phatnir, Prototype of Coolness'];
  const BESCHWOERUNG = ['Slimy Slime', 'Fiery Slime'];
  for (const stSeat of [0, 1]) {
    const heroes = [[F, 'Tushu, the Knowledge Keeper', null], [F, null, null]]; heroes[stSeat][0] = D;
    const stackId = `equip-${stSeat}-0-1`;

    R.section(`Aktive Kreatureneffekte — Stapel bei Sitz ${stSeat}`);
    for (const name of AKTIV) {
      const t = await H.fresh({ active: 0, heroes, hand: [[F], [F]], gold: 100 });
      const c = t.put(0, 1, 0, name); c.turnPlayed = 1;
      stapel(t, stSeat, NAMEN);
      t.phase(2); t.grantFor(0, 1, name);
      let angeboten = null;
      t.targetFn = (valid) => { angeboten = valid.map(v => v.id); return [valid[0].id]; };
      const r = await t.activateCreature(0, 1, 0);
      R.check(`${name}: Zielliste vorhanden und ohne Stapel (${stackId})`, Array.isArray(angeboten) && angeboten.length > 0 && !angeboten.includes(stackId), { r, angeboten });
      R.check(`${name}: sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }

    R.section(`Beschwoerungs-Effekte — Stapel bei Sitz ${stSeat}`);
    for (const name of BESCHWOERUNG) {
      const t = await H.fresh({ active: 0, heroes, hand: [[name, F], [F]], gold: 100 });
      stapel(t, stSeat, NAMEN);
      let angeboten = null;
      t.targetFn = (valid) => { angeboten = valid.map(v => v.id); return [valid[0].id]; };
      const r = await t.play(0, name, { hero: 1, slot: 0 });
      R.check(`${name}: Zielliste vorhanden und ohne Stapel`, Array.isArray(angeboten) && angeboten.length > 0 && !angeboten.includes(stackId), { r, angeboten });
      R.check(`${name}: sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }

    R.section(`Kreaturen-Sammler (Lovely Teddy) — Stapel bei Sitz ${stSeat}`);
    {
      const t = await H.fresh({ active: 0, heroes, hand: [[F], [F]], gold: 100 });
      stapel(t, stSeat, NAMEN);
      for (const pi of [0, 1]) {
        const ids = t.engine.getCreatureTargets(pi).map(x => x.id);
        R.check(`getCreatureTargets(${pi}) kennt den Stapel nicht`, !ids.includes(stackId), ids);
      }
    }
  }

  R.section('Bekannt (nicht Darion-spezifisch): Mischief Militia - Heli Troopers bietet Ausruestungen als Frost-Ziel an');
  {
    const t = await H.fresh({ active: 0, heroes: [[F, null, null], [D, null, null]], hand: [[F], [F]], gold: 100 });
    const h = t.put(0, 0, 0, 'Mischief Militia - Heli Troopers'); h.turnPlayed = 1;
    stapel(t, 1, NAMEN);
    let angeboten = null;
    t.targetFn = (valid) => { angeboten = valid.map(v => v.id); return [valid[0].id]; };
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 1, heroIdx: 0 }, h, 500, 'spell', { sourceOwner: 1 }));
    R.note('Heli-Troopers-Zielliste (Stapel-ID steht dreimal darin)', angeboten);
  }
  R.finish();
})();
