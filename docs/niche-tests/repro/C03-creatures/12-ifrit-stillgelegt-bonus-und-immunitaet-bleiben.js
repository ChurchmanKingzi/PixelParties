'use strict';
// C03-creatures-12 · Ifrit: gefroren/betäubt/negiert gibt er Armageddon weiter +100 Schaden und bleibt unverwundbar (Klasse B-01…B-03: Dauereffekte trotz Stilllegung)
// Kartentext: „This Creature cannot be summoned from anywhere, except your hand. The damage of all "Armageddon" Spells any player activates is increased by 100.
//   This Creature is unaffected by "Armageddon"."
// Konvention (B-querschnitt, `isCreatureEffectSuppressed`): gefrorene, betäubte, negierte Kreaturen verlieren ihre Effekte.
// Aufbau: Sitz 1: Ifrit (Held 0 / Slot 0, nicht frisch) + ZZ Dummy Big; Zustand des Ifrit: gesund (Gegenprobe) / negiert / gefroren / betäubt.
//   Sitz 0 wirkt Armageddon (echter Spielweg).
// Erwartung: Gesund: 150 Schaden auf Helden, Ifrit unverwundbar (80 HP). Stillgelegt: nur 50 Schaden, Ifrit nimmt 50 (80 → 30).
// Beobachtet: In allen drei Stilllegungs-Zuständen 150 Schaden und Ifrit unverwundbar (80 HP).
// Ursache: `_apocalypse-shared.js` `ifritsOf()` (Aufschlag, gelesen in `armageddon.js` `schaden()`) und `_engine.js` ~46122/46140 (`immuneToSourceNames`) fragen
//   `isCreatureEffectSuppressed` nicht ab.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const st of ['none', 'negated', 'frozen', 'stunned']) {
    R.section(`Ifrit ${st}`);
    const t = await H.fresh({ hand: [['Armageddon'], []] });
    const i = t.put(1, 0, 0, 'Ifrit'); i.turnPlayed = 1;
    t.put(1, 1, 0, H.INERT.big);
    if (st === 'negated') await t.run(() => t.engine.actionNegateCreature(i, 'Test'));
    else if (st !== 'none') await t.run(() => t.engine.applyCreatureStatus(i, st, { sourceOwner: 0 }));
    await t.play(0, 'Armageddon', { hero: 0 });
    const dmg = 800 - t.hp(1, 0);
    const ifritHp = i.counters.currentHp ?? 80;
    if (st === 'none') {
      R.check('gesund: 150 Schaden (50 + 100)', dmg === 150, dmg);
      R.check('gesund: Ifrit unverwundbar', ifritHp === 80, ifritHp);
    } else {
      R.check(`${st}: nur 50 Schaden (kein Aufschlag)`, dmg === 50, dmg);
      R.check(`${st}: Ifrit nimmt 50 Schaden (80 → 30)`, ifritHp === 30, ifritHp);
    }
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
