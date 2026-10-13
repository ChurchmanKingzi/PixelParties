'use strict';
// R02-18 · Toxic Trap („is hit by an Attack, Spell or Creature effect") löst bei einem reinen Flächen-Statuszauber (Poisoned Well) nicht aus
// Kartentexte: Toxic Trap – „Activate this Surprise when the user is hit by an Attack, Spell or Creature effect. Inflict 1 Stack of Poison to the attacker."
//              Poisoned Well – „Inflict 1 Stack of Poison to all targets your opponent controls."
// CARD_API (Flächenschlag): „„hit by"-Surprises (Booby Trap) [öffnen bei Flächenschlägen] schon." – gilt für `dealDamageToTargets`; Poisoned Well vergibt den Status direkt (`addHeroStatus`, poisoned-well.js Z. 77) ohne Surprise-Fenster.
// Aufbau: Sitz 1: Toxic Trap in der Surprise Zone von Held 0 (Decay Magic 1). Sitz 0 (Decay Magic 3) spielt (a) Flame Avalanche (150 Schaden an allen, Kontrolle) bzw. (b) Poisoned Well.
// Erwartet: In beiden Fällen kommt die Frage „Toxic Trap" (Held 0 von Sitz 1 wird von einem Spell getroffen) und der Angreifer (Held 0 von Sitz 0) wird vergiftet.
// Beobachtet: (a) ✓. (b) keine Frage; die Surprise bleibt liegen, obwohl alle Helden von Sitz 1 vergiftet werden.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const karte of ['Flame Avalanche', 'Poisoned Well']) {
    const t = await H.fresh({ hand: [[karte], []], hp: 800 });
    t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], ['Decay Magic', 'Decay Magic', 'Decay Magic'], []]);
    t.setAbilities(1, 0, [['Decay Magic'], [], []]);
    t.putSurprise(1, 0, 'Toxic Trap');
    t.policy.confirm = true;
    await t.play(0, karte, { hero: 0, noGrant: true });
    const gefragt = t.prompts.some(p => p.d.title === 'Toxic Trap');
    const gegnerVergiftet = !!t.hero(1, 0).statuses.poisoned || t.hp(1, 0) < 800;
    R.check(`${karte}: Aufbau – der Zauber hat Held 0 von Sitz 1 erreicht`, gegnerVergiftet, { hp: t.hp(1, 0), st: Object.keys(t.hero(1, 0).statuses) });
    R.check(`${karte}: Toxic Trap wird angeboten`, gefragt, t.prompts.map(p => p.d.title));
    R.check(`${karte}: Angreifer (Sitz 0, Held 0) vergiftet`, !!t.hero(0, 0).statuses.poisoned, Object.keys(t.hero(0, 0).statuses));
    R.check(`${karte}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
