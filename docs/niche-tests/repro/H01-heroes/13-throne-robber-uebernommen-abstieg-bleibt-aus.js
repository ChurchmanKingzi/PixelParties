'use strict';
// H01-heroes-13 · „???, the Throne Robber" unter fremder Kontrolleur: Abstieg am Ende des gegnerischen nächsten Zuges bleibt aus
//
// Kartentext: „You may once per turn Ascend this Hero to an Ascended Hero with a different name from all Heroes you currently control from your
//   hand or deck, ignoring its Ascension condition. … At the end of your opponent's next turn, Descend this Hero (even if it is defeated or its
//   effects are negated)."
// Aufbau: Sitz 0: Shapeshifter (3 Gestalten benutzt) steigt zum Throne Robber auf (`performAscension`), Sitz 1 übernimmt ihn dauerhaft
//   (`actionTakeHeroPermanently`), steigt per Heldeneffekt zu „Dajan, Conqueror of the Treasure Cave" auf und es folgen drei `endTurn()`.
// Erwartet: nach dem Zugende des Gegners (Sitz 0) ist der Held wieder „???, the Throne Robber" (Kontrolle: eigener Robber ✓).
// Beobachtet: der Held bleibt „Dajan, Conqueror of the Treasure Cave"; der Ablaufstempel `_identityExpiresTurn` wird nie gesetzt.
// Ursache: wie H01-heroes-12 – `the-throne-robber.js` ~Z. 318 `heldeninstanz(engine, feld, heroIdx)` mit `feld = ctx.cardHeroOwner ?? pi`
//   liefert für den übernommenen Helden `null` (Instanz-`owner` ist während der Aktivierung der Kontrolleur).
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter', ROBBER = '???, the Throne Robber', DAJAN = 'Dajan, Conqueror of the Treasure Cave';
(async () => {
  const R = H.runner();
  async function lauf(uebernommen) {
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[ROBBER, DAJAN], [DAJAN]] });
    t.hero(0, 0)._shapeshiftUsed = ['Archibald, the Archmage', 'Alex, Trainer of Heroes', 'Bill, the Angry Auctioneer'];
    const hi = t.pile(0, 'hand').indexOf(ROBBER);
    t.gs.activePlayer = 0; t.resetActions(0); t.phase(2);
    await t.run(() => t.engine.performAscension(0, 0, ROBBER, hi, {}));
    const istRobber = t.hero(0, 0).name === ROBBER;
    if (uebernommen) await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 0, { sourceName: 'Test' }));
    const wer = uebernommen ? 1 : 0;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === ROBBER, answer: () => ({ cardName: DAJAN, source: 'hand' }), once: true });
    t.gs.activePlayer = wer; t.resetActions(wer); t.phase(2);
    await t.run(() => t.host.doActivateHeroEffect(t.room, wer, uebernommen ? { heroIdx: 0, charmedOwner: 0 } : { heroIdx: 0 }));
    const dajan = t.hero(0, 0).name === DAJAN;
    for (let i = 0; i < 3; i++) await t.endTurn();
    return { t, istRobber, dajan, nachher: t.hero(0, 0).name };
  }
  for (const u of [false, true]) {
    const x = await lauf(u);
    R.section(u ? 'Dauerhaft übernommener Robber' : 'Kontrolle: eigener Robber');
    R.check('Aufbau: Robber steht, Aufstieg zu Dajan geklappt', x.istRobber && x.dajan, [x.istRobber, x.dajan]);
    R.check('nach 3 Zugwechseln wieder „???, the Throne Robber"', x.nachher === ROBBER, x.nachher);
    R.check('keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
