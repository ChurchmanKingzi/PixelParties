'use strict';
// A07-25 · Smugbeth: der Träger darf gegnerische Ability-Effekte weiter nutzen, wenn Smugbeth von der Creepy-Clown-Aura (oder `magic_silenced`) stillgelegt ist
//
// Kartentext Smugbeth: „While this Creature has "Lizbeth, the Reaper of the Light" attached to it, it gains 250 HP and this effect: You may use
//   the active effects of your opponent's Heroes' Abilities as if they were attached to the corresponding Hero."
// Konvention (B-querschnitt.md B-01…B-03 / `engine.isCreatureEffectSuppressed`): eine stillgelegte Kreatur verliert ihre Dauereffekte.
//   Der Engine-Weg `_heroHasSmugbethBoost` (_engine.js ~42964) prüft selbst `negated/nulled/frozen/stunned` und beachtet damit schon die
//   Status-Stilllegungen – nicht aber die Clown-Aura (abgeleitete Negation) und `magic_silenced`, die `isCreatureEffectSuppressed` ebenfalls kennt.
// Erwartung: Ist Smugbeth stillgelegt (`isCreatureEffectSuppressed === true`), liefert `_getAbilityBorrowerForOppSlot` für den Träger null.
// Beobachtet: negiert/gefroren/betäubt ⇒ null ✓; Clown-Aura und `magic_silenced` ⇒ der Träger leiht die gegnerische Ability weiter.
// Vermutete Ursache: `_engine.js _heroHasSmugbethBoost` fragt vier Zähler einzeln ab statt `isCreatureEffectSuppressed(inst)`.
const H = require('../../lib/h.js');

async function szene(how) {
  const t = await H.fresh({ hand: [['Lizbeth, the Reaper of the Light'], []], deckSize: 10, abilities: { 1: { 0: [['Wealth'], [], []] } } });
  const sb = t.put(0, 0, 0, 'Smugbeth, the Rebel of no Rules'); sb.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);                                    // Lizbeth unter Smugbeth legen (+250 HP)
  if (how === 'negiert') await t.engine.actionNegateCreature(sb, 'Test');
  else if (how === 'eingefroren') await t.engine.applyCreatureStatus(sb, 'frozen', { sourceOwner: 1 });
  else if (how === 'betäubt') await t.engine.applyCreatureStatus(sb, 'stunned', { sourceOwner: 1 });
  else if (how === 'Clown-Aura') t.put(1, 0, 1, 'The Creepy Clown of Heaven');
  else if (how === 'magic_silenced') sb.counters.magic_silenced = 1;
  t.gs.activePlayer = 0;
  return { t, sb };
}

(async () => {
  const R = H.runner();
  for (const how of ['keine', 'negiert', 'eingefroren', 'betäubt', 'Clown-Aura', 'magic_silenced']) {
    const { t, sb } = await szene(how);
    const leiht = t.engine._getAbilityBorrowerForOppSlot(0, 1, 0, 0);   // Sitz 0 aktiviert Zone 0 von Held 0 des Gegners (Wealth)
    const stillgelegt = t.engine.isCreatureEffectSuppressed(sb);
    if (how === 'keine') R.check('Kontrolle: arbeitender Smugbeth ⇒ Leihe möglich', !!leiht && !stillgelegt, { leiht, stillgelegt });
    else R.check(`Smugbeth ${how} (stillgelegt=${stillgelegt}) ⇒ keine Leihe`, stillgelegt && !leiht, { leiht, stillgelegt });
  }
  R.finish();
})();
