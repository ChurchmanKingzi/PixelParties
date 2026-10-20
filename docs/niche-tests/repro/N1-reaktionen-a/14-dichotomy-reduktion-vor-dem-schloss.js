'use strict';
// N1-14 · Dichotomy of Luna and Tempeste: „damage they take cannot be reduced further" – eine Vor-Schaden-Surprise (Aquatic Shield, −100) reduziert den Treffer trotzdem
// Kartentext Dichotomy: „While this card is attached to a Hero you control, Burned targets you control take half damage from all sources, except their Burn damage (rounded up), but damage they take cannot be reduced further."
// Kartentext Aquatic Shield: „Activate this Surprise when the user takes any damage. Reduce that damage by 100."
// Skript: Dichotomy halbiert und sperrt im `beforeDamage`-Hook (`ctx.multiplyAmount(0.5); ctx.lockReduction()`). Aquatic Shield wirkt im Vor-Schaden-FENSTER (`damageReduced: 100`), das VOR den
//   `beforeDamage`-Hooks läuft; die Sperre existiert dann noch nicht („Echter Schaden läuft an diesem Fenster vorbei" greift nur bei bereits gesetztem `cannotBeReduced`).
// Aufbau: Held 1:0 ist Burned, Dichotomy liegt an Held 1:1 (Sitz 1), Aquatic Shield (Magic Arts 2 + Support Magic 2) verdeckt an Held 1:0. Sitz 0 trifft Held 1:0 mit 200 Schaden (Typ attack).
// Gegenprobe: ohne Aquatic Shield 200 → 100, auch mit Stoneskin (−80 gegen Attacks) bleibt es bei 100 – dessen Reduktion läuft nach der Halbierung und wird gesperrt.
// Erwartet (Lesart A: nach Dichotomy keine Reduktion mehr): 100 Schaden – die Surprise reduziert nicht. Lesart B (Reihenfolge der Fenster): (200 − 100) / 2 = 50.
// Beobachtet (vor W25a): 50 (die Surprise reduzierte VOR der Halbierung, die Sperre kam zu spät).
// ENTSCHIEDEN (Al, 21.10.2026, W25a: „ja, soll verhindert werden!"): Lesart A – die Surprise löst aus, ihre Reduktion zählt nicht (`_surpriseReduktionGesperrt`, Vertrag `sperrtSurpriseReduktion`); Exit 0 = 100.
const H = require('../../lib/h.js');
const SRC = { name: 'ZZ', owner: 0, controller: 0, heroIdx: 0, counters: {} };
const lauf = async (aufbau) => {
  const t = await H.fresh({ hand: [[], []] });
  t.put(1, 1, 0, 'Dichotomy of Luna and Tempeste');
  await t.run(() => t.engine.addHeroStatus(1, 0, 'burned', { appliedBy: 0 }));
  await aufbau(t);
  const b = t.hp(1, 0);
  await t.run(() => t.engine.actionDealDamage(SRC, t.hero(1, 0), 200, 'attack'));
  return { t, schaden: b - t.hp(1, 0) };
};
(async () => {
  const R = H.runner();
  { const { t, schaden } = await lauf(async () => {});
    R.check('Gegenprobe: Burned + Dichotomy: 200 → 100', schaden === 100, schaden); }
  { const { t, schaden } = await lauf(async (t) => { t.put(1, 2, 0, 'Stoneskin'); });
    R.check('Gegenprobe: zusätzlich Stoneskin (−80 gegen Attacks) wird gesperrt: 100', schaden === 100, schaden); }
  { const { t, schaden } = await lauf(async (t) => { t.putSurprise(1, 0, 'Aquatic Shield'); t.grantFor(1, 0, 'Aquatic Shield'); });
    R.check('Aquatic Shield wurde ausgelöst', t.prompts.some(p => p.pi === 1 && p.d.title === 'Aquatic Shield'), t.prompts.map(p => p.d.title));
    R.check('Aquatic Shield: Schaden bleibt bei 100 („cannot be reduced further")', schaden === 100, schaden);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
