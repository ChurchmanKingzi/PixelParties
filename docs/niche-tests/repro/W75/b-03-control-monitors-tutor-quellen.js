'use strict';
// W75 · Control Monitors — Tutor-Quellen: Cute Dog (2/2, 1/1), Inventing Lv3.
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand by discarding the same number of cards from your hand. Delete the cards your opponent added. Your opponent may delete all other cards in their hand instead."
// W72a: der Reaktionsspieler zahlt N weitere Handkarten (N = Zahl der hinzugefuegten Karten) — seine Hand haelt deshalb N Preis-Karten mehr; sonst wie W75.
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/b-03-control-monitors-tutor-quellen.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler;
(async () => {
  const R = H.runner();
  // Cute Dog: 2 Abwuerfe -> 2 Karten -> EIN Fenster, beide geloescht
  R.section('Cute Dog 2 Abwuerfe / 2 Karten');
  let t = await H.fresh({ active: 1, hand: [['Control Monitors', F, F], [F, F, 'Fireball']], deck: [[], ['Cute Hydra', 'Cute Phoenix', F, F, F]] });
  t.grantFor(0, 0, 'Control Monitors');
  const dog = t.put(1, 0, 0, 'Cute Dog'); dog.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable', answer: () => ({ cardName: F, handIndex: t.pile(1, 'hand').indexOf(F) }) });
  t.phase(2); await t.activateCreature(1, 0, 0);
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.note('piles', JSON.stringify({ h1: t.pile(1, 'hand'), del1: t.pile(1, 'deletedPile'), dis1: t.pile(1, 'discardPile') }));
  R.check('beide geloescht', t.pile(1, 'deletedPile').includes('Cute Hydra') && t.pile(1, 'deletedPile').includes('Cute Phoenix'), t.pile(1, 'deletedPile'));
  R.check('genau ein Monitors-Fenster', t.lg('control_monitors').length === 1, t.lg('control_monitors').length);
  R.check('keine Fehler', t.errors.length === 0, t.errors);
  R.check('audit', t.audit().length === 0, t.audit());

  // Cute Dog: 1 Abwurf, 1 Karte
  R.section('Cute Dog 1 Abwurf / 1 Karte');
  t = await H.fresh({ active: 1, hand: [['Control Monitors', F], [F, 'Fireball']], deck: [[], ['Cute Hydra', F, F, F]] });
  t.grantFor(0, 0, 'Control Monitors');
  const dog2 = t.put(1, 0, 0, 'Cute Dog'); dog2.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable', answer: (d) => d.type === 'forceDiscardCancellable' ? { cancelled: true } : ({ cardName: F, handIndex: t.pile(1, 'hand').indexOf(F) }) });
  t.phase(2); await t.activateCreature(1, 0, 0);
  R.check('1 Karte geloescht', t.pile(1, 'deletedPile').includes('Cute Hydra'), t.pile(1, 'deletedPile'));

  // Cute Dog: 2 Abwuerfe aber nur 1 passende Karte im Deck -> nicht gleiche Anzahl -> kein Fenster
  R.section('Cute Dog 2 Abwuerfe / nur 1 gefunden -> kein Fenster');
  t = await H.fresh({ active: 1, hand: [['Control Monitors', F], [F, F, 'Fireball']], deck: [[], ['Cute Hydra', F, F, F]] });
  t.grantFor(0, 0, 'Control Monitors');
  const dog3 = t.put(1, 0, 0, 'Cute Dog'); dog3.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable', answer: () => ({ cardName: F, handIndex: t.pile(1, 'hand').indexOf(F) }) });
  t.phase(2); await t.activateCreature(1, 0, 0);
  R.note('piles', JSON.stringify({ h1: t.pile(1, 'hand'), del1: t.pile(1, 'deletedPile'), dis1: t.pile(1, 'discardPile') }));
  R.check('nur 1 Karte moeglich -> 1 Abwurf / 1 Karte -> Fenster', t.lg('control_monitors').length === 1, t.pile(1, 'deletedPile'));

  // Inventing Lv3
  R.section('Inventing Lv3');
  t = await H.fresh({ active: 1, hand: [['Control Monitors', F], [F, 'Fireball']], deck: [[], ['Cute Hydra', F, F, F]], abilities: { 1: { 0: [[], ['Inventing', 'Inventing', 'Inventing'], []] } } });
  t.grantFor(0, 0, 'Control Monitors');
  R.note('inv', JSON.stringify(t.gs.players[1].abilityZones[0]));
  t.script.push({ match: d => d.type === 'forceDiscardCancellable' || d.type === 'forceDiscard', answer: () => ({ cardName: F, handIndex: 0 }) });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title !== 'Control Monitors', answer: (d) => ({ optionId: d.options[d.options.length - 1].id }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Inventing/.test(d.title || ''), answer: () => ({ cardName: 'Cute Hydra' }) });
  t.gs.activePlayer = 1; t.phase(2); const ra = await t.run(() => t.host.doActivateFreeAbility(t.room, 1, { heroIdx: 0, zoneIdx: 1 }));
  R.note('ra', JSON.stringify(ra));
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.note('piles', JSON.stringify({ h1: t.pile(1, 'hand'), del1: t.pile(1, 'deletedPile'), dis1: t.pile(1, 'discardPile') }));
  R.check('Inventing: Cute Hydra geloescht', t.pile(1, 'deletedPile').includes('Cute Hydra'), t.pile(1, 'deletedPile'));
  R.check('keine Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
