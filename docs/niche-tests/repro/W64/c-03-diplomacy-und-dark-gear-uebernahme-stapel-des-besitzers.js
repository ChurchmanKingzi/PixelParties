'use strict';
// W64c-03 · Diplomacy und Dark Gear: dauerhaft übernommene Kreatur — alle Abgänge landen im Stapel bzw. in der Hand des BESITZERS (Al, 23.10.2026: Karten gehen IMMER in die Stapel ihres permanenten Besitzers)
//
// Beide Karten nutzen DIESELBE Primitive (`actionTransferCreature` + `actionNegateCreature` bis zum Zugende, `originalOwner` bleibt der alte Besitzer):
//   Diplomacy (Fähigkeit, Gold je Stufe statt Kartenkosten, freie Aktion) und Dark Gear (Artefakt, Kosten = Stufe × 5 Gold). Hier beide über ihren echten Spielweg.
// Danach (beide Sitze): Kreatur stirbt durch Schaden · wird zerstört · wird in den Löschstapel bewegt · geht per Rückgabe auf die Hand (Hand des KONTROLLEURS [Al 23.10.], Herkunft bleibt; von dort abgeworfen → Ablage des Besitzers)
// · wird per Mass Routing ins Deck der ursprünglichen Besitzer gemischt. Gegenprobe: eine EIGENE Kreatur desselben Namens geht in den Stapel des Kontrolleurs.
// Dazu läuft der generische Besitzer-Wächter (lib/besitzer.js `waechter`) mit: keine Karte in einem Stapel eines Nicht-Besitzers.
// Exit 0 = korrekt.
const B = require('../../lib/besitzer.js');
const { H } = B;
const { returnSupportCreatureToHand } = require('../../../../cards/effects/_deepsea-shared.js');
(async () => {
  const R = H.runner();
  const KARTE = 'ZZ Dummy';
  const frisch = async (weg, ktrl) => {
    const besitzer = 1 - ktrl;
    const hand = [[], []]; if (weg === 'dark-gear') hand[ktrl] = ['Dark Gear'];
    const opts = { gold: [100, 100], hand, deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')] };
    if (weg === 'diplomacy') opts.abilities = { [ktrl]: { 0: [['Diplomacy'], [], []] } };
    const t = await H.fresh(opts);
    const w = B.waechter(t);
    t.ktrl = ktrl; t.besitzer = besitzer;
    const inst = t.put(besitzer, 0, 0, KARTE); inst.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.owner === besitzer && v.cardName === KARTE).id];
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
    t.gs.activePlayer = ktrl;
    let ok;
    if (weg === 'diplomacy') { t.phase(2); ok = await t.run(() => t.host.doActivateFreeAbility(t.room, ktrl, { heroIdx: 0, zoneIdx: 0 })); }
    else { await t.play(ktrl, 'Dark Gear', { hero: 0 }); ok = true; }
    R.check(`${weg} (Kontrolleur ${ktrl}): Kreatur übernommen`, ok && inst.controller === ktrl && inst.originalOwner === besitzer, { ok, controller: inst.controller, orig: inst.originalOwner, owner: inst.owner });
    return { t, w, inst };
  };
  const exits = [
    ['stirbt durch Schaden', 'discardPile', async (t, inst) => { await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: t.besitzer }, inst, 9999, 'fire')); }],
    ['wird zerstört', 'discardPile', async (t, inst) => { await t.run(() => t.engine.actionDestroyCard(null, inst, {})); }],
    ['wird in den Löschstapel bewegt', 'deletedPile', async (t, inst) => { await t.run(() => t.engine.actionMoveCard(inst, 'deleted', -1, -1, { source: 'Test' })); }],
    ['Rückgabe auf die Hand (Hand des KONTROLLEURS, Herkunft bleibt), dann abgeworfen', 'discardPile', async (t, inst) => {
      await t.run(() => returnSupportCreatureToHand(t.engine, inst, 'Test', {}));
      R.check(`  Rückgabe (Kontrolleur ${t.ktrl}): Hand des KONTROLLEURS (Al 23.10.), Herkunft = Besitzer ${t.besitzer}`, B.anzahl(t, t.ktrl, 'hand', KARTE) === 1 && B.anzahl(t, t.besitzer, 'hand', KARTE) === 0 && Object.values(t.gs.players[t.ktrl]._handOriginals || {}).some(o => o && o.n === KARTE && o.o === t.besitzer), B.ort(t, KARTE));
      await t.run(() => t.engine.actionDiscardHandCard(t.ktrl, KARTE, t.pile(t.ktrl, 'hand').indexOf(KARTE), {}));
    }],
    ['Rückgabe auf die Hand, Zwangsabwurf des Kontrolleurs', 'discardPile', async (t, inst) => {
      await t.run(() => returnSupportCreatureToHand(t.engine, inst, 'Test', {}));
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: KARTE, handIndex: t.pile(t.ktrl, 'hand').indexOf(KARTE) }) });
      await t.run(() => t.engine.actionPromptForceDiscard(t.ktrl, 1, { selfInflicted: true }));
    }],
    ['Mass Routing mischt sie ins Deck der ursprünglichen Besitzer', 'mainDeck', async (t, inst) => {
      t.setHand(t.ktrl, ['Mass Routing']);
      await t.play(t.ktrl, 'Mass Routing', { hero: 0 });
    }],
  ];
  for (const weg of ['diplomacy', 'dark-gear']) for (const ktrl of [0, 1]) {
    R.section(`── ${weg}: Kontrolleur = Sitz ${ktrl}, Besitzer = Sitz ${1 - ktrl} ──`);
    for (const [name, stapel, fn] of exits) {
      const { t, w, inst } = await frisch(weg, ktrl);
      await fn(t, inst);
      await t.run(async () => {});
      B.erwarteStapel(R, t, `${weg} / Kreatur ${name} (Kontrolleur ${ktrl})`, KARTE, t.besitzer, stapel);
      const echte = w.echte();
      R.check(`  Besitzer-Wächter: keine Karte im Stapel eines Nicht-Besitzers`, echte.length === 0, echte.map(f => `${f.karte} → ${f.stapel} Sitz ${f.sitz} via ${f.wo.join(' < ')}`));
    }
  }
  // Gegenprobe: eigene Kreatur desselben Namens → Stapel des Kontrolleurs
  for (const ktrl of [0, 1]) {
    const t = await H.fresh({ deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')] });
    const inst = t.put(ktrl, 0, 0, KARTE);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1 - ktrl }, inst, 9999, 'fire'));
    R.check(`Gegenprobe: eigene Kreatur (Sitz ${ktrl}) stirbt → eigene Ablage`, B.anzahl(t, ktrl, 'discardPile', KARTE) === 1 && B.anzahl(t, 1 - ktrl, 'discardPile', KARTE) === 0, B.ort(t, KARTE));
  }
  R.finish();
})();
