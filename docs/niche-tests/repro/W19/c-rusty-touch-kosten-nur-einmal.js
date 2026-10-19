'use strict';
// W19c · Rusty Touch — „Negate that Artifact (but your opponent still has to pay its Cost)": die Kosten werden genau EINMAL bezahlt.
// Al (Welle 19): „Rusty Touch soll die Kosten nur einmal abziehen." Erwartung (Gold-Bilanz des Artefakt-Spielers):
//  • Initialkarte (Artefakt aus der Hand, Kosten werden sonst erst NACH der Kette gebucht): Rusty Touch erzwingt die Zahlung -> genau 1× Kosten.
//  • Reaktions-Artefakt (Hand-Pfeil / Bow-Pfeil): Kosten schon beim Aktivieren bezahlt -> Rusty Touch bucht NICHTS mehr (Summe = 1× Kosten).
const H = require('../../lib/h.js');
const BOW = 'Bow of the Hunt Goddess';
(async () => {
  const R = H.runner();
  const bilanz = (t) => t.gs.players[0].gold;

  R.section('Hand-Pfeil (Flame Arrow, 5 Gold) als Reaktion, von Rusty Touch negiert');
  {
    const t = await H.fresh({ hand: [['Attack', 'Flame Arrow'], ['Rusty Touch']], gold: [100, 100] });
    t.policy.confirm = true;
    t.grantFor(1, 0, 'Rusty Touch');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.script.push({ match: d => d.type === 'cardGallery' && /Chain a Reaction/.test(d.title || ''), answer: () => ({ cardName: 'Flame Arrow', source: 'hand' }), once: true });
    t.reset();
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Rusty Touch hat den Pfeil negiert (kein Brand)', !t.gs.players[1].heroes[0].statuses?.burned, t.gs.players[1].heroes[0].statuses);
    R.check('Pfeil in der Ablage, Rusty Touch gespielt', t.pile(0, 'discardPile').includes('Flame Arrow') && t.pile(1, 'discardPile').includes('Rusty Touch'), { d0: t.pile(0, 'discardPile'), d1: t.pile(1, 'discardPile') });
    R.check('Gold: genau 1× 5 bezahlt (100 -> 95)', bilanz(t) === 95, bilanz(t));
    R.check('Zustand sauber, keine Engine-Fehler', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
  }

  R.section('Bow-Pfeil (Flame Arrow aus dem Deck, 5 Gold), von Rusty Touch negiert');
  {
    const t = await H.fresh({ hand: [['Attack'], ['Rusty Touch']], deck: [['Flame Arrow', 'ZZ Dummy', 'ZZ Dummy'], undefined], gold: [100, 100] });
    t.policy.confirm = true;
    t.put(0, 0, 0, BOW); t.grantFor(1, 0, 'Rusty Touch');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: 'Flame Arrow', source: 'deck' }), once: true });
    t.reset();
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Bow-Pfeil negiert (kein Brand), in der Ablage', !t.gs.players[1].heroes[0].statuses?.burned && t.pile(0, 'discardPile').includes('Flame Arrow'), { st: t.gs.players[1].heroes[0].statuses, d: t.pile(0, 'discardPile') });
    R.check('Gold: genau 1× 5 bezahlt (100 -> 95)', bilanz(t) === 95, bilanz(t));
    R.check('Zustand sauber, keine Engine-Fehler', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
  }

  R.section('Gegenprobe: Initial-Artefakt (Sitz 0 am Zug) von Rusty Touch negiert -> genau 1× Kosten (Server bucht erst NACH der Kette, nie bei Negation)');
  const DB = require('../../../../data/cards.json');
  for (const [art] of [['Golden Bananas'], ['Book of Doom'], [BOW]]) {
    const kosten = DB.find(c => c.name === art).cost;
    const t = await H.fresh({ hand: [[art], ['Rusty Touch']], gold: [100, 100] });
    t.policy.confirm = true;
    t.grantFor(1, 0, 'Rusty Touch');
    t.targetFn = (valid) => [valid.find(v => v.owner === 1 && v.type === 'hero').id];
    t.reset();
    await t.play(0, art, { hero: 0 });
    R.check(`${art}: Rusty Touch gespielt, Artefakt negiert (Karte in der Ablage, nicht im Spiel)`, t.pile(1, 'discardPile').includes('Rusty Touch') && t.pile(0, 'discardPile').includes(art), { d0: t.pile(0, 'discardPile'), d1: t.pile(1, 'discardPile') });
    R.check(`${art}: Gold genau 1× ${kosten} (100 -> ${100 - kosten})`, bilanz(t) === 100 - kosten, bilanz(t));
    R.check(`${art}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('Gegenprobe: ohne Rusty Touch zahlt ein Reaktionspfeil ebenfalls genau 1× (Referenz)');
  {
    const t = await H.fresh({ hand: [['Attack', 'Flame Arrow'], []], gold: [100, 100] });
    t.policy.confirm = true;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.script.push({ match: d => d.type === 'cardGallery' && /Chain a Reaction/.test(d.title || ''), answer: () => ({ cardName: 'Flame Arrow', source: 'hand' }), once: true });
    t.reset();
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Flame Arrow gewirkt (Brand), Gold 95', !!t.gs.players[1].heroes[0].statuses?.burned && bilanz(t) === 95, { g: bilanz(t), st: t.gs.players[1].heroes[0].statuses });
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
