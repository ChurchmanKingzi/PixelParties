'use strict';
// M01-19 · Ferocious Tiger Kick (2. Attack): Heilung zählt den Überhang (Overkill) mit
// Kartentext: „If this is the second Attack you used this turn, the user is healed for any damage this Attack dealt."
// Engine-Konvention (_engine.js ~8987-8992 / ~9036-9043): „Real dealt: HP-drop, capped at the target's pre-hit HP so overkill doesn't count … the true HP loss"
// Aufbau: Sitz 0 Held 0 mit 400/800 HP, Tiger Kick als 2. Attack (attacksPlayedThisTurn = 1); Ziel (a) gegnerischer Held mit 10 HP, (b) Kreatur mit 10 HP (ZZ Dummy Frail).
// Erwartet: geheilt wird der tatsächliche HP-Verlust (10), nicht der Angriffswert (40).
// Beobachtet: beide Male +40 (Rückgabe von actionDealDamage/-CreatureDamage `dealt` = actualAmount, nicht auf Vor-Treffer-HP gedeckelt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [label, onCreature] of [['Held mit 10 HP', false], ['Kreatur mit 10 HP', true]]) {
    const t = await H.fresh({ hand: [['Ferocious Tiger Kick'], []], hp: 800 });
    t.grantFor(0, 0, 'Ferocious Tiger Kick');
    t.hero(0, 0).hp = 400;
    if (onCreature) { t.put(1, 0, 0, H.INERT.frail); t.targetFn = (valid) => [valid.find(v => v.type === 'equip').id]; }
    else { t.hero(1, 0).hp = 10; t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; }
    t.gs.players[0].attacksPlayedThisTurn = 1;
    const r = await t.play(0, 'Ferocious Tiger Kick', { hero: 0, keepActions: true });
    R.check(label + ': gespielt', r === true, r);
    R.check(label + ': Heilung = tatsächlicher HP-Verlust (10), nicht 40', t.hp(0, 0) === 410, 'Held 0 HP ' + t.hp(0, 0));
    R.check(label + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
