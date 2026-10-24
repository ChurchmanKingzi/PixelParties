'use strict';
// W73a-02 · Ankhota: auch die Sonderwege „vom Brett auf die Hand" (am zentralen Move vorbei) löschen
//   Deepsea-Bounce-Place (Swap), Rückgabe-Wege des Deepsea-Bausteins, Sparkfly-Diebstahl; Gegenprobe ohne Ankhota
const H = require('../../lib/h.js');
const CARD = 'Ankhota, the Burier';
const geloescht = (t, seat, name) => t.pile(seat, 'deletedPile').filter(n => n === name).length;
const fertig = (t) => t.run(() => t.engine._runPostChainActions());

(async () => {
  const R = H.runner();

  R.section('A · Deepsea-Swap (Bounce-Place): die zurückgenommene Kreatur wird gelöscht, die neue steht im Platz');
  for (const mitAnkhota of [true, false]) {
    const t = await H.fresh({ hand: [['Deepsea Pirate'], []] });
    if (mitAnkhota) t.put(0, 0, 0, CARD);
    const alt = t.put(0, 1, 0, 'Deepsea Witch'); alt.turnPlayed = 1;
    t.grantFor(0, 1, 'Deepsea Pirate');
    t.gs.players[0].heroes[1].atk = 10;
    const hp0 = t.hero(0, 0).maxHp;
    t.script.length = 0;
    const r = await t.play(0, 'Deepsea Pirate', { hero: 1, slot: 0 });
    await fertig(t);
    const hand = t.pile(0, 'hand');
    if (mitAnkhota) {
      R.check('mit Ankhota: Deepsea Witch ist gelöscht, nicht auf der Hand', geloescht(t, 0, 'Deepsea Witch') === 1 && !hand.includes('Deepsea Witch'), { r, hand, del: t.pile(0, 'deletedPile') });
      R.check('mit Ankhota: Deepsea Pirate steht im frei gewordenen Platz', t.zone(0, 1, 0) === 'Deepsea Pirate', t.zone(0, 1, 0));
      R.check('mit Ankhota: Ankhotas Held +10 max HP', t.hero(0, 0).maxHp === hp0 + 10, [hp0, t.hero(0, 0).maxHp]);
    } else {
      R.check('ohne Ankhota: Deepsea Witch kehrt wie bisher auf die Hand zurück', hand.includes('Deepsea Witch') && geloescht(t, 0, 'Deepsea Witch') === 0, { r, hand });
    }
    R.check(`keine Engine-Fehler, Zustand sauber (${mitAnkhota ? 'mit' : 'ohne'} Ankhota)`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('B · Deepsea-Rückgabe (returnSupportCreatureToHand) und Gegner-Bounce');
  for (const mitAnkhota of [true, false]) {
    const t = await H.fresh({ hand: [[], []] });
    if (mitAnkhota) t.put(0, 0, 0, CARD);
    const ds = require('../../../../cards/effects/_deepsea-shared.js');
    const k = t.put(1, 0, 0, 'Deepsea Witch');
    const r = await t.run(() => ds.returnSupportCreatureToHand(t.engine, k, 'Test'));
    await fertig(t);
    const hand = t.pile(1, 'hand');
    if (mitAnkhota) R.check('mit Ankhota: gelöscht beim Besitzer, nicht auf der Hand', geloescht(t, 1, 'Deepsea Witch') === 1 && !hand.includes('Deepsea Witch'), { r, hand, del: t.pile(1, 'deletedPile') });
    else R.check('ohne Ankhota: auf der Hand', hand.includes('Deepsea Witch'), hand);
    R.check('Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('C · Teppes zieht nicht, wenn die Kreatur gelöscht statt zurückgegeben wurde („returned to hand")');
  {
    const t = await H.fresh({ hand: [[], []] });
    t.put(0, 0, 0, CARD);
    t.put(0, 2, 0, 'Teppes, the Deepsea Vampire');
    const ds = require('../../../../cards/effects/_deepsea-shared.js');
    const k = t.put(0, 1, 0, 'Deepsea Witch');
    const hand0 = t.pile(0, 'hand').length;
    await t.run(() => ds.returnSupportCreatureToHand(t.engine, k, 'Test'));
    await fertig(t);
    R.check('keine Teppes-Zugkarte (nichts wurde zurückgegeben)', t.pile(0, 'hand').length === hand0, [hand0, t.pile(0, 'hand')]);
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
