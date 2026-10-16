'use strict';
// W14b · Q159 (S01-08, Aurora Borealis) · Al, 16.10.2026: „Ja, das Deleten soll erst passieren, nachdem der gewählte Spell komplett committed wurde; wird er abgebrochen, verbleiben die Karten auf der Hand."
// Kartentext: „… If the user has Magic Arts 3, you may delete 2 of your chosen Spells to immediately perform the third one as an additional Action with the user."
// Erwartet: (a) Abbruch der Zielwahl des gewählten Zaubers → alle drei Karten bleiben auf der Hand, nichts gelöscht, Aurora wird nicht verbraucht (Karte zurück auf der Hand), Zustand sauber;
//   (b) bestätigte Zielwahl → die zwei anderen sind gelöscht, der gewählte wirkt (Schaden) und liegt in der Ablage; (c) „Delete 2?" mit Nein → nichts gelöscht, alle drei auf der Hand;
//   (d) Zauber ohne Zielwahl (Boiling Oil) → am Ende des Zaubers werden die zwei anderen gelöscht.
const H = require('../../lib/h.js');
// Der Harness-Sitz ist ein CPU-Sitz: dort feuert die Zusage (Kartenauftritt) sofort beim Beginn des Gusses. Ein Mensch bekommt sie erst bei der ersten bestätigten Antwort bzw. am Ende
// (`gussAuftrittBeginnen` ohne den CPU-Sofortzweig) – das stellt dieser Helfer nach.
function menschlicherAuftritt(t) {
  t.engine.gussAuftrittBeginnen = function (cardName, playerIdx) {
    const handle = { cardName, playerIdx, vorher: this.gs._pendingCardReveal || null };
    this.gs._pendingCardReveal = { cardName, ownerIdx: playerIdx };
    return handle;
  };
}
(async () => {
  const R = H.runner();
  async function szene(deck, wahl, gewirkt, jaNein = true) {
    const t = await H.fresh({ hand: [['Aurora Borealis'], []], deck: [deck, []],
      abilities: { 0: { 0: [['Magic Arts', 'Magic Arts', 'Magic Arts'], ['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], []] } } });
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: wahl }) });
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Aurora Borealis', answer: () => jaNein ? ({ confirmed: true }) : null });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Aurora Borealis', answer: () => ({ cardName: gewirkt }) });
    return t;
  }
  const deck = ['Fireball', 'Burning Finger', 'Boiling Oil', 'Fireball', 'Big Oopsie', H.INERT.creature];
  const sorted = (a) => a.slice().sort();

  R.section('(a) Abbruch der Zielwahl');
  {
    const t = await szene(deck, ['Fireball', 'Burning Finger', 'Boiling Oil'], 'Fireball');
    t.targetFn = () => null;
    await t.play(0, 'Aurora Borealis', { hero: 0, noGrant: true });
    const hand = t.pile(0, 'hand'), del = t.pile(0, 'deletedPile');
    R.check('nichts gelöscht', del.length === 0, del);
    R.check('alle drei Zauber auf der Hand', ['Fireball', 'Burning Finger', 'Boiling Oil'].every(n => hand.includes(n)), hand);
    R.check('kein Schaden', t.hp(1, 0) === 800 && t.hp(1, 1) === 800, t.hp(1, 0));
    R.check('Zustand sauber, keine Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    R.check('Aurora selbst ist aufgelöst (Ablage); der abgebrochene Guss kostet keine Zusatzaktion-Karte', t.pile(0, 'discardPile').includes('Aurora Borealis'), t.pile(0, 'discardPile'));
  }

  R.section('(a2) Mensch (Auftritt/Zusage erst bei Bestätigung, nicht sofort wie bei der CPU): während der Zielwahl ist noch nichts gelöscht; Abbruch → alles auf der Hand');
  {
    const t = await szene(deck, ['Fireball', 'Burning Finger', 'Boiling Oil'], 'Fireball');
    menschlicherAuftritt(t);
    let beiZielwahl = null;
    t.targetFn = () => { beiZielwahl = t.pile(0, 'deletedPile').length; return null; };
    await t.play(0, 'Aurora Borealis', { hero: 0, noGrant: true });
    R.check('bei der Zielwahl war noch NICHTS gelöscht', beiZielwahl === 0, beiZielwahl);
    R.check('nach dem Abbruch: nichts gelöscht, alle drei auf der Hand', t.pile(0, 'deletedPile').length === 0 && ['Fireball', 'Burning Finger', 'Boiling Oil'].every(n => t.pile(0, 'hand').includes(n)), { del: t.pile(0, 'deletedPile'), hand: t.pile(0, 'hand') });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await szene(deck, ['Fireball', 'Burning Finger', 'Boiling Oil'], 'Fireball');
    menschlicherAuftritt(t);
    let beiZielwahl = null;
    t.targetFn = (valid) => { beiZielwahl = t.pile(0, 'deletedPile').length; return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; };
    await t.play(0, 'Aurora Borealis', { hero: 0, noGrant: true });
    R.check('Mensch, bestätigt: bei der Zielwahl noch nichts gelöscht, danach zwei gelöscht und Fireball gewirkt', beiZielwahl === 0 && t.pile(0, 'deletedPile').length === 2 && t.hp(1, 0) < 800, { beiZielwahl, del: t.pile(0, 'deletedPile'), hp: t.hp(1, 0) });
  }

  R.section('(b) bestätigte Zielwahl: erst jetzt wird gelöscht');
  {
    const t = await szene(deck, ['Fireball', 'Burning Finger', 'Boiling Oil'], 'Fireball');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Aurora Borealis', { hero: 0, noGrant: true });
    R.check('die zwei anderen Zauber sind gelöscht', sorted(t.pile(0, 'deletedPile')).join() === sorted(['Burning Finger', 'Boiling Oil']).join(), t.pile(0, 'deletedPile'));
    R.check('Fireball hat gewirkt (Schaden) und liegt in der Ablage', t.hp(1, 0) < 800 && t.pile(0, 'discardPile').includes('Fireball') && !t.pile(0, 'hand').includes('Fireball'), { hp: t.hp(1, 0), abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(c) „Delete 2 …?" mit Nein');
  {
    const t = await szene(deck, ['Fireball', 'Burning Finger', 'Boiling Oil'], 'Fireball', false);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Aurora Borealis', { hero: 0, noGrant: true });
    R.check('nichts gelöscht, alle drei auf der Hand', t.pile(0, 'deletedPile').length === 0 && ['Fireball', 'Burning Finger', 'Boiling Oil'].every(n => t.pile(0, 'hand').includes(n)), { del: t.pile(0, 'deletedPile'), hand: t.pile(0, 'hand') });
  }

  R.section('(d) Zauber ohne Zielwahl (Boiling Oil): Löschen am Ende');
  {
    const t = await szene(['Boiling Oil', 'Burning Finger', 'Fireball', 'Fireball', H.INERT.creature], ['Boiling Oil', 'Burning Finger', 'Fireball'], 'Boiling Oil');
    await t.play(0, 'Aurora Borealis', { hero: 0, noGrant: true });
    R.check('die zwei anderen sind gelöscht, Boiling Oil hat gewirkt und liegt in der Ablage', sorted(t.pile(0, 'deletedPile')).join() === sorted(['Burning Finger', 'Fireball']).join() && t.pile(0, 'discardPile').includes('Boiling Oil') && t.hp(1, 0) < 800, { del: t.pile(0, 'deletedPile'), abl: t.pile(0, 'discardPile'), hp: t.hp(1, 0) });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
