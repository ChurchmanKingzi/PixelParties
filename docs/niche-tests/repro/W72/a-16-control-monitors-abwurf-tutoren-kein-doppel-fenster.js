'use strict';
// W72a · Control Monitors — die alten Abwurf-Tutoren (Cute Dog, Cute Annoyance Mini, Life-Searcher, Inventing Lv3, Lunatic Cycle - New Moon, Navigation Lv3) bleiben Ausloeser,
//   melden aber nicht mehr selbst (`meldeHandZugangDurchAbwurf` gibt es nicht mehr): GENAU EIN Fenster je Effekt, auch nach weiteren Nach-Ketten-Aktionen (kein Doppel-Fenster). BEIDE Sitze.
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand by discarding the same number of cards from your hand. …"
// Erwartet: je Tutor genau 1 Hook `onHandAddFromPile` fuer den Hinzufuegenden, 1 Angebot, die hinzugefuegten Karten geloescht; ein zweites `drain` loest nichts mehr aus.
// Aufruf: node docs/niche-tests/repro/W72/a-16-….js   (Exit 0 = korrekt)
const L = require('../../lib/monitors.js');
const { H, F, MC } = L;
const ARGOS = 'Argos, the Eye of the Cosmos', NM = 'Lunatic Cycle - New Moon';

async function bau(M, o) {
  const A = 1 - M;
  const hand = [[], []]; hand[M] = [MC, F, F, F]; hand[A] = o.handA;
  const deck = [[], []]; deck[A] = o.deckA; deck[M] = [F, F, F];
  const heroes = [null, null]; if (o.heldA) { heroes[A] = [o.heldA, null, null]; }
  const t = await H.fresh({ active: A, hand, deck, gold: [300, 300], ...(o.heldA ? { heroes: heroes.map((h, i) => h || (i % 2 === 0 ? H.BLANK_HEROES : H.BLANK_HEROES_B)) } : {}), ...(o.abilities ? { abilities: { [A]: o.abilities } } : {}) });
  t.grantFor(M, 0, MC);
  t.M = M; t.A = A; t.hooks = [];
  const rh = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (name, ctx = {}, ...r) => { if (name === 'onHandAddFromPile') t.hooks.push({ pi: ctx.playerIdx, namen: ctx.cardNames.slice(), quelle: ctx.sourceName }); return rh(name, ctx, ...r); };
  t.script.push({ match: d => d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable', answer: (d, pi) => ({ cardName: F, handIndex: t.pile(pi, 'hand').indexOf(F) }) });
  return t;
}
const TUTOREN = [
  ['Cute Dog (2 Abwuerfe, 2 Karten)', ['Cute Hydra', 'Cute Phoenix'], async (M) => {
    const t = await bau(M, { handA: [F, F, 'Fireball'], deckA: ['Cute Hydra', 'Cute Phoenix', F, F, F] });
    t.put(t.A, 0, 0, 'Cute Dog').turnPlayed = 1; t.phase(2);
    return [t, () => t.activateCreature(t.A, 0, 0)];
  }],
  ['Cute Annoyance Mini', ['Cute Cat'], async (M) => {
    const t = await bau(M, { handA: [F, 'Fireball'], deckA: ['Cute Cat', F, F, F], heldA: 'Cute Annoyance Mini' });
    t.script.push({ match: d => d.type === 'cardGallery' && /Mini/.test(d.title || ''), answer: () => ({ cardName: 'Cute Cat' }) });
    return [t, () => t.activateHero(t.A, 0)];
  }],
  ['Life-Searcher from the Cosmic Depths (Argos)', ['Cosmic Manipulation'], async (M) => {
    const t = await bau(M, { handA: ['Fireball', F], deckA: ['Cosmic Manipulation', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'Life-Searcher from the Cosmic Depths'], heldA: ARGOS });
    t.setAbilities(t.A, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic']]); t.hero(t.A, 0)._changeCounters = 3;
    t.script.push({ match: d => d.type === 'optionPicker' && /Argos/.test(d.title || ''), answer: (d) => ({ optionId: d.options[d.options.length - 1].id }) });
    t.script.push({ match: d => d.type === 'cardGallery' && /Argos/.test(d.title || ''), answer: () => ({ cardName: 'Life-Searcher from the Cosmic Depths' }) });
    t.script.push({ match: d => d.type === 'cardGallery' && /Life-Searcher/.test(d.title || ''), answer: () => ({ cardName: 'Cosmic Manipulation' }) });
    return [t, () => t.activateHero(t.A, 0)];
  }],
  ['Inventing Lv3', ['Cute Hydra'], async (M) => {
    const t = await bau(M, { handA: [F, 'Fireball'], deckA: ['Cute Hydra', F, F, F], abilities: { 0: [[], ['Inventing', 'Inventing', 'Inventing'], []] } });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title !== MC, answer: (d) => ({ optionId: d.options[d.options.length - 1].id }) });
    t.script.push({ match: d => d.type === 'cardGallery' && /Inventing/.test(d.title || ''), answer: () => ({ cardName: 'Cute Hydra' }) });
    return [t, () => { t.gs.activePlayer = t.A; t.phase(2); return t.host.doActivateFreeAbility(t.room, t.A, { heroIdx: 0, zoneIdx: 1 }); }];
  }],
  ['Lunatic Cycle - New Moon', ['Lunatic Cycle - Half Moon'], async (M) => {
    const t = await bau(M, { handA: [F, 'Fireball'], deckA: ['Lunatic Cycle - Half Moon', F, F] });
    t.put(t.A, 0, 0, NM).turnPlayed = 1;
    t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: F, handIndex: t.pile(t.A, 'hand').indexOf(F) }), once: true });
    return [t, () => t.activateEquip(t.A, 0, 0)];
  }],
  ['Navigation Lv3 (2 Kopien weg, 1 Karte hinzu)', ['Cute Hydra'], async (M) => {
    const t = await bau(M, { handA: [F, F, 'Fireball'], deckA: ['Cute Hydra', F, F, F], abilities: { 0: [[], ['Navigation', 'Navigation', 'Navigation'], []] } });
    t.script.push({ match: d => d.type === 'cardGallery' && /Navigation/.test(d.title || ''), answer: () => ({ cardName: 'Cute Hydra' }) });
    return [t, () => { t.gs.activePlayer = t.A; t.phase(2); return t.host.doActivateFreeAbility(t.room, t.A, { heroIdx: 0, zoneIdx: 1 }); }];
  }],
];

(async () => {
  const R = H.runner();
  for (const M of [0, 1]) {
    for (const [name, erwartet, mk] of TUTOREN) {
      R.section(`Sitz ${M} haelt Monitors · ${name}`);
      const [t, call] = await mk(M);
      await t.run(call);
      await t.drain();
      R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
      const nachEins = t.hooks.length;
      await t.drain(); await t.drain();
      R.check('genau EIN Hook onHandAddFromPile fuer den Hinzufuegenden (auch nach weiteren drain)', nachEins === 1 && t.hooks.length === 1 && t.hooks[0].pi === t.A, t.hooks);
      R.check('genau EIN Angebot', L.fenster(t).length === 1, t.prompts.map(p => p.pi + p.d.type));
      R.check('die hinzugefuegten Karten wurden geloescht: ' + erwartet.join(', '), erwartet.every(n => t.pile(t.A, 'deletedPile').includes(n) && !t.pile(t.A, 'hand').includes(n)), { g: t.pile(t.A, 'deletedPile'), h: t.pile(t.A, 'hand') });
      R.check('Preis des Reaktionsspielers = Zahl der hinzugefuegten Karten (+ Control Monitors)', t.pile(t.M, 'discardPile').length === erwartet.length + 1, t.pile(t.M, 'discardPile'));
      R.check('keine Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
