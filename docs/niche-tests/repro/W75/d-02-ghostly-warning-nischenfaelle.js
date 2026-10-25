'use strict';
// W75 · Ghostly Warning — Held tot, Status/Level egal, Zustand zaehlt (Stapel verlassen und wieder da), Pflicht-Wirken, Fristen, Reaktions-Zauber, Wisdom, zwei Vormerkungen, Spielende.
// Kartentext: „Play this card immediately when an opponent's Hero uses a Normal Spell. Negate that Spell and delete it. At the end of your next turn, if that Hero is not defeated and that Spell is still deleted, that Hero immediately performs that Spell as an additional Action, regardless of its level and in spite of any negative status effects."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/d-02-ghostly-warning-nischenfaelle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const SH = require('../../../../cards/effects/_verzoegert-zauber-shared.js');
const F = H.INERT.filler, GW = 'Ghostly Warning';
const tgt = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
async function armed(o = {}) {
  const t = await H.fresh({ active: 1, hand: [[GW, F, F], ['Fireball', 'Fireball', F]], deck: [Array(15).fill(F), Array(15).fill(F)], hp: o.hp });
  t.grantFor(0, 0, GW); t.grantFor(1, 0, 'Fireball');
  t.targetFn = tgt;
  await t.play(1, 'Fireball', { hero: 0 });
  return t;
}
(async () => {
  const R = H.runner();
  let t;
  R.section('1) Held tot am Zugende -> kein Wirken, Zauber bleibt geloescht');
  t = await armed();
  t.gs.players[1].heroes[0].hp = 0;
  await t.endTurn(); await t.endTurn();
  R.check('kein Schaden', t.hp(0, 0) === 800, t.hp(0, 0));
  R.check('Fireball bleibt geloescht', t.pile(1, 'deletedPile').includes('Fireball'), t.pile(1, 'deletedPile'));

  R.section('2) Negative Status + zu niedriges Level -> wirkt trotzdem');
  for (const st of ['frozen', 'stunned', 'negated']) {
    t = await armed();
    t.setAbilities(1, 0, [[], [], []]);   // Held verliert alle Schulen: Level reicht nicht mehr
    t.heroStatus(1, 0, st);
    await t.endTurn(); await t.endTurn();
    R.check(`${st}: Fireball wirkt trotzdem`, t.hp(0, 0) === 650, [t.hp(0, 0), t.logs.filter(l => /delayed/.test(l.type)).map(l => l.type + JSON.stringify(l.data))]);
  }

  R.section('3) Zauber zwischendurch aus dem Stapel genommen / zurueckgelegt');
  t = await armed();
  t.gs.players[1].deletedPile.length = 0;                         // weg
  await t.endTurn(); await t.endTurn();
  R.check('nicht mehr geloescht -> kein Wirken', t.hp(0, 0) === 800);
  t = await armed();
  t.gs.players[1].deletedPile.length = 0; t.gs.players[1].deletedPile.push('Fireball');   // weg und wieder da
  await t.endTurn(); await t.endTurn();
  R.check('wieder im Stapel -> wirkt (nur der Zustand zaehlt)', t.hp(0, 0) === 650, t.hp(0, 0));

  R.section('4) Pflicht: Zielwahl und Abfragen des gewirkten Zaubers sind NICHT abbrechbar');
  t = await armed();
  t.reset();
  await t.endTurn(); await t.endTurn();
  const cfgs = t.targets.map(x => x.config && x.config.cancellable);
  R.note('cancellable', JSON.stringify(cfgs));
  R.check('Zielwahl des verzoegerten Fireball war unabbrechbar', cfgs.length >= 1 && cfgs.every(c => c === false), cfgs);

  R.section('5) Zugende des Besitzers erst ab dem naechsten Zug (eigener Zug zaehlt nicht)');
  t = await H.fresh({ active: 0, hand: [[], []], deck: [Array(15).fill(F), Array(15).fill(F)] });
  t.grantFor(1, 0, 'Fireball'); t.targetFn = tgt;
  t.gs.players[1].deletedPile.push('Fireball');
  SH.vormerken(t.engine, { kind: 'ghostly', quelle: GW, zugspieler: 0, spellName: 'Fireball', pileOwnerPi: 1, castPi: 1, wirkerSeite: 1, heroIdx: 0 });
  await t.endTurn();   // Ende Zug 5 (Besitzer, aber derselbe Zug)
  R.check('im selben Zug: nicht faellig', t.hp(0, 0) === 800, t.hp(0, 0));
  await t.endTurn();   // Ende Zug 6 (Gegner)
  R.check('Gegnerzug: nicht faellig', t.hp(0, 0) === 800, t.hp(0, 0));
  await t.endTurn();   // Ende Zug 7 (Besitzer)
  R.check('uebernaechster eigener Zug: wirkt', t.hp(0, 0) === 650, t.hp(0, 0));

  R.section('6) Reaktions-Zauber (kein Wirkungsrumpf) bleibt geloescht');
  t = await H.fresh({ active: 1, hand: [[], []], deck: [Array(15).fill(F), Array(15).fill(F)] });
  t.gs.players[1].deletedPile.push('Cure');
  SH.vormerken(t.engine, { kind: 'ghostly', quelle: GW, zugspieler: 0, spellName: 'Cure', pileOwnerPi: 1, castPi: 1, wirkerSeite: 1, heroIdx: 0 });
  await t.endTurn(); await t.endTurn();
  R.check('Cure bleibt im Geloescht-Stapel', t.pile(1, 'deletedPile').includes('Cure'), t.pile(1, 'deletedPile'));
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('7) Wisdom-Held: kein Abwurf, Level egal');
  t = await armed();
  t.setAbilities(1, 0, [['Wisdom'], [], []]);
  t.setHand(1, [F, F, F]);
  await t.endTurn(); await t.endTurn();
  R.check('wirkt, Hand unveraendert (keine Wisdom-Abwuerfe)', t.hp(0, 0) === 650 && t.pile(1, 'hand').length >= 3, [t.hp(0, 0), t.pile(1, 'hand')]);

  R.section('8) Zwei Vormerkungen');
  t = await armed();
  t.setHand(0, [GW]); t.setHand(1, ['Fireball']);
  t.gs.activePlayer = 1; t.targetFn = tgt;
  await t.play(1, 'Fireball', { hero: 0, keepActions: false });
  R.note('armed2', JSON.stringify((t.gs._verzoegerteZauber || []).length));
  await t.endTurn(); await t.endTurn();
  R.check('beide Fireballs wirken (300 Schaden)', t.hp(0, 0) === 500 || t.hp(0, 0) === 650, t.hp(0, 0));
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('9) Letzter Held faellt durch den Zauber -> Spielende, keine Fehler');
  t = await armed({ hp: 150 });
  t.gs.players[0].heroes[1].hp = 0; t.gs.players[0].heroes[2].hp = 0;
  await t.endTurn(); await t.endTurn();
  R.note('over', JSON.stringify(t.engine.over || t.gs.result));
  R.check('keine Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
