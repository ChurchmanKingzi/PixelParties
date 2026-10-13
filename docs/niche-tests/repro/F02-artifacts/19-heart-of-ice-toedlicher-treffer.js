'use strict';
// F02-19 · Heart of Ice: ein TÖDLICHER Treffer auf den Träger friert den Angreifer nicht ein
// Kartentext: „Equip this card to a Hero you control. The equipped Hero cannot be Frozen. Additionally, any Hero hitting the equipped Hero with an Attack and any Creature hitting it with its effect is Frozen for 1 turn."
// Aufbau: Sitz 1: Heart of Ice an Held 0 (Atta); Sitz 0 greift mit „Attack" (Tushu, 40 ATK) den Träger an. Fall a) Träger hat 800 HP (überlebt), Fall b) Träger hat 30 HP (stirbt).
// Erwartet (Lesart „hitting" = getroffen, auch tödlich): in beiden Fällen ist Tushu 1 Zug eingefroren.
// Beobachtet: a) Tushu gefroren ✓; b) Träger tot, Heart in der Ablage, Tushu NICHT gefroren.
// Vermutete Ursache: heart-of-ice.js `afterSpellResolved` → `traeger(engine, ctx.card)` verlangt `inst.zone === 'support'`; der Tod des Trägers legt das Heart vor dem Hook in die Ablage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [fall, hp, erwartetFrost] of [['a) Träger überlebt', 800, true], ['b) Träger stirbt am Treffer', 30, true]]) {
    const t = await H.fresh({ hand: [['Attack'], ['Heart of Ice']], gold: [100, 100] });
    await t.play(1, 'Heart of Ice', { hero: 0 });
    t.gs.activePlayer = 0;
    t.hero(1, 0).hp = hp;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Attack', { hero: 0 });
    const gefroren = !!t.hero(0, 0).statuses.frozen;
    R.check(`${fall}: Angriff ausgeführt`, r === true, r);
    R.check(`${fall}: Angreifer eingefroren`, gefroren === erwartetFrost, { gefroren, hpTraeger: t.hp(1, 0), ablage1: t.pile(1, 'discardPile') });
  }
  R.finish();
})();
