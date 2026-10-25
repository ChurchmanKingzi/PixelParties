'use strict';
// W75 · Control Monitors — Cute Annoyance Mini (Rider entfaellt), Lunatic-Kostensenkung entfaellt, Ambush the Scout negiert das Loeschen.
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand by discarding the same number of cards from your hand. Delete the cards your opponent added. Your opponent may delete all other cards in their hand instead."
// W72a: der Reaktionsspieler zahlt N weitere Handkarten — seine Hand haelt deshalb eine Preis-Karte mehr (Ambush-Fall: 1 Preis + 2 durch Ambush); sonst wie W75.
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/b-04-control-monitors-rider-kosten-ambush.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler;
const HM = 'Lunatic Cycle - Half Moon', NM = 'Lunatic Cycle - New Moon';
(async () => {
  const R = H.runner();
  // Mini: ohne Monitors -> Rider moeglich; mit Monitors -> kein Rider, nichts beschworen
  for (const mitMonitors of [false, true]) {
    R.section('Cute Annoyance Mini, Monitors=' + mitMonitors);
    const t = await H.fresh({ active: 1, heroes: [null, ['Cute Annoyance Mini', null, null]], hand: [mitMonitors ? ['Control Monitors', F] : [F], [F, F, 'Fireball']], deck: [[], ['Cute Cat', F, F, F]] });
    if (mitMonitors) t.grantFor(0, 0, 'Control Monitors');
    t.grantFor(1, 0, 'Cute Cat');
    t.phase(2); t.gs.activePlayer = 1;
    t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: F, handIndex: t.pile(1, 'hand').indexOf(F) }) });
    t.script.push({ match: d => d.type === 'cardGallery' && /Mini/.test(d.title || ''), answer: () => ({ cardName: 'Cute Cat' }) });
    const r = await t.activateHero(1, 0);
    R.note('r', JSON.stringify(r) + JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
    R.note('piles', JSON.stringify({ h1: t.pile(1, 'hand'), del1: t.pile(1, 'deletedPile'), dis1: t.pile(1, 'discardPile'), z: t.gs.players[1].supportZones[0] }));
    if (mitMonitors) {
      R.check('Cute Cat geloescht', t.pile(1, 'deletedPile').includes('Cute Cat'));
      R.check('kein Rider-Confirm', !t.prompts.some(p => p.d.type === 'confirm' && /summon/i.test(p.d.message || '')), 1);
      R.check('Cute Cat nicht beschworen', !t.gs.players[1].supportZones[0].some(z => z.includes('Cute Cat')));
    } else {
      R.check('(Kontrolle) Rider wurde angeboten', t.prompts.some(p => p.d.type === 'confirm' && /summon/i.test(p.d.message || '')), t.prompts.map(p => p.d.type));
    }
    R.check('keine Fehler', t.errors.length === 0, t.errors);
    R.check('audit', t.audit().length === 0, t.audit());
  }
  // Lunatic: Kostensenkung entfaellt bei geloeschter Karte
  R.section('Lunatic: keine Kostensenkung auf geloeschte Karte');
  let t = await H.fresh({ active: 1, hand: [['Control Monitors', F], [F, 'Fireball']], deck: [[], [HM, F, F]] });
  t.grantFor(0, 0, 'Control Monitors');
  const eq = t.put(1, 0, 0, NM); eq.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: F, handIndex: 0 }), once: true });
  await t.activateEquip(1, 0, 0);
  R.check('keine Kostensenkung gespeichert', Object.keys(t.gs.players[1]._handCostReductions || {}).length === 0, t.gs.players[1]._handCostReductions);
  R.check('Fireball nicht verrutscht', t.pile(1, 'hand').join() === 'Fireball', t.pile(1, 'hand'));

  // Ambush the Scout beim Hinzufuegenden
  R.section('Ambush the Scout negiert das Loeschen');
  t = await H.fresh({ active: 1, hand: [['Control Monitors', F, F, F], [F, 'Ambush the Scout']], deck: [[], [HM, F, F]] });
  t.grantFor(0, 0, 'Control Monitors'); t.grantFor(1, 0, 'Ambush the Scout');
  const eq2 = t.put(1, 0, 0, NM); eq2.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: F, handIndex: 0 }), once: true });
  await t.activateEquip(1, 0, 0);
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.note('piles', JSON.stringify({ h0: t.pile(0, 'hand'), dis0: t.pile(0, 'discardPile'), h1: t.pile(1, 'hand'), del1: t.pile(1, 'deletedPile'), dis1: t.pile(1, 'discardPile') }));
  R.check('Half Moon bleibt (Loeschen negiert)', t.pile(1, 'hand').includes(HM) && !t.pile(1, 'deletedPile').includes(HM), t.pile(1, 'hand'));
  R.check('Monitors-Besitzer wirft 1 Preis-Karte (W72a) + 2 Karten durch Ambush ab = 3', t.pile(0, 'discardPile').filter(n => n === F).length === 3, t.pile(0, 'discardPile'));
  R.check('keine Fehler', t.errors.length === 0, t.errors);
  R.check('audit', t.audit().length === 0, t.audit());
  R.finish();
})();
