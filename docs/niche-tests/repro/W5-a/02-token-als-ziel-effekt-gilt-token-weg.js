'use strict';
// W5-a-02 · Tokens sind legale Ziele von „auf die Hand/ins Deck"-Effekten; der Effekt gilt als ausgeführt, der Token verschwindet vollständig (Entscheidung Welle 5, Al 14.10.2026)
// Al zu Z5-Frage 8: „Ja, sie sind legale Ziele und werden, wenn sie das Board verlassen, komplett aus dem Spiel entfernt." Frage 9: „Potion wird deleted."
// Karten: Gold Trap, Chasing the Legend, Shapeshift, Tengu Windstorm, Dive Bomblebee, Missing People, Sparkfly (stealBoardCardToHand).
// Erwartet je Karte: (a) Token ist wählbar/wird getroffen, (b) er liegt danach in KEINER Hand/keinem Deck/keiner Ablage/keinem Gelöscht-Stapel,
//   (c) Biomancy-Token: die Potion darunter liegt genau einmal im Gelöscht-Stapel des Besitzers, (d) Zustand sauber, keine Engine-Fehler.
const H = require('../../lib/h.js');
const { placeBiomancyToken } = require('../../../../cards/effects/_biomancy-shared.js');
const ALL = ['hand', 'mainDeck', 'discardPile', 'deletedPile'];
const bio = async (t, seat, hi, slot) => (await placeBiomancyToken(t.engine, seat, hi, 'Healing Potion', 1, { slot, animate: false })).inst;
const tokenWeg = (t, nm, ausser) => [0, 1].every(s => ALL.every(k => (ausser && ausser[0] === s && ausser[1] === k) || !t.pile(s, k).includes(nm)));
const anz = (t, s, k, nm) => t.pile(s, k).filter(n => n === nm).length;
const sauber = (t) => t.audit().length === 0 && t.errors.length === 0;
function pruefe(R, t, tag, art, besitzer) {
  if (art === 'pur') {
    R.check(`${tag}: Mummy Token in keinem Stapel`, tokenWeg(t, 'Mummy Token'), [0, 1].map(s => ({ h: t.pile(s, 'hand'), d: t.pile(s, 'mainDeck').slice(0, 2), a: t.pile(s, 'discardPile'), g: t.pile(s, 'deletedPile') })));
  } else {
    R.check(`${tag}: Potion darunter genau einmal im Gelöscht-Stapel des Besitzers (Sitz ${besitzer})`, anz(t, besitzer, 'deletedPile', 'Healing Potion') === 1 && ['hand', 'mainDeck', 'discardPile'].every(k => !t.pile(0, k).includes('Healing Potion') && !t.pile(1, k).includes('Healing Potion')), [0, 1].map(s => ({ h: t.pile(s, 'hand'), a: t.pile(s, 'discardPile'), g: t.pile(s, 'deletedPile') })));
  }
  R.check(`${tag}: Zustand sauber, keine Engine-Fehler`, sauber(t), { a: t.audit(), e: t.errors });
}
(async () => {
  const R = H.runner();
  for (const art of ['pur', 'bio']) {
    const wasToken = art === 'pur' ? 'Mummy Token' : 'Healing Potion';
    const mk = async (t, seat, hi, slot) => art === 'pur' ? t.put(seat, hi, slot, 'Mummy Token') : bio(t, seat, hi, slot);

    R.section(`Gold Trap (${art})`);
    {
      const t = await H.fresh({ gold: [100, 100] });
      t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
      await mk(t, 1, 0, 0);
      t.gs.activePlayer = 1;
      let angeboten = false;
      t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.cardName === wasToken); angeboten = !!v; return v ? [v.id] : undefined; };
      await t.run(() => t.engine.actionGainGold(1, 30));
      R.check('Gold Trap: Gold umgeleitet', t.gs.players[0].gold === 130, t.gs.players[0].gold);
      R.check('Gold Trap: Token war wählbar', angeboten, t.targets.length);
      R.check('Gold Trap: Token weg vom Brett', !t.zone(1, 0, 0), t.zone(1, 0, 0));
      pruefe(R, t, 'Gold Trap', art, 1);
    }

    R.section(`Chasing the Legend (${art})`);
    {
      const t = await H.fresh({ hand: [['Fireball'], ['Chasing the Legend']] });
      t.grantFor(1, 0, 'Chasing the Legend');
      await mk(t, 1, 1, 0);
      t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 1); return v ? [v.id] : undefined; };
      await t.play(0, 'Fireball', { hero: 0 });
      R.check('Chasing the Legend gespielt (liegt in der Ablage von Sitz 1)', t.pile(1, 'discardPile').includes('Chasing the Legend'), t.pile(1, 'discardPile'));
      R.check('Chasing the Legend: Token weg vom Brett', !t.zone(1, 1, 0), t.zone(1, 1, 0));
      pruefe(R, t, 'Chasing the Legend', art, 1);
    }

    R.section(`Shapeshift (${art})`);
    {
      const t = await H.fresh({ hand: [['Shapeshift', H.INERT.creature], []] });
      const tok = await mk(t, 0, 0, 0); tok.turnPlayed = 1;
      t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
      t.script.push({ match: d => d.type === 'pickHandCard', answer: () => { const i = t.pile(0, 'hand').indexOf(H.INERT.creature); return { cardName: H.INERT.creature, handIndex: i, selectedCards: [{ cardName: H.INERT.creature, handIndex: i }] }; } });
      await t.play(0, 'Shapeshift', { hero: 0 });
      R.check('Shapeshift: Token ist vom Brett', !t.zone(0, 0, 0) || t.zone(0, 0, 0) !== wasToken, t.zone(0, 0, 0));
      pruefe(R, t, 'Shapeshift', art, 0);
    }

    R.section(`Tengu Windstorm (${art})`);
    {
      const t = await H.fresh({ hand: [['Tengu Windstorm'], []], discard: [['Rebelliokai Terror Tengu'], []] });
      await mk(t, 1, 0, 0);
      t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'top' }) });
      t.targetFn = (valid) => { const a = valid.find(v => v.cardName === wasToken); return [a ? a.id : valid[0].id]; };
      await t.play(0, 'Tengu Windstorm', { hero: 0 });
      R.check('Tengu Windstorm: Token weg vom Brett', !t.zone(1, 0, 0), t.zone(1, 0, 0));
      pruefe(R, t, 'Tengu Windstorm', art, 1);
    }

    R.section(`Dive Bomblebee (${art})`);
    {
      const t = await H.fresh({});
      const dive = t.put(0, 0, 0, 'Dive Bomblebee'); dive.turnPlayed = 1;
      const opfer = t.put(1, 2, 2, H.INERT.frail);
      await mk(t, 1, 0, 0);
      t.targetFn = (valid) => { const v = valid.find(x => x.cardName === wasToken); return v ? [v.id] : [valid[0].id]; };
      await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, opfer));
      R.check('Dive Bomblebee: Token weg vom Brett', !t.zone(1, 0, 0), t.zone(1, 0, 0));
      pruefe(R, t, 'Dive Bomblebee', art, 1);
    }

    R.section(`Missing People (${art})`);
    {
      const t = await H.fresh({ hand: [['Missing People'], []], deckSize: 3 });
      await mk(t, 1, 0, 0);
      t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip'); return v ? [v.id] : null; };
      const r = await t.play(0, 'Missing People', { hero: 0 });
      R.check('Missing People gespielt', r === true, r);
      R.check('Missing People: Token weg vom Brett', !t.zone(1, 0, 0), t.zone(1, 0, 0));
      await t.engine.actionDrawCards(1, 4);
      pruefe(R, t, 'Missing People', art, 1);
    }

    R.section(`Sparkfly „Brett → Hand" (${art})`);
    {
      const t = await H.fresh({ hand: [[], []] });
      const tok = await mk(t, 1, 0, 0);
      const ok = await t.run(() => require('../../../../cards/effects/_sparkfly-shared.js').stealBoardCardToHand(t.engine, 0, tok, 'Test'));
      R.check('Sparkfly: Effekt gilt als ausgeführt', ok === true || (ok && ok.threw === undefined), ok);
      R.check('Sparkfly: Token weg vom Brett', !t.zone(1, 0, 0), t.zone(1, 0, 0));
      pruefe(R, t, 'Sparkfly', art, 1);
    }
  }
  R.finish();
})();
