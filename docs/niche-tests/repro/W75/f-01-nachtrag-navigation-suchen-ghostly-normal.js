'use strict';
// W75 · Nachtrag (Al): (1) Navigation löst Control Monitors aus, (2) Atta: Aufdecken per Magnetic Glove / Angry Cheese zählt, (3) Ghostly Warning nur gegen Normal Spells.
// Kartentexte: Control Monitors „… when your opponent adds 1 or more cards from their deck or discard pile to their hand by discarding the same number of cards …";
//   Atta „… when you reveal exactly 1 Normal Spell from your deck or hand that this Hero can use, except by the effect of an Ability, you may delete that Spell. …";
//   Ghostly Warning „Play this card immediately when an opponent's Hero uses a Normal Spell. Negate that Spell and delete it. …"
// W72a: der Reaktionsspieler zahlt N weitere Handkarten — Seat 0 haelt deshalb eine Preis-Karte (F) mehr.
// Erwartet: laut Kartentext und Rulings von Al (Welle 75). Aufruf: node docs/niche-tests/repro/W75/f-01-nachtrag-navigation-suchen-ghostly-normal.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler, ATTA = 'Atta, Speaker of Desires';
(async () => {
  const R = H.runner();

  R.section('Navigation Lv3 (2 Kopien weg, 1 Karte hinzu) → Control Monitors loescht die Karte');
  let t = await H.fresh({ active: 1, hand: [['Control Monitors', F], [F, F, 'Fireball']], deck: [[], ['Cute Hydra', F, F, F]], abilities: { 1: { 0: [[], ['Navigation', 'Navigation', 'Navigation'], []] } } });
  t.grantFor(0, 0, 'Control Monitors');
  t.script.push({ match: d => d.type === 'forceDiscardCancellable' || d.type === 'forceDiscard', answer: () => ({ cardName: F, handIndex: t.pile(1, 'hand').indexOf(F) }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Navigation/.test(d.title || ''), answer: () => ({ cardName: 'Cute Hydra' }) });
  t.gs.activePlayer = 1; t.phase(2);
  await t.run(() => t.host.doActivateFreeAbility(t.room, 1, { heroIdx: 0, zoneIdx: 1 }));
  await t.drain();
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.note('piles', JSON.stringify({ h1: t.pile(1, 'hand'), del1: t.pile(1, 'deletedPile'), dis1: t.pile(1, 'discardPile') }));
  R.check('Cute Hydra geloescht', t.pile(1, 'deletedPile').includes('Cute Hydra') && !t.pile(1, 'hand').includes('Cute Hydra'), [t.pile(1, 'hand'), t.pile(1, 'deletedPile')]);
  R.check('genau ein Monitors-Fenster', t.lg('control_monitors').length === 1, t.lg('control_monitors').length);
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('Navigation ohne Control Monitors: Karte bleibt auf der Hand');
  t = await H.fresh({ active: 1, hand: [[F], [F, F, 'Fireball']], deck: [[], ['Cute Hydra', F, F, F]], abilities: { 1: { 0: [[], ['Navigation', 'Navigation', 'Navigation'], []] } } });
  t.script.push({ match: d => d.type === 'forceDiscardCancellable' || d.type === 'forceDiscard', answer: () => ({ cardName: F, handIndex: t.pile(1, 'hand').indexOf(F) }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Navigation/.test(d.title || ''), answer: () => ({ cardName: 'Cute Hydra' }) });
  t.gs.activePlayer = 1; t.phase(2);
  await t.run(() => t.host.doActivateFreeAbility(t.room, 1, { heroIdx: 0, zoneIdx: 1 }));
  await t.drain();
  R.check('Cute Hydra auf der Hand', t.pile(1, 'hand').includes('Cute Hydra'), t.pile(1, 'hand'));

  R.section('Atta + Magnetic Glove (Suche per Artefakt): Fireball wird aufgedeckt → Angebot');
  const scene = async (artifact, extraDeck = []) => {
    const x = await H.fresh({ active: 0, heroes: [[ATTA, null, null], null], hand: [[artifact, F], [F]], deck: [['Fireball', F, F, F, ...extraDeck], Array(10).fill(F)] });
    x.grantFor(0, 0, 'Fireball');
    x.policy.confirm = true;
    return x;
  };
  t = await scene('Magnetic Glove');
  t.script.push({ match: d => d.type === 'cardGallery' && /Magnetic Glove/.test(d.title || ''), answer: () => ({ cardName: 'Fireball' }) });
  t.phase(2);
  await t.play(0, 'Magnetic Glove', { hero: 0, noGrant: true });
  await t.drain();
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.check('Atta bot das Loeschen an → Fireball geloescht', t.pile(0, 'deletedPile').includes('Fireball'), [t.pile(0, 'hand'), t.pile(0, 'deletedPile')]);
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('Atta + Angry Cheese (Suche nach Destruction Magic Spell)');
  t = await scene('Angry Cheese');
  t.script.push({ match: d => d.type === 'cardGallery' && /Angry Cheese/.test(d.title || ''), answer: () => ({ cardName: 'Fireball' }) });
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0) || valid[0]).id];
  t.phase(2);
  await t.play(0, 'Angry Cheese', { hero: 0, noGrant: true });
  await t.drain();
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.check('Atta bot das Loeschen an → Fireball geloescht', t.pile(0, 'deletedPile').includes('Fireball'), [t.pile(0, 'hand'), t.pile(0, 'deletedPile')]);
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('Ghostly Warning: nur Normal Spells');
  t = await H.fresh({ active: 1, hand: [['Ghostly Warning'], [F]] });
  const gw = require('../../../../cards/effects/ghostly-warning');
  const link = (cardName) => ({ chain: [{ cardType: 'Spell', cardName, owner: 1, heroIdx: 0, isInitialCard: true }] });
  R.check('Fireball (Normal) → Reaktion moeglich', gw.reactionCondition(t.gs, 0, t.engine, link('Fireball')) === true);
  R.check('Shamanic Curse (Reaction) → keine Reaktion', gw.reactionCondition(t.gs, 0, t.engine, link('Shamanic Curse')) === false);
  R.check('Ghostly Warning (Reaction) → keine Reaktion', gw.reactionCondition(t.gs, 0, t.engine, link('Ghostly Warning')) === false);
  R.finish();
})();
