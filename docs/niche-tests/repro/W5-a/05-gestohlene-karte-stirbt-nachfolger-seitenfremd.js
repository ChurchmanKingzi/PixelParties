'use strict';
// W5-a-05 · Stirbt eine gestohlene Karte (Elven Rider / Cycling Demons), darf der aktuelle (temporäre) Besitzer den Nachfolger seitenfremd beschwören (A09-15, Entscheidung Al 14.10.2026)
// Al: „Falls der temporary owner ein geeignetes Ziel zum Beschwören hat, darf er es seitenfremd beschwören."
// Kartentext Elven Rider: „… when an "Elven" Creature you control leaves the board, but you must summon it into the SAME Support Zone that Creature occupied."
// Kartentext Bouldor Demon: „When this Creature is defeated, you may choose 1 "Infernous Demon" from your deck and place it into the Support Zone this Creature occupied."
// Aufbau: Seed 1234. Sitz 1: Elven Archer bzw. Bouldor Demon auf Held 0 / Slot 1. Sitz 0 stiehlt die Kreatur (actionStealCreature), Hand [Elven Rider] bzw. Deck [Infernous Demon]; die gestohlene Kreatur wird zerstört.
// Erwartet: Der Nachfolger steht in der Zone der gestorbenen Karte (Sitz 1, Held 0, Slot 1), kontrolliert von Sitz 0 (Kontrolleur), egal ob die gleich indizierte Zone auf Seite 0 frei oder belegt ist;
//   der Rider wird von der Hand genommen / Infernous aus dem Deck von Sitz 0 gezogen; die gestorbene Karte liegt in der Ablage ihres Besitzers (Sitz 1); Zustand sauber.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const eigeneZoneBelegt of [false, true]) {
    const tag = eigeneZoneBelegt ? '(eigene Zone belegt)' : '(eigene Zone frei)';
    R.section('Elven Rider – gestohlener Elven Archer stirbt ' + tag);
    {
      const t = await H.fresh({ hand: [['Elven Rider'], []], gold: [100, 100], deck: [[H.INERT.creature, 'Elven Leader', ...Array(10).fill(H.INERT.creature)], Array(10).fill(H.INERT.creature)] });
      t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Elven Rider', answer: () => ({ cardName: 'Elven Leader' }) });
      const a = t.put(1, 0, 1, 'Elven Archer');
      if (eigeneZoneBelegt) t.put(0, 0, 1, H.INERT.creature);
      await t.run(() => t.engine.actionStealCreature(0, a)); await H.sleep(250);
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, a));
      const r = t.find('Elven Rider', 'support');
      R.check('Rider steht in der Zone der gestorbenen Karte (Brettseite Sitz 1, Held 0, Slot 1)', !!r && t.gs.players[1].supportZones[0][1][0] === 'Elven Rider', t.gs.players[1].supportZones[0][1]);
      R.check('Rider wird von Sitz 0 kontrolliert (seitenfremd)', !!r && t.engine.kontrolleurVon(r) === 0 && t.engine.physicalSide(r) === 1, r && { owner: r.owner, controller: r.controller });
      R.check('Rider nicht mehr auf der Hand von Sitz 0', !t.pile(0, 'hand').includes('Elven Rider'), t.pile(0, 'hand'));
      R.check('gestorbener Archer liegt in der Ablage seines Besitzers (Sitz 1), nicht in der des Diebes', t.pile(1, 'discardPile').includes('Elven Archer') && !t.pile(0, 'discardPile').includes('Elven Archer'), { a0: t.pile(0, 'discardPile'), a1: t.pile(1, 'discardPile') });
      R.check('Zustand sauber, keine Engine-Fehler', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
    }
    R.section('Bouldor Demon – gestohlen, stirbt ' + tag);
    {
      const t = await H.fresh({ hand: [[], []], gold: [100, 100], deck: [['Infernous Demon', ...Array(15).fill(H.INERT.creature)], ['Infernous Demon', ...Array(15).fill(H.INERT.creature)]] });
      const d = t.put(1, 0, 1, 'Bouldor Demon');
      if (eigeneZoneBelegt) t.put(0, 0, 1, H.INERT.creature);
      t.put(1, 1, 0, H.INERT.big);
      await t.run(() => t.engine.actionStealCreature(0, d)); await H.sleep(250);
      t.script.push({ match: q => q.type === 'confirm' && q.title === 'Bouldor Demon' && /defeated/.test(q.message || ''), answer: () => ({ confirmed: true }) });
      t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.cardName === H.INERT.big); return v ? [v.id] : null; };
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, d));
      const r = t.find('Infernous Demon', 'support');
      R.check('Infernous Demon steht in der Zone des gestorbenen Demons (Brettseite Sitz 1, Held 0, Slot 1)', !!r && t.gs.players[1].supportZones[0][1][0] === 'Infernous Demon', t.gs.players[1].supportZones[0][1]);
      R.check('Infernous wird von Sitz 0 kontrolliert und stammt aus dessen Deck', !!r && t.engine.kontrolleurVon(r) === 0 && t.pile(0, 'mainDeck').filter(n => n === 'Infernous Demon').length === 0 && t.pile(1, 'mainDeck').filter(n => n === 'Infernous Demon').length === 1, r && { controller: r.controller, deck0: t.pile(0, 'mainDeck').length });
      R.check('gestorbener Bouldor liegt in der Ablage seines Besitzers (Sitz 1)', t.pile(1, 'discardPile').includes('Bouldor Demon') && !t.pile(0, 'discardPile').includes('Bouldor Demon'), { a0: t.pile(0, 'discardPile'), a1: t.pile(1, 'discardPile') });
      R.check('Zustand sauber, keine Engine-Fehler', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
    }
  }
  R.finish();
})();
