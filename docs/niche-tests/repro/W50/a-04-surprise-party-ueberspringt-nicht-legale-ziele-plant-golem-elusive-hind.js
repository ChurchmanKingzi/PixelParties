'use strict';
// W50a · Punkt 4 · Al, 22.10.2026: „Plant Golem und Elusive Hind sollten keine legalen Ziele sein; Surprise Party soll sie ÜBERSPRINGEN und einfach weiter Karten ‚ausgraben' (oder bei 5 abbrechen)."
// Kartentext: „Reveal the top card of your deck until you reveal a level 3 or lower Creature. Place that Creature into one of the user's free Support Zones, if possible. […]
//   Shuffle all other revealed cards back into your deck. If you reveal 5 cards before you reveal an appropriate Creature, terminate this effect. Immediately end your turn afterwards."
// Lesart (dokumentiert): übersprungene Karten sind AUFGEDECKTE Karten und zählen deshalb für die 5-Karten-Grenze („5 cards before you reveal an appropriate Creature"); sie gehören zu den
// „other revealed cards" und werden ins Deck zurückgemischt (Al: ja). Sie landen weder in den Zonen des Nutzers noch auf dem Brett des Gegners. Zugende immer.
// Beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const KREATUR = 'Cannon Tower';
const nurPlatz = (t, s) => t.gs.players[s].supportZones.flat().flat();
const alle = (t, s) => { const ps = t.gs.players[s]; return [...(ps.mainDeck || []), ...(ps.hand || []), ...(ps.discardPile || []), ...nurPlatz(t, s)].length; };
const sortiert = (a) => [...a].sort();
const zugEnde = (t, me) => t.gs._terrorForceEndTurn === me && t.gs._terrorForceEndSource?.name === 'Surprise Party';
async function szene(me, deck) {
  const op = 1 - me;
  const d = [[], []]; d[me] = deck; d[op] = ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'];
  const hand = [[], []]; hand[me] = ['Surprise Party'];
  const t = await H.fresh({ hand, hp: 800, deck: d, active: me, gold: 200 });
  t.setAbilities(me, 0, [['Support Magic', 'Support Magic'], [], []]);
  return t;
}
(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    R.section(`Sitz ${me} wirkt Surprise Party`);
    for (const skip of ['Plant Golem', 'Elusive Hind']) {
      {   // übersprungen, dann wird die nächste passende Creature gefunden
        const deck = [skip, 'Slow', KREATUR, 'Fireball'];
        const t = await szene(me, deck);
        const vor = alle(t, me);
        const r = await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
        const eigene = nurPlatz(t, me), gegner = nurPlatz(t, op);
        R.check(`${skip} übersprungen: stattdessen steht ${KREATUR} in der Zone des Nutzers`, r === true && eigene.includes(KREATUR) && !eigene.includes(skip), { r, eigene });
        R.check(`${skip}: nicht auf dem Brett des Gegners, nicht in den Zonen des Nutzers`, !gegner.includes(skip) && !eigene.includes(skip), { eigene, gegner });
        R.check(`${skip}: zurück im Deck (Deck: ${skip}, Slow, Fireball)`, sortiert(t.pile(me, 'mainDeck')).join() === sortiert([skip, 'Slow', 'Fireball']).join(), t.pile(me, 'mainDeck'));
        R.check(`${skip}: zählt als aufgedeckte Karte (3 Aufdeckungen, die ersten beiden unpassend)`, t.lg('surprise_party_reveal').length === 3 && t.lg('surprise_party_reveal').filter(l => !l.qualifies).length === 2, t.lg('surprise_party_reveal'));
        R.check(`${skip}: Bilanz stimmt, Zugende`, alle(t, me) === vor && zugEnde(t, me), { vor, nach: alle(t, me) });
        R.check(`${skip}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
      }
    }
    {   // beide hintereinander + drei Füller = 5 Karten ohne Treffer → Abbruch, alles zurück, Zug endet
      const deck = ['Plant Golem', 'Elusive Hind', 'Slow', 'Fireball', 'Rockfall', KREATUR];
      const t = await szene(me, deck);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('Plant Golem + Elusive Hind + 3 Füller: 5 Karten ohne Treffer → Effekt endet, nichts platziert, die Creature als 6. Karte bleibt unaufgedeckt', nurPlatz(t, me).length === 0 && nurPlatz(t, op).length === 0 && t.lg('surprise_party_reveal').length === 5, { eigene: nurPlatz(t, me), n: t.lg('surprise_party_reveal').length });
      R.check('Abbruch: Deck wieder vollständig (alle 6), Gegner zieht nicht, Zugende', sortiert(t.pile(me, 'mainDeck')).join() === sortiert(deck).join() && t.pile(op, 'hand').length === 0 && zugEnde(t, me), { d: t.pile(me, 'mainDeck') });
      R.check('Abbruch: sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // die übersprungenen zählen mit: 4 übersprungene + Creature als 5. Karte → gefunden; 5 übersprungene + Creature danach → nicht gefunden
      const t = await szene(me, ['Plant Golem', 'Elusive Hind', 'Plant Golem', 'Elusive Hind', KREATUR]);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('4 Übersprungene + Creature als 5. Karte: platziert', nurPlatz(t, me).includes(KREATUR) && nurPlatz(t, me).length === 1, nurPlatz(t, me));
      const u = await szene(me, ['Plant Golem', 'Elusive Hind', 'Plant Golem', 'Elusive Hind', 'Plant Golem', KREATUR]);
      await u.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('5 Übersprungene → Grenze erreicht, die Creature danach wird nicht mehr aufgedeckt', nurPlatz(u, me).length === 0 && u.lg('surprise_party_reveal').length === 5 && zugEnde(u, me), { eigene: nurPlatz(u, me), n: u.lg('surprise_party_reveal').length }); }
    {   // Gegenprobe: eine Alternativ-Beschwörer-Creature (Archer of Teocuilatl: „may sacrifice … additional Action") bleibt legales Ziel
      const t = await szene(me, ['Archer of Teocuilatl', 'Fireball']);
      await t.play(me, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('Gegenprobe: Archer of Teocuilatl (Alternativ-Beschwörung) wird als Erstes gefunden und platziert', nurPlatz(t, me).includes('Archer of Teocuilatl'), nurPlatz(t, me)); }
  }
  R.finish();
})();
