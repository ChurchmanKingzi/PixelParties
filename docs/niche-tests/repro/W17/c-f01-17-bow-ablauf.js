'use strict';
// W17c · F01-17 Bow of the Hunt Goddess — Grundablauf der Ausrüstungs-Reaktion
// Kartentext: „Equip this card to a Hero you control. Once per turn, when the equipped Hero performs an Attack, you may search your deck for an "Arrow" Artifact
//   and play it directly from your deck in reaction to the Attack. You still need to pay its Cost."
// Erwartung: Beim Angriff des Trägers erscheint (nach der Bestätigung) eine Galerie der spielbaren Arrow-Artifacts im Deck; der gewählte Pfeil wird aus dem Deck genommen,
//   bezahlt, wirkt auf den Angriff (Flame Arrow: +10 Schaden und Burn) und geht danach in die Ablage (nicht auf die Hand). Einmal pro Zug und Bow; Abbruch der Wahl verbraucht nichts.
const H = require('../../lib/h.js');
const BOW = 'Bow of the Hunt Goddess';
const attackSchaden = async (mitBow, wahl) => {
  const t = await H.fresh({ hand: [['Attack'], []], deck: [['Flame Arrow', 'Poisoned Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], undefined], gold: [100, 100] });
  if (mitBow) t.put(0, 0, 0, BOW);
  t.policy.confirm = true;
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  if (wahl !== undefined) t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => wahl, once: true });
  const hp0 = t.hp(1, 0);
  await t.play(0, 'Attack', { hero: 0 });
  return { t, verlust: hp0 - t.hp(1, 0) };
};
(async () => {
  const R = H.runner();

  R.section('Grundablauf: Flame Arrow aus dem Deck');
  const kontrolle = await attackSchaden(false);
  const { t, verlust } = await attackSchaden(true, { cardName: 'Flame Arrow', source: 'deck' });
  const gal = t.prompts.find(p => p.pi === 0 && p.d.type === 'cardGallery' && /Bow/.test(p.d.title || ''));
  R.check('Galerie der Pfeile im Deck (beide Pfeile, sonst nichts)', !!gal && gal.d.cards.map(c => c.name).sort().join() === 'Flame Arrow,Poisoned Arrow', gal && gal.d.cards);
  R.check('Flame Arrow ist aus dem Deck', !t.pile(0, 'mainDeck').includes('Flame Arrow') && t.pile(0, 'mainDeck').includes('Poisoned Arrow'), t.pile(0, 'mainDeck'));
  R.check('Flame Arrow liegt in der Ablage (nicht in der Hand)', t.pile(0, 'discardPile').includes('Flame Arrow') && !t.pile(0, 'hand').includes('Flame Arrow'), { d: t.pile(0, 'discardPile'), h: t.pile(0, 'hand') });
  R.check('Kosten (5 Gold) bezahlt', t.gs.players[0].gold === 95, t.gs.players[0].gold);
  R.check('+10 Schaden gegenüber dem Angriff ohne Bow', verlust === kontrolle.verlust + 10, { verlust, kontrolle: kontrolle.verlust });
  R.check('Ziel brennt', !!t.gs.players[1].heroes[0].statuses?.burned, t.gs.players[1].heroes[0].statuses);
  R.check('Deck 5 → 4 Karten, Bilanz sauber', t.pile(0, 'mainDeck').length === 4 && t.audit().length === 0, t.audit());
  R.check('Pfeil-Aktivierung im Log mit Quelle equip', t.lg('reaction_activated').some(l => l.card === 'Flame Arrow' && l.source === 'equip'), t.lg('reaction_activated'));
  R.check('keine Engine-Fehler (Grundablauf)', t.errors.length === 0, t.errors);

  R.section('Einmal pro Zug (je Bow), neuer Zug neues Glück');
  t.reset();
  t.addHand(0, 'Attack');
  await t.play(0, 'Attack', { hero: 0 });
  R.check('2. Angriff im selben Zug: kein Angebot, Gold unverändert', !t.prompts.some(p => p.pi === 0 && /Bow/.test(p.d.title || '')) && t.gs.players[0].gold === 95, t.prompts.map(p => p.d.type + ':' + p.d.title));
  await t.endTurn(); await t.endTurn();
  t.reset();
  t.addHand(0, 'Attack');
  t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: 'Poisoned Arrow', source: 'deck' }) });
  await t.play(0, 'Attack', { hero: 0 });
  R.check('nächster Zug (' + t.gs.turn + '): wieder angeboten, Poisoned Arrow in der Ablage', t.pile(0, 'discardPile').includes('Poisoned Arrow'), { d: t.pile(0, 'discardPile'), p: t.prompts.map(p => p.d.type + ':' + p.d.title) });
  R.check('keine Engine-Fehler (Folgezug)', t.errors.length === 0, t.errors);

  R.section('Abbruch der Pfeilwahl: nichts verbraucht, Bow bleibt frei');
  {
    const a = await attackSchaden(true, null);
    const t2 = a.t;
    R.check('Abbruch: Gold, Deck, Ablage unverändert', t2.gs.players[0].gold === 100 && t2.pile(0, 'mainDeck').length === 5 && !t2.pile(0, 'discardPile').some(n => /Arrow/.test(n)), { g: t2.gs.players[0].gold, d: t2.pile(0, 'mainDeck') });
    R.check('Abbruch: Angriff läuft ohne Zuschlag', a.verlust === kontrolle.verlust, { v: a.verlust, k: kontrolle.verlust });
    t2.reset();
    t2.addHand(0, 'Attack');
    t2.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: 'Flame Arrow', source: 'deck' }) });
    await t2.play(0, 'Attack', { hero: 0 });
    R.check('Abbruch verbrauchte den Stempel nicht: 2. Angriff im selben Zug darf noch', t2.pile(0, 'discardPile').includes('Flame Arrow'), t2.pile(0, 'discardPile'));
    R.check('keine Engine-Fehler (Abbruch)', t2.errors.length === 0, t2.errors);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
