'use strict';
// A04-cute-20 · Lunar Eclipse: der Spieler kann den abzulegenden „Lunatic Cycle" nicht wählen
//
// Kartentext (Lunar Eclipse): "Activate this Surprise when your opponent activates any card from their hand by sending a 'Lunatic Cycle' card
//   from your side of the board to the discard pile. Negate your opponent's card and delete it. …"
// Erwartung: Der Spieler entscheidet, WELCHE Mondphase geht (jede hat einen anderen Nutzen: New Moon = Tutor, Half Moon = Schadensdeckel,
//   Gibbous = Statusimmunität, Full Moon = +100 ATK; außerdem hängen Lunatic Golem/Hawk an der Zahl VERSCHIEDENER Cycles).
// Beobachtet: Kein Auswahldialog; es wird immer der erste Cycle in der Instanzliste abgelegt (hier New Moon, obwohl auch Full Moon da war).
// Ursache: cards/effects/lunar-eclipse.js `payActivationCost` (Z. 93): `engine.actionMoveCard(insts[0], 'discard')`; Kommentar „All five moons satisfy
//   the cost equally — no benefit to prompting which" stimmt nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 1, hand: [[], ['Fireball']], deck: [Array(6).fill(H.INERT.creature), Array(6).fill(H.INERT.creature)] });
  t.putSurprise(0, 0, 'Lunar Eclipse'); t.grantFor(0, 0, 'Lunar Eclipse');
  t.put(0, 1, 0, 'Lunatic Cycle - New Moon'); t.put(0, 2, 0, 'Lunatic Cycle - Full Moon');
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
  // Der Eclipse-Besitzer möchte den FULL MOON opfern und den New Moon behalten – falls die Engine ihn danach fragt, wählt er so:
  t.script.push({ match: d => /gallery|zonePick|cardPick|optionPicker/i.test(d.type) && /Lunatic|Eclipse/.test(JSON.stringify(d).slice(0, 400)), answer: (d) => ({ cardName: 'Lunatic Cycle - Full Moon', optionId: 'Lunatic Cycle - Full Moon' }) });
  await t.play(1, 'Fireball', { hero: 0 });
  const abgelegt = t.pile(0, 'discardPile').filter(n => n.startsWith('Lunatic Cycle'));
  const fragen = t.prompts.filter(p => p.d.type !== 'confirm').length;
  R.note('abgelegte Cycles / Rückfragen außer Ja-Nein', { abgelegt, fragen });
  R.check('Es gibt eine Auswahl, welcher Cycle abgelegt wird (oder der Spieler konnte Full Moon wählen)', fragen > 0 || abgelegt.includes('Lunatic Cycle - Full Moon'), { abgelegt, fragen });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
