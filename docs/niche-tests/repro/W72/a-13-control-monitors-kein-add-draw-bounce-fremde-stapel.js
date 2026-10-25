'use strict';
// W72a · Control Monitors — was KEIN „adds cards from their deck or discard pile to their hand" ist (BEIDE Sitze), dazu die Gegenprobe (eigenes Deck / eigene Ablage loest aus).
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand …"
// Auslegung: ausloesen tut nur ein Hinzufuegen aus dem EIGENEN Deck oder der EIGENEN Ablage. NICHT: Ziehen (draw ist kein „add"), Karte vom Brett zurueck auf die Hand (Bounce),
//   Karten aus FREMDEN Stapeln (Deck/Ablage des Gegners: Infiltration, Xiong …), Geloescht-Stapel, Potion Deck (Ja/Nein-Frage an Al im Bericht).
// Erwartet: in allen „NICHT"-Faellen kein Angebot; in den Kontrollfaellen genau EIN Angebot.
// Aufruf: node docs/niche-tests/repro/W72/a-13-….js   (Exit 0 = korrekt)
const L = require('../../lib/monitors.js');
const { H, F, MC } = L;
const RET = require('../../../../cards/effects/_deepsea-shared.js');

(async () => {
  const R = H.runner();
  const FAELLE = [
    // [Bezeichnung, erwartet Fenster?, Aufbau/Aktion (t, A, M)]
    ['Ziehen (actionDrawCards)', false, async (t, A) => { await t.run(() => t.engine.actionDrawCards(A, 1)); }],
    ['Ziehen aus dem Potion Deck (actionDrawFromPotionDeck)', false, async (t, A) => { t.gs.players[A].potionDeck = ['Healing Potion']; await t.run(() => t.engine.actionDrawFromPotionDeck(A, 1)); }],
    ['Brett → Hand (Bounce einer eigenen Kreatur, handZugangSync von:brett)', false, async (t, A) => {
      const k = t.put(A, 0, 0, H.INERT.creature); k.turnPlayed = 1;
      await t.run(() => RET.returnSupportCreatureToHand(t.engine, k, 'Probe', { sourceOwner: A }));
    }],
    ['Karte aus dem Deck des GEGNERS (von:fremdesDeck, wie Infiltration/Enigma)', false, async (t, A, M) => {
      t.gs.players[M].mainDeck.unshift('Cute Cat');
      await t.run(async () => { await t.engine.takeFromPile(M, 'deck', 'Cute Cat', { source: 'Probe' }); t.engine.handZugangSync(A, 'Cute Cat', { von: 'fremdesDeck', source: 'Probe', originalOwner: M }); });
    }],
    ['Karte aus der Ablage des GEGNERS (addCardFromDiscardToHand, fremde Ablage — Xiong, Herbithorn Demon …)', false, async (t, A, M) => {
      t.gs.players[M].discardPile.push('Fireball');
      await t.run(() => t.engine.addCardFromDiscardToHand(A, 'Fireball', M, { source: 'Probe' }));
    }],
    ['Gelöscht-Stapel → Hand (addFromPileToHand deleted, wie The Second Circle of Hell)', false, async (t, A) => {
      t.gs.players[A].deletedPile.push('Fireball');
      await t.run(() => t.engine.addFromPileToHand(A, 'deleted', 'Fireball', { source: 'Probe' }));
    }],
    ['Potion Deck → Hand (addFromPileToHand potionDeck, wie Philosopher\'s Stone / Alchemic Journal)', false, async (t, A) => {
      t.gs.players[A].potionDeck = ['Healing Potion'];
      await t.run(() => t.engine.addFromPileToHand(A, 'potionDeck', 'Healing Potion', { source: 'Probe' }));
    }],
    ['KONTROLLE: eigenes Deck → Hand (actionAddCardFromDeckToHand)', true, async (t, A) => { await t.run(() => t.engine.actionAddCardFromDeckToHand(A, 'Fireball', { source: 'Probe', reveal: false })); }],
    ['KONTROLLE: eigenes Deck → Hand (takeFromPile toHand + handZugangSync, Eigenbau wie Gate to the Armory)', true, async (t, A) => {
      await t.run(async () => { await t.engine.takeFromPile(A, 'deck', 'Fireball', { source: 'Probe', toHand: true }); t.engine.handZugangSync(A, 'Fireball', { source: 'Probe' }); });
    }],
    ['KONTROLLE: eigene Ablage → Hand (addCardFromDiscardToHand)', true, async (t, A) => {
      t.gs.players[A].discardPile.push('Fireball');
      await t.run(() => t.engine.addCardFromDiscardToHand(A, 'Fireball', A, { source: 'Probe' }));
    }],
    ['KONTROLLE: eigene Ablage → Hand (addFromPileToHand discard)', true, async (t, A) => {
      t.gs.players[A].discardPile.push('Fireball');
      await t.run(() => t.engine.addFromPileToHand(A, 'discard', 'Fireball', { source: 'Probe' }));
    }],
    ['KONTROLLE: Entnahme mit toHand, aber zurueckgelegt (returnToPile) → KEIN Zugang', false, async (t, A) => {
      await t.run(async () => { await t.engine.takeFromPile(A, 'deck', 'Fireball', { source: 'Probe', toHand: true }); t.engine.returnToPile(A, 'deck', 'Fireball', 0); });
    }],
  ];
  for (const M of [0, 1]) {
    const A = 1 - M;
    for (const [name, erwartet, tu] of FAELLE) {
      R.section(`Sitz ${M} haelt Monitors · ${name}`);
      const t = await L.szene(M, { deckA: ['Fireball', F, F, F] });
      t.script.push({ match: d => d.type === 'confirm' && d.title === MC, answer: () => false });   // nur das Angebot zaehlen
      await tu(t, A, M);
      await t.drain();
      const n = L.fenster(t).length;
      R.check(erwartet ? 'genau EIN Angebot' : 'KEIN Angebot', n === (erwartet ? 1 : 0), { angebote: n, prompts: t.prompts.map(p => p.pi + p.d.type) });
      R.check('keine Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
