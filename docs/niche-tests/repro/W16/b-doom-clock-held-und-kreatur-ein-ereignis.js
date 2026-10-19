'use strict';
// W16b · A01-pollution-06 (Erweiterung) · Doom Clock: Helden UND Kreaturen eines Vorgangs sind EIN Ereignis
// Kartentext: „The first 4 times every turn 1 or more targets are defeated, their controller must place 1 Doom Counter onto this card."
// Auslegung (Konvention „targets" = Helden und Kreaturen, wie Strongman / Ritual Chamber; „je Ereignis EINE Auslösung" aus dem Skriptkopf):
//   (a) Ein Flächenschlag, der einen Helden UND eine Kreatur gleichzeitig besiegt (Armageddon: 50 an alle), legt nur EINEN Counter.
//   (b) Zwei einzeln besiegte Helden (zwei Fireballs) = zwei Ereignisse = zwei Counter.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();

  R.section('(a) Armageddon: Held + Kreatur in einem Vorgang');
  {
    const t = await H.fresh({ hand: [['Armageddon'], []], hp: 40 });
    const clock = t.putArea(0, 'Doom Clock');
    t.put(1, 0, 0, H.INERT.frail);                                   // 10 HP -> stirbt am Flächenschlag
    t.gs.players[1].heroes.forEach((h, i) => { if (i > 0) h.hp = 0; }); // nur Gegner-Held 0 lebt (40 HP -> stirbt)
    await t.play(0, 'Armageddon', { hero: 0 });
    R.check('Gegner-Held 0 und die Kreatur sind besiegt', t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check('Held + Kreatur im selben Vorgang = EIN Doom Counter', (clock.counters.doom || 0) === 1, clock.counters.doom || 0);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(b) zwei einzelne Heldenniederlagen = zwei Ereignisse');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball'], []], hp: 100 });
    const clock = t.putArea(0, 'Doom Clock');
    for (let k = 0; k < 2; k++) {
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === k).id];
      await t.play(0, 'Fireball', { hero: 0, keepActions: false });
    }
    R.check('beide Gegnerhelden besiegt', t.hp(1, 0) <= 0 && t.hp(1, 1) <= 0, [t.hp(1, 0), t.hp(1, 1)]);
    R.check('zwei Ereignisse = zwei Counter', (clock.counters.doom || 0) === 2, clock.counters.doom || 0);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
