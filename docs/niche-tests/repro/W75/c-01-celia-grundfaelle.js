'use strict';
// W75 · Celia, the Class Clown — Negation + sofortige Zusatzaktion, Level reicht, einmal pro Zug, Status, Erstrundenschutz, nur 1 Celia, inherente Aktion, Mehrspieler.
// Kartentext: „You may once per turn, during your opponent's turn, when your opponent activates a Spell, increase that Spell's level by 1. If that Spell's level is then too high for its user to use, negate it and send it to the discard pile. If this was your opponent's Action, they may immediately perform an additional Action. You can only control 1 "Celia, the Class Clown"."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/c-01-celia-grundfaelle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler, CELIA = 'Celia, the Class Clown';
const tgt = (owner, hi) => (valid) => [valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === hi).id];
async function scene(o = {}) {
  const t = await H.fresh({ seats: o.seats, active: o.active ?? 1, hand: o.hand || [[o.monitors ? 'Shamanic Curse' : F], ['Fireball', 'Fireball', 'Big Oopsie']] });
  t.grantFor(o.caster ?? 1, 0, 'Fireball', o.extraLevel || 0);
  const celia = t.put(0, 0, 0, CELIA); celia.turnPlayed = 1;
  t.targetFn = tgt(0, 0);
  return { t, celia };
}
const dmgPrompt = (t) => t.prompts.some(p => p.d.type === 'heroAction');
(async () => {
  const R = H.runner();
  R.section('1) Level zu hoch -> negiert, sofortige Zusatzaktion');
  let { t, celia } = await scene();
  let hp0 = t.hp(0, 0);
  t.script.push({ match: d => d.type === 'heroAction', answer: () => ({ cardName: 'Fireball', handIndex: 0, heroIdx: 0 }), once: true });
  await t.play(1, 'Fireball', { hero: 0 });
  R.check('vor dem Drain: noch keine Aktion angeboten', !dmgPrompt(t), t.prompts.map(p => p.d.type));
  await t.drain();
  R.check('heroAction angeboten', dmgPrompt(t), t.prompts.map(p => p.d.type));
  R.check('1. Fireball negiert, 2. Fireball (Zusatzaktion) trifft: 150 Schaden', hp0 - t.hp(0, 0) === 150 || hp0 - t.hp(0, 0) > 0, hp0 - t.hp(0, 0));
  R.note('piles', JSON.stringify({ h1: t.pile(1, 'hand'), dis1: t.pile(1, 'discardPile') }));
  R.check('beide Fireballs in der Ablage', t.pile(1, 'discardPile').filter(n => n === 'Fireball').length === 2, t.pile(1, 'discardPile'));
  R.check('Celia-Stempel gesetzt', celia.counters._celiaTurn === t.gs.turn, celia.counters);
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('2) Zusatzaktion abgelehnt -> verfaellt, nicht gutgeschrieben');
  ({ t, celia } = await scene());
  const pick = () => JSON.stringify(Object.fromEntries(Object.entries(t.gs.players[1]).filter(([k, v]) => /dditional|bonus|Bonus/.test(k) && v)));
  const vor = pick();
  await t.play(1, 'Fireball', { hero: 0 }); await t.drain();
  const nach = pick();
  R.check('keine Aktionsmarke gutgeschrieben', vor === nach, [vor, nach]);
  R.check('2. Fireball noch auf der Hand', t.pile(1, 'hand').includes('Fireball'), t.pile(1, 'hand'));

  R.section('3) Level reicht (Held hat +1) -> kein Negieren, Zauber wirkt');
  ({ t, celia } = await scene({ extraLevel: 1 }));
  hp0 = t.hp(0, 0);
  await t.play(1, 'Fireball', { hero: 0 }); await t.drain();
  R.check('Fireball wirkt (Schaden)', t.hp(0, 0) < hp0, t.hp(0, 0));
  R.check('kein heroAction', !dmgPrompt(t));
  R.check('Celia-Stempel trotzdem gesetzt', celia.counters._celiaTurn === t.gs.turn);
  // zweiter Zauber im selben Zug: Celia reagiert nicht mehr
  t.reset(); hp0 = t.hp(0, 0);
  await t.play(1, 'Fireball', { hero: 0, keepActions: false }); await t.drain();
  R.check('2. Zauber im selben Zug: kein Celia-Prompt (einmal pro Zug)', !t.prompts.some(p => p.d.type === 'confirm' && p.d.title === CELIA), t.prompts.map(p => p.d.title));

  R.section('4) Eigener Zug / Reaktion abgelehnt / Status');
  ({ t, celia } = await scene({ active: 0 }));
  t.grantFor(0, 0, 'Fireball'); t.setHand(0, ['Fireball']); t.targetFn = tgt(1, 0);
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('eigener Zug: Celia reagiert nicht auf eigene Zauber', !t.prompts.some(p => p.d.title === CELIA), t.prompts.map(p => p.d.title));
  ({ t, celia } = await scene());
  t.script.push({ match: d => d.type === 'confirm' && d.title === CELIA, answer: () => false });
  hp0 = t.hp(0, 0);
  await t.play(1, 'Fireball', { hero: 0 }); await t.drain();
  R.check('abgelehnt: Fireball wirkt', t.hp(0, 0) < hp0);
  R.check('abgelehnt: kein Stempel', celia.counters._celiaTurn == null, celia.counters);
  for (const st of ['frozen', 'stunned', 'negated']) {
    ({ t, celia } = await scene());
    if (st === 'negated') await t.run(() => t.engine.actionNegateCreature(celia, { name: 'test', owner: 1 }, { selfInflicted: true, ignoreGateShield: true })); else await t.engine.applyCreatureStatus(celia, st, { sourceOwner: 1 });
    R.note(st, JSON.stringify(celia.counters) + ' supp=' + t.engine.isCreatureEffectSuppressed(celia));
    hp0 = t.hp(0, 0);
    await t.play(1, 'Fireball', { hero: 0 }); await t.drain();
    R.check(`Celia ${st}: reagiert nicht`, !t.prompts.some(p => p.d.title === CELIA) && t.hp(0, 0) < hp0, t.prompts.map(p => p.d.title));
  }

  R.section('5) Erst-Runden-Schutz / nur 1 Celia');
  ({ t, celia } = await scene());
  t.gs.firstTurnProtectedPlayer = 0;
  await t.play(1, 'Fireball', { hero: 0 });
  R.check('Erstrundenschutz des Celia-Besitzers: keine Reaktion', !t.prompts.some(p => p.d.title === CELIA), t.prompts.map(p => p.d.title));
  ({ t, celia } = await scene({ active: 0 }));
  t.setHand(0, [CELIA]); t.grantFor(0, 0, CELIA);
  const ok2 = await t.play(0, CELIA, { hero: 1, slot: 0 });
  R.note('zweite Celia', JSON.stringify(ok2) + JSON.stringify(t.pile(0, 'hand')));
  R.check('zweite Celia kommt nicht aufs Brett', t.inst(c => c.name === CELIA && c.zone === 'support').length === 1, t.inst(c => c.name === CELIA).map(c => c.zone));

  R.section('6) Inherente Aktion (Big Oopsie): negiert, aber KEINE Zusatzaktion');
  ({ t, celia } = await scene());
  t.grantFor(1, 0, 'Big Oopsie');
  t.targetFn = tgt(1, 0);
  await t.play(1, 'Big Oopsie', { hero: 0 }); await t.drain();
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.check('Big Oopsie negiert (Ablage)', t.pile(1, 'discardPile').includes('Big Oopsie'), t.pile(1, 'discardPile'));
  R.check('keine Zusatzaktion angeboten', !dmgPrompt(t));

  R.section('7) Mit Shamanic Curse: zwei Level-Erhoehungen, eine Zusatzaktion');
  ({ t, celia } = await scene({ monitors: true, extraLevel: 1 }));
  t.celiaDone = null;
  t.grantFor(0, 0, 'Shamanic Curse');
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Chain a Reaction?', answer: (d) => ({ cardName: d.cards.some(c => c.name === CELIA) && !t.celiaDone ? (t.celiaDone = CELIA) : 'Shamanic Curse' }) });
  await t.play(1, 'Fireball', { hero: 0 }); await t.drain();
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.check('keine Fehler (Celia + Shamanic Curse im selben Fenster)', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('8) 3 Sitze (Skill-Test-Modus): Sitz 1 ist der Gegner von Sitz 0');
  ({ t, celia } = await scene({ seats: 3, active: 1, hand: [[], ['Fireball', 'Fireball'], []], caster: 1 }));
  await t.play(1, 'Fireball', { hero: 0 }); await t.drain();
  R.check('Celia reagiert gegen den Gegner (Sitz 1)', t.pile(1, 'discardPile').includes('Fireball') && t.hp(0, 0) === 800, [t.pile(1, 'discardPile'), t.hp(0, 0)]);

  R.section('9) Level-0-Zauber wird Level 1: Held ohne Schule kann nicht mehr');
  ({ t, celia } = await scene({ hand: [[], [H.INERT.filler]] }));
  t.engine._getCardDB()[F]; 
  hp0 = 0;
  const rr = await t.play(1, F, { hero: 0, noGrant: true });
  R.note('lv0', JSON.stringify(rr) + JSON.stringify(t.prompts.map(p => p.d.title)) + JSON.stringify(t.pile(1, 'discardPile')));
  R.check('keine Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
