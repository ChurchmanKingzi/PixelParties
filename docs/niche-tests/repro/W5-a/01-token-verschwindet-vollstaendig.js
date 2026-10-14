'use strict';
// W5-a-01 · Tokens, die das Brett verlassen, verschwinden VOLLSTÄNDIG (Entscheidung Welle 5, Al 14.10.2026; ersetzt M01-08/Z5-Konvention „→ Gelöscht-Stapel")
// Al: „Sterbende Tokens sollten komplett verschwinden, außer wenn 'darunter' noch echte Karten liegen, etwa bei Biomancy Tokens; die werden dann gelöscht."
// Gilt für Mummy/Invader/Leprochaun/Pollution Token, Puppets (reine Tokens, keine Karte darunter) – kein Eintrag in Hand/Deck/Ablage/Gelöscht-Stapel, keine Geister-Instanz.
// Biomancy-/Boulder-Token liegen UNTER dem Namen einer Potion: diese echte Karte wird gelöscht (Gelöscht-Stapel des permanenten Besitzers, genau einmal).
// Wege: Schaden, actionDestroyCard, actionMoveCard (→ Ablage / → Hand), Inselabbau, gestohlener Token.
const H = require('../../lib/h.js');
const { placeBiomancyToken } = require('../../../../cards/effects/_biomancy-shared.js');
const ALL = ['hand', 'mainDeck', 'discardPile', 'deletedPile'];
const nirgends = (t, nm) => [0, 1].every(s => ALL.every(k => !t.pile(s, k).includes(nm)));
const anzahl = (t, s, k, nm) => t.pile(s, k).filter(n => n === nm).length;
(async () => {
  const R = H.runner();
  const TOKENS = ['Mummy Token', 'Invader Token', 'Leprochaun Token', 'Pollution Token'];
  for (const tok of TOKENS) {
    R.section(`${tok}: Schaden / Zerstören / Ablage / Hand`);
    for (const weg of ['schaden', 'destroy', 'nachAblage', 'nachHand']) {
      const t = await H.fresh({ hand: [[], []], hp: 800 });
      const c = t.put(1, 0, 0, tok);
      const c0 = t.census();
      if (weg === 'schaden') await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0, heroIdx: 0 }, c, 9999, 'spell'));
      if (weg === 'destroy') await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 0, heroIdx: 0 }, c));
      if (weg === 'nachAblage') await t.run(() => t.engine.actionMoveCard(c, 'discard'));
      if (weg === 'nachHand') await t.run(() => t.engine.actionMoveCard(c, 'hand'));
      R.check(`${tok}/${weg}: Brett leer`, !t.zone(1, 0, 0), t.zone(1, 0, 0));
      R.check(`${tok}/${weg}: in KEINEM Stapel (Hand/Deck/Ablage/Gelöscht)`, nirgends(t, tok), { del: t.pile(1, 'deletedPile'), disc: t.pile(1, 'discardPile'), hand: t.pile(1, 'hand') });
      R.check(`${tok}/${weg}: keine Instanz mehr (auch kein Geist im Gelöscht-Stapel)`, !t.engine.cardInstances.some(i => i.name === tok), t.engine.cardInstances.filter(i => i.name === tok).map(i => i.zone));
      R.check(`${tok}/${weg}: Zustand sauber, keine Engine-Fehler`, t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
      const diff = t.censusDiff(c0, t.census());
      R.check(`${tok}/${weg}: Bilanz = nur der Token fehlt`, diff.length === 1 && diff[0].startsWith(tok + ': -1'), diff);
    }
  }

  R.section('Gestohlener Token: nichts beim Dieb, nichts beim Besitzer');
  {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    const c = t.put(1, 0, 0, 'Mummy Token');
    await t.engine.actionStealCreature(0, c); await H.sleep(250);
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1, heroIdx: 0 }, c));
    R.check('gestohlener Mummy Token: in keinem Stapel', nirgends(t, 'Mummy Token'), { del0: t.pile(0, 'deletedPile'), del1: t.pile(1, 'deletedPile') });
    R.check('Zustand sauber', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
  }

  R.section('Biomancy-Token (Potion darunter): die ECHTE Karte wird gelöscht – Gelöscht-Stapel des Besitzers, genau einmal');
  for (const weg of ['schaden', 'destroy', 'nachAblage', 'nachHand']) {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    const inst = (await placeBiomancyToken(t.engine, 0, 0, 'Healing Potion', 1, { slot: 0, animate: false })).inst;
    R.check(`bio/${weg}: Vorbedingung Token liegt (Potion-Name + Token-Override)`, !!inst && t.engine.isTokenCard(inst) && t.engine.tokenUnterkarte(inst) === 'Healing Potion', !!inst);
    const c0 = t.census();
    if (weg === 'schaden') await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, inst, 9999, 'spell'));
    if (weg === 'destroy') await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1, heroIdx: 0 }, inst));
    if (weg === 'nachAblage') await t.run(() => t.engine.actionMoveCard(inst, 'discard'));
    if (weg === 'nachHand') await t.run(() => t.engine.actionMoveCard(inst, 'hand'));
    R.check(`bio/${weg}: Potion genau einmal im Gelöscht-Stapel des Besitzers`, anzahl(t, 0, 'deletedPile', 'Healing Potion') === 1, t.pile(0, 'deletedPile'));
    R.check(`bio/${weg}: Potion NICHT in Hand/Ablage/Deck`, ['hand', 'discardPile', 'mainDeck'].every(k => !t.pile(0, k).includes('Healing Potion')) && !t.pile(1, 'deletedPile').includes('Healing Potion'), { hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile') });
    R.check(`bio/${weg}: Brett leer, Zustand sauber`, !t.zone(0, 0, 0) && t.audit().length === 0 && t.errors.length === 0, { z: t.zone(0, 0, 0), a: t.audit(), e: t.errors });
    const diff = t.censusDiff(c0, t.census());
    R.check(`bio/${weg}: Bilanz ±0 (Potion wanderte vom Brett in den Gelöscht-Stapel)`, diff.length === 0, diff);
  }

  R.section('Inselabbau mit Mummy Token in der Insel-Zone');
  {
    const t = await H.fresh({ hand: [['Flying Island in the Sky'], []], hp: 800 });
    await t.play(0, 'Flying Island in the Sky', { hero: 0 });
    t.put(0, 0, 3, 'Mummy Token');
    await t.engine.actionMoveCard(t.find('Flying Island in the Sky', 'support'), 'discard');
    R.check('Inselabbau: Token in keinem Stapel, Insel in der Ablage', nirgends(t, 'Mummy Token') && t.pile(0, 'discardPile').includes('Flying Island in the Sky'), { disc: t.pile(0, 'discardPile'), del: t.pile(0, 'deletedPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
