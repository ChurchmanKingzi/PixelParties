'use strict';
// M01-03 · Cloud in a Bottle: Das Zielfenster fragt „Activate?", die Zusage bewirkt aber nichts (Karte bleibt auf der Hand, kein Halbieren)
// Kartentext: „Play this card immediately when a target you control takes any damage. Halve any damage that target would take for the rest of the turn (including that damage) (rounded up)."
// Aufbau: Sitz 0 spielt Fireball (150) auf Sitz 1 Held 0; Sitz 1 hat Cloud in a Bottle auf der Hand und antwortet auf „Activate Cloud in a Bottle?" mit JA.
// Erwartet: Karte wird gespielt (Hand leer, Gelöscht-Stapel), der Held verliert 75 statt 150 (725 HP), Buff „cloudy".
// Beobachtet: Prompt „Fireball is targeting … Activate Cloud in a Bottle?" erscheint, nach JA: Held verliert die vollen 150 (650), Cloud bleibt auf der Hand, kein Buff, kein zweiter Prompt.
// Ursache: `_checkPostTargetHandReactions` (_engine.js ~35990) ruft nach der Zusage `_rxCastWirkerWaehlen`; `_rxCastKandidaten` (_engine.js:36432) liefert für Karten ohne Wirker-Bedarf (Potion) `null`;
//   `_rxCastWirkerWaehlen` (Z. 36495-36498) macht daraus `[]` und gibt `kandidaten.length === 1` = false zurück → `continue`.
//   Zusätzlich setzt `postTargetCondition` (cloud-in-a-bottle.js) schon beim Anbieten `_cibPromptedFor`, der Fallback über `afterDamageCondition` ist damit gesperrt.
// Kontrolle: Direkter Schaden ohne Zielfenster (Fallback-Pfad `isAfterDamageReaction`) halbiert korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  R.section('Kontrolle: Fallback-Pfad (Schaden ohne Zielfenster) funktioniert');
  {
    const t = await H.fresh({ hand: [[], ['Cloud in a Bottle']], hp: 800 });
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 0, heroIdx: 0 }, t.hero(1, 0), 200, 'destruction_spell'));
    R.check('direkter Schaden 200 → nur 100 (halbiert)', t.hp(1, 0) === 700, t.hp(1, 0));
    R.check('Cloud verbraucht', !t.pile(1, 'hand').includes('Cloud in a Bottle'), t.pile(1, 'hand'));
  }
  R.section('Fireball auf den Helden (Zielfenster)');
  {
    const t = await H.fresh({ hand: [['Fireball'], ['Cloud in a Bottle']], hp: 800, confirm: true });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Fireball', { hero: 0 });
    R.check('Fireball gespielt', r === true, r);
    const prompt = t.prompts.find(p => p.d.type === 'confirm' && p.d.title === 'Cloud in a Bottle');
    R.check('Vorbedingung: Sitz 1 wurde gefragt, ob Cloud in a Bottle aktiviert wird', !!prompt, t.prompts.map(p => p.d.title));
    R.check('Held verliert nur die Hälfte (150 → 75): 725 HP', t.hp(1, 0) === 725, t.hp(1, 0));
    R.check('Cloud in a Bottle wurde gespielt (nicht mehr auf der Hand)', !t.pile(1, 'hand').includes('Cloud in a Bottle'), t.pile(1, 'hand'));
    R.check('Held hat den Buff „cloudy"', !!(t.hero(1, 0).buffs && t.hero(1, 0).buffs.cloudy), t.hero(1, 0).buffs);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
