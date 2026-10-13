'use strict';
// R01-11 · Ein Berserk-Held löst weiter Surprises aus und spielt Reaktions-Zauber, obwohl er „cannot use any Spells"
// Kartentext: „The Hero this Spell is attached to cannot use any Spells or summon Creatures, but it can perform an Attack as an additional Action once per turn. …"
// Engine-Regel (`_engine.js` `_canHeroActivateSurprise` ~Z. 36680, v880): „SPELL-SPERREN GELTEN AUCH HIER … Surprises und Hand-Reaktionen sind Spells" – dort werden aber nur
//   `magic_silenced` und `frightened` geprüft, `berserked` nicht (nur `validateActionPlay` kennt es, Z. ~20800).
// Aufbau: Sitz 1: Held 0 (Magic Arts 3, Destruction Magic 1) mit Berserk-Anhang + Status `berserked`; in seiner Surprise Zone liegt verdeckt Booby Trap; Anti Magic Shield auf der Hand.
// Schritte: 1. Sitz 0 wirkt Fireball auf diesen Helden.
// Erwartet: Kein Surprise-Fenster, keine Hand-Reaktion (wie bei `magic_silenced` / `frightened`, Kontrolle unten): Fireball trifft (650), Sitz 0 bleibt bei 800.
// Beobachtet: Booby Trap löst aus (Angreifer 700) UND Anti Magic Shield negiert den Fireball (Held 800). Dasselbe bei `nulled` (Null Zone, ebenfalls „no Spells", `validateActionPlay` Z. ~20763) –
//   `magic_silenced` ist als Kontrolle korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const status of ['magic_silenced', 'nulled', 'berserked']) {
    const t = await H.fresh({ hand: [['Fireball'], ['Anti Magic Shield']] });
    t.putSurprise(1, 0, 'Booby Trap'); t.grantFor(1, 0, 'Booby Trap');
    t.setAbilities(1, 0, [['Destruction Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
    if (status === 'berserked') t.put(1, 0, 0, 'Berserk');
    t.heroStatus(1, 0, status);
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check(`${status}: keine Surprise, keine Hand-Reaktion (kein Prompt)`, t.prompts.length === 0, t.prompts.map(p => p.d.title));
    R.check(`${status}: Fireball trifft den Helden (650) und der Angreifer bleibt unversehrt (800)`, t.hp(1, 0) === 650 && t.hp(0, 0) === 800, [t.hp(0, 0), t.hp(1, 0)]);
    R.check(`${status}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
