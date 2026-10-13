// A08-15 · Deep-Drowned Waflav: der Überladungs-Schlag („100 damage to a target that many times") bezahlt Zähler, verletzt eine gewählte KREATUR aber nicht
//
// Kartentext: „You may once per turn remove up to 3 Evolution Counters from this Hero to deal 100 damage to a target that many times."
// `collectBoardTargets` (_waflav-shared.js) bietet Helden UND Kreaturen als Ziel an.
//
// Erwartung: Wählt der Spieler eine Kreatur (hier „ZZ Dummy Frail", 10 HP), stirbt sie beim ersten Treffer; die Zähler sind bezahlt.
// Beobachtet: Die Zähler werden abgebucht und der Once-per-turn gestempelt, die Kreatur bleibt unversehrt auf dem Brett.
//   `deep-drowned-waflav.js` ~Z. 105: `engine.actionDealDamage(source, inst, SURGE_DAMAGE, 'hero')` mit einer Kreatur-Instanz – `actionDealDamage` ist der HELDEN-Schadenspfad
//   (liefert { dealt: 100 }, ändert aber nichts); Kreaturen brauchen `actionDealCreatureDamage`.
// Aufruf: node docs/niche-tests/repro/A08-pacman/15-deepdrowned-surge-trifft-keine-kreatur.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler, FR = H.INERT.frail, D = H.INERT.creature;
  const WAF = 'Waflav, the Metamorphing Monstrosity';
  for (const name of [FR, D]) {
    const t = await H.fresh({
      heroes: [[WAF, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null],
      gold: [100, 100], hand: [[], []], deck: [Array(30).fill(F), Array(30).fill(F)],
    });
    const c = t.put(1, 0, 0, name); c.turnPlayed = 1;
    // Held 0 direkt als Deep-Drowned aufstellen (Aufstieg ist nicht Gegenstand)
    t.hero(0, 0).name = 'Deep-Drowned Waflav'; t.hero(0, 0)._evolutionCounters = 3;
    for (const inst of t.engine.cardInstances) if (inst.zone === 'hero' && inst.owner === 0 && inst.heroIdx === 0) { inst.name = 'Deep-Drowned Waflav'; inst.script = null; }
    t.script.push({ match: d => d.type === 'optionPicker' && /Which effect/.test(d.description || ''), answer: () => ({ optionId: 'surge' }) });
    t.script.push({ match: d => d.type === 'optionPicker' && /Remove how many/.test(d.description || ''), answer: () => ({ optionId: '3' }) });
    t.targetFn = (valid) => [valid.find(v => v.cardName === name).id];
    await t.activateHero(0, 0, {});
    const evo = t.hero(0, 0)._evolutionCounters || 0;
    R.check(`${name}: Zähler wurden bezahlt (3 → 0)`, evo === 0, { evo });
    const lebt = t.inst(x => x.id === c.id && x.zone === 'support').length > 0;
    const hp = c.counters.currentHp;
    R.check(`${name}: Kreatur ist besiegt (3 × 100 Schaden gegen ${name === FR ? 10 : 200} HP)`, !lebt, { lebt, currentHp: hp, ablage1: t.pile(1, 'discardPile') });
    R.check(`${name}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
