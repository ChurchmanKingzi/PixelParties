'use strict';
// W14c · Q174 (S03-10) Outbreak: „can be used in spite of any negative status effects" – auch mit NEGIERTEM oder GEBLENDETEM Nutzer spielbar (Al 16.10.2026: „Ja")
// Erwartet: harte Negierung, leichte Negierung (Anhängsel/Crystal), blinded, blinded_hit: Outbreak (100 Schaden) ist spielbar, der Nutzer wird bereinigt; Kontrolle: ein anderer Zauber mit Ziel (Chain Lightning) bleibt für einen geblendeten Nutzer gesperrt.
//   Die Stufe zählt auch unter harter Negierung nach den echten Schulstufen des Helden (ohne Destruction Magic bleibt Outbreak unspielbar).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const faelle = {
    negated_hart: { negated: { appliedTurn: 4, duration: 3, stacks: 1 } },
    negated_leicht: { negated: { appliedTurn: 4, duration: 3, effectOnly: true } },
    blinded: { blinded: { appliedTurn: 4, duration: 3, stacks: 1 } },
    blinded_hit: { blinded_hit: { appliedTurn: 4, duration: 3, stacks: 1 } },
    negated_und_blinded: { negated: { appliedTurn: 4, duration: 3, stacks: 1 }, blinded: { appliedTurn: 4, duration: 3, stacks: 1 } },
  };
  for (const [name, st] of Object.entries(faelle)) {
    const t = await H.fresh({ hand: [['Outbreak'], []], hp: 500 });
    t.grantFor(0, 0, 'Outbreak');
    Object.assign(t.gs.players[0].heroes[0].statuses, JSON.parse(JSON.stringify(st)));
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Outbreak', { hero: 0, noGrant: true });
    R.check(`Outbreak spielbar (${name}), 100 Schaden`, r === true && t.hp(1, 0) === 400, { r, grund: t.gs._cpuPlayFailReason, hp: t.hp(1, 0) });
    R.check(`(${name}) Nutzer lebt und keine Engine-Fehler`, t.hp(0, 0) > 0 && t.errors.length === 0, t.errors);
  }
  {
    // Kontrolle 1: Chain Lightning (requiresTarget) bleibt für einen geblendeten Nutzer gesperrt
    const t = await H.fresh({ hand: [['Chain Lightning'], []], hp: 500 });
    t.grantFor(0, 0, 'Chain Lightning');
    t.gs.players[0].heroes[0].statuses.blinded = { appliedTurn: 4, duration: 3, stacks: 1 };
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Chain Lightning', { hero: 0, noGrant: true });
    R.check('Kontrolle: Chain Lightning mit geblendetem Nutzer bleibt gesperrt', r === false, r);
  }
  {
    // Kontrolle 2: ohne die Schulstufe bleibt Outbreak auch unter Negierung unspielbar
    const t = await H.fresh({ hand: [['Outbreak'], []], hp: 500 });
    t.gs.players[0].heroes[0].statuses.negated = { appliedTurn: 4, duration: 3, stacks: 1 };
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Outbreak', { hero: 0, noGrant: true });
    R.check('Kontrolle: negierter Nutzer ohne Destruction Magic kann Outbreak nicht spielen', r === false, r);
  }
  {
    // Kontrolle 3: ohne negativen Status bleibt Outbreak unspielbar
    const t = await H.fresh({ hand: [['Outbreak'], []], hp: 500 });
    t.grantFor(0, 0, 'Outbreak');
    const r = await t.play(0, 'Outbreak', { hero: 0, noGrant: true });
    R.check('Kontrolle: ohne negativen Status nicht spielbar', r === false, r);
  }
  R.finish();
})();
