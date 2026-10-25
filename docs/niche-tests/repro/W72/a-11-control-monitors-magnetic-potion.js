'use strict';
// W72a · Control Monitors — Magnetic Potion (kein Abwurf!) loest das Fenster aus; BEIDE Sitze.
// Fehlerbericht Al: „Die Puzzle-CPU aktiviert, trotz eines Heroes, der das koennte, nie ‚Control Monitors' in Reaktion auf meine Magnetic Potion.
//   Die Erwartung ist: Ich fuege eine Karte meiner Hand hinzu, also sollte Monitors eingesetzt werden und die nehmen!"
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand by discarding the same number of cards from your hand.
//   Delete the cards your opponent added. Your opponent may delete all other cards in their hand instead."
// Auslegung (Al): Ausloeser = JEDES Hinzufuegen aus Deck/Ablage; „by discarding the same number of cards from your hand" = Preis des REAKTIONSSPIELERS (N weitere Handkarten, zusaetzlich zu Control Monitors).
// Erwartet: Monitors-Fenster nach der Potion; N=1 → der Reaktionsspieler waehlt 1 Handkarte als Preis; die hinzugefuegte Karte wird geloescht. Aufruf: node …/a-11-….js (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler;
const MC = 'Control Monitors';
const fenster = (t) => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === MC && !p.sim);
const preisWahl = (t) => t.prompts.filter(p => p.d.type === 'handPick' && p.d.title === MC && !p.sim);

async function szene(M, o = {}) {
  const A = 1 - M;
  const hand = [[], []]; hand[M] = o.handM || [MC, F, 'Fireball']; hand[A] = o.handA || [F];
  const deck = [[], []]; deck[A] = o.deckA || ['Fireball', F, F, F]; deck[M] = [F, F, F];
  const t = await H.fresh({ active: A, hand, deck, gold: [100, 100] });
  if (!o.keinHeld) t.grantFor(M, 0, MC);
  return t;
}

(async () => {
  const R = H.runner();
  for (const M of [0, 1]) {
    const A = 1 - M;
    R.section(`Sitz ${M} haelt Monitors, Sitz ${A} spielt Magnetic Potion`);
    const t = await szene(M);
    t.script.push({ match: d => d.type === 'handPick' && d.title === MC, answer: (d, pi) => ({ selectedCards: [{ handIndex: t.pile(pi, 'hand').indexOf(F), cardName: F }] }), once: true });
    await t.play(A, 'Magnetic Potion');
    await t.drain();
    R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
    R.check('Fenster fuer Control Monitors geoeffnet (Bestaetigung an den Monitors-Besitzer)', fenster(t).length === 1 && fenster(t)[0].pi === M, t.prompts.map(p => p.pi + p.d.type));
    R.check('Abwurfwahl (Preis) wird dem Reaktionsspieler gestellt, N=1', preisWahl(t).length === 1 && preisWahl(t)[0].pi === M && preisWahl(t)[0].d.minSelect === 1, preisWahl(t).map(p => p.pi));
    R.check('die hinzugefuegte Karte (Fireball) liegt im Geloescht-Stapel des Hinzufuegenden', t.pile(A, 'deletedPile').includes('Fireball') && !t.pile(A, 'hand').includes('Fireball'), { del: t.pile(A, 'deletedPile'), hand: t.pile(A, 'hand') });
    R.check('Control Monitors in der Ablage des Reaktionsspielers, dazu die Preis-Karte (1 Abwurf)', t.pile(M, 'discardPile').includes(MC) && t.pile(M, 'discardPile').filter(n => n === F).length === 1, t.pile(M, 'discardPile'));
    R.check('Rest der Monitors-Hand unveraendert (Fireball bleibt)', t.pile(M, 'hand').join() === 'Fireball', t.pile(M, 'hand'));
    R.check('Magnetic Potion wurde verbraucht (Hard-Once-Per-Turn gestempelt)', !t.pile(A, 'hand').includes('Magnetic Potion'));
    R.check('keine Fehler', t.errors.length === 0, t.errors);
    R.check('audit', t.audit().length === 0, t.audit());
  }

  R.section('Ohne Held, der Control Monitors wirken kann → kein Angebot');
  {
    const t = await szene(0, { keinHeld: true });
    await t.play(1, 'Magnetic Potion'); await t.drain();
    R.check('kein Fenster', fenster(t).length === 0, t.prompts.map(p => p.pi + p.d.type));
    R.check('Fireball bleibt auf der Hand', t.pile(1, 'hand').includes('Fireball'));
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
