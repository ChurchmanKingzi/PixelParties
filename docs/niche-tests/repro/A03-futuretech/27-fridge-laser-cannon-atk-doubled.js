'use strict';
// A03-futuretech-27 · Slippery Fridge verschiebt eine Future Tech Laser Cannon: der alte Held behält +100 ATK, der neue bekommt zusätzlich +100
//
// Kartentexte: Laser Cannon „Equip this card to a Hero you control. That Hero's Attack stat is increased by 100.“
//              Slippery Fridge „Choose any number of Artifacts equipped to a Hero and equip them to a different Hero the same player controls.“
// Erwartung: nach dem Umhängen hat Held 0 wieder seinen Basis-ATK (40), Held 1 +100 (180); die Summe aller Helden steigt nicht um 100 zu viel.
// Beobachtet: Held 0 bleibt bei 140, Held 1 bekommt 180 (80+100): der Bonus gilt jetzt zweimal. Zerstört man die Kanone danach, wird nur 1 × 100 zurückgenommen – Held 0 behält dauerhaft +100.
// Ursache: slippery-fridge.js:360 ruft `onCardLeaveZone` ohne `leavingCard`; future-tech-laser-cannon.js `hooks.onCardLeaveZone` prüft `ctx.leavingCard?.id !== inst.id` und kehrt sofort zurück
//   (revoke entfällt). Danach setzt die Fridge (Z. 375) `atkGranted = 0`, und das erneute `onPlay` gewährt am neuen Helden nochmals +100. Future Tech Gun rechnet neu und ist nicht betroffen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SF = 'Slippery Fridge', LC = 'Future Tech Laser Cannon';
  const t = await H.fresh({ hand: [[LC, SF], []], gold: 200 });
  await t.play(0, LC, { hero: 0, slot: 0 });
  const base0 = t.hero(0, 0).atk - 100, base1 = t.hero(0, 1).atk;
  R.check('Aufbau: Held 0 hat +100', t.hero(0, 0).atk === base0 + 100, t.hero(0, 0).atk);
  t.targetFn = (valid, cfg) => {
    const ti = (cfg && cfg.title) || '';
    if (ti === SF) { const v = valid.find(v => v.cardName === LC); return v ? [v.id] : undefined; }
    if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(v => v.type === 'hero' && v.heroIdx === 1); return v ? [v.id] : undefined; }
    return undefined;
  };
  await t.play(0, SF);
  R.check('Aufbau: Kanone liegt bei Held 1', [0, 1, 2].some(s => t.zone(0, 1, s) === LC), [0, 1, 2].map(s => t.zone(0, 1, s)));
  R.check('Held 1 hat +100', t.hero(0, 1).atk === base1 + 100, t.hero(0, 1).atk);
  R.check('Held 0 hat wieder den Basis-ATK', t.hero(0, 0).atk === base0, { atk0: t.hero(0, 0).atk, base0 });
  const inst = t.inst(c => c.name === LC && c.zone === 'support')[0];
  await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: 1 }, inst));
  R.check('nach Zerstörung: beide Helden auf Basis', t.hero(0, 0).atk === base0 && t.hero(0, 1).atk === base1, [t.hero(0, 0).atk, t.hero(0, 1).atk]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
