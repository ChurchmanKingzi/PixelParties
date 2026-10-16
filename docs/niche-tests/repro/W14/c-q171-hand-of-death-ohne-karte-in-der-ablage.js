'use strict';
// W14c · Q171 (S02-11) Hand of Death: der verzögerte Effekt kommt auch, wenn die Karte zwischenzeitlich aus der Ablage genommen wurde (Al 16.10.2026: „Ja!")
// Fälle: (a) Karte per Magic Sapphire zurück auf die Hand, (b) Karte weg aus Hand UND Ablage (ins Deck gemischt), (c) Kontrolle: Karte bleibt in der Ablage → Effekt kommt genau EINMAL.
// Erwartet: am Ende des Gegnerzugs erscheint genau eine Zielwahl; das Ziel wird besiegt; „skip your next turn"-Folge wie bisher; kein Doppelfeuern.
const H = require('../../lib/h.js');
async function lauf(variante) {
  const t = await H.fresh({ hand: [['Hand of Death', 'Magic Sapphire'], []] });
  let prompts = 0;
  t.targetFn = (valid, cfg) => { if (/Hand of Death/.test((cfg && cfg.title) || '')) prompts++; return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; };
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { const c = d.cards.find(x => x.name === 'Hand of Death') || d.cards[0]; return { cardName: c.name, source: c.source }; } });
  await t.play(0, 'Hand of Death', { hero: 0 });
  prompts = 0;
  if (variante === 'sapphire') await t.play(0, 'Magic Sapphire', { hero: 0 });
  if (variante === 'deck') { const i = t.gs.players[0].discardPile.indexOf('Hand of Death'); t.gs.players[0].discardPile.splice(i, 1); t.gs.players[0].mainDeck.push('Hand of Death'); t.engine.cardInstances = t.engine.cardInstances.filter(c => !(c.name === 'Hand of Death' && c.zone === 'discard')); }
  await t.endTurn(); await t.endTurn();
  return { t, prompts };
}
(async () => {
  const R = H.runner();
  for (const v of ['sapphire', 'deck', 'ablage']) {
    const { t, prompts } = await lauf(v);
    R.check(`(${v}) genau eine Zielwahl am Ende des Gegnerzugs`, prompts === 1, prompts);
    R.check(`(${v}) Gegnerheld 0 besiegt`, t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check(`(${v}) Folge: nächster eigener Zug wird übersprungen`, t.gs.players[0]._skipNextTurn === true || t.gs.players[0]._skipNextTurn === undefined && t.gs.turn >= 7, { skip: t.gs.players[0]._skipNextTurn, turn: t.gs.turn });
    R.check(`(${v}) Eintrag verbraucht`, !t.gs.players[0]._handOfDeathArmed, t.gs.players[0]._handOfDeathArmed);
    R.check(`(${v}) keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
