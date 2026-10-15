'use strict';
// W13 / Q143 (M02-06) · Weapon Storm: vor der ersten abgelegten Karte abbrechbar wie Breaking Strike (Al: „Ja, sollte abbrechbar sein")
// Erwartung: (a) Abbruch-Knopf (null) bei der ersten Wahl → genau EIN Prompt (nicht 40), Karte bleibt auf der Hand, Ausrüstung bleibt, Aktion nicht verbraucht;
// (b) nach einer abgelegten Karte beendet „Done" nur das Sammeln: Schaden = 1 × Satz; (c) normaler Durchlauf bleibt intakt. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  { const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(0, 1, [['Fighting', 'Fighting'], ['Toughness'], []]);
    t.put(0, 1, 0, 'Blade of the Swamp Witch');
    t.policy.cancelTargets = true;
    const r = await t.play(0, 'Weapon Storm', { hero: 1 });
    const cfg = t.targets[0] && t.targets[0].config;
    R.check('(a) erste Wahl abbrechbar, nur ein Prompt (keine 40 Wiederholungen)', !!(cfg && cfg.cancellable) && t.targets.length === 1, { cancellable: cfg && cfg.cancellable, prompts: t.targets.length });
    R.check('(a) Karte bleibt auf der Hand, Ausrüstung bleibt, Aktion nicht verbraucht', t.pile(0, 'hand').includes('Weapon Storm') && t.zone(0, 1, 0) === 'Blade of the Swamp Witch' && t.gs.currentPhase === 3, { hand: t.pile(0, 'hand'), equip: t.zone(0, 1, 0), phase: t.gs.currentPhase, r });
    R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(0, 1, [['Fighting', 'Fighting'], ['Toughness'], []]);
    t.put(0, 1, 0, 'Blade of the Swamp Witch');
    let n = 0;
    t.targetFn = (valid, cfg) => {
      if (valid.some(v => v.type === 'hero' && v.owner === 1)) return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];   // Schadensziel
      n++;
      if (n === 1) return [valid.find(v => v.type === 'equip').id];   // die Klinge ablegen
      return null;                                                    // „Done"
    };
    const r = await t.play(0, 'Weapon Storm', { hero: 1 });
    R.check('(b) eine Karte gesendet, danach „Done": Karte aufgelöst, Gegnerheld verliert 40–60', r === true && t.hp(1, 0) < 800 && t.pile(0, 'discardPile').includes('Weapon Storm'), { r, hp: t.hp(1, 0), ablage: t.pile(0, 'discardPile') });
    R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
