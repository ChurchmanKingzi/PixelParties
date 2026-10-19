'use strict';
// W18b-3 · Dark Ocean: ALLE Zauber-Schadenstypen '<school>_spell' (und 'attack') kommen bei Kreaturen durch, auch decay_spell (Forbidden Zone)
// Kartentext Dark Ocean: „… Creatures take no damage, except from Attacks and Spells."
// Ruling 5.8.: nur Attack und Zauber kommen durch; Status-/Artefakt-/Kreaturen-/„other"-Schaden bleibt geblockt, auch Gift-/Brand-Ticks.
// Al (19.10.2026): „Ja, decay_spell ist eine Form von Spell und sollte damit durchkommen."
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();

  R.section('Forbidden Zone (decay_spell) unter Dark Ocean');
  {
    const t = await H.fresh({ hand: [['Forbidden Zone'], []] });
    t.putArea(0, 'Dark Ocean');
    const c = t.put(1, 0, 0, H.INERT.creature);
    await t.play(0, 'Forbidden Zone', { hero: 0 });
    R.check('Forbidden Zone verletzt die Kreatur unter Dark Ocean (−50)', (c.counters.currentHp ?? 200) === 150, { hp: c.counters.currentHp, blockiert: t.lg('dark_ocean_damage_blocked') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('Typ-Tabelle (direkter Schaden auf eine Kreatur unter Dark Ocean)');
  {
    const t = await H.fresh({ hand: [[], []] });
    t.putArea(0, 'Dark Ocean');
    const quelle = { name: 'Test', owner: 0, heroIdx: 0 };
    const probe = async (typ, status) => {
      const c = t.put(1, 0, 0, H.INERT.big);
      c.counters.currentHp = 1000; c.counters.maxHp = 1000;
      await t.run(() => t.engine.actionDealCreatureDamage(quelle, c, 50, typ, status ? { isStatusDamage: true } : undefined));
      const hp = c.counters.currentHp ?? 1000;
      t.engine._untrackCard?.(c.id); t.gs.players[1].supportZones[0][0] = [];
      return hp;
    };
    for (const typ of ['attack', 'destruction_spell', 'decay_spell', 'magic_arts_spell', 'support_spell', 'summoning_spell', 'spell']) {
      R.check(`${typ} kommt durch (−50)`, (await probe(typ)) === 950, typ);
    }
    for (const typ of ['creature', 'artifact', 'status', 'other', 'poison', 'burn']) {
      R.check(`${typ} bleibt geblockt`, (await probe(typ)) === 1000, typ);
    }
    R.check('Zauber-Typ als Status-Tick (isStatusDamage) bleibt geblockt', (await probe('decay_spell', true)) === 1000);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
