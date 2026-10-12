'use strict';
// A02-deepsea-01 · Deepsea Siren: die Verknüpfung hängt am PLATZ des Ziels, nicht an der Karte
//
// Kartentext (Deepsea Siren): „When you summon this Creature, choose any target on the board. Any damage this
// Creature takes is also applied to that target. When this Creature is defeated by an opponent's card or effect,
// also defeat the chosen target."
//
// Erwartung: Gespiegelt wird nur an das GEWÄHLTE Ziel (die Karte). Ist es weg (tot) oder verschoben, trifft der
// Schaden nichts bzw. weiter genau diese Karte – nie eine andere Kreatur, die zufällig im alten Platz steht.
// Beobachtet: `_sirenLinkHeroIdx/_sirenLinkSlotIdx` speichert Koordinaten (deepsea-siren.js `_resolveLinkedTarget`,
//  Suche über owner/heroIdx/zoneSlot). (a) Stirbt X und landet Y im selben Platz, bekommt Y den gespiegelten Schaden /
//  stirbt mit der Siren. (b) Rutscht das Ziel (Slippery Narw: eigener Zugbeginn), verliert die Siren die Verbindung.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();

  R.section('(a) Ziel X stirbt, Nachfolger Y im selben Platz – Y darf NICHT gespiegelten Schaden nehmen');
  {
    const t = await H.fresh({ hand: [['Deepsea Siren'], []] });
    const x = t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1 && v.heroIdx === 0 && v.slotIdx === 0).id];
    await t.play(0, 'Deepsea Siren', { hero: 0, slot: 0 });
    const siren = t.find('Deepsea Siren', 'support');
    await t.run(() => t.engine.actionDestroyCard({ name: 'k', owner: 0 }, x));
    const y = t.put(1, 0, 0, H.INERT.big);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Src', owner: 1 }, siren, 30, 'creature', { sourceOwner: 1 }));
    R.check('Siren hat 30 Schaden genommen', siren.counters.currentHp === 70, siren.counters.currentHp);
    R.check('Y (nie gewählt) bleibt unverletzt', (y.counters.currentHp ?? 1000) === 1000, y.counters.currentHp);
    // Tod der Siren durch den Gegner: „also defeat the chosen target" – Y darf nicht sterben
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Src', owner: 1 }, siren, 500, 'creature', { sourceOwner: 1 }));
    R.check('Y (nie gewählt) lebt nach dem Tod der Siren', t.inst(c => c.id === y.id && c.zone === 'support').length === 1, { ablageGegner: t.pile(1, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(b) Ziel rutscht (Slippery Narw am Zugbeginn) – gewähltes Ziel muss weiter gespiegelten Schaden nehmen');
  {
    const t = await H.fresh({ hand: [['Deepsea Siren'], []] });
    t.put(0, 0, 0, 'Slippery Narw');
    const narw = t.find('Slippery Narw', 'support'); narw.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 0 && v.cardName === 'Slippery Narw').id];
    await t.play(0, 'Deepsea Siren', { hero: 0, slot: 1 });
    t.targetFn = () => null;                       // Narws Einsatz-Effekt: nichts besiegen
    const siren = t.find('Deepsea Siren', 'support');
    await t.endTurn(); await t.endTurn();          // Sitz 0 ist wieder dran: Slippery rutscht
    const moved = narw.heroIdx !== 0;
    R.check('Vorbedingung: Narw ist gerutscht', moved, [narw.heroIdx, narw.zoneSlot]);
    const hp0 = narw.counters.currentHp ?? 80;
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Src', owner: 1 }, siren, 30, 'creature', { sourceOwner: 1 }));
    R.check('Narw (gewähltes Ziel) nimmt den gespiegelten Schaden', (narw.counters.currentHp ?? 80) === hp0 - 30, { hp0, now: narw.counters.currentHp });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
