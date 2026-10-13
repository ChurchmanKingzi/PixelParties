'use strict';
// A04-cute-27 (C) · Cute Dog: ein ABGELEHNTES Beschwörungsangebot verbraucht das "1 pro Zug"
//
// Kartentext (Cute Dog): "You may immediately summon this Creature as an additional Action when you discard it from your hand. You can only summon 1 "Cute Dog" per turn with this effect."
// Gezählt wird nach Wortlaut das BESCHWÖREN. Beobachtet: Antwort „Nein" (null) auf das Angebot des ersten abgeworfenen Hundes -> der zweite Hund im selben Zug bekommt gar kein Angebot mehr.
// Ursache: cute-dog.js onDiscard: `ps._cuteDogDiscardSummonUsed = true;` direkt nach dem Prompt, „regardless of accept/decline" (Kommentar: „the offer counts as the turn's use") – bewusst so geschrieben, aber nicht als Al-Ruling markiert.
// Frage an Al: Soll schon das Angebot (auch bei „Nein") den Einmal-pro-Zug-Platz verbrauchen – ja oder nein?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Cute Dog', 'Cute Dog'], []], deck: [Array(8).fill(H.INERT.creature), Array(8).fill(H.INERT.creature)] });
  t.grantFor(0, 0, 'Cute Dog');
  t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  let ask = 0;
  t.script.push({ match: d => d.type === 'confirm' && /Cute Dog/.test(d.message || ''), answer: () => (++ask === 1 ? null : { confirmed: true }) });   // echtes „Nein" = null
  await t.run(() => t.engine.actionDiscardHandCard(0, 'Cute Dog', 0, { source: 'Test', selfInflicted: true }));
  R.check('1. Hund: Angebot gemacht, abgelehnt, kein Hund auf dem Brett', ask === 1 && t.inst(x => x.name === 'Cute Dog' && x.zone === 'support').length === 0, { ask });
  await t.run(() => t.engine.actionDiscardHandCard(0, 'Cute Dog', 0, { source: 'Test', selfInflicted: true }));
  R.check('2. Hund im selben Zug: bekommt noch ein Angebot (es wurde ja noch kein Hund beschworen)', ask === 2, { ask });
  R.check('2. Hund steht auf dem Brett', t.inst(x => x.name === 'Cute Dog' && x.zone === 'support').length === 1);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
