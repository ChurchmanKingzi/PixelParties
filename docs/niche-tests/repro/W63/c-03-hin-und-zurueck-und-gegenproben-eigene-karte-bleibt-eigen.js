'use strict';
// W63c-03 · Charme Lv 2 in BEIDE Richtungen und die Gegenproben: eine EIGENE Karte desselben Namens wird nie mit der fremden verwechselt.
//   (a) P_A klaut X von P_B (Charme), P_B klaut später selbst (Charme) X zurück → X liegt wieder in der Hand des Besitzers und geht in SEINE Stapel.
//   (b) Hand-Zähler: die gestohlene Karte zählt für die Handgröße/das Handlimit des Diebs (nicht des Besitzers).
//   (c) Fremde Kreatur wird abgeworfen, danach spielt der Dieb eine EIGENE Kopie gleichen Namens aus und sie stirbt → Ablage des DIEBS (kein Fremdstempel).
//   (d) Eigene und gestohlene Kopie gleichzeitig auf dem Brett (zwei Kreaturen gleichen Namens) → jede stirbt in ihrer eigenen Ablage.
//   (e) Umsortieren der Hand (reorder_hand ohne Permutation): die Herkunftsmarke bleibt beim Namen.
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();

  // (a) hin und zurück per Charme
  for (const a of [0, 1]) {
    const b = 1 - a;
    R.section(`── (a) Sitz ${a} klaut, Sitz ${b} klaut zurück ──`);
    const t = await H.fresh({
      hand: a === 0 ? [['ZZ Filler'], ['Fireball']] : [['Fireball'], ['ZZ Filler']],
      deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')],
      abilities: { 0: { 0: [['Charme', 'Charme'], [], []] }, 1: { 0: [['Charme', 'Charme'], [], []] } },
    });
    // Besitzer b gibt Fireball an a
    t.script.push({ match: (d, pi) => d.type === 'forceDiscard' && /Charme/.test(d.title || ''), answer: (d, pi) => ({ cardName: pi === b ? 'Fireball' : 'ZZ Filler', handIndex: t.pile(pi, 'hand').indexOf(pi === b ? 'Fireball' : 'ZZ Filler') }) });
    await B.frei(t, a, 0, 0);
    R.check(`Fireball liegt in der Hand von Sitz ${a}`, B.anzahl(t, a, 'hand', 'Fireball') === 1 && B.anzahl(t, b, 'hand', 'Fireball') === 0, B.ort(t, 'Fireball'));
    // jetzt klaut b von a zurück (a gibt Fireball)
    t.script.length = 0;
    t.script.push({ match: (d, pi) => d.type === 'forceDiscard' && /Charme/.test(d.title || ''), answer: (d, pi) => ({ cardName: 'Fireball', handIndex: t.pile(pi, 'hand').indexOf('Fireball') }) });
    t.gs.turn = 7;   // nächste Runde (HOPT)
    await B.frei(t, b, 0, 0);
    R.check(`Fireball ist zurück in der Hand von Sitz ${b}`, B.anzahl(t, b, 'hand', 'Fireball') === 1 && B.anzahl(t, a, 'hand', 'Fireball') === 0, B.ort(t, 'Fireball'));
    await t.run(() => t.engine.actionDiscardHandCard(b, 'Fireball', t.pile(b, 'hand').indexOf('Fireball'), {}));
    B.erwarteStapel(R, t, `(a) Rückkehr, Sitz ${b} wirft ab`, 'Fireball', b, 'discardPile');
  }

  // (b) Handzähler
  for (const dieb of [0, 1]) {
    const t = await B.charmeKlau('Fireball', dieb, { diebHand: ['ZZ Filler', 'ZZ Filler'], besitzerHand: ['ZZ Filler'] });
    R.check(`(b) Dieb ${dieb}: Hand 3 (2 eigene + gestohlene), Besitzer 1`, t.pile(dieb, 'hand').length === 3 && t.pile(1 - dieb, 'hand').length === 1, [t.pile(dieb, 'hand').length, t.pile(1 - dieb, 'hand').length]);
    // Handlimit 2 beim Dieb: genau eine Karte muss weg; wählt der Dieb die gestohlene, landet sie beim Besitzer
    t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'Fireball', handIndex: t.pile(dieb, 'hand').indexOf('Fireball') }) });
    await t.run(() => t.engine.enforceHandLimit(dieb, { maxSize: 2 }));
    R.check(`(b) Dieb ${dieb}: nach Handlimit 2 Karten, Besitzer unverändert`, t.pile(dieb, 'hand').length === 2 && t.pile(1 - dieb, 'hand').length === 1, [t.pile(dieb, 'hand'), t.pile(1 - dieb, 'hand')]);
    R.check(`(b) Dieb ${dieb}: Fireball in der Ablage des Besitzers`, B.anzahl(t, 1 - dieb, 'discardPile', 'Fireball') === 1 && B.anzahl(t, dieb, 'discardPile', 'Fireball') === 0, B.ort(t, 'Fireball'));
  }

  // (c) fremde Kreatur abwerfen, eigene Kopie spielen
  for (const dieb of [0, 1]) {
    const t = await B.charmeKlau('ZZ Dummy Frail', dieb, { diebHand: ['ZZ Dummy Frail'] });
    // Plätze beim Dieb: [eigene, gestohlene]
    await t.run(() => t.engine.actionDiscardHandCard(dieb, 'ZZ Dummy Frail', 1, {}));   // gestohlene weg
    R.check(`(c) Dieb ${dieb}: gestohlene Kreatur in der Ablage des Besitzers`, B.anzahl(t, 1 - dieb, 'discardPile', 'ZZ Dummy Frail') === 1, B.ort(t, 'ZZ Dummy Frail'));
    await t.play(dieb, 'ZZ Dummy Frail', { hero: 0 });   // eigene Kopie
    const inst = t.engine.cardInstances.find(c => c.name === 'ZZ Dummy Frail' && c.zone === 'support');
    R.check(`(c) Dieb ${dieb}: eigene Kopie trägt KEINE Fremdherkunft`, inst && inst.originalOwner === dieb, inst && inst.originalOwner);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1 - dieb }, inst, 999, 'fire'));
    R.check(`(c) Dieb ${dieb}: eigene Kopie stirbt → Ablage des Diebs (nicht des Gegners)`, B.anzahl(t, dieb, 'discardPile', 'ZZ Dummy Frail') === 1 && B.anzahl(t, 1 - dieb, 'discardPile', 'ZZ Dummy Frail') === 1, B.ort(t, 'ZZ Dummy Frail'));
  }

  // (d) eigene + gestohlene Kopie gleichzeitig auf dem Brett
  for (const dieb of [0, 1]) {
    const t = await B.charmeKlau('ZZ Dummy Frail', dieb, { diebHand: ['ZZ Dummy Frail'] });
    await t.play(dieb, 'ZZ Dummy Frail', { hero: 0, handIndex: 1, slot: 0 });   // die GESTOHLENE (Platz 1)
    await t.play(dieb, 'ZZ Dummy Frail', { hero: 0, handIndex: 0, slot: 1 });   // die eigene (Platz 0)
    const insts = t.engine.cardInstances.filter(c => c.name === 'ZZ Dummy Frail' && c.zone === 'support');
    R.check(`(d) Dieb ${dieb}: zwei Kreaturen auf dem Brett`, insts.length === 2, insts.length);
    const fremd = insts.find(c => c.zoneSlot === 0), eigen = insts.find(c => c.zoneSlot === 1);
    R.check(`(d) Dieb ${dieb}: Zone 0 (gestohlen) gehört dem Besitzer, Zone 1 (eigen) dem Dieb`, fremd && eigen && fremd.originalOwner === 1 - dieb && eigen.originalOwner === dieb, [fremd && fremd.originalOwner, eigen && eigen.originalOwner]);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1 - dieb }, fremd, 999, 'fire'));
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1 - dieb }, eigen, 999, 'fire'));
    R.check(`(d) Dieb ${dieb}: je eine Kopie in jeder Ablage`, B.anzahl(t, dieb, 'discardPile', 'ZZ Dummy Frail') === 1 && B.anzahl(t, 1 - dieb, 'discardPile', 'ZZ Dummy Frail') === 1, B.ort(t, 'ZZ Dummy Frail'));
    R.check(`(d) Dieb ${dieb}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // (e) Umsortieren ohne Permutation (Herkunft nach Namen verteilen)
  for (const dieb of [0, 1]) {
    const t = await B.charmeKlau('Fireball', dieb, { diebHand: ['ZZ Filler', 'ZZ Filler'] });
    const ps = t.gs.players[dieb];
    const alt = ps.hand.slice();
    const neu = alt.slice().reverse();
    R.check(`(e) Dieb ${dieb}: Hilfe \`herkunftNachNamenVerteilen\` existiert`, typeof t.engine.herkunftNachNamenVerteilen === 'function');
    const marken = typeof t.engine.herkunftNachNamenVerteilen === 'function' ? t.engine.herkunftNachNamenVerteilen(ps._handOriginals, alt, neu) : {};   // alter Stand: Marken wurden gestrichen
    ps._handOriginals = marken; ps.hand = neu; t.engine._installHandRevealInterceptor(dieb);
    await t.run(() => t.engine.actionDiscardHandCard(dieb, 'Fireball', ps.hand.indexOf('Fireball'), {}));
    B.erwarteStapel(R, t, `(e) Dieb ${dieb}: nach Umsortieren ohne Permutation`, 'Fireball', 1 - dieb, 'discardPile');
  }
  R.finish();
})();
