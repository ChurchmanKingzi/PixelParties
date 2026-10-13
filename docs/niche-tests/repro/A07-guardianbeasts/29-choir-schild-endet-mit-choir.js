'use strict';
// A07-29 · Harpyformer Choir: der gewirkte Schutz („next damage … reduced by 100") hängt am Leben/Zustand des Choir
//
// Kartentext: „You may once per turn discard a Summoning Magic Ability, and if you do, the next damage a Creature you control
//   would take until the beginning of your next turn is reduced by 100."
// Erwartung: der Schutz ist ein abgeschlossen gewirkter Effekt; er gilt bis zum nächsten eigenen Zugbeginn, auch wenn der Choir
//   danach stirbt / negiert / eingefroren / betäubt wird (Kontrolle: normal ⇒ 150 − 100 = 50 Schaden).
// Beobachtet (harpyformer-choir.js beforeCreatureDamageBatch): der Schild liegt als `_choirShield` am Choir-Objekt und wirkt nur
//   über dessen Hook; `runHooks` überspringt stillgelegte/tote Kreaturen ⇒ volle 150 Schaden, der Schild bleibt als totes Flag stehen.
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  for (const zustand of ['normal', 'negiert', 'gefroren', 'betäubt', 'tot']) {
    R.section(zustand);
    const t = await H.fresh({ hand: [['Summoning Magic'], []], deckSize: 10 });
    const choir = t.put(0, 0, 0, 'Harpyformer Choir'); choir.turnPlayed = 1;
    t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: 'Summoning Magic' }) });
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 0, 0);
    const opfer = t.put(0, 1, 0, H.INERT.big);
    if (zustand === 'negiert') await t.engine.actionNegateCreature(choir, 'x');
    if (zustand === 'gefroren') await t.engine.applyCreatureStatus(choir, 'frozen', { sourceOwner: 1 });
    if (zustand === 'betäubt') await t.engine.applyCreatureStatus(choir, 'stunned', { sourceOwner: 1 });
    if (zustand === 'tot') await t.engine.actionDestroyCard({ name: 'T', owner: 1 }, choir);
    await t.engine.actionDealCreatureDamage({ name: 'T', owner: 1, heroIdx: 0 }, opfer, 150, 'creature');
    const verlust = 1000 - (opfer.counters.currentHp ?? 1000);
    R.check(`Schutz wirkt (${zustand}): Schaden 50`, verlust === 50, { verlust });
  }
  R.finish();
})();
