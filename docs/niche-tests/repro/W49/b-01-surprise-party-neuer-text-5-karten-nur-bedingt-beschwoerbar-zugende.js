'use strict';
// W49b · Al, 22.10.2026: „‚Surprise Party' braucht einen neuen Text: ‚Reveal the top card of your deck until you reveal a level 3 or lower Creature. Place that Creature into one of the user's free
//   Support Zones, if possible. If the Creature's level is higher than the user's Support Magic level, your opponent draws 2 cards times the difference. Shuffle all other revealed cards back into your
//   deck. If you reveal 5 cards before you reveal an appropriate Creature, terminate this effect. Immediately end your turn afterwards.' Das Beenden der Runde passiert, egal, ob der Effekt erfolgreich
//   ist oder nicht. Außerdem: Creatures, die ‚only' unter bestimmten Voraussetzungen beschworen werden können, etwa Foresta, sollen KEINE legalen Ziele sein!"
// Geprüft (beide Sitze):
//   1) Kreatur gefunden (Stufe 3 > Support Magic 2): platziert, Gegner zieht 2 × 1, übrige Aufgedeckte zurück ins Deck, Kartenbilanz stimmt, Zugende angefordert.
//   2) 5er-Grenze: 5 unpassende Karten oben → Effekt endet, nichts platziert, kein Ziehen, alle 5 zurück im Deck, Zugende trotzdem; die Kreatur als 5. Karte zählt noch (wird gefunden).
//   3) Nur-unter-Bedingung-Kreaturen (Foresta, Guardian Beast, Spirit, Elven Rider, Ifrit, Blue-Ice Dragon …) werden aufgedeckt, zählen für die Grenze, werden NICHT platziert und kommen ins Deck zurück.
//   4) Keine freie Zone beim Auflösen / Kreatur erfüllt ihre eigenen Bedingungen nicht: nichts platziert, Zug endet trotzdem.
//   5) Negiert (Silence) bevor sie wirkt: Deck unberührt, KEIN Zugende.
//   6) Sofort-Guss (Zusatzaktion): Zugende angefordert; im Zug des Gegners (kein eigener Zug): kein Zugende.
//   7) Das Prädikat `nurUnterBedingungBeschwoerbar`: genau die inventarisierte Kartenmenge (Gegenprobe: Limits/„may"-Wege/Reaktions-Kreaturen sind KEINE Treffer).
// Zugende = `gs._terrorForceEndTurn` (Harness hat keinen Socket, der Verbraucher in server.js sendGameState läuft hier nicht — Flagge und Quelle werden geprüft).
// W50a (Al, 22.10.2026): Plant Golem / Elusive Hind sind KEINE legalen Ziele – Surprise Party überspringt sie, zählt sie als aufgedeckt und mischt sie zurück (so schon umgesetzt; eigene Prüfung W50/a-04).
// Aufruf: node docs/niche-tests/repro/W49/b-01-surprise-party-neuer-text-5-karten-nur-bedingt-beschwoerbar-zugende.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { nurUnterBedingungBeschwoerbar } = require('../../../../cards/effects/_summon-eligibility');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const FILL = ['Slow', 'Meteor Crash', 'Fireball', 'Rockfall', 'Icebolt'];   // Nicht-Creatures
const KREATUR = 'Cannon Tower';                                                // Stufe 3, kein canSummon, kein „only"
const gesamt = (t, pi) => { const ps = t.gs.players[pi]; let n = (ps.mainDeck || []).length + (ps.hand || []).length + (ps.discardPile || []).length; for (const z of ps.supportZones) for (const s of z) n += (s || []).length; return n; };
const zonenBelegt = (t, pi) => t.gs.players[pi].supportZones.reduce((a, z) => a + z.reduce((b, s) => b + (s || []).length, 0), 0);
const sortiert = (a) => [...a].sort();

async function szene(me, deck, o = {}) {
  const op = 1 - me;
  const d = [[], []]; d[me] = deck; d[op] = ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'];
  const hand = [[], []]; hand[me] = ['Surprise Party']; if (o.opHand) hand[op] = o.opHand;
  const t = await H.fresh({ hand, hp: 800, deck: d, active: me, gold: 200 });
  t.setAbilities(me, 0, [['Support Magic', 'Support Magic'], [], []]);
  return t;
}
const zugEnde = (t, me) => t.gs._terrorForceEndTurn === me && t.gs._terrorForceEndSource?.name === 'Surprise Party';

(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    R.section(`Sitz ${me} wirkt Surprise Party`);
    {   // 1) gefunden
      const deck = ['Slow', 'Meteor Crash', KREATUR, 'Fireball', 'Rockfall'];
      const t = await szene(me, deck);
      const vor = gesamt(t, me);
      const r = await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      const zone = t.gs.players[me].supportZones[0].map(s => (s || [])[0]);
      R.check('1) gespielt, Kreatur steht in einer Support Zone von Held 0', r === true && zone.includes(KREATUR), { r, zone });
      R.check('1) Gegner zieht 2 × (3 − 2) = 2 Karten', t.pile(op, 'hand').length === 2, t.pile(op, 'hand'));
      R.check('1) Deck: 2 unaufgedeckte + 2 zurückgemischte Karten, die Kreatur ist nicht mehr im Deck', t.pile(me, 'mainDeck').length === 4 && !t.pile(me, 'mainDeck').includes(KREATUR)
        && sortiert(t.pile(me, 'mainDeck')).join() === sortiert(['Slow', 'Meteor Crash', 'Fireball', 'Rockfall']).join(), t.pile(me, 'mainDeck'));
      R.check('1) Kartenbilanz des Wirkers stimmt (Zauber in der Ablage, sonst nichts verloren)', gesamt(t, me) === vor, { vor, nach: gesamt(t, me) });
      R.check('1) Zugende angefordert (Quelle Surprise Party)', zugEnde(t, me), { f: t.gs._terrorForceEndTurn, s: t.gs._terrorForceEndSource });
      R.check('1) sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // 1b) Kreatur mit Stufe ≤ Support Magic: kein Ziehen
      const t = await szene(me, ['Slow', H.INERT.creature, 'Fireball']);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('1b) Stufe 0 ≤ Support Magic 2: platziert, Gegner zieht nicht, Zugende trotzdem', zonenBelegt(t, me) === 1 && t.pile(op, 'hand').length === 0 && zugEnde(t, me), { z: zonenBelegt(t, me), h: t.pile(op, 'hand'), f: t.gs._terrorForceEndTurn });
    }
    {   // 2) Grenze 5
      const deck = [...FILL, KREATUR, 'Fireball'];
      const t = await szene(me, deck);
      const vor = gesamt(t, me);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('2) 5 unpassende Karten: nichts platziert', zonenBelegt(t, me) === 0, t.gs.players[me].supportZones);
      R.check('2) Gegner zieht nicht', t.pile(op, 'hand').length === 0, t.pile(op, 'hand'));
      R.check('2) Deck wieder vollständig (7 Karten, die Kreatur als 6. Karte blieb unaufgedeckt)', t.pile(me, 'mainDeck').length === 7 && sortiert(t.pile(me, 'mainDeck')).join() === sortiert(deck).join(), t.pile(me, 'mainDeck'));
      R.check('2) Es wurden genau 5 Karten aufgedeckt', t.lg('surprise_party_reveal').length === 5, t.lg('surprise_party_reveal').length);
      R.check('2) Zugende trotzdem', zugEnde(t, me) && gesamt(t, me) === vor, { f: t.gs._terrorForceEndTurn, vor, nach: gesamt(t, me) });
      R.check('2) sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // 2b) die Kreatur ist die 5. Karte → wird noch gefunden
      const t = await szene(me, [...FILL.slice(0, 4), KREATUR, 'Fireball']);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('2b) Kreatur als 5. Karte: platziert (4 Karten davor, die Grenze ist erst bei 5 ohne Treffer)', zonenBelegt(t, me) === 1 && t.pile(op, 'hand').length === 2, { z: zonenBelegt(t, me), h: t.pile(op, 'hand') });
    }
    {   // 3) nur-unter-Bedingung-Kreaturen
      const nur = ['Foresta, the Guard', 'Guardian Beast Hu', 'Spirit of the Heart Bow', 'Elven Rider'];
      const deck = [...nur, KREATUR, 'Fireball'];
      const t = await szene(me, deck);
      const vor = gesamt(t, me);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      const zone = t.gs.players[me].supportZones[0].map(s => (s || [])[0]);
      R.check('3) vier Nur-unter-Bedingung-Kreaturen übersprungen, die normale Kreatur (5. Karte) wird platziert', zone.includes(KREATUR) && zonenBelegt(t, me) === 1, zone);
      R.check('3) die vier kehren ins Deck zurück (Deck: Fireball + 4)', sortiert(t.pile(me, 'mainDeck')).join() === sortiert([...nur, 'Fireball']).join(), t.pile(me, 'mainDeck'));
      R.check('3) alle fünf Aufdeckungen im Log, die vier als „restricted"', t.lg('surprise_party_reveal').length === 5 && t.lg('surprise_party_reveal').filter(l => l.restricted).length === 4, t.lg('surprise_party_reveal'));
      R.check('3) Bilanz + Zugende', gesamt(t, me) === vor && zugEnde(t, me), { vor, nach: gesamt(t, me) });
    }
    {   // 3b) fünf Bedingte hintereinander → Grenze, auch ohne Zonenplatzierung
      const nur = ['Foresta, the Guard', 'Guardian Beast Gou', 'Ifrit', 'Blue-Ice Dragon', 'Spirit of the Ultimate Gun'];
      const deck = [...nur, KREATUR];
      const t = await szene(me, deck);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('3b) fünf Bedingte: kein Treffer, Effekt endet, Deck vollständig, Zug endet', zonenBelegt(t, me) === 0 && sortiert(t.pile(me, 'mainDeck')).join() === sortiert(deck).join() && zugEnde(t, me), { z: zonenBelegt(t, me), d: t.pile(me, 'mainDeck') });
    }
    {   // 4a) keine freie Zone beim Auflösen
      const t = await szene(me, ['Slow', KREATUR, 'Fireball']);
      const e = t.engine, orig = e.getFreeSupportZones.bind(e), takeOrig = e.takeFromPileSync.bind(e);
      let gestartet = false;
      e.takeFromPileSync = (...a) => { gestartet = true; return takeOrig(...a); };
      e.getFreeSupportZones = (...a) => gestartet ? [] : orig(...a);
      const vor = gesamt(t, me);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('4a) keine freie Zone: nichts platziert, Kreatur zurück im Deck, Gegner zieht nicht', zonenBelegt(t, me) === 0 && t.pile(me, 'mainDeck').includes(KREATUR) && t.pile(op, 'hand').length === 0, { z: zonenBelegt(t, me), d: t.pile(me, 'mainDeck') });
      R.check('4a) Zug endet trotzdem, Bilanz stimmt', zugEnde(t, me) && gesamt(t, me) === vor, { vor, nach: gesamt(t, me) });
    }
    {   // 4b) Kreatur erfüllt ihre eigenen Bedingungen nicht (Cute Phoenix: „You can only control 1" — eine steht schon auf dem Brett)
      const t = await szene(me, ['Slow', 'Cute Phoenix', 'Fireball']);
      t.put(me, 1, 0, 'Cute Phoenix');
      R.check('4b) Ausgangslage: Cute Phoenix ist für Held 0 nicht beschwörbar', t.engine.isCreatureSummonable('Cute Phoenix', me, 0) === false, {});
      const vor = gesamt(t, me);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('4b) nicht platziert (nur der eine Phoenix von vorher), Phoenix zurück im Deck, Gegner zieht nicht, Zug endet trotzdem',
        zonenBelegt(t, me) === 1 && t.pile(me, 'mainDeck').includes('Cute Phoenix') && t.pile(op, 'hand').length === 0 && zugEnde(t, me) && gesamt(t, me) === vor, { z: zonenBelegt(t, me), d: t.pile(me, 'mainDeck') });
    }
    {   // 5) negiert → kein Zugende
      const t = await szene(me, ['Slow', KREATUR, 'Fireball'], { opHand: ['Silence'] });
      for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, 'Silence');
      t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Silence', answer: (d) => ({ optionId: d.options[0].id }) });
      t.script.push({ match: d => d.type === 'heroAction', answer: () => ({ cancelled: true }) });
      const r = await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      await t.run(() => t.engine._runPostChainActions());
      R.check('5) Silence hat negiert (Silence verbraucht), Deck unberührt, nichts platziert', !t.pile(op, 'hand').includes('Silence') && t.pile(me, 'mainDeck').length === 3 && zonenBelegt(t, me) === 0 && t.lg('surprise_party_reveal').length === 0, { r, hand: t.pile(op, 'hand'), deck: t.pile(me, 'mainDeck') });
      R.check('5) KEIN Zugende (Karte wirkte nie)', t.gs._terrorForceEndTurn == null, t.gs._terrorForceEndTurn);
      R.check('5) sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // 6) Sofort-Guss
      const t = await szene(me, ['Slow', KREATUR, 'Fireball']);
      const r = await t.run(() => t.engine._castSpellImmediately(me, 0, 'Surprise Party', { by: 'W49b' }));
      R.check('6) Sofort-Guss (eigener Zug): wirkt (Kreatur platziert) und fordert das Zugende an', zonenBelegt(t, me) === 1 && zugEnde(t, me), { r, z: zonenBelegt(t, me), f: t.gs._terrorForceEndTurn });
      R.check('6) sauber', sauber(t), { e: t.errors, a: t.audit() });
      const u = await szene(me, ['Slow', KREATUR, 'Fireball']);
      u.gs.activePlayer = op;   // Guss im Zug des Gegners: „your turn" ist nicht dran
      await u.run(() => u.engine._castSpellImmediately(me, 0, 'Surprise Party', { by: 'W49b' }));
      R.check('6) Guss im Zug des Gegners: Effekt läuft, aber der Zug des Gegners wird NICHT beendet', u.gs._terrorForceEndTurn == null && u.lg('surprise_party_reveal').length >= 1, { f: u.gs._terrorForceEndTurn, rev: u.lg('surprise_party_reveal').length });
    }
  }

  R.section('7) Prädikat nurUnterBedingungBeschwoerbar');
  {
    const DB = require('../../../../cards/effects/_card-db').getCardDB();
    const erwartet = [
      '500 Piranhas in a Monster Suit', 'Blue-Ice Dragon', 'Dark Deepsea God', 'Disgruntled Forest Warden', 'Elusive Hind', 'Elven Rider', 'Foresta, the Guard',
      'Gigantisaur Chimera', 'Gigantisaur King Trex', 'Guardian Beast Gou', 'Guardian Beast Hou', 'Guardian Beast Hu', 'Guardian Beast Ji', 'Guardian Beast Long', 'Guardian Beast Ma',
      'Guardian Beast Niu', 'Guardian Beast She', 'Guardian Beast Shu', 'Guardian Beast Tu', 'Guardian Beast Yang', 'Guardian Beast Zhu', 'Hot Skull Potato', 'Ifrit',
      'Invader from the Cosmic Depths', 'Piggyfied Hero', 'Plant Golem', 'Pollution Piranha', 'Rebelliokai Oblivious Oni', 'Sparkfly Queen', 'Spirit of the Barbarian Sword',
      'Spirit of the Forbidden Grimoire', 'Spirit of the Heart Bow', 'Spirit of the Relic Hammer', 'Spirit of the Shattered Trident', 'Spirit of the Super-Killing Knife',
      'Spirit of the Ultimate Gun', 'Steam Dwarf Dragon Pilot', 'The Egg of God', 'Trident Spirit - Hammer Absorbed',
    ];
    const treffer = Object.values(DB).filter(cd => /Creature/.test(cd.cardType || '') && nurUnterBedingungBeschwoerbar(cd, cd.name)).map(cd => cd.name);
    R.check('Treffermenge = inventarisierte Liste (39 Karten)', sortiert(treffer).join('|') === sortiert(erwartet).join('|'), { zuViel: treffer.filter(n => !erwartet.includes(n)), fehlt: erwartet.filter(n => !treffer.includes(n)) });
    const kein = ['Archer', 'Archer of Teocuilatl', 'Black Marketeer', 'Nimble Monkee', 'Front Soldier', 'Doomed Town Guard', 'Deepsea Bats', 'Eager Oarsman', 'Mischief Militia - Chilly Wizard', 'Stowaway', 'Water Golem',
      'Gigantisaur Triceras', 'Queen of Kings [W]', 'Cannon Tower', H.INERT.creature, 'Rook of Kings [W]', 'Rook of Kings [B]', 'Soul Shard Ba', 'Elven Archer', 'Slave Trader', 'Pet Snake', 'Ash Worms'];
    R.check('Gegenprobe: Limits, „may"-Alternativwege, Reaktions-Kreaturen und Normalkarten sind KEINE Treffer', kein.every(n => !nurUnterBedingungBeschwoerbar(DB[n], n)), kein.filter(n => nurUnterBedingungBeschwoerbar(DB[n], n)));
  }
  R.finish();
})();
