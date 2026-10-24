const H = require('../lib/h.js');
const F = H.INERT.filler, ATTA = 'Atta, Speaker of Desires';
async function scene() {
  const t = await H.fresh({ active: 0, heroes: [[ATTA, null, null], null], hand: [[F, F], [F]], deck: [['Fireball', F, F, F], Array(10).fill(F)], abilities: { 0: { 0: [['Inventing', 'Inventing', 'Inventing'], [], []] } } });
  t.grantFor(0, 0, 'Fireball');
  return t;
}
(async () => {
  const R = H.runner();
  R.section('Echter Such-Weg (Titel = Karte, keine Ability) loest aus');
  let t = await scene();
  await t.run(() => t.engine.searchDeckForNamedCard(0, 'Fireball', 'Cute Dog'));
  await t.drain();
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.check('Atta bot das Loeschen an und loeschte Fireball', t.pile(0, 'deletedPile').includes('Fireball'), [t.pile(0, 'deletedPile')]);
  R.check('Atta-Angebot kam NACH dem Reveal-Fenster', t.prompts.map(p => p.d.type).join() === 'deckSearchReveal,confirm', t.prompts.map(p => p.d.type));

  R.section('actionAddCardFromDeckToHand mit reveal');
  t = await scene();
  await t.run(() => t.engine.actionAddCardFromDeckToHand(0, 'Fireball', { source: 'Cute Bunny', reveal: true }));
  await t.drain();
  R.check('geloescht', t.pile(0, 'deletedPile').includes('Fireball'), t.pile(0, 'deletedPile'));

  R.section('Inventing Lv3 (Ability): kein Angebot');
  t = await scene();
  t.setHand(0, [F, F]);
  t.script.push({ match: d => d.type === 'forceDiscardCancellable' || d.type === 'forceDiscard', answer: () => ({ cardName: F, handIndex: 0 }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Inventing/.test(d.title || ''), answer: () => ({ cardName: 'Fireball' }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
  await t.drain();
  R.note('inv', JSON.stringify({ prompts: t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || '')), hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile') }));
  R.check('Fireball auf der Hand, nicht geloescht', t.pile(0, 'hand').includes('Fireball') && t.pile(0, 'deletedPile').length === 0, [t.pile(0, 'hand'), t.pile(0, 'deletedPile')]);
  R.check('kein Atta-Prompt', !t.prompts.some(p => p.d.title === ATTA));
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
