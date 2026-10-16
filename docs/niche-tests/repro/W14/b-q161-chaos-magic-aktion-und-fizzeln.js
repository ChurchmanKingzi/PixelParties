'use strict';
// W14b · Q161 (S01-14, Chaos Magic, die zu einem „Divine Gift" wird) · Al, 16.10.2026: „Chaos Magic verbraucht die Action, die für es aufgewandt wurde, immer, egal, ob der Ziel-Spell additional ist.
//   Und Spells mit bereits verbrauchtem Once-per-Turn/-Game-Stempel werden von ihm zwar gewählt, fizzeln dann aber einfach (also z.B. Divine Gifts, nachdem man schon eines benutzt hat)."
// Erwartet: (a) Chaos Magic wird zu Divine Gift of Biseria („This counts as an additional Action"): die Aktion von Chaos Magic ist verbraucht, ein weiterer Zauber im selben Zug ist NICHT spielbar;
//   (b) Chaos Magic setzt den Einmal-pro-Spiel-Stempel „divineGift"; (c) ist der Stempel schon gesetzt, wird Biseria trotzdem gewählt (aufgedeckt/gelöscht), fizzelt aber sichtbar (card_reveal fizzled),
//   kein Effekt, Chaos Magic ist verbraucht; (d) ebenso ein Zauber mit verbrauchtem „1 pro Zug" (Big Oopsie nach einem Big Oopsie im selben Zug): gewählt, fizzelt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const hero1 = (t) => t.gs.players[1].heroes[0];

  R.section('(a)/(b) Chaos Magic → Divine Gift of Biseria');
  {
    const t = await H.fresh({ hand: [['Chaos Magic', 'Fireball'], []], deck: [['Divine Gift of Biseria'], []] });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Chaos Magic', { hero: 0 });
    R.check('Chaos Magic wirkte als Biseria (Ziel eingefroren)', hero1(t).statuses.frozen != null, Object.keys(hero1(t).statuses));
    R.check('(b) „divineGift" gestempelt', (t.gs.players[0]._oncePerGameUsed || new Set()).has('divineGift'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
    const r = await t.play(0, 'Fireball', { hero: 0, keepActions: true });
    R.check('(a) die Aktion ist verbraucht: ein weiterer Zauber ist NICHT spielbar (Zusatzaktion des Ziel-Spells zählt nicht zusätzlich)', r === false && t.pile(0, 'hand').includes('Fireball'), { r, hand: t.pile(0, 'hand') });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(c) Divine-Gift-Stempel schon verbraucht: gewählt, aber fizzelt');
  {
    const t = await H.fresh({ hand: [['Chaos Magic'], []], deck: [['Divine Gift of Biseria', H.INERT.creature], []] });
    t.gs.players[0]._oncePerGameUsed = new Set(['divineGift']);
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Chaos Magic', { hero: 0 });
    const gewaehlt = t.logs.some(l => l.type === 'chaos_magic_become' && l.data.spell === 'Divine Gift of Biseria');
    R.check('Biseria wurde trotz Stempel gewählt (chaos_magic_become)', gewaehlt, t.logs.filter(l => /chaos/.test(l.type)).map(l => l.type));
    R.check('... und fizzelt sichtbar (card_reveal fizzled), kein Einfrieren', t.events.some(e => e.ev === 'card_reveal' && e.data?.fizzled && e.data.cardName === 'Divine Gift of Biseria') && hero1(t).statuses.frozen == null, { fizz: t.events.filter(e => e.data?.fizzled).length, st: Object.keys(hero1(t).statuses) });
    R.check('Chaos Magic ist verbraucht (Ablage), Biseria gelöscht', t.pile(0, 'discardPile').includes('Chaos Magic') && t.pile(0, 'deletedPile').includes('Divine Gift of Biseria'), { abl: t.pile(0, 'discardPile'), del: t.pile(0, 'deletedPile') });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(d) „1 pro Zug" verbraucht (Big Oopsie)');
  {
    const t = await H.fresh({ hand: [['Chaos Magic'], []], deck: [['Big Oopsie', H.INERT.creature], []] });
    t.gs.hoptUsed = { ...(t.gs.hoptUsed || {}), ['big-oopsie:0']: t.gs.turn };
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    const hp = t.hp(1, 0);
    await t.play(0, 'Chaos Magic', { hero: 0 });
    R.check('Big Oopsie wurde gewählt, fizzelt: kein Schaden, sichtbares Fizzeln', t.logs.some(l => l.type === 'chaos_magic_become' && l.data.spell === 'Big Oopsie') && t.hp(1, 0) === hp && t.events.some(e => e.ev === 'card_reveal' && e.data?.fizzled), { hp: t.hp(1, 0), fizz: t.events.filter(e => e.data?.fizzled).length });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
