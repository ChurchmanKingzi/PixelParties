'use strict';
// W75 · Control Monitors — Grundfaelle: Wahl „alle anderen loeschen", keine anderen Karten, eigener Tutor, Held ohne Schule/gefroren, abgelehnt, Duplikate, 3 Sitze.
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand by discarding the same number of cards from your hand. Delete the cards your opponent added. Your opponent may delete all other cards in their hand instead."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/b-02-control-monitors-grundfaelle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler;
const HM = 'Lunatic Cycle - Half Moon', NM = 'Lunatic Cycle - New Moon';
async function scene(o = {}) {
  const t = await H.fresh({ active: 1, seats: o.seats, hand: o.hand || [['Control Monitors'], [F, 'Fireball', 'Fireball']], deck: o.deck || [[], [HM, F, F, F]] });
  if (!o.noGrant) t.grantFor(0, 0, 'Control Monitors');
  const eq = t.put(1, 0, 0, NM); eq.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: o.discardName || F, handIndex: o.discardIdx ?? 0 }), once: true });
  return t;
}
(async () => {
  const R = H.runner();
  // 2) Wahl "rest"
  R.section('Wahl: alle anderen Karten loeschen');
  let t = await scene();
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Control Monitors', answer: () => ({ optionId: 'rest' }) });
  await t.activateEquip(1, 0, 0);
  R.check('Half Moon bleibt auf der Hand', t.pile(1, 'hand').includes(HM), t.pile(1, 'hand'));
  R.check('2 Fireball geloescht', t.pile(1, 'deletedPile').filter(n => n === 'Fireball').length === 2, t.pile(1, 'deletedPile'));
  R.check('Hand = nur Half Moon', t.pile(1, 'hand').length === 1, t.pile(1, 'hand'));
  R.check('keine Fehler', t.errors.length === 0, t.errors);
  // 3) keine anderen Handkarten -> keine Wahl
  R.section('Keine anderen Karten -> keine Wahl');
  t = await scene({ hand: [['Control Monitors'], [F]] });
  await t.activateEquip(1, 0, 0);
  R.check('kein optionPicker', !t.prompts.some(p => p.d.type === 'optionPicker'), t.prompts.map(p => p.d.type));
  R.check('Half Moon geloescht', t.pile(1, 'deletedPile').includes(HM));
  // 4) eigener Tutor -> Monitors des Gegners... Monitors beim Tutor-Spieler selbst reagiert nicht
  R.section('Eigener Tutor: Monitors in eigener Hand reagiert nicht');
  t = await scene({ hand: [['Control Monitors'], [F, 'Control Monitors']] });
  t.grantFor(1, 0, 'Control Monitors');
  await t.activateEquip(1, 0, 0);
  R.check('Monitors (Seat 0) reagiert, Seat 1 nicht', t.lg('control_monitors').length === 1, t.lg('control_monitors').length);
  // 5) Held ohne Schule -> kein Fenster
  R.section('Held kann Monitors nicht wirken');
  t = await scene({ noGrant: true });
  await t.activateEquip(1, 0, 0);
  R.check('kein confirm fuer Monitors', !t.prompts.some(p => p.d.type === 'confirm' && p.d.title === 'Control Monitors'), t.prompts.map(p => p.pi + p.d.type));
  R.check('Half Moon bleibt auf der Hand', t.pile(1, 'hand').includes(HM));
  // 6) Nein sagen
  R.section('Reaktion abgelehnt');
  t = await scene();
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Control Monitors', answer: () => false });
  await t.activateEquip(1, 0, 0);
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title||''))));
  R.check('nichts geloescht', t.pile(1, 'deletedPile').length === 0);
  R.check('Monitors noch in Hand', t.pile(0, 'hand').includes('Control Monitors'));
  // 7) Held gefroren
  R.section('Held gefroren');
  t = await scene();
  t.heroStatus(0, 0, 'frozen');
  await t.activateEquip(1, 0, 0);
  R.check('kein Fenster (Held gefroren)', t.lg('control_monitors').length === 0, t.lg('control_monitors'));
  // 8) Duplikate
  R.section('Duplikat der hinzugefuegten Karte auf der Hand');
  t = await scene({ hand: [['Control Monitors'], [F, HM, 'Fireball']] });
  await t.activateEquip(1, 0, 0);
  R.check('genau ein Half Moon geloescht', t.pile(1, 'deletedPile').filter(n => n === HM).length === 1, t.pile(1, 'deletedPile'));
  R.check('anderes Half Moon bleibt', t.pile(1, 'hand').includes(HM), t.pile(1, 'hand'));
  t = await scene({ hand: [['Control Monitors'], [F, HM, 'Fireball']] });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Control Monitors', answer: () => ({ optionId: 'rest' }) });
  await t.activateEquip(1, 0, 0);
  R.check('rest: das alte Half Moon ist eine ANDERE Karte -> nur das hinzugefuegte bleibt', t.pile(1, 'hand').length === 1 && t.pile(1, 'hand')[0] === HM, t.pile(1, 'hand'));
  // 9) Boris? skip. 3 Sitze: Opponents of both
  R.section('3 Sitze');
  t = await H.fresh({ seats: 3, active: 1, hand: [['Control Monitors'], [F, 'Fireball'], ['Control Monitors']], deck: [[], [HM, F, F], []] });
  t.grantFor(0, 0, 'Control Monitors'); t.grantFor(2, 0, 'Control Monitors');
  const eq = t.put(1, 0, 0, NM); eq.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: F, handIndex: 0 }), once: true });
  await t.activateEquip(1, 0, 0);
  R.note('3seat', JSON.stringify({ del: t.pile(1, 'deletedPile'), lg: t.lg('control_monitors').length, prompts: t.prompts.map(p => p.pi + p.d.type) }));
  R.check('Half Moon geloescht (3 Sitze)', t.pile(1, 'deletedPile').includes(HM), t.pile(1, 'deletedPile'));
  R.check('nur einmal geloescht', t.lg('control_monitors').length === 1, t.lg('control_monitors').length);
  R.check('keine Fehler', t.errors.length === 0, t.errors);
  R.check('audit', t.audit().length === 0, t.audit());
  R.finish();
})();
