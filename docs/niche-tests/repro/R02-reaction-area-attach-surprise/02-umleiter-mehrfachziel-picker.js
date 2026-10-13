'use strict';
// R02-02 · Zielumleiter/-Negierer (Martyry, Rolling Boulder) sehen Mehrfachziel-Wahlen (Fireball „bis zu 2 Ziele", Mr. Jiggles „bis zu 2 Ziele") nie
// Kartentexte: Martyry – „Play this card immediately when a target you control is chosen by an Attack, Spell or Creature effect. That Attack, Spell or effect is redirected to the user."
//              Rolling Boulder – „Activate this Surprise when your opponent chooses exactly 1 target you control with the effect of a Creature. Negate the effect and defeat that Creature."
// Ruling (_engine.js ~29065, „Als Vorgabe (bindend, 31.8.)"): „ein Umleiter reagiert auf JEDES Ziel EINZELN" – die Schleife in `applyRedirectWindows` gilt ausdrücklich auch für mehrere Ziele.
// Aufbau: (a) Sitz 1 hat Martyry auf der Hand (Held 1 kann Support Magic 1), Sitz 0 spielt Fireball und wählt GENAU EIN Ziel (Held 0 von Sitz 1).
//         (b) Sitz 1 hat Rolling Boulder (Held 1), Sitz 0 aktiviert Mr. Jiggles (Kreatur: „up to 2 targets … 100 damage") und wählt GENAU EIN Ziel (Held 0 von Sitz 1).
//         Gegenproben mit Einzelziel-Wahl: Burning Finger (Martyry) und Cannon Tower (Rolling Boulder) lösen aus.
// Erwartet: in (a) wird Martyry angeboten, in (b) feuert Rolling Boulder (Kreatur wird besiegt, Effekt negiert).
// Beobachtet: weder (a) noch (b): Fireball trifft Held 0 (650 HP), Martyry bleibt auf der Hand; Jiggles trifft (700 HP) und lebt. Gegenproben ✓.
// Ursache: `promptMultiTarget` (_engine.js ~5799) ruft `promptEffectTarget` ohne `_redirectSource`/`sourceCard` in der Config → `_redirectSourceFor()` liefert null →
//   `applyRedirectWindows(…, null)` kehrt sofort zurück (Z. ~29115 „if (!sourceCard) return pickedIds"). `promptDamageTarget` setzt die Quelle, daher funktioniert dort alles.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const wähle1 = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  // Martyry
  for (const [card, erwartet] of [['Burning Finger', true], ['Fireball', true]]) {
    const t = await H.fresh({ hand: [[card], ['Martyry']] });
    t.grantFor(1, 1, 'Martyry');
    t.targetFn = wähle1;
    await t.play(0, card, { hero: 0 });
    const angeboten = t.prompts.some(p => p.d.title === 'Martyry');
    R.check(`Martyry wird gegen ${card} (genau 1 Ziel gewählt) angeboten`, angeboten === erwartet, { angeboten, hand1: t.pile(1, 'hand'), hp1: t.gs.players[1].heroes.map(h => h.hp) });
  }
  // Rolling Boulder
  for (const [kreatur, erwartet] of [['Cannon Tower', true], ['Mr. Jiggles', true]]) {
    const t = await H.fresh({ hand: [[], []] });
    t.grantFor(1, 1, 'Rolling Boulder'); t.putSurprise(1, 1, 'Rolling Boulder');
    const ct = t.put(0, 0, 1, kreatur); ct.turnPlayed = 1; t.gs.activePlayer = 0; t.phase(2);
    t.targetFn = wähle1;
    await t.activateCreature(0, 0, 1);
    const feuerte = t.prompts.some(p => p.d.title === 'Rolling Boulder') && ct.zone !== 'support';
    R.check(`Rolling Boulder reagiert auf ${kreatur} mit genau 1 gewähltem Ziel (Kreatur besiegt)`, feuerte === erwartet, { zone: ct.zone, hp1: t.gs.players[1].heroes.map(h => h.hp) });
  }
  R.finish();
})();
