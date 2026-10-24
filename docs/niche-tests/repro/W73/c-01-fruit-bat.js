'use strict';
// W73c-01 · Fruit Bat, Nosferapple (Creature Normal Lv3, 200 HP)
// „You may once per turn choose a target your opponent controls and deal 150 damage to it. If you do, heal this Creature for the amount of damage dealt."
const H = require('../../lib/h.js');
const CARD = 'Fruit Bat, Nosferapple';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);

async function beissen(t, seat, hi, slot, zielId) {
  t.gs.activePlayer = seat; t.phase('MAIN1');
  t.targetFn = (valid) => (zielId ? valid.filter(v => v.id === zielId).map(v => v.id) : []);
  const r = await t.activateCreature(seat, hi, slot, {});
  t.targetFn = null;
  return r;
}
const hp = (inst) => inst.counters.currentHp;

(async () => {
  const R = H.runner();

  R.section('A · 150 Schaden, Heilung um den angerichteten Schaden');
  {
    const t = await H.fresh({ hand: [[], []] });
    const bat = t.put(0, 0, 0, CARD); bat.turnPlayed = 0; bat.counters.currentHp = 50;
    const v = t.hp(1, 0);
    const r = await beissen(t, 0, 0, 0, 'hero-1-0');
    R.check('benutzt', r !== false, r);
    R.check('Gegnerheld verliert 150', v - t.hp(1, 0) === 150, [v, t.hp(1, 0)]);
    R.check('Fledermaus 50 → 200 (geheilt um 150)', hp(bat) === 200, hp(bat));
    R.check('Animation: Biss am Ziel, dann Blut zur Fledermaus (Ziele Opfer, Fledermaus)', t.evs('play_zone_animation').some(e => e.type === 'bat_bite_drain' && e.targets.length === 2 && e.targets[0].owner === 1 && e.targets[1].zoneSlot === 0), t.evs('play_zone_animation'));
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  {
    // einmal pro Zug
    const t = await H.fresh({ hand: [[], []] });
    const bat = t.put(0, 0, 0, CARD); bat.turnPlayed = 0; bat.counters.currentHp = 50;
    await beissen(t, 0, 0, 0, 'hero-1-0');
    const v = t.hp(1, 0);
    await beissen(t, 0, 0, 0, 'hero-1-0');
    R.check('zweiter Einsatz im selben Zug: kein Schaden', t.hp(1, 0) === v, [v, t.hp(1, 0)]);
  }

  R.section('B · nur der REAL angerichtete Schaden heilt');
  {
    const t = await H.fresh({ hand: [[], []] });
    const bat = t.put(0, 0, 0, CARD); bat.turnPlayed = 0; bat.counters.currentHp = 20;
    t.gs.players[1].heroes[0].hp = 60;
    await beissen(t, 0, 0, 0, 'hero-1-0');
    R.check('Ziel hatte nur 60 HP: Held besiegt', t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check('Heilung nur 60 (nicht 150): 20 → 80', hp(bat) === 80, hp(bat));
  }
  {
    const t = await H.fresh({ hand: [[], []] });
    const bat = t.put(0, 0, 0, CARD); bat.turnPlayed = 0; bat.counters.currentHp = 20;
    const ziel = t.put(1, 0, 0, H.INERT.creature);   // 200 HP
    ziel.counters.currentHp = 90;
    await beissen(t, 0, 0, 0, 'equip-1-0-0');
    R.check('Kreatur mit 90 HP: besiegt', !t.find(H.INERT.creature, 'support', 1, 0), t.gs.players[1].supportZones[0]);
    R.check('Heilung nur 90: 20 → 110', hp(bat) === 110, hp(bat));
  }
  {
    const t = await H.fresh({ hand: [[], []] });
    const bat = t.put(0, 0, 0, CARD); bat.turnPlayed = 0; bat.counters.currentHp = 20;
    const ziel = t.put(1, 0, 0, H.INERT.big);   // 1000 HP
    await beissen(t, 0, 0, 0, 'equip-1-0-0');
    R.check('Kreatur mit 1000 HP: 850 übrig, Heilung 150', ziel.counters.currentHp === 850 && hp(bat) === 170, [ziel.counters.currentHp, hp(bat)]);
  }
  {
    // max HP der Fledermaus: Heilung über die Grenze wird gekappt
    const t = await H.fresh({ hand: [[], []] });
    const bat = t.put(0, 0, 0, CARD); bat.turnPlayed = 0; bat.counters.currentHp = 150;
    await beissen(t, 0, 0, 0, 'hero-1-0');
    R.check('Heilung nicht über die max. HP (200)', hp(bat) <= 200, hp(bat));
  }

  R.section('C · Ziele und Abbruch');
  {
    const t = await H.fresh({ hand: [[], []] });
    const bat = t.put(0, 0, 0, CARD); bat.turnPlayed = 0; bat.counters.currentHp = 50;
    t.put(0, 1, 0, H.INERT.creature);
    let angeboten = null;
    t.targetFn = (valid) => { angeboten = valid.slice(); return []; };
    t.gs.activePlayer = 0; t.phase('MAIN1');
    await t.activateCreature(0, 0, 0, {});
    t.targetFn = null;
    R.check('nur Ziele des Gegners angeboten (keine eigenen Helden/Kreaturen)', angeboten && angeboten.length > 0 && angeboten.every(v => v.owner === 1), angeboten && angeboten.map(v => v.id));
    R.check('Abbruch: nichts passiert, Effekt nicht verbraucht', hp(bat) === 50 && t.hp(1, 0) === 800, [hp(bat), t.hp(1, 0)]);
    await beissen(t, 0, 0, 0, 'hero-1-0');
    R.check('danach noch benutzbar', t.hp(1, 0) === 650 && hp(bat) === 200, [t.hp(1, 0), hp(bat)]);
  }
  {
    // Shrink am Helden der Fledermaus ändert nichts (Kreaturenschaden, keine Attack)
    const t = await H.fresh({ hand: [[], []] });
    const bat = t.put(0, 0, 0, CARD); bat.turnPlayed = 0; bat.counters.currentHp = 50;
    await t.run(() => t.engine.addHeroStatus(0, 0, 'shrunk', { appliedBy: 1, source: 'Shrink', permanent: true, _fromAttachment: 'Shrink' }));
    await beissen(t, 0, 0, 0, 'hero-1-0');
    R.check('Fledermaus-Schaden ist kein Attack', t.hp(1, 0) === 650, t.hp(1, 0));
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
