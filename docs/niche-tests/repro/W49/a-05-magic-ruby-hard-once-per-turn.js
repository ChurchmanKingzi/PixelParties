'use strict';
// W49a · Punkt 5 · Al, 22.10.2026: „Magic Ruby soll hard once per turn sein (wie die anderen Magic-Gems)."
// Kartentext (wörtlich): „Choose a Hero your opponent controls and Stun it for 1 turn. \nYou may discard a card from your hand to keep this card in your hand instead of putting it into your
//   discard pile after playing it.\nYou can only play 1 "Magic Ruby" per turn."
// Erwartet (beide Sitze): zweiter Ruby im selben Zug nicht spielbar (bleibt auf der Hand), im nächsten eigenen Zug wieder spielbar; Gegenproben: Magic Amethyst und Magic Cobalt verhalten
//   sich gleich und bleiben unverändert; ein anderer Gem (Amethyst) wird vom Ruby-Stempel nicht berührt; ein ganz negierter/abgebrochener Ruby stempelt nicht (Z7b).
const fs = require('fs');
const path = require('path');
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  const karten = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'data', 'cards.json'), 'utf8'));
  const liste = Array.isArray(karten) ? karten : (karten.cards || Object.values(karten));
  const ruby = liste.find(c => c.name === 'Magic Ruby');
  R.check('Kartentext wörtlich', ruby && ruby.effect === 'Choose a Hero your opponent controls and Stun it for 1 turn. \nYou may discard a card from your hand to keep this card in your hand instead of putting it into your discard pile after playing it. You can only play 1 "Magic Ruby" per turn.', ruby && ruby.effect);
  const topaz = liste.find(c => c.name === 'Magic Topaz'), ame = liste.find(c => c.name === 'Magic Amethyst');
  R.check('Gegenprobe: Topaz/Amethyst enden auf demselben Satzbau', /You can only play 1 "Magic Topaz" per turn\.$/.test(topaz.effect) && /You can only play 1 "Magic Amethyst" per turn\.$/.test(ame.effect));

  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    for (const GEM of ['Magic Ruby', 'Magic Cobalt']) {
      const t = await H.fresh({ hand: me === 0 ? [[GEM, GEM, 'Fireball'], []] : [[], [GEM, GEM, 'Fireball']], gold: [500, 500], ...(me ? { active: 1 } : {}) });
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0) || v[0]; return h ? [h.id] : null; };
      t.policy.confirm = false; t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cancelled: true }), once: false });
      const r1 = await t.play(me, GEM, { hero: 0 });
      R.check(GEM + ': erster im Zug gespielt', r1 === true && t.pile(me, 'hand').filter(n => n === GEM).length === 1, { r1, hand: t.pile(me, 'hand') });
      if (GEM === 'Magic Ruby') R.check('Ruby: Gegnerheld 0 betäubt', !!t.hero(op, 0).statuses?.stunned, Object.keys(t.hero(op, 0).statuses || {}));
      const handVor = t.pile(me, 'hand').slice();
      const r2 = await t.play(me, GEM, { hero: 0 });
      R.check(GEM + ': zweiter im selben Zug nicht spielbar (bleibt auf der Hand)', t.pile(me, 'hand').filter(n => n === GEM).length === 1 && t.pile(me, 'discardPile').filter(n => n === GEM).length === 1, { r2, hand: t.pile(me, 'hand'), abl: t.pile(me, 'discardPile') });
      R.check(GEM + ': canActivate meldet false', H.loadCardEffect(GEM).canActivate(t.gs, me, t.engine) === false);
      R.check(GEM + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
      await t.endTurn(); await t.endTurn();
      R.check(GEM + ': im nächsten eigenen Zug wieder spielbar', H.loadCardEffect(GEM).canActivate(t.gs, me, t.engine) === true);
      const r3 = await t.play(me, GEM, { hero: 0 });
      R.check(GEM + ': im nächsten Zug gespielt', r3 === true && t.pile(me, 'hand').filter(n => n === GEM).length === 0, { r3, hand: t.pile(me, 'hand') });
      R.check(GEM + ': Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    // Ruby-Stempel sperrt andere Gems nicht
    { const t = await H.fresh({ hand: me === 0 ? [['Magic Ruby', 'Magic Cobalt'], []] : [[], ['Magic Ruby', 'Magic Cobalt']], gold: [500, 500], ...(me ? { active: 1 } : {}) });
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0) || v[0]; return h ? [h.id] : null; };
      t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cancelled: true }), once: false });
      await t.play(me, 'Magic Ruby', { hero: 0 });
      R.check('Ruby-Stempel sperrt Magic Cobalt nicht', H.loadCardEffect('Magic Cobalt').canActivate(t.gs, me, t.engine) === true); }
    // Abbruch der Zielwahl stempelt nicht (Z7b: ganz abgebrochen = nichts passiert)
    { const t = await H.fresh({ hand: me === 0 ? [['Magic Ruby'], []] : [[], ['Magic Ruby']], gold: [500, 500], ...(me ? { active: 1 } : {}) });
      t.targetFn = () => null;
      await t.play(me, 'Magic Ruby', { hero: 0 });
      R.check('Ruby nach abgebrochener Zielwahl: weiter spielbar, kein Stempel', t.pile(me, 'hand').includes('Magic Ruby') && H.loadCardEffect('Magic Ruby').canActivate(t.gs, me, t.engine) === true, { hand: t.pile(me, 'hand') }); }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
