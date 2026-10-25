'use strict';
// W72a · Control Monitors — Ablehnen, Abbruch der Preiswahl, zu wenige Handkarten, Preis = N weitere Karten (BEIDE Sitze).
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand by discarding the same number of cards from your hand. …"
// Auslegung (Al): „by discarding the same number of cards from your hand" = Preis des Reaktionsspielers; Kosten erst NACH dem Commit (CARD_API „KOSTEN UND LIMITS ERST NACH DEM COMMIT"):
//   die Abwurfkarten werden bei der Aktivierung GEWAEHLT (abbrechbar → nichts passiert) und erst danach bezahlt.
// Erwartet: Ablehnen == Abbruch der Preiswahl (identischer Endzustand, nichts bezahlt, nichts geloescht); zu wenige Karten → kein Angebot; Preis = genau N Karten (N = Zahl der hinzugefuegten Karten).
// Aufruf: node docs/niche-tests/repro/W72/a-12-….js   (Exit 0 = korrekt)
const L = require('../../lib/monitors.js');
const { H, F, MC } = L;

(async () => {
  const R = H.runner();
  for (const M of [0, 1]) {
    const A = 1 - M;
    // ── Ablehnen vs. Abbruch der Preiswahl: gleicher Endzustand, nichts bezahlt ──
    R.section(`Sitz ${M}: Ablehnen und Abbruch der Preiswahl lassen alles unveraendert`);
    const endzustand = {};
    for (const modus of ['ablehnen', 'abbrechen']) {
      const t = await L.szene(M);
      if (modus === 'ablehnen') t.script.push({ match: d => d.type === 'confirm' && d.title === MC, answer: () => false });
      else t.script.push({ match: d => d.type === 'handPick' && d.title === MC, answer: () => ({ cancelled: true }) });
      await t.play(A, 'Magnetic Potion'); await t.drain();
      endzustand[modus] = L.zustand(t);
      R.check(`${modus}: Control Monitors bleibt auf der Hand, nichts abgeworfen`, t.pile(M, 'hand').join() === [MC, F, 'Fireball'].join() && t.pile(M, 'discardPile').length === 0, { hand: t.pile(M, 'hand'), ablage: t.pile(M, 'discardPile') });
      R.check(`${modus}: die hinzugefuegte Karte (Fireball) bleibt auf der Hand des Hinzufuegenden`, t.pile(A, 'hand').includes('Fireball') && !t.pile(A, 'deletedPile').includes('Fireball'), { hand: t.pile(A, 'hand'), geloescht: t.pile(A, 'deletedPile') });
      R.check(`${modus}: genau EIN Angebot, keine Wahl fuer den Hinzufuegenden`, L.fenster(t).length === 1 && L.wahlHinzufuegender(t).length === 0, t.prompts.map(p => p.pi + p.d.type));
      R.check(`${modus}: kein Gold bezahlt, keine Fehler`, t.gs.players[M].gold === 300 && t.errors.length === 0 && t.audit().length === 0, { gold: t.gs.players[M].gold, e: t.errors, a: t.audit() });
      if (modus === 'abbrechen') R.check('abbrechen: die Preiswahl wurde dem Reaktionsspieler gestellt (und abgebrochen)', L.preisWahl(t).length === 1 && L.preisWahl(t)[0].pi === M, L.preisWahl(t).length);
    }
    R.check('Abbruch der Preiswahl == Ablehnen (identischer Spielzustand beider Sitze)', endzustand.ablehnen === endzustand.abbrechen, { a: endzustand.ablehnen, b: endzustand.abbrechen });

    // ── zu wenige Karten ──
    R.section(`Sitz ${M}: Hand des Reaktionsspielers hat keine weitere Karte → kein Angebot (N=1)`);
    let t = await L.szene(M, { handM: [MC] });
    await t.play(A, 'Magnetic Potion'); await t.drain();
    R.check('kein Fenster (Control Monitors allein auf der Hand)', L.fenster(t).length === 0, t.prompts.map(p => p.pi + p.d.type));
    R.check('Fireball bleibt auf der Hand', t.pile(A, 'hand').includes('Fireball'));

    // N=2: Divine Gift of Creation holt 2 Karten mit verschiedenen Namen
    const zweiKarten = (tt) => tt.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Divine Gift of Creation', answer: (d) => {
      const idx = ['Fireball', 'Cute Cat'].map(n => d.cards.findIndex(c => c.name === n)).filter(i => i >= 0);
      return { selectedCards: idx.map(i => d.cards[i].name), selectedIndices: idx };
    } });
    R.section(`Sitz ${M}: 2 hinzugefuegte Karten → Preis 2 weitere Karten; mit nur 1 weiteren Karte kein Angebot`);
    t = await L.szene(M, { handM: [MC, F], deckA: ['Fireball', 'Cute Cat', F, F, F] });
    zweiKarten(t);
    await t.play(A, 'Divine Gift of Creation'); await t.drain();
    R.check('N=2, nur 1 weitere Karte: KEIN Angebot', L.fenster(t).length === 0, t.prompts.map(p => p.pi + p.d.type));
    R.check('beide Karten bleiben auf der Hand', t.pile(A, 'hand').includes('Fireball') && t.pile(A, 'hand').includes('Cute Cat'), t.pile(A, 'hand'));
    t = await L.szene(M, { handM: [MC, F, 'Cute Hydra'], deckA: ['Fireball', 'Cute Cat', F, F, F] });
    zweiKarten(t);
    await t.play(A, 'Divine Gift of Creation'); await t.drain();
    R.check('N=2, 2 weitere Karten: ein Angebot', L.fenster(t).length === 1, t.prompts.map(p => p.pi + p.d.type));
    R.check('Preiswahl verlangt genau 2 Karten (minSelect = maxSelect = 2)', L.preisWahl(t).length === 1 && L.preisWahl(t)[0].d.minSelect === 2 && L.preisWahl(t)[0].d.maxSelect === 2, L.preisWahl(t).map(p => [p.d.minSelect, p.d.maxSelect]));
    R.check('Preis bezahlt: beide Handkarten + Control Monitors in der Ablage des Reaktionsspielers, Hand leer', t.pile(M, 'hand').length === 0 && t.pile(M, 'discardPile').length === 3 && t.pile(M, 'discardPile').includes(MC), { hand: t.pile(M, 'hand'), ablage: t.pile(M, 'discardPile') });
    R.check('beide hinzugefuegten Karten geloescht, EIN Fenster', t.pile(A, 'deletedPile').includes('Fireball') && t.pile(A, 'deletedPile').includes('Cute Cat') && t.lg('control_monitors').length === 1, { g: t.pile(A, 'deletedPile'), l: t.lg('control_monitors').length });
    R.check('keine Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

    // ── die weitere Karte darf auch ein zweites Control Monitors sein ──
    R.section(`Sitz ${M}: Hand [Control Monitors, Control Monitors] → die zweite Kopie ist der Preis`);
    t = await L.szene(M, { handM: [MC, MC] });
    await t.play(A, 'Magnetic Potion'); await t.drain();
    R.check('Angebot; Preiswahl bietet nur die ANDERE Kopie an (eligibleIndices ohne die aktivierende Karte)', L.fenster(t).length === 1 && L.preisWahl(t).length === 1 && L.preisWahl(t)[0].d.eligibleIndices.length === 1, L.preisWahl(t).map(p => p.d.eligibleIndices));
    R.check('beide Kopien in der Ablage, Fireball geloescht', t.pile(M, 'discardPile').filter(n => n === MC).length === 2 && t.pile(A, 'deletedPile').includes('Fireball'), { ab: t.pile(M, 'discardPile'), g: t.pile(A, 'deletedPile') });
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
