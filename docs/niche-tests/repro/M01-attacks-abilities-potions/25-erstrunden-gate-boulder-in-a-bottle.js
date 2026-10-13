'use strict';
// M01-25 · Erste-Runden-Gate fehlt bei Boulder in a Bottle (reiner Gegner-Trank); Bottled Flame/Lightning als Randfall (Ergänzung zu B-06)
// Regel (CARD_API.md „Turn-1 Immunity" / B-06): „If EVERY mode of your card targets the opponent, gate the whole card off"; B-06 nennt 16 Karten, Boulder in a Bottle fehlt dort (Bottled Flame/Lightning haben eine Eigenwirkung auf den Wirker und sind nur als Notiz geführt).
// Aufbau wie B-05 (echter Spielstart `engine.startGame()`, Sitz 0 spielt in Zug 1, Sitz 1 geschützt und `shielded`).
// Erwartet: Trank bleibt auf der Hand (nicht spielbar), Sitz 1 unverändert. Kontrolle: Flashbang wird korrekt gegated (`false`).
// Beobachtet: `play` meldet `true`, der Trank liegt im Gelöscht-Stapel, Sitz 1 unverändert (nichts geschah).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const FILL = 'ZZ Filler';
  async function start(card) {
    const t = await H.fresh({ hand: [[card], [FILL, FILL, FILL, FILL, FILL]], deck: [Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)], gold: [0, 20], turn: 0, phase: 0 });
    t.gs.turn = 0; t.gs.activePlayer = 0; t.gs.currentPhase = 0;
    t.grantFor(0, 0, card);
    await t.run(() => t.engine.startGame());
    t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : (valid.length ? [valid[0].id] : []); };
    t.reset();
    return t;
  }
  for (const card of ['Flashbang', 'Boulder in a Bottle', 'Bottled Flame', 'Bottled Lightning']) {
    const t = await start(card);
    const r = await t.play(0, card, { hero: 0, noGrant: true, phase: t.gs.currentPhase, keepActions: true });
    const verbraucht = r === true && !t.pile(0, 'hand').includes(card);
    if (card.startsWith('Bottled')) { R.note(card + ': in Zug 1 ' + (verbraucht ? 'verbraucht (Eigenwirkung auf den Wirker möglich – nur Notiz)' : 'nicht verbraucht'), { r, deleted: t.pile(0, 'deletedPile') }); continue; }
    R.check(card + ': in Zug 1 nicht ohne Wirkung verbrauchbar (bleibt auf der Hand)', !verbraucht, { r, hand: t.pile(0, 'hand'), deleted: t.pile(0, 'deletedPile') });
    R.check(card + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
