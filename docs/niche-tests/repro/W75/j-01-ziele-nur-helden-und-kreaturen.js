'use strict';
// W75 · Perfect Disguise, Anti-Magnet, Skeleton Archer, Cardinal Beast Zhuque — „target" sind nur HELDEN und KREATUREN, keine Ausruestung (Al, 25.10.2026).
// Kartentexte: Perfect Disguise „Choose a target you control. …"; Anti-Magnet „… when exactly 1 target you control is chosen … while you control other possible targets. … redirected to a different target of your opponent's choice.";
//   Skeleton Archer „You may once per turn choose a target and deal 50 damage to it OR choose a face-down Surprise …"; Zhuque „… choose a target and Burn it for the rest of the game."
// Erwartet: Equips (auch im Darion-Stapel) werden nirgends als Ziel angeboten/gezaehlt; Helden und Kreaturen schon.
// Aufruf: node docs/niche-tests/repro/W75/j-01-ziele-nur-helden-und-kreaturen.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
function stapel(t, seite, namen) {
  const ps = t.gs.players[seite];
  ps.supportZones[0][1] = [];
  return namen.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  R.section('Perfect Disguise: nur eigene Helden und Kreaturen');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [['Perfect Disguise'], [F]] });
    stapel(t, 0, ['Club of Gobbo', 'Cute Crown']);
    t.put(0, 1, 0, H.INERT.creature);
    const sc = require('../../../../cards/effects/perfect-disguise.js');
    const ziele = sc.getValidTargets(t.gs, 0, t.engine);
    R.note('ziele', JSON.stringify(ziele.map(z => z.id + ':' + z.cardName)));
    R.check('kein Equip unter den Zielen', !ziele.some(z => z.cardName === 'Club of Gobbo' || z.cardName === 'Cute Crown'), ziele.map(z => z.cardName));
    R.check('Helden und die Kreatur sind Ziele', ziele.filter(z => z.type === 'hero').length >= 2 && ziele.some(z => z.cardName === H.INERT.creature), ziele.map(z => z.cardName));
  }

  R.section('Skeleton Archer: Schadensziele nur Helden und Kreaturen');
  {
    const t = await H.fresh({ active: 0, heroes: [[F, null, null], [D, 'Tushu, the Knowledge Keeper', null]], hand: [[F], [F]] });
    stapel(t, 1, ['Club of Gobbo', 'Cute Crown']);
    t.put(1, 1, 0, H.INERT.creature);
    const arch = t.put(0, 0, 0, 'Skeleton Archer'); arch.turnPlayed = 1;
    let angebote = [];
    t.targetFn = (v) => { angebote = v.map(x => x.cardName); return null; };
    t.policy.cancelTargets = true;
    t.phase(2); await t.activateCreature(0, 0, 0);
    R.note('angebote', JSON.stringify(angebote));
    R.check('Archer bot Ziele an', angebote.length > 0, angebote);
    R.check('kein Equip dabei', !angebote.includes('Club of Gobbo') && !angebote.includes('Cute Crown'), angebote);
    R.check('die Kreatur ist dabei', angebote.includes(H.INERT.creature), angebote);
  }

  R.section('Zhuque: nur Equips beim Gegner → nicht aktivierbar; mit Kreatur → aktivierbar');
  {
    const t = await H.fresh({ active: 0, heroes: [[F, null, null], [null, null, null]], hand: [[F], [F]] });
    // Gegner ohne Helden-Ziele ist nicht herstellbar; deshalb: Helden des Gegners verbrannt, nur Equip uebrig
    const z = t.put(0, 0, 0, 'Cardinal Beast Zhuque'); z.turnPlayed = 1;
    const sc = require('../../../../cards/effects/cardinal-beast-zhuque.js');
    const oppHero = t.gs.players[1].heroes.find(h => h?.name);
    if (oppHero) oppHero.statuses = { ...(oppHero.statuses || {}), burned: { permanent: true } };
    stapel(t, 1, ['Club of Gobbo']);
    const ctx = { _engine: t.engine, cardOwner: 0, cardHeroIdx: 0 };
    R.check('nur ein Equip beim Gegner → nicht aktivierbar', sc.canActivateCreatureEffect(ctx) === false);
    t.put(1, 1, 0, H.INERT.creature);
    R.check('mit einer Kreatur → aktivierbar', sc.canActivateCreatureEffect(ctx) === true);
  }

  R.section('Anti-Magnet: nur Helden/Kreaturen zaehlen als weitere Ziele');
  {
    const t = await H.fresh({ active: 1, heroes: [[F, null, null], [F, null, null]], hand: [['Anti-Magnet'], [F]], gold: [10, 10] });
    stapel(t, 0, ['Club of Gobbo']);
    const kreatur = t.put(0, 0, 0, H.INERT.creature);
    const sc = require('../../../../cards/effects/anti-magnet.js');
    const held = { id: 'hero-0-0', type: 'hero', owner: 0, heroIdx: 0, cardName: t.gs.players[0].heroes[0].name };
    const equip = { id: 'equip-0-0-1', type: 'equip', owner: 0, heroIdx: 0, slotIdx: 1, cardName: 'Club of Gobbo', cardInstance: t.engine.cardInstances.find(c => c.name === 'Club of Gobbo') };
    const kr = { id: 'equip-0-0-0', type: 'equip', owner: 0, heroIdx: 0, slotIdx: 0, cardName: H.INERT.creature, cardInstance: kreatur };
    t.engine.sourceEffectKind = () => 'spell';
    const quelle = { name: 'Fireball', owner: 1, controller: 1 };
    R.check('Held gewaehlt, einziges weiteres Ziel ist ein Equip → keine Umleitung', sc.canRedirect(t.gs, 0, held, [held, equip], {}, t.engine, quelle) === false);
    R.check('Held gewaehlt, weiteres Ziel ist eine Kreatur → Umleitung moeglich', sc.canRedirect(t.gs, 0, held, [held, kr], {}, t.engine, quelle) === true);
    R.check('ein Equip als gewaehltes Ziel loest nichts aus', sc.canRedirect(t.gs, 0, equip, [held, equip, kr], {}, t.engine, quelle) === false);
  }
  R.finish();
})();
