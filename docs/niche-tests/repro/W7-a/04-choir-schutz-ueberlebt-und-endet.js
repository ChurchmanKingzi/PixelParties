'use strict';
// W7-a/04 · Harpyformer Choir (Al, 15.10.2026): der erteilte Schutz überlebt den Tod des Choir, wirkt nur EINMAL (erster Treffer
// auf eine eigene Kreatur) und nur auf Kreaturen des Besitzers; er endet beim nächsten Zugbeginn des Besitzers.
// Aufruf: node docs/niche-tests/repro/W7-a/04-choir-schutz-ueberlebt-und-endet.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function aufbau(tot) {
    const t = await H.fresh({ hand: [['Summoning Magic'], []], deckSize: 10 });
    const choir = t.put(0, 0, 0, 'Harpyformer Choir'); choir.turnPlayed = 1;
    t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: 'Summoning Magic' }) });
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 0, 0);
    const eigene = t.put(0, 1, 0, H.INERT.big);
    const fremde = t.put(1, 0, 0, H.INERT.big);
    if (tot) await t.engine.actionDestroyCard({ name: 'T', owner: 1 }, choir);
    return { t, eigene, fremde };
  }
  const verlust = (i) => 1000 - (i.counters.currentHp ?? 1000);
  const treffer = (t, i, n = 150) => t.engine.actionDealCreatureDamage({ name: 'T', owner: 1, heroIdx: 0 }, i, n, 'creature');

  { // Choir tot: erster Treffer -100, zweiter voll; Gegnerkreatur nicht geschützt
    const { t, eigene, fremde } = await aufbau(true);
    await treffer(t, fremde);
    R.check('Schutz gilt nicht für Kreaturen des Gegners', verlust(fremde) === 150, verlust(fremde));
    await treffer(t, eigene);
    R.check('Choir tot: erster Treffer auf eigene Kreatur um 100 gesenkt', verlust(eigene) === 50, verlust(eigene));
    await treffer(t, eigene);
    R.check('zweiter Treffer voll (Schutz verbraucht)', verlust(eigene) === 50 + 150, verlust(eigene));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  { // endet beim nächsten Zugbeginn des Besitzers (Sitz 0): Zug Sitz 0 -> Sitz 1 -> Sitz 0
    const { t, eigene } = await aufbau(true);
    await t.endTurn();
    await treffer(t, eigene);
    R.check('im Gegnerzug gilt der Schutz noch', verlust(eigene) === 50, verlust(eigene));
    const { t: t2, eigene: e2 } = await aufbau(true);
    await t2.endTurn(); await t2.endTurn();
    await treffer(t2, e2);
    R.check('nach dem nächsten eigenen Zugbeginn ist der Schutz weg', verlust(e2) === 150, verlust(e2));
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
