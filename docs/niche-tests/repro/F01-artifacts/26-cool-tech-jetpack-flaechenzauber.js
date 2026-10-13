'use strict';
// F01-artifacts-26 · Cool Tech Jetpack wird gegen einen Flächenzauber angeboten und negiert ihn für ALLE Ziele
// Kartentext: „The first time every turn when the equipped Hero is **chosen** by a card or effect, you may discard 1 card to negate that card or effect."
// Ruling CARD_API.md Z. 16680: „Ein Flächenschlag WÄHLT niemanden: „is chosen by / targeted by"-Surprises … öffnen dabei nie." (Anti-Magnetic Armor „is chosen by an opponent's card or effect" hält sich daran – Gegenprobe.)
// Aufbau: Sitz 0 trägt das Jetpack (bzw. die Anti-Magnetic Armor) an Held 0, hat eine Kreatur und 2 Handkarten; Sitz 1 wirkt Flame Avalanche („Deal 150 damage to all targets your opponent controls").
// Erwartung: Kein Angebot (nichts wird gewählt); alle Ziele nehmen 150.
// Beobachtet: Das Jetpack wird angeboten; nach dem Abwurf ist der GANZE Flächenzauber negiert (Held 0 und die übrigen Ziele 0 Schaden).
// Ursache: `cool-tech-jetpack.js` `postTargetCondition` (Z. 36–45) prüft nur, ob der Träger unter `targetedHeroes` steht; die Engine (`_engine.js` Z. ~36130 ff., Ausrüstungs-Reaktionen) reicht auch bei Flächenquellen die Trefferliste als „targeted" durch,
//   und `sourceCard._isAoeCheck` wird dort nicht ausgewertet (anders als bei Surprises, Z. 35090).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const equip of ["Anti-Magnetic Armor", 'Cool Tech Jetpack']) {
    const t = await H.fresh({ hand: [['ZZ Filler', 'ZZ Filler'], ['Flame Avalanche']], gold: [100, 100] });
    t.put(0, 0, 0, equip);
    const k = t.put(0, 1, 0, H.INERT.creature);
    t.policy.confirm = true;
    const hp = [0, 1, 2].map(i => t.hp(0, i));
    await t.play(1, 'Flame Avalanche', { hero: 0 });
    const schaden = [0, 1, 2].map(i => hp[i] - t.hp(0, i));
    const angebot = t.prompts.some(p => p.d.type === 'confirm' && p.pi === 0);
    R.check(equip + ': kein Angebot bei Flächenzauber, alle Helden nehmen 150', !angebot && schaden.every(d => d === 150), { angebot, schaden });
    R.check(equip + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
