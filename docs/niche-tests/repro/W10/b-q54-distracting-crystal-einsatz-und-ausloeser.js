'use strict';
// W10b · Q54 (A08-10) · Distracting Crystal unterdrückt Einsatz-Effekte und Auslöser, die Hand/Ablage ins Deck mischen
//
// Kartentext: „While this card is in your hand, you cannot activate effects that include adding cards from your hand or discard pile to your deck."
// ENTSCHIEDEN (Al, Welle 10, Q54): „Ja, die können nicht feuern." → Black Marketeer, Deepsea Stein (beim Beschwören), The Stormblade, Lunatic Cycle -
//   Crescent Moon: mit dem Kristall auf der Hand nicht angeboten/nicht ausgelöst, keine Kosten ohne Wirkung. Die Kreatur selbst darf kommen.
// Geprüft je Karte: (A) MIT Kristall: kein Angebot, nichts gemischt, Stormblade-Einsatz nicht verbraucht, Beschwörung gelingt;
//   (B) Kontrolle OHNE Kristall: das Angebot erscheint und mischt (bzw. öffnet die Handauswahl).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler, A = H.INERT.artifact;
  const neu = async (mitKristall) => {
    const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    if (mitKristall) t.engine.handZugangSync(0, 'Distracting Crystal');
    return t;
  };
  for (const mit of [true, false]) {
    for (const kreatur of ['Black Marketeer', 'Deepsea Stein']) {
      const t = await neu(mit);
      t.setDiscard(0, [F, F, A]);
      t.script.push({ match: d => /Gallery/i.test(d.type), answer: () => ({ selectedCards: [F] }) });
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      const d0 = t.pile(0, 'mainDeck').length;
      const r = await t.play(0, kreatur, { hero: 0 });
      const gemischt = t.pile(0, 'mainDeck').length > d0;
      const gespielt = t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === kreatur).length === 1;
      if (mit) R.check(`${kreatur} MIT Kristall: Beschwörung ok, nichts gemischt, keine Galerie`, r === true && gespielt && !gemischt && !t.prompts.some(p => /Gallery/i.test(p.d.type)), { r, gespielt, deck: [d0, t.pile(0, 'mainDeck').length], prompts: t.prompts.map(p => p.d.type) });
      else R.check(`${kreatur} OHNE Kristall (Kontrolle): Galerie erscheint und es wird gemischt`, r === true && gespielt && gemischt, { r, gespielt, deck: [d0, t.pile(0, 'mainDeck').length], prompts: t.prompts.map(p => p.d.type) });
      R.check(`${kreatur}: keine Engine-Fehler / Zustand sauber (${mit ? 'mit' : 'ohne'} Kristall)`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
    for (const ausruestung of ['The Stormblade', 'Lunatic Cycle - Crescent Moon']) {
      const t = await neu(mit);
      const inst = t.put(0, 0, 0, ausruestung); inst.turnPlayed = 1;
      for (const n of [F, F, F]) t.engine.handZugangSync(0, n);
      t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: (d.eligibleIndices || []).slice(0, 1).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
      const d0 = t.pile(0, 'mainDeck').length;
      await t.play(0, 'Fireball', { hero: 0 });
      const offen = t.prompts.some(p => p.d.type === 'handPick');
      if (mit) R.check(`${ausruestung} MIT Kristall: keine Handauswahl, Hand bleibt (Kristall noch drin)`, !offen && t.pile(0, 'hand').includes('Distracting Crystal'), { offen, hand: t.pile(0, 'hand') });
      else R.check(`${ausruestung} OHNE Kristall (Kontrolle): Handauswahl öffnet sich`, offen, t.prompts.map(p => p.d.type));
      R.check(`${ausruestung}: keine Engine-Fehler (${mit ? 'mit' : 'ohne'} Kristall)`, t.errors.length === 0, t.errors);
    }
  }
  // Stormblade-Einsatz nicht verbraucht: nach Entfernen des Kristalls feuert er in derselben Runde noch.
  {
    const t = await neu(true);
    const sb = t.put(0, 0, 0, 'The Stormblade'); sb.turnPlayed = 1;
    for (const n of [F, F, F]) t.engine.handZugangSync(0, n);
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: (d.eligibleIndices || []).slice(0, 1).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    const idx = t.pile(0, 'hand').indexOf('Distracting Crystal');
    if (idx >= 0) t.engine.takeFromPileSync(t.gs.players[0], 'hand', idx);
    t.reset();
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Stormblade: der gesperrte Versuch hat den Einmal-pro-Zug-Einsatz nicht verbraucht', t.prompts.some(p => p.d.type === 'handPick'), t.prompts.map(p => p.d.type));
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
