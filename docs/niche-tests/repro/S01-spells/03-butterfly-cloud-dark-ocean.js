'use strict';
// S01-03 · Butterfly Cloud (Zauber) schadet Kreaturen unter Dark Ocean nicht
// Kartentext Dark Ocean: „… Creatures take no damage, except from Attacks and Spells."  Butterfly Cloud: „Deal 50 damage to all targets your opponent controls." (Spell, Magic Arts)
// Ruling in _engine.js ca. Z. 46286: „NUR `attack` und `destruction_spell` kommen durch – alles andere (creature, artifact, status, other) wird geblockt."
// Butterfly Cloud schlägt mit `damageType: 'other'` zu (butterfly-cloud.js:82) – obwohl es ein Zauber ist (CARD_API „Schadenstypen": 'destruction_spell' = „Schaden eines Zaubers").
// Aufbau: Dark Ocean liegt, Sitz 1 hat eine 200-HP-Kreatur. Vergleich: Boiling Oil (destruction_spell) trifft, Butterfly Cloud nicht.
// Erwartet: beide Zauber verletzen die Kreatur (Boiling Oil −80, Butterfly Cloud −50).
// Beobachtet: Butterfly Cloud: Kreatur unverletzt (Log `dark_ocean_damage_blocked`, damageType 'other').
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(zauber) {
    const t = await H.fresh({ hand: [[zauber], []] });
    t.putArea(0, 'Dark Ocean');
    const c = t.put(1, 0, 0, H.INERT.creature);
    await t.play(0, zauber, { hero: 0 });
    return { t, hp: c.counters.currentHp ?? 200 };
  }
  const oil = await lauf('Boiling Oil');
  R.check('Boiling Oil verletzt die Kreatur unter Dark Ocean (Kontrolle: −80)', oil.hp === 120, oil.hp);
  const bc = await lauf('Butterfly Cloud');
  R.check('Butterfly Cloud (ein Zauber) verletzt die Kreatur unter Dark Ocean (−50)', bc.hp === 150, { hp: bc.hp, log: bc.t.lg('dark_ocean_damage_blocked') });
  R.check('keine Engine-Fehler', bc.t.errors.length === 0 && oil.t.errors.length === 0);
  R.finish();
})();
