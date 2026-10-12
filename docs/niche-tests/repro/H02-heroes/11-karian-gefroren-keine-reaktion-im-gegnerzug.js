// H02-heroes-11 · Grand Inquisitor Karian – gefroren/betäubt im ZUG DES GEGNERS: Reaktions-Spell nicht spielbar (Stufe C, Regelfrage)
//
// Kartentext Karian: „While this Hero is Stunned or Frozen, you may perform a second Action with it during your Action Phase and it is **otherwise not affected** by those effects."
// Beobachtung: Das Skript hebt Frozen/Stunned nur in den eigenen Handlungsphasen auf (`grand-inquisitor-karian.js` `onPhaseStart` für MAIN1/ACTION/MAIN2 des Kontrolleurs).
//   Im Zug des Gegners bleibt Karian gefroren: Spectral Armor (Support Magic, Reaction) wird gegen einen Fireball nicht angeboten (Vergleich: Karian ohne Status spielt sie).
// Frage an Al: Soll eine gefrorene/betäubte Karian im Gegnerzug (und in Start/Resource/End) Reaktionen und Fähigkeiten nutzen können („otherwise not affected") – ja oder nein?
// Aufruf: node docs/niche-tests/repro/H02-heroes/11-karian-gefroren-keine-reaktion-im-gegnerzug.js   (✗ = Reaktion gesperrt)
const H = require('../../lib/h.js');
const KA = 'Grand Inquisitor Karian';
function pickHero(owner, hi) { return (valid) => [valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === hi).id]; }
(async () => {
  const R = H.runner();
  for (const status of [null, 'frozen', 'stunned']) {
    const t = await H.fresh({ heroes: [[KA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Spectral Armor'], ['Fireball']], active: 1 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setAbilities(0, 0, [['Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts'], []]);
    t.gs.currentPhase = 3; t.gs.activePlayer = 1;
    if (status) await t.run(() => t.engine.addHeroStatus(0, 0, status, { duration: 2, appliedBy: 1 }));
    t.policy.confirm = true;
    t.targetFn = pickHero(0, 0);
    const r = await t.play(1, 'Fireball', { hero: 0 });
    R.check(`Karian (${status || 'ohne Status'}): Spectral Armor gespielt (Fireball 150 → 75)`, r === true && t.hp(0, 0) === 725, { r, hp: t.hp(0, 0), hand: t.pile(0, 'hand') });
  }
  R.finish();
})();
