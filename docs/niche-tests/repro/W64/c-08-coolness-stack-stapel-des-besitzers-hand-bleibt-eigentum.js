'use strict';
// W64c-08 · Coolness Stack (Wowhalla): eine gestohlene Handkarte, die der Dieb auf SEINEN Coolness Stack legt, bleibt Eigentum ihres Besitzers (Al, 23.10.2026):
//   · verlässt sie den Stack per ABLAGE oder LÖSCHEN (auch „Stack komplett löschen") → Ablage/Löschstapel des permanenten BESITZERS;
//   · kommt sie vom Stack zurück auf die HAND (Hand des Stack-Halters), trägt sie weiter die Herkunft → Abwerfen/Löschen/Mischen danach → Stapel des Besitzers.
// Gegenprobe: eine EIGENE Karte desselben Namens geht in den Stapel des Halters. Beide Sitze. Besitzer-Wächter läuft mit. Exit 0 = korrekt.
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();
  const decks = [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')];
  const KARTE = 'Fireball';
  const szene = async (halter, eigene) => {
    const besitzer = 1 - halter;
    const hand = [[], []]; hand[halter] = eigene ? [KARTE] : []; hand[besitzer] = eigene ? [] : [KARTE];
    const t = await H.fresh({ hand, deck: decks, gold: [100, 100] });
    const w = B.waechter(t); t.halter = halter; t.besitzer = besitzer;
    t.gs.players[halter].coolnessStack = ['ZZ Filler'];            // Stack besteht (die Karte darunter ist eine Platzhalterkarte des Halters)
    t.engine.gs.players[halter].coolnessStack = ['ZZ Filler'];
    if (!eigene) {
      const r = await t.run(() => t.engine.actionStealFromHand(halter, { sourceName: 'Test', preselectedIndices: [t.pile(besitzer, 'hand').indexOf(KARTE)] }));
      R.check(`Fireball gestohlen (Halter ${halter})`, r && r.stolen && r.stolen[0] === KARTE, r);
    }
    const ok = await t.run(() => t.engine.actionPushHandCardToCoolnessStack(halter, KARTE, t.pile(halter, 'hand').indexOf(KARTE), { source: 'Test' }));
    R.check(`Fireball auf den Coolness Stack von Sitz ${halter} gelegt`, ok === true && t.gs.players[halter].coolnessStack.includes(KARTE), { ok, stack: t.gs.players[halter].coolnessStack });
    return { t, w };
  };
  for (const halter of [0, 1]) {
    for (const eigene of [false, true]) {
      const stapelErwartet = (eigene ? halter : 1 - halter);
      R.section(`══ Halter = Sitz ${halter}, ${eigene ? 'EIGENE Karte (Gegenprobe)' : 'gestohlene Karte'} → Stapel von Sitz ${stapelErwartet} ══`);
      for (const [name, dest, stapel] of [['Stack → Ablage', 'discard', 'discardPile'], ['Stack → Löschstapel', 'delete', 'deletedPile']]) {
        const { t, w } = await szene(halter, eigene);
        await t.run(() => t.engine.actionPopCoolnessStackTo(halter, dest, { source: 'Test' }));
        B.erwarteStapel(R, t, `${name} (Halter ${halter})`, KARTE, stapelErwartet, stapel);
        R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
      }
      {
        const { t, w } = await szene(halter, eigene);
        await t.run(() => t.engine.actionDeleteCoolnessStack(halter, { source: 'Test' }));
        R.check(`Stack komplett löschen (Halter ${halter}): ${KARTE} im Löschstapel von Sitz ${stapelErwartet}`, B.anzahl(t, stapelErwartet, 'deletedPile', KARTE) === 1 && B.anzahl(t, 1 - stapelErwartet, 'deletedPile', KARTE) === 0, B.ort(t, KARTE));
        R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
      }
      {   // Stack → Hand, dann abgeworfen: Stapel des Besitzers
        const { t, w } = await szene(halter, eigene);
        await t.run(() => t.engine.actionPopCoolnessStackTo(halter, 'hand', { source: 'Test' }));
        R.check(`Stack → Hand (Halter ${halter}): Fireball liegt in der Hand des Halters`, B.anzahl(t, halter, 'hand', KARTE) === 1, B.ort(t, KARTE));
        await t.run(() => t.engine.actionDiscardHandCard(halter, KARTE, t.pile(halter, 'hand').indexOf(KARTE), {}));
        B.erwarteStapel(R, t, `Stack → Hand → Abwerfen (Halter ${halter})`, KARTE, stapelErwartet, 'discardPile');
        R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
      }
    }
  }
  R.finish();
})();
