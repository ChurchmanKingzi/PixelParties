'use strict';
// W64c-06 · Unterkarten: ein unter eine Kreatur gelegter Held (Goff + Gon, Dream Lander & Co., `actionAttachHeroToCreature`) kommt beim Abgang der Träger-Kreatur in die Ablage
// des BESITZERS DER HELDEN-KARTE (Al, 23.10.2026: Karten gehen IMMER in die Stapel ihres permanenten Besitzers) — nicht pauschal des Besitzers der Träger-Kreatur.
//   a) Sitz X kontrolliert eine übernommene Kreatur (Besitzer Y) und legt seinen EIGENEN Helden darunter: stirbt sie, geht der Held in die Ablage von X.
//   b) die Heldenkarte war eine GESTOHLENE Handkarte (Besitzer Y): sie geht in die Ablage von Y.
//   c) Gegenprobe: eigene Kreatur + eigener Held → eigene Ablage.
// Wege des Abgangs: Schaden-Tod, Zerstörung, auf die Hand zurück (Held folgt in die Ablage des Heldenbesitzers). Beide Sitze. Exit 0 = korrekt.
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();
  const TRAEGER = 'Goff, the Burnbringer', HELD = 'Gon, the Frostbringer';
  const decks = [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')];
  const exits = [
    ['stirbt durch Schaden', (t, inst) => t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0 }, inst, 99999, 'fire'))],
    ['wird zerstört', (t, inst) => t.run(() => t.engine.actionDestroyCard(null, inst, {}))],
  ];
  for (const x of [0, 1]) for (const [exName, ex] of exits) {
    const y = 1 - x;
    for (const variante of ['a-eigener-held-auf-uebernommener-kreatur', 'b-gestohlene-heldenkarte', 'c-gegenprobe-alles-eigen']) {
      const hand = [[], []]; hand[x] = [HELD];
      const t = await H.fresh({ gold: [100, 100], hand, deck: decks });
      const w = B.waechter(t);
      let inst;
      if (variante.startsWith('a')) { inst = t.put(y, 0, 0, TRAEGER); inst.turnPlayed = 1; await t.run(() => t.engine.actionTransferCreature(inst, x, 0, 0, {})); }
      else if (variante.startsWith('b')) {
        inst = t.put(x, 0, 0, TRAEGER); inst.turnPlayed = 1;
        // die Heldenkarte gehört Y und liegt in X' Hand (Diebstahl)
        t.setHand(x, []); t.addHand(y, HELD);
        await t.run(() => t.engine.actionStealFromHand(x, { sourceName: 'Test', preselectedIndices: [t.pile(y, 'hand').indexOf(HELD)] }));
      } else { inst = t.put(x, 0, 0, TRAEGER); inst.turnPlayed = 1; }
      const ok = await t.run(() => t.engine.actionAttachHeroToCreature(x, HELD, inst, {}));
      R.check(`${variante} (X=${x}, ${exName}): Held angelegt`, ok === true && inst.counters.attachedHero === HELD, { ok, c: inst.counters.attachedHero });
      await ex(t, inst);
      const erwartet = variante.startsWith('b') ? y : x;
      R.check(`${variante} (X=${x}, ${exName}): ${HELD} in der Ablage von Sitz ${erwartet}, nirgends sonst`, B.anzahl(t, erwartet, 'discardPile', HELD) === 1 && B.anzahl(t, 1 - erwartet, 'discardPile', HELD) === 0, B.ort(t, HELD));
      R.check(`${variante} (X=${x}, ${exName}): Besitzer-Wächter ohne Verstoß`, w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel + '@' + f.sitz));
    }
  }
  R.finish();
})();
