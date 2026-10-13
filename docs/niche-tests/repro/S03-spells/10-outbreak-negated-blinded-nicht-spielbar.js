'use strict';
// S03-10 · Outbreak: „can be used in spite of any negative status effects" – bei Negated / Blinded trotzdem unspielbar
// Kartentext: „This Spell can only be used by a Hero that is afflicted by at least 1 negative status effect. This Spell can be used in spite of any negative status effects. …"
// Aufbau: Hand [Outbreak]; Held 0 trägt genau EINEN negativen Status (Schleife über alle 17 negativen Status aus `getNegativeStatuses()`); Ziel Gegner-Held 0.
// Erwartet: In allen 17 Fällen spielbar (100 Schaden am Ziel).
// Beobachtet: spielbar bei frozen, stunned, burned, poisoned, bleeding, nulled, bound, webbed, magic_silenced, frightened, berserked, cursed, aged, soul_transmitted;
//   NICHT spielbar bei `negated`, `blinded`, `blinded_hit`.
//   · negated: `canPlayDespiteStatuses` greift nur an den Toren für Frozen/Stunned/Bound, Nulled, Silenced/Frightened, Berserked; der Handlungsunfähigkeits-Riegel
//     (`isHeroIncapacitated`: hart negierter Held) wird nicht umgangen.
//   · blinded/blinded_hit: Outbreak trägt `requiresTarget: true` (Blinded-Gate, `_engine.js` ~20843: `_isHeroBlinded && requiresTarget === true ⇒ null`); der Bypass wird dort nicht gefragt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const hooks = require(H.ROOT + '/cards/effects/_hooks.js');
  for (const st of hooks.getNegativeStatuses()) {
    const t = await H.fresh({ hand: [['Outbreak'], []], hp: 500 });
    t.grantFor(0, 0, 'Outbreak');
    t.gs.players[0].heroes[0].statuses[st] = { appliedTurn: 4, duration: 3, stacks: 1 };
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Outbreak', { hero: 0, noGrant: true });
    R.check(`Outbreak spielbar mit Status „${st}"`, r === true && t.hp(1, 0) === 400, { r, grund: t.gs._cpuPlayFailReason, hp: t.hp(1, 0) });
  }
  R.finish();
})();
