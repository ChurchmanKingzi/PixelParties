// S02-17 · Einzelzielwahl (promptDamageTarget/promptMultiTarget): zwei gegenseitig gestohlene Kreaturen an derselben (Held, Slot)-Stelle
//          werden beide zur SELBEN Instanz aufgelöst – die vom Wirker kontrollierte Kreatur ist nicht wählbar.
// Karten: Magic Hammer („Choose a target and deal 300 damage to it."), Heal („Choose a target and heal it for 150/200/300 HP.")
// Aufbau: Sitz 0 besitzt X (Held 0, Slot 0), Sitz 1 besitzt Y (Held 0, Slot 0); X wird von Sitz 1, Y von Sitz 0 gestohlen
//         (beide bleiben physisch in der Zone ihres Besitzers, also auf derselben Koordinate in je EINER Spalte).
// Erwartet: Die Zielliste enthält zwei verschiedene Kreaturen (X und Y); die Wahl der Kachel „Gegnerspalte H0/S0" (dort liegt Y) trifft Y.
// Beobachtet: Beide Listeneinträge (equip-1-0-0 und equip-0-0-0) tragen `cardInstance` X; Y kommt nie vor. Hammer: X −300, Y unversehrt;
//             Heal: X (vom Gegner kontrolliert) +150, die eigene Kreatur Y bleibt ungeheilt.
// Ursache (vermutet): `_engine.js` promptDamageTarget ~4917 / promptMultiTarget ~5507: `cardInstances.find(c => (c.owner === p || c.controller === p) && …heroIdx/zoneSlot)` – erster Treffer für beide Spalten (Muster wie F02-14 getCreatureTargets).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const card of ['Magic Hammer', 'Heal']) {
    const t = await H.fresh({ hand: [[card], []] });
    const mk = (seat) => { const c = t.put(seat, 0, 0, H.INERT.big); c.counters.currentHp = 500; c.counters.maxHp = 1000; return c; };
    const X = mk(0), Y = mk(1);
    await t.engine.actionStealCreature(1, X);   // X: Besitzer 0, Kontrolle 1
    await new Promise(r => setTimeout(r, 250));   // Steal-Kette (Reaktionsfenster) läuft kurz nach; sie sperrt Handkarten (_chainResolvingLock)
    await t.engine.actionStealCreature(0, Y);   // Y: Besitzer 1, Kontrolle 0
    await new Promise(r => setTimeout(r, 250));   // Steal-Kette (Reaktionsfenster) läuft kurz nach; sie sperrt Handkarten (_chainResolvingLock)
    let liste = [];
    t.targetFn = (valid) => {
      liste = valid.filter(v => v.type === 'equip').map(v => v.id + '->' + (v.cardInstance === X ? 'X' : v.cardInstance === Y ? 'Y' : '?'));
      return [valid.find(v => v.id === 'equip-1-0-0').id];   // Kachel der Gegnerspalte H0/S0 = dort liegt physisch Y
    };
    await t.play(0, card, { hero: 0 });
    R.note(card, `Liste ${liste.join(' ')} · X ${X.counters.currentHp} · Y ${Y.counters.currentHp}`);
    const hit = card === 'Heal' ? (c) => c.counters.currentHp > 500 : (c) => c.counters.currentHp < 500;
    R.check(`${card}: Liste enthält Y als eigenes Ziel`, liste.some(s => s.endsWith('->Y')), liste);
    R.check(`${card}: Wahl der Kachel mit Y trifft Y (nicht X)`, hit(Y) && !hit(X), { X: X.counters.currentHp, Y: Y.counters.currentHp });
  }
  R.finish();
})();
