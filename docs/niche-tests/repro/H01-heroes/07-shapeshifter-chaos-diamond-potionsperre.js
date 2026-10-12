'use strict';
// H01-heroes-07 · Shapeshifter in Chaos-Diamond-Gestalt sperrt das Potion-Ziehen dauerhaft (auch nach dem Abfallen)
//
// Kartentext Chaos-Diamond: „If this is one of your starting Heroes, you can never draw cards from your Potion Deck."
// Kartentext Shapeshifter: „This Hero gains the effects and name of the Hero equipped … At the end of your opponent's turn, send all Heroes
//   equipped this way to the discard pile."
// Frage (Stufe C): Soll die Potion-Zieh-Sperre nach dem Abfallen der Gestalt bleiben („never"), oder gilt sie nur, solange der Shapeshifter
//   Chaos-Diamond IST (dann wäre sie hier ein Zustandsleck wie bei H01-heroes-02)?
// Beobachtet: `initGainedHeroEffect` führt `onGameStart` von Chaos-Diamond aus (`_potion-deck-hero-shared.js onGameStart`): stempelt
//   `hero._startingHeroOf` und setzt `ps.potionDrawBanned = true`. Nach der Rückverwandlung bleibt beides; `actionDrawFromPotionDeck` zieht nichts mehr.
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter';
const CD = 'Chaos-Diamond, the Cracked Keeper';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], potionDeck: [['Healing Potion', 'Healing Potion', 'Healing Potion'], []] });
  R.check('Vorprobe: Potion-Ziehen ist frei', !t.gs.players[0].potionDrawBanned);
  t.addHand(0, CD);
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: CD, source: 'hand' }), once: true });
  await t.activateHero(0, 0, {});
  R.check('Vorprobe: Shapeshifter ist Chaos-Diamond', t.hero(0, 0).name === CD, t.hero(0, 0).name);
  await t.endTurn(); await t.endTurn();
  R.check('Shapeshifter ist zurück', t.hero(0, 0).name === SHAPE, t.hero(0, 0).name);
  R.check('Potion-Ziehen ist wieder frei (kein "starting Hero" Chaos-Diamond mehr)', !t.gs.players[0].potionDrawBanned, { banned: t.gs.players[0].potionDrawBanned, stempel: t.hero(0, 0)._startingHeroOf });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
