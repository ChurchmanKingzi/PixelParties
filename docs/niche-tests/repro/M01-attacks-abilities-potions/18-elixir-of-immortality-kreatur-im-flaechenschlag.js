'use strict';
// M01-18 · Elixir of Immortality sammelt Kreaturen, die in einem Mehrfachtreffer-Schlag (Fireball) sterben, nie ein – die Kreatur bleibt tot, das Elixir bleibt liegen
// Kartentext: „The next time a target you control is defeated, delete this card and revive and heal that target's HP for half their maximum instead (rounded up)."
// Aufbau: Seed 1234, Zug 5; Sitz 0 spielt Elixir of Immortality (Permanent) und hat eine Kreatur (10 HP); Sitz 1 tötet sie mit (a) Burning Finger (Einzeltreffer), (b) Attack, (c) Fireball (Mehrfachtreffer-Weg `dealDamageToTargets`).
// Erwartet: in allen drei Fällen steht die Kreatur danach wieder auf dem Brett (halbe Max-HP) und das Elixir ist gelöscht.
// Beobachtet: (a) und (b) ✓; bei (c) bleibt die Kreatur in der Ablage, das Elixir liegt weiter als Permanent, auch nach Zugwechseln.
// Ursache: Seit „Erst aller Schaden, dann alle Tode" (`_engine.js` `_kreaturTodMelden`, ~Z. 47083) wird der Tod innerhalb einer Flächenklammer erst beim Schließen der Klammer abgewickelt; der Hook
// `afterCreatureDamageBatch` läuft davor, die tote Kreatur liegt dann noch im Support (hp < 0) und noch nicht in der Ablage. `elixir-of-immortality.js` ~Z. 188-232 sammelt aber nur Kreaturen, die schon
// in `discardPile`/`deletedPile` stehen (`pile = null` ⇒ nichts vorgemerkt) und löst später nicht mehr aus (Debug: `discAtHook` = [] beim Fireball, ["ZZ Dummy Frail"] beim Burning Finger).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const card of ['Burning Finger', 'Attack', 'Fireball']) {
    const t = await H.fresh({ hand: [['Elixir of Immortality'], [card]], hp: 800 });
    await t.play(0, 'Elixir of Immortality');
    t.put(0, 0, 0, H.INERT.frail);
    t.gs.activePlayer = 1;
    t.targetFn = (valid) => { const x = valid.find(v => v.type === 'equip' && v.owner === 0); return x ? [x.id] : [valid[0].id]; };
    await t.play(1, card, { hero: 0 });
    await t.endTurn();
    const live = t.engine.cardInstances.filter(i => i.zone === 'support' && i.owner === 0 && i.name === H.INERT.frail);
    const perm = t.gs.players[0].permanents.map(p => p.name);
    R.note(`${card}: Kreaturen auf dem Brett=${live.length}, Permanents=${JSON.stringify(perm)}, Ablage Sitz 0=${JSON.stringify(t.pile(0, 'discardPile'))}`);
    R.check(`${card}: die getötete Kreatur wird vom Elixir wiederbelebt`, live.length === 1, live.length);
    R.check(`${card}: das Elixir ist danach verbraucht`, perm.length === 0, perm);
    R.check(`${card}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
