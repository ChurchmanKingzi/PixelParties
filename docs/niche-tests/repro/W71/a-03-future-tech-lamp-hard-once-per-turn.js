'use strict';
// W71a · Punkt 1 · Al: „Future Tech Lamp: hard once per turn." Neuer Text (wörtlich):
//   „Look at as many of the top cards of your deck as there are "Future Tech Lamp" cards in your discard pile +1. Add all Artifacts you find among those cards to your hand and shuffle the
//    rest of the cards back into your deck. You can only play 1 "Future Tech Lamp" per turn."
// Erwartet (beide Sitze): zweite Lamp im selben Zug gesperrt (bleibt auf der Hand; `canActivate` false = ausgegraut, CPU-/Server-Gate gleich), nächster eigener Zug frei, eine GANZ negierte Lamp
//   (Rusty Touch) stempelt nicht (Z7b), Gegenprobe: andere Artefakte (und andere Future-Tech-Karten) bleiben unberührt, der Lamp-Stempel gilt je Spieler.
const fs = require('fs');
const path = require('path');
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const LAMP = 'Future Tech Lamp';
const TEXT = 'Look at as many of the top cards of your deck as there are "Future Tech Lamp" cards in your discard pile +1. Add all Artifacts you find among those cards to your hand and shuffle the rest of the cards back into your deck. You can only play 1 "Future Tech Lamp" per turn.';
(async () => {
  const R = H.runner();
  const karten = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'data', 'cards.json'), 'utf8'));
  const lampe = karten.find(c => c.name === LAMP);
  R.check('Kartentext wörtlich (ohne Zeilenumbruch, mit Sperrsatz)', lampe && lampe.effect === TEXT, lampe && lampe.effect);

  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const mk = (extra = {}) => {
      const deck = ['ZZ Trinket', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Trinket', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'];
      const hand = [LAMP, LAMP, 'Heart of the Mountain'];
      return H.fresh({ hand: me === 0 ? [hand, extra.opHand || []] : [extra.opHand || [], hand], deck: me === 0 ? [deck, deck] : [deck, deck], gold: [100, 100], ...(me ? { active: 1 } : {}) });
    };
    const script = H.loadCardEffect(LAMP);

    // ── 1) zweite Lamp im selben Zug gesperrt ──
    {
      const t = await mk();
      R.check('vorher: canActivate true, Hand-Liste (getUnactivatableArtifacts) enthält die Lamp nicht', script.canActivate(t.gs, me, t.engine) === true && !t.engine.getUnactivatableArtifacts(me).includes(LAMP), t.engine.getUnactivatableArtifacts(me));
      const r1 = await t.play(me, LAMP);
      R.check('erste Lamp gespielt: eine Lamp weg, eine in der Ablage, Artefakte aus den oberen Karten auf der Hand', r1 === true && t.pile(me, 'hand').filter(n => n === LAMP).length === 1 && t.pile(me, 'discardPile').filter(n => n === LAMP).length === 1, { r1, hand: t.pile(me, 'hand'), abl: t.pile(me, 'discardPile') });
      R.check('Stempel gesetzt (HOPT "Future Tech Lamp:' + me + '")', t.gs.hoptUsed && t.gs.hoptUsed[LAMP + ':' + me] === t.gs.turn, t.gs.hoptUsed);
      const handVor = t.pile(me, 'hand').slice(), deckVor = t.pile(me, 'mainDeck').slice();
      const r2 = await t.play(me, LAMP);
      R.check('zweite Lamp im selben Zug: nicht gespielt (bleibt auf der Hand, Deck unverändert)', r2 !== true && t.pile(me, 'hand').filter(n => n === LAMP).length === 1 && t.pile(me, 'discardPile').filter(n => n === LAMP).length === 1 && JSON.stringify(t.pile(me, 'mainDeck')) === JSON.stringify(deckVor) && JSON.stringify(t.pile(me, 'hand')) === JSON.stringify(handVor), { r2, hand: t.pile(me, 'hand'), abl: t.pile(me, 'discardPile') });
      R.check('canActivate false (Server-/CPU-Gate), Hand-Liste meldet die Lamp als nicht aktivierbar (ausgegraut)', script.canActivate(t.gs, me, t.engine) === false && t.engine.getUnactivatableArtifacts(me).includes(LAMP), t.engine.getUnactivatableArtifacts(me));
      // Gegenprobe: ein anderes Artefakt ist vom Lamp-Stempel unberührt
      R.check('Gegenprobe: Heart of the Mountain (anderes Artefakt) bleibt spielbar', !t.engine.getUnactivatableArtifacts(me).includes('Heart of the Mountain'), t.engine.getUnactivatableArtifacts(me));
      const rT = await t.play(me, 'Heart of the Mountain', { keepActions: true });
      R.check('Gegenprobe: Heart of the Mountain wird im selben Zug gespielt', rT === true && !t.pile(me, 'hand').includes('Heart of the Mountain'), { rT, hand: t.pile(me, 'hand') });
      // Gegner-Stempel getrennt
      R.check('der Stempel gilt nur für den eigenen Spieler (Gegner kann Lamp spielen)', script.canActivate(t.gs, op, t.engine) === true);
      R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
      // ── nächster eigener Zug frei ──
      await t.endTurn(); await t.endTurn();
      R.check('im nächsten eigenen Zug wieder spielbar (canActivate true)', script.canActivate(t.gs, me, t.engine) === true && !t.engine.getUnactivatableArtifacts(me).includes(LAMP), { turn: t.gs.turn, hopt: t.gs.hoptUsed });
      const r3 = await t.play(me, LAMP);
      R.check('im nächsten Zug gespielt (Ablage: 2 Lamps)', r3 === true && t.pile(me, 'discardPile').filter(n => n === LAMP).length === 2, { r3, abl: t.pile(me, 'discardPile') });
      R.check('Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }

    // ── 2) ganz negierte Lamp (Rusty Touch) stempelt nicht — Z7b ──
    {
      const t = await mk({ opHand: ['Rusty Touch'] });
      t.grantFor(op, 0, 'Rusty Touch');
      t.policy.confirm = true;
      await t.play(me, LAMP);
      const negiert = t.pile(op, 'discardPile').includes('Rusty Touch') && t.pile(me, 'discardPile').includes(LAMP);
      R.check('erste Lamp ganz negiert (Rusty Touch), Kosten bezahlt', negiert, { abl: t.pile(me, 'discardPile'), opAbl: t.pile(op, 'discardPile') });
      R.check('negierte Lamp stempelt nicht (canActivate bleibt true)', script.canActivate(t.gs, me, t.engine) === true && !(t.gs.hoptUsed && t.gs.hoptUsed[LAMP + ':' + me] === t.gs.turn), t.gs.hoptUsed);
      t.policy.confirm = false; t.reset();
      const r2 = await t.play(me, LAMP, { keepActions: true });
      R.check('zweite Lamp im selben Zug wirkt (Ablage hat beide Lamps, Stempel jetzt gesetzt)', r2 === true && t.pile(me, 'discardPile').filter(n => n === LAMP).length === 2 && script.canActivate(t.gs, me, t.engine) === false, { r2, abl: t.pile(me, 'discardPile') });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    }

    // ── 3) Abbruch/Leerlauf: Deck leer → nicht spielbar, kein Stempel ──
    {
      const t = await mk();
      t.setDeck(me, []);
      R.check('leeres Deck: Lamp nicht spielbar, kein Stempel', script.canActivate(t.gs, me, t.engine) === false && !(t.gs.hoptUsed && t.gs.hoptUsed[LAMP + ':' + me]), t.gs.hoptUsed);
      const r = await t.play(me, LAMP);
      R.check('Lamp bleibt auf der Hand', r !== true && t.pile(me, 'hand').filter(n => n === LAMP).length === 2 && !(t.gs.hoptUsed && t.gs.hoptUsed[LAMP + ':' + me]), { r, hand: t.pile(me, 'hand') });
    }

    // ── 4) Lamp-Zählung unverändert (X+1, Rest gemischt) ──
    {
      const t = await mk();
      t.setDiscard(me, [LAMP, LAMP]);
      const r = await t.play(me, LAMP);
      const artefakte = t.pile(me, 'hand').filter(n => n === 'ZZ Trinket').length;
      R.check('Zählung unverändert: 2 Lamps in der Ablage → 3 obere Karten angeschaut (2 Trinkets unter den oberen 4, davon 1 unter den oberen 3 → nur das erste)', r === true && artefakte === 1, { r, hand: t.pile(me, 'hand') });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
