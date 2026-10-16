'use strict';
// W14b · Q156 (R02-18, Toxic Trap/Booby Trap „is hit by …") · Al, 16.10.2026: „Jeder Treffer zählt, auch reines Status-Zufügen wie Poisoned Well."
// Kartentexte: Toxic Trap/Booby Trap – „Activate this Surprise when the user is hit by an Attack, Spell or Creature effect. …"
// Erwartet: die reinen Status-Flächenzauber Poisoned Well, Iceage und Medusa's Curse öffnen das „hit by"-Fenster: Toxic Trap (Angreifer vergiftet) und Booby Trap (100 Schaden an
//   den Angreifer) lösen aus; „chosen by"-Surprises (Frost Rune) bleiben bei einem Flächenschlag zu; tötet Booby Trap den Angreifer, ist der Zauber negiert (kein Status).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const zauber = [
    { karte: 'Poisoned Well', schulen: [['Decay Magic', 'Decay Magic', 'Decay Magic'], ['Decay Magic'], []], status: (h) => h.statuses.poisoned },
    { karte: 'Iceage', schulen: [['Decay Magic', 'Decay Magic', 'Decay Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []], status: (h) => h.statuses.frozen },
    { karte: "Medusa's Curse", schulen: [['Decay Magic', 'Decay Magic', 'Decay Magic'], ['Decay Magic'], []], status: (h) => h.statuses.stunned },
  ];
  for (const z of zauber) {
    R.section(z.karte);
    // Toxic Trap
    {
      const t = await H.fresh({ hand: [[z.karte], []], hp: 800 });
      t.setAbilities(0, 0, z.schulen); t.setAbilities(1, 0, [['Decay Magic'], [], []]);
      t.putSurprise(1, 0, 'Toxic Trap'); t.policy.confirm = true;
      if (z.karte === "Medusa's Curse") t.script.push({ match: d => /Pollution|Medusa/.test(d.title || '') && d.type !== 'confirm', answer: (d) => t.engine._getCpuGenericResponse(d, 0) });
      await t.play(0, z.karte, { hero: 0, noGrant: true });
      R.check(`${z.karte}: der Zauber wirkte (Helden von Sitz 1 betroffen)`, z.status(t.hero(1, 0)) != null, Object.keys(t.hero(1, 0).statuses));
      R.check(`${z.karte}: Toxic Trap wird angeboten`, t.prompts.some(p => p.d.title === 'Toxic Trap'), t.prompts.map(p => p.d.title));
      R.check(`${z.karte}: Angreifer (Sitz 0, Held 0) vergiftet`, !!t.hero(0, 0).statuses.poisoned, Object.keys(t.hero(0, 0).statuses));
      R.check(`${z.karte}: keine Fehler / sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    // Booby Trap, Angreifer überlebt
    {
      const t = await H.fresh({ hand: [[z.karte], []], hp: 800 });
      t.setAbilities(0, 0, z.schulen); t.setAbilities(1, 0, [['Destruction Magic'], [], []]);
      t.putSurprise(1, 0, 'Booby Trap'); t.policy.confirm = true;
      if (z.karte === "Medusa's Curse") t.script.push({ match: d => /Pollution|Medusa/.test(d.title || '') && d.type !== 'confirm', answer: (d) => t.engine._getCpuGenericResponse(d, 0) });
      await t.play(0, z.karte, { hero: 0, noGrant: true });
      R.check(`${z.karte}: Booby Trap wird angeboten und schadet dem Angreifer (700 HP)`, t.prompts.some(p => p.d.title === 'Booby Trap') && t.hp(0, 0) === 700, { hp: t.hp(0, 0), pr: t.prompts.map(p => p.d.title) });
      R.check(`${z.karte}: der Zauber wirkt trotzdem (Booby Trap negiert nur bei Tod des Angreifers)`, z.status(t.hero(1, 1)) != null, Object.keys(t.hero(1, 1).statuses));
    }
    // Booby Trap tötet den Angreifer → Zauber negiert
    {
      const t = await H.fresh({ hand: [[z.karte], []], hp: 800 });
      t.hero(0, 0).hp = 100;
      t.setAbilities(0, 0, z.schulen); t.setAbilities(1, 0, [['Destruction Magic'], [], []]);
      t.putSurprise(1, 0, 'Booby Trap'); t.policy.confirm = true;
      if (z.karte === "Medusa's Curse") t.script.push({ match: d => /Pollution|Medusa/.test(d.title || '') && d.type !== 'confirm', answer: (d) => t.engine._getCpuGenericResponse(d, 0) });
      await t.play(0, z.karte, { hero: 0, noGrant: true });
      R.check(`${z.karte}: Booby Trap tötet den Angreifer → der Zauber ist negiert, kein Held von Sitz 1 hat den Status`, t.hero(0, 0).hp <= 0 && [0, 1, 2].every(i => z.status(t.hero(1, i)) == null), { hp0: t.hp(0, 0), st: [0, 1, 2].map(i => Object.keys(t.hero(1, i).statuses)) });
      R.check(`${z.karte}: keine Fehler`, t.errors.length === 0, t.errors);
    }
  }
  R.section('Gegenprobe: „chosen by"-Surprise (Frost Rune) bleibt bei einem Flächenzauber zu');
  {
    const t = await H.fresh({ hand: [['Poisoned Well'], []], hp: 800 });
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic', 'Decay Magic'], ['Decay Magic'], []]);
    t.setAbilities(1, 0, [['Destruction Magic'], [], []]);
    t.putSurprise(1, 0, 'Frost Rune'); t.policy.confirm = true;
    await t.play(0, 'Poisoned Well', { hero: 0, noGrant: true });
    R.check('Frost Rune wird nicht angeboten', !t.prompts.some(p => p.d.title === 'Frost Rune'), t.prompts.map(p => p.d.title));
    R.check('Poisoned Well wirkt normal', !!t.hero(1, 0).statuses.poisoned);
  }
  R.finish();
})();
