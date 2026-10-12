'use strict';
// A07-05 · Dream Lander verlässt das Brett OHNE zu sterben (Opfer, Zerstören, Zurückmischen) → der angelegte Held verschwindet
//
// Kartentexte (Dream Landers, z. B. Goff): „You may once per turn place a "Gon, the Frostbringer" from your hand or
//   deck underneath this Creature." – der Held liegt UNTER der Kreatur.
// CARD_API / Engine-Vertrag (_engine.js ~10315-10335, ~47270): „on creature death, the attached Hero is sent to the
//   original owner's discard pile" – NUR der Schadens-Todespfad (`_processCreatureDamageBatch…`, _engine.js:47273)
//   räumt `counters.attachedHero` auf.
//
// Erwartung: Ein unter einer Kreatur liegender Held ist eine echte Karte. Verlässt die Kreatur das Brett (Opfer,
//   Zerstörung durch Effekt, Zurückmischen), landet auch der Held irgendwo (Ablage / Deck) – keine Karte verschwindet.
// Beobachtet: `actionDestroyCard` (damit jede Opferzahlung von Green Dragoneer/Blue-Ice/Clausss/King Trex und Antonias
//   „send to the discard pile") und Mass Routing (Zurückmischen) kennen `attachedHero` nicht: Gon ist danach in KEINER
//   Zone mehr (Kartenbilanz: −1).
const H = require('../../lib/h.js');

function zaehle(t, name) {
  let n = 0;
  for (const ps of t.gs.players) for (const k of ['hand', 'mainDeck', 'discardPile', 'deletedPile']) n += (ps[k] || []).filter(x => x === name).length;
  return n;
}

async function szene(hand) {
  const t = await H.fresh({ hand: [['Gon, the Frostbringer', ...hand], []], deckSize: 10 });
  const g = t.put(0, 0, 0, 'Goff, the Burnbringer'); g.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);                    // Gon unterlegen
  return { t, g };
}

(async () => {
  const R = H.runner();

  R.section('Kontrolle: Tod durch Schaden');
  let { t, g } = await szene([]);
  R.check('Vorbedingung: Gon liegt unter Goff', g.counters.attachedHero === 'Gon, the Frostbringer');
  await t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, g, 9999, 'creature');
  R.check('Tod durch Schaden: Gon landet in der Ablage', zaehle(t, 'Gon, the Frostbringer') === 1, t.pile(0, 'discardPile'));

  R.section('Zerstörung durch Effekt (actionDestroyCard)');
  ({ t, g } = await szene([]));
  await t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, g);
  R.check('Goff liegt in der Ablage', t.pile(0, 'discardPile').includes('Goff, the Burnbringer'), t.pile(0, 'discardPile'));
  R.check('Gon ist nicht verschwunden', zaehle(t, 'Gon, the Frostbringer') === 1, { ablage: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });

  R.section('Opfer (Green Dragoneer opfert Goff)');
  ({ t, g } = await szene([]));
  const gd = t.put(0, 1, 0, 'Green Dragoneer'); gd.turnPlayed = 1;
  t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return [h ? h.id : v.find(x => x.cardName === 'Goff, the Burnbringer').id]; };
  t.phase(2);
  await t.activateCreature(0, 1, 0);
  R.check('Goff wurde geopfert', !t.find('Goff, the Burnbringer', 'support'));
  R.check('Gon ist nicht verschwunden', zaehle(t, 'Gon, the Frostbringer') === 1, t.pile(0, 'discardPile'));

  R.section('Zurückmischen (Mass Routing)');
  ({ t, g } = await szene(['Mass Routing']));
  await t.play(0, 'Mass Routing', { hero: 0 });
  R.check('Goff wurde ins Deck gemischt', t.pile(0, 'mainDeck').includes('Goff, the Burnbringer') && !t.find('Goff, the Burnbringer', 'support'));
  R.check('Gon ist nicht verschwunden', zaehle(t, 'Gon, the Frostbringer') === 1, { deck: t.pile(0, 'mainDeck').includes('Gon, the Frostbringer'), ablage: t.pile(0, 'discardPile') });
  R.finish();
})();
