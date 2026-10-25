'use strict';
// W75 · Darion — Audit P3b: Klasse B (Zaehlen/Bedingungen) — jede Karte im Stapel zaehlt, nicht die Zone.
// Kartentexte: Breaking Strike „Discard any number of Artifacts equipped to the user … deals the user's Attack stat times the number of discarded Artifacts"; Weapon Storm „Send any number of Artifacts equipped and Abilities attached …
//   each card adds 40 damage"; Muscle Training „… if the user has an equipped Artifact this counts as an additional Action"; Capture „If the user is equipped with Truth-Seeing Eye, this counts as an additional Action";
//   Gathering Storm „… damage doubled while the Hero is also equipped with The White Eye"; Blood Rock (Area) trifft nicht den Helden mit Diver Helmet.
// Erwartet (Stapel Club / Blade / Crown bzw. mit dem genannten Artefakt in der Mitte): Breaking Strike und Weapon Storm zaehlen drei abgeworfene Karten; die Bedingungen finden das Artefakt auch mitten im Stapel.
// Aufruf: node docs/niche-tests/repro/W75/h-P3b-08-zaehlen-und-bedingungen-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat];
  ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  for (const karte of ['Breaking Strike', 'Weapon Storm']) {
    R.section(`${karte}: alle drei Karten des Stapels abwerfen`);
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [[karte, F], [F]], gold: 500 });
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    const insts = stapel(t, 0, NAMEN);
    let n = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: insts[n++ % 3].id }) });
    t.targetFn = (valid, config) => {
      if (config && config._abilityCost) { const e = valid.find(v => v.type === 'equip' && v.owner === 0); return e ? [e.id] : []; }
      return [(valid.find(v => v.type === 'hero' && v.owner === 1) || valid[0]).id];
    };
    t.policy.confirm = true;
    const hp0 = t.hp(1, 0);
    await t.play(0, karte, { hero: 0 });
    await t.drain();
    const log = t.lg(karte === 'Breaking Strike' ? 'breaking_strike' : 'weapon_storm')[0];
    R.note('lauf', JSON.stringify({ log, zone: t.gs.players[0].supportZones[0][1], hpVerlust: hp0 - t.hp(1, 0) }));
    R.check('drei Karten gezaehlt', log && (log.discarded === 3 || log.sent === 3), log);
    R.check('Stapel leer, alle drei in der Ablage', t.gs.players[0].supportZones[0][1].length === 0 && NAMEN.every(x => t.pile(0, 'discardPile').includes(x)), [t.gs.players[0].supportZones[0], t.pile(0, 'discardPile')]);
    R.check('Schaden = Satz x 3', log && log.damage === (log.atk != null ? log.atk * 3 : log.rate * 3) && hp0 - t.hp(1, 0) === log.damage, [log, hp0 - t.hp(1, 0)]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Muscle Training / Capture: Bedingung findet das Artefakt mitten im Stapel');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [[F], [F]], gold: 500 });
    const MT = H.loadCardEffect('Muscle Training'), CAP = H.loadCardEffect('Capture');
    R.check('Muscle Training: ohne Equip keine Zusatzaktion', MT.inherentAction(t.gs, 0, 0, t.engine) === false);
    stapel(t, 0, ['Club of Gobbo', 'Glass Sword', 'Cute Crown']);
    R.check('Muscle Training: mit Stapel eine Zusatzaktion', MT.inherentAction(t.gs, 0, 0, t.engine) === true);
    R.check('Capture: ohne Truth-Seeing Eye keine Zusatzaktion', CAP.inherentAction(t.gs, 0, 0, t.engine) === false);
    const t2 = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [[F], [F]], gold: 500 });
    stapel(t2, 0, ['Club of Gobbo', 'Truth-Seeing Eye', 'Cute Crown']);
    R.check('Capture: Truth-Seeing Eye mitten im Stapel gibt die Zusatzaktion', CAP.inherentAction(t2.gs, 0, 0, t2.engine) === true);
    R.check('Sauber', t.errors.length === 0 && t2.errors.length === 0 && t.audit().length === 0 && t2.audit().length === 0, [t.errors, t2.errors]);
  }

  R.section('Gathering Storm: The White Eye mitten im Stapel verdoppelt den Schaden');
  for (const mitAuge of [false, true]) {
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, F, F]], hand: [[F], [F]], deck: [Array(15).fill(F), Array(15).fill(F)], gold: 500, hp: 800 });
    stapel(t, 0, ['Club of Gobbo', mitAuge ? 'The White Eye' : 'Glass Sword', 'Cute Crown']);
    const gs = t.put(0, 0, 0, 'Gathering Storm'); gs.turnPlayed = 1;
    t.targetFn = (valid) => valid.filter(v => v.type === 'hero' && v.owner === 1).map(v => v.id);
    await t.endTurn();
    const verlust = 800 - t.hp(1, 0);
    R.check(`${mitAuge ? 'mit' : 'ohne'} White Eye: ${mitAuge ? 140 : 70} Schaden je Ziel`, verlust === (mitAuge ? 140 : 70), verlust);
  }

  R.section('Blood Rock: Diver Helmet mitten im Stapel schuetzt Darion');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [[F], [F]], deck: [Array(15).fill(F), Array(15).fill(F)], gold: 500, hp: 800 });
    stapel(t, 0, ['Club of Gobbo', 'Diver Helmet', 'Cute Crown']);
    t.putArea(1, 'Blood Rock');
    await t.endTurn();
    R.check('Darion unversehrt, der andere Held 100 Schaden', t.hp(0, 0) === 800 && t.hp(0, 1) === 700, [t.hp(0, 0), t.hp(0, 1)]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
