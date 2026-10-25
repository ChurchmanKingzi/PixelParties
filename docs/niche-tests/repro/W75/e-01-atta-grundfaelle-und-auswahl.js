'use strict';
// W75 · Atta, Speaker of Desires — Aufdecken → Loeschen → verzoegertes Wirken; Zauber von Atta werden geloescht statt abgelegt; genau 1 brauchbarer Normal Spell; Ability-Quellen; einmal pro Zug; Deck-Zone; Atta tot; Celia.
// Kartentext: „Once per turn, when you reveal exactly 1 Normal Spell from your deck or hand that this Hero can use, except by the effect of an Ability, you may delete that Spell. At the end of your opponent's next turn, if this Hero is not defeated and that Spell is still deleted, this Hero immediately uses it as an additional Action, regardless of its level and in spite of any negative status effects. Spells this Hero uses that would be sent to the discard pile are deleted instead."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/e-01-atta-grundfaelle-und-auswahl.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler, ATTA = 'Atta, Speaker of Desires';
const tgt = (owner) => (valid) => [valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === 0).id];
async function scene(o = {}) {
  const t = await H.fresh({ active: o.active ?? 0, heroes: [[ATTA, null, null], null], hand: o.hand || [['Fireball', F], [F, F]], deck: [Array(15).fill(F), Array(15).fill(F)] });
  t.grantFor(0, 0, 'Fireball');
  t.targetFn = tgt(1);
  return t;
}
(async () => {
  const R = H.runner();
  let t = await scene();
  R.section('1) Aufdecken -> Angebot -> Loeschen -> verzoegertes Wirken');
  t.engine.revealToOpponent(0, 'Fireball', { source: 'Test' });
  R.check('vor dem Drain: nichts passiert', t.prompts.length === 0);
  await t.drain();
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.check('Fireball geloescht (Hand)', t.pile(0, 'deletedPile').includes('Fireball') && !t.pile(0, 'hand').includes('Fireball'), [t.pile(0, 'deletedPile'), t.pile(0, 'hand')]);
  R.check('Vormerkung (Atta)', (t.gs._verzoegerteZauber || []).length === 1 && t.gs._verzoegerteZauber[0].kind === 'atta' && t.gs._verzoegerteZauber[0].zugspieler === 1);
  await t.endTurn();   // Ende Zug 5 (Atta-Besitzer)
  R.check('Ende des eigenen Zuges: noch nichts', t.hp(1, 0) === 800, t.hp(1, 0));
  await t.endTurn();   // Ende Zug 6 (Gegner) -> faellig
  R.note('after', JSON.stringify({ hp1: t.hp(1, 0), del0: t.pile(0, 'deletedPile'), dis0: t.pile(0, 'discardPile') }));
  R.check('Atta wirkt Fireball am Ende des gegnerischen Zuges: 150 Schaden', t.hp(1, 0) === 650, t.hp(1, 0));
  R.check('Der gewirkte Zauber wird gelöscht statt abgelegt', t.pile(0, 'deletedPile').includes('Fireball') && !t.pile(0, 'discardPile').includes('Fireball'), [t.pile(0, 'deletedPile'), t.pile(0, 'discardPile')]);
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('2) Ein von Atta gespielter Zauber (Hand) wird geloescht statt abgelegt');
  t = await scene();
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Fireball im Geloescht-Stapel', t.pile(0, 'deletedPile').includes('Fireball') && !t.pile(0, 'discardPile').includes('Fireball'), [t.pile(0, 'deletedPile'), t.pile(0, 'discardPile')]);
  R.check('150 Schaden', t.hp(1, 0) === 650);

  R.section('3) Atta ruhend (gefroren) beim verzoegerten Wirken: wirkt trotzdem, Ersatz „geloescht statt Ablage" gilt nicht');
  t = await scene();
  t.engine.revealToOpponent(0, 'Fireball', { source: 'Test' }); await t.drain();
  await t.endTurn();
  t.heroStatus(0, 0, 'frozen');   // erst jetzt (Frost laeuft sonst am Ende des eigenen Zuges ab)
  await t.endTurn();
  R.check('wirkt trotz Frost (150 Schaden)', t.hp(1, 0) === 650, t.hp(1, 0));
  R.check('Passiv ruht: Fireball in der Ablage', t.pile(0, 'discardPile').includes('Fireball') && !t.pile(0, 'deletedPile').includes('Fireball'), [t.pile(0, 'discardPile'), t.pile(0, 'deletedPile')]);

  R.section('4) Auswahlregeln: genau 1 brauchbarer Normal Spell');
  const reveal = async (hand, names, opts = {}) => {
    const tt = await scene({ hand: [hand, [F]] });
    if (opts.setup) opts.setup(tt);
    tt.engine.meldeAufgedeckt(0, names, { zone: opts.zone || 'hand', source: opts.source ?? 'Test' });
    await tt.drain();
    return tt;
  };
  t = await reveal(['Fireball', 'Fireball'], ['Fireball', 'Fireball']);
  R.check('2 Normal Spells zugleich: kein Angebot', t.prompts.length === 0, t.prompts.length);
  t = await reveal(['Fireball', 'Cute Dog'], ['Fireball', 'Cute Dog']);
  R.check('Spell + Creature: Angebot fuer den Spell', t.pile(0, 'deletedPile').includes('Fireball') && t.prompts.length === 1, [t.pile(0, 'deletedPile'), t.prompts.length]);
  t = await reveal(['Fireball'], ['Fireball'], { source: 'Inventing' });
  R.check('Aufdecken durch eine ABILITY (Inventing): kein Angebot', t.prompts.length === 0 && t.pile(0, 'deletedPile').length === 0, t.prompts.length);
  t = await reveal(['Fireball'], ['Fireball'], { source: 'Inventing Lv3' });
  R.check('Ability mit Stufenzusatz im Titel ("Inventing Lv3"): kein Angebot', t.prompts.length === 0);
  t = await reveal(['Cure'], ['Cure']);
  R.check('Reaction Spell (nicht Normal): kein Angebot', t.prompts.length === 0, t.prompts.length);
  t = await reveal(['Fireball'], ['Fireball'], { setup: (tt) => tt.setAbilities(0, 0, [[], [], []]) });
  R.check('Spell, den Atta nicht wirken kann (kein Level): kein Angebot', t.prompts.length === 0, t.prompts.length);
  t = await reveal(['Fireball', 'Heal'], ['Fireball', 'Heal'], { setup: (tt) => { tt.grantFor(0, 0, 'Fireball'); } });
  R.note('fireball+heal', JSON.stringify({ p: t.prompts.length, del: t.pile(0, 'deletedPile') }));

  R.section('5) Einmal pro Zug, abgelehnt gibt die Sperre zurueck');
  t = await scene({ hand: [['Fireball', 'Fireball', 'Fireball'], [F]] });
  t.script.push({ match: d => d.type === 'confirm' && d.title === ATTA, answer: () => false, once: true });
  t.engine.meldeAufgedeckt(0, ['Fireball'], { source: 'A' }); await t.drain();
  R.check('abgelehnt: nichts geloescht', t.pile(0, 'deletedPile').length === 0);
  t.engine.meldeAufgedeckt(0, ['Fireball'], { source: 'B' }); await t.drain();
  R.check('nach Ablehnung noch einmal moeglich', t.pile(0, 'deletedPile').length === 1, t.pile(0, 'deletedPile'));
  t.engine.meldeAufgedeckt(0, ['Fireball'], { source: 'C' }); await t.drain();
  R.check('danach in diesem Zug gesperrt', t.pile(0, 'deletedPile').length === 1, t.pile(0, 'deletedPile'));
  R.check('Prompts: 2 (abgelehnt, bestaetigt)', t.prompts.filter(p => p.d.title === ATTA).length === 2, t.prompts.length);
  await t.endTurn(); await t.endTurn(); await t.endTurn();
  R.note('turn', t.gs.turn);

  R.section('6) Oberste Deckkarte aufgedeckt (zone deck): geloescht aus dem Deck');
  t = await scene();
  t.setDeck(0, ['Fireball', F, F]);
  t.engine.meldeAufgedeckt(0, ['Fireball'], { zone: 'deck', source: 'Test' }); await t.drain();
  R.check('aus dem Deck geloescht', t.pile(0, 'deletedPile').includes('Fireball') && !t.pile(0, 'mainDeck').includes('Fireball'), [t.pile(0, 'deletedPile'), t.pile(0, 'mainDeck').slice(0, 3)]);

  R.section('7) Atta beim Zugende tot / Spell nicht mehr geloescht / nicht Atta-Spieler');
  t = await scene();
  t.engine.revealToOpponent(0, 'Fireball', { source: 'Test' }); await t.drain();
  t.gs.players[0].heroes[0].hp = 0;
  await t.endTurn(); await t.endTurn();
  R.check('Atta tot: kein Wirken, Spell bleibt geloescht', t.hp(1, 0) === 800 && t.pile(0, 'deletedPile').includes('Fireball'), [t.hp(1, 0), t.pile(0, 'deletedPile')]);
  t = await scene();
  t.engine.meldeAufgedeckt(1, ['Fireball'], { source: 'Test' }); await t.drain();
  R.check('Aufdecken des GEGNERS loest Atta nicht aus', t.prompts.length === 0);

  R.section('8) Mit Celia: negierter Zauber von Atta wird geloescht');
  t = await scene({ active: 0 });
  t.gs.players[1].heroes[0] = { ...t.gs.players[1].heroes[0] };
  const celia = t.put(1, 0, 0, 'Celia, the Class Clown'); celia.turnPlayed = 1;
  await t.play(0, 'Fireball', { hero: 0 });
  R.note('celia', JSON.stringify({ del: t.pile(0, 'deletedPile'), dis: t.pile(0, 'discardPile'), hp1: t.hp(1, 0), prompts: t.prompts.map(p => p.pi + p.d.title) }));
  R.check('negierter Fireball: geloescht statt abgelegt', t.pile(0, 'deletedPile').includes('Fireball') && !t.pile(0, 'discardPile').includes('Fireball'), [t.pile(0, 'deletedPile'), t.pile(0, 'discardPile')]);

  R.section('9) Zusammenspiel mit Ghostly Warning (beide verzoegert, gleiche Karte)');
  t = await scene({ active: 1, hand: [['Fireball', F], ['Fireball', F, F]] });
  t.grantFor(1, 0, 'Fireball');
  t.targetFn = tgt(0);
  t.engine.revealToOpponent(0, 'Fireball', { source: 'Test' }); await t.drain();
  R.check('Atta-Vormerkung steht', (t.gs._verzoegerteZauber || []).length === 1);
  t.targetFn = tgt(0);
  await t.endTurn(); await t.endTurn();
  R.check('keine Fehler', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
