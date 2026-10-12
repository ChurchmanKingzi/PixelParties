'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-01 · Naos Überheilung hängt als Dauer-Flag am Heldenplatz, nicht an Nao
//
//  Karte: Nao, the Barrier Priestess
//  Kartentext: „When this Hero heals a target's HP while they are lower than or equal to their maximum,
//  it can heal that target's HP beyond their maximum. The max HP of the target stays unchanged."
//
//  Erwartung: Nur Heilungen, die DIESER Held (lebend, nicht negiert) ausführt, dürfen über das Maximum gehen.
//  Beobachtung (✗): Das Skript setzt in `onGameStart` einmalig `gs.heroFlags['<seite>-<heroIdx>'].overhealPassive`
//  und nie zurück; `actionHealHero` / `actionHealCreature` fragen nur dieses Flag über `source.heroIdx` ab. Folge:
//    (a) eine Kreatur in Naos Support Zone (Skeleton Healer) überheilt – das ist nicht „this Hero";
//    (b) ist Nao tot, überheilt dieselbe Kreatur weiter;
//    (c) ist Nao nur leicht negiert (Weakening-Crystal-/Attachment-Form: Heldeneffekt aus, Abilities an) und
//        wirkt selbst Heal, überheilt sie trotzdem.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/01-nao-ueberheilung-slotflag.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const NAO = 'Nao, the Barrier Priestess';
(async () => {
  const R = H.runner();
  const base = async (extra = {}) => {
    const t = await H.fresh(Object.assign({ heroes: [[NAO, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 400 }, extra));
    await t.run(() => t.engine.runHooks('onGameStart', {}));   // die Harness ruft startGame() nicht auf
    return t;
  };
  const healerAn = async (t, ziel) => {
    const i = t.put(0, 0, 0, 'Skeleton Healer'); i.turnPlayed = 0;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === ziel).id];
    t.phase(2);
    return t.activateCreature(0, 0, 0);
  };

  R.section('(a) Skeleton Healer in der Support Zone der LEBENDEN Nao heilt Held 2 (volle HP 400, Heilung 100)');
  let t = await base();
  await healerAn(t, 2);
  R.check('Kreatur-Heilung überheilt nicht (nur „this Hero" darf)', t.hp(0, 2) === 400, t.hp(0, 2));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  R.section('(b) Nao tot, derselbe Healer in ihrer Spalte');
  t = await base();
  t.hero(0, 0).hp = 0;
  await healerAn(t, 2);
  R.check('Nao tot -> keine Überheilung', t.hp(0, 2) === 400, t.hp(0, 2));

  R.section('(c) Nao leicht negiert (Weakening-Crystal-Form), sie selbst wirkt Heal auf Held 1 (300/400, Heal 150)');
  t = await base({ hand: [['Heal'], []] });
  t.setAbilities(0, 0, [['Support Magic'], [], []]);
  t.hero(0, 1).hp = 300;
  t.hero(0, 0).statuses.negated = { appliedTurn: 0, _byWeakeningCrystal: true };
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
  const r = await t.play(0, 'Heal', { hero: 0 });
  R.note('Heal gespielt', r);
  R.check('Nao negiert -> Heilung endet bei max 400', t.hp(0, 1) <= 400, t.hp(0, 1));
  R.finish();
})();
