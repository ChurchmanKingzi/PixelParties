'use strict';
// W12 / Q109 (H01-heroes-07) · Potion-Zieh-Sperre nach temporärer Chaos-Diamond-/Pinta-Gestalt (Al: „Nein, nach einer temporären Verwandlung in Pinta/Chaos-Diamond
//   wird die Ziehsperre wieder aufgehoben, sofern es nicht noch einen permanenten Chaos-Diamond/Pinta gibt.")
// (a) Shapeshifter wird Chaos-Diamond: Sperre solange die Gestalt steht (Potion-Ziehen liefert nichts), nach dem Abfallen wieder frei (Ziehen geht).
// (b) Steht zusätzlich ein permanenter Chaos-Diamond (Starthero) auf der Seite: die Sperre bleibt nach dem Abfallen.
// (c) Das Verbot eines permanenten Chaos-Diamond bleibt bei Frost/Betäubung/Negation bestehen (Welle 8) und nach dem Abfallen einer Leihgestalt.
// (d) Zweimal hintereinander verwandeln: Sperre geht jedes Mal an und wieder aus (keine Restmarke).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter';
const CD = 'Chaos-Diamond, the Cracked Keeper';
const PN = 'Pinta, the Singing Ship';
async function verwandeln(t, karte) {
  t.addHand(0, karte);
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: karte, source: 'hand' }), once: true });
  await t.activateHero(0, 0, {});
}
(async () => {
  const R = H.runner();
  const pot = () => ['Healing Potion', 'Healing Potion', 'Healing Potion', 'Healing Potion'];
  for (const karte of [CD, PN]) {   // (a)
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], potionDeck: [pot(), []] });
    R.check(`(a/${karte.split(',')[0]}) Vorprobe: frei`, !t.gs.players[0].potionDrawBanned);
    await verwandeln(t, karte);
    R.check(`(a/${karte.split(',')[0]}) Vorprobe: Gestalt steht`, t.hero(0, 0).name === karte, t.hero(0, 0).name);
    R.check(`(a/${karte.split(',')[0]}) in der Gestalt: Sperre an, Ziehen liefert nichts`, t.gs.players[0].potionDrawBanned === true && (await t.engine.actionDrawFromPotionDeck(0, 1)).length === 0, t.gs.players[0].potionDrawBanned);
    await t.endTurn(); await t.endTurn();
    R.check(`(a/${karte.split(',')[0]}) Shapeshifter zurück`, t.hero(0, 0).name === SHAPE, t.hero(0, 0).name);
    R.check(`(a/${karte.split(',')[0]}) Sperre aufgehoben`, !t.gs.players[0].potionDrawBanned, { b: t.gs.players[0].potionDrawBanned, perm: t.gs.players[0]._potionBanPerm, temp: t.gs.players[0]._potionBanTemp });
    R.check(`(a/${karte.split(',')[0]}) Potion-Ziehen geht wieder`, (await t.engine.actionDrawFromPotionDeck(0, 1)).length === 1);
    R.check(`(a/${karte.split(',')[0]}) kein Rest-Starthelden-Stempel am Shapeshifter`, t.hero(0, 0)._startingHeroOf == null, t.hero(0, 0)._startingHeroOf);
    R.check(`(a/${karte.split(',')[0]}) keine Engine-Fehler`, t.errors.length === 0, t.errors);
    R.check(`(a/${karte.split(',')[0]}) Zustand sauber`, t.audit().length === 0, t.audit());
  }
  {   // (b)+(c)
    const t = await H.fresh({ heroes: [[SHAPE, CD, H.BLANK_HEROES[2]], null], potionDeck: [pot(), []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    R.check('(b) Vorprobe: permanenter Chaos-Diamond sperrt', t.gs.players[0].potionDrawBanned === true && t.gs.players[0]._potionBanPerm === true, t.gs.players[0].potionDrawBanned);
    await verwandeln(t, PN);
    R.check('(b) Vorprobe: Shapeshifter ist Pinta', t.hero(0, 0).name === PN, t.hero(0, 0).name);
    await t.endTurn(); await t.endTurn();
    R.check('(b) Shapeshifter zurück', t.hero(0, 0).name === SHAPE, t.hero(0, 0).name);
    R.check('(b) Sperre bleibt (permanenter Chaos-Diamond steht noch)', t.gs.players[0].potionDrawBanned === true, t.gs.players[0].potionDrawBanned);
    R.check('(b) Potion-Ziehen weiter gesperrt', (await t.engine.actionDrawFromPotionDeck(0, 1)).length === 0);
    await t.run(() => t.engine.addHeroStatus(0, 1, 'frozen', { duration: 2, appliedBy: 1 }));
    await t.run(() => t.engine.addHeroStatus(0, 1, 'stunned', { duration: 2, appliedBy: 1 }));
    R.check('(c) Sperre bleibt bei gefrorenem/betäubtem permanentem Chaos-Diamond', t.gs.players[0].potionDrawBanned === true);
    R.check('(b/c) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (d)
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], potionDeck: [pot(), []] });
    await verwandeln(t, CD);
    await t.endTurn(); await t.endTurn();
    R.check('(d) nach 1. Abfallen frei', !t.gs.players[0].potionDrawBanned);
    // Ruling: ein Name pro Shapeshifter nur einmal; andere Gestalt nehmen
    await verwandeln(t, PN);
    R.check('(d) 2. gestaltwandel: Sperre wieder an', t.hero(0, 0).name === PN && t.gs.players[0].potionDrawBanned === true, { n: t.hero(0, 0).name, b: t.gs.players[0].potionDrawBanned });
    await t.endTurn(); await t.endTurn();
    R.check('(d) nach 2. Abfallen frei', !t.gs.players[0].potionDrawBanned, { b: t.gs.players[0].potionDrawBanned, temp: t.gs.players[0]._potionBanTemp });
    R.check('(d) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
