'use strict';
// N2-03 · Detection legt Surprises in die Ablage, ohne das „Brett → Ablage durch Effekt"-Fenster zu öffnen (Furious Anger, Water Golem)
// Kartentext (Furious Anger): „Immediately play this card when a Surprise or Creature you control is sent to the discard pile by an opponent's card or effect (but not by taking damage)."
// Kartentext (Water Golem): „Activate this Surprise when a Surprise on your side of the board is sent to the discard pile by an effect."
// Kartentext (Detection): „Remove all Surprises your opponent controls from the board, then draw 2 cards for every Surprise removed …" — das Skript legt sie in die Ablage ihres Besitzers.
// Erwartung: Wirkt der Gegner Detection auf meine Surprises, gehen sie in die Ablage → Furious Anger darf angeboten werden; Water Golem löst auf die erste abgelegte Surprise aus.
// Beobachtet: Weder Furious Anger noch Water Golem werden gefragt. Gegenprobe: dieselbe Furious Anger wird bei einer per Goldify besiegten Kreatur gefragt.
// Ursache: detection.js ~Z. 253 schiebt den Namen per `discardPile.push` und `_untrackCard`, ruft aber weder `actionMoveCard(…, 'discard')` noch `engine._fireBoardSentToDiscard(…)`
//   (_engine.js ~13860: dort hängen `_checkBoardSentToDiscardHandReactions` und `_checkSurpriseOnSurpriseDiscarded`).
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Furious Anger: Sitz ${op} hält die Karte, Sitz ${me} wirkt Detection`);
    {
      const t = await H.fresh({ hand: me === 0 ? [['Detection'], ['Furious Anger', 'Burning Finger']] : [['Furious Anger', 'Burning Finger'], ['Detection']], deckSize: 30 });
      t.grantFor(op, 0, 'Furious Anger'); t.grantFor(op, 0, 'Burning Finger');
      t.putSurprise(op, 0, 'Booby Trap'); t.putSurprise(op, 1, 'Frost Rune');
      t.script.push({ match: d => d.title === 'Furious Anger' && d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.script.push({ match: d => d.type === 'heroAction', answer: () => null });
      const r = await t.play(me, 'Detection', { hero: 0 });
      R.check('Detection wurde gewirkt, beide Surprises liegen in der Ablage', r === true && t.pile(op, 'discardPile').includes('Booby Trap') && t.pile(op, 'discardPile').includes('Frost Rune'), [r, t.pile(op, 'discardPile')]);
      R.check('Furious Anger wird angeboten', gefragt(t, 'Furious Anger') >= 1, gefragt(t, 'Furious Anger'));
    }
    R.section(`Gegenprobe Sitz ${op}: dieselbe Furious Anger bei einer von Goldify besiegten Kreatur`);
    {
      const t = await H.fresh({ hand: me === 0 ? [['Goldify'], ['Furious Anger', 'Burning Finger']] : [['Furious Anger', 'Burning Finger'], ['Goldify']], deckSize: 30 });
      t.grantFor(op, 0, 'Furious Anger'); t.grantFor(op, 0, 'Burning Finger');
      t.put(op, 1, 0, H.INERT.creature);
      t.script.push({ match: d => d.title === 'Furious Anger' && d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.script.push({ match: d => d.type === 'heroAction', answer: () => null });
      t.targetFn = (v) => [v.find(x => x.type === 'equip').id];
      await t.play(me, 'Goldify', { hero: 0 });
      R.check('Furious Anger wird angeboten', gefragt(t, 'Furious Anger') >= 1, gefragt(t, 'Furious Anger'));
    }
  }
  R.section('Water Golem: Detection legt Booby Trap (Held 0) zuerst ab, Water Golem (Held 1) liegt noch verdeckt');
  {
    const t = await H.fresh({ hand: [['Detection'], []], deckSize: 30 });
    t.putSurprise(1, 0, 'Booby Trap'); t.putSurprise(1, 1, 'Water Golem'); t.grantFor(1, 1, 'Water Golem');
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [v[0].id];
    await t.play(0, 'Detection', { hero: 0 });
    R.check('Water Golem wird gefragt (eine Surprise seiner Seite wurde durch einen Effekt abgelegt)', gefragt(t, 'Water Golem') >= 1, t.prompts.map(p => p.d.title));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
