'use strict';
// W24e · Ergänzungen zu N5-07, N5-09, N5-11, N5-12 (Befund-Repros decken den Kern ab):
//  N5-12 Magic Amethyst: die gewählte Support-Zonen-Ability (Leadership bei Xalibur / Cloak of Edge) wird WIRKLICH abgeworfen (Ablage des Helden-Besitzers,
//        Support Zone leer, Instanz weg), die Ability-Zone bleibt unberührt; die Karte wird gespielt/behalten wie gehabt.
//  N5-11 Piercer of Heavens: Abbruch der Zielwahl (null) → Karte bleibt auf der Hand, kein Schaden.
//  N5-07 Potion of Greed: ohne Sperre spielbar und überspringt die Aktionsphase.
//  N5-09 The Melting: ein Freeze OHNE „unheilbar" (Icebolt auf Kreatur-Wirkung / Cold Coffin auf bereits eingefrorene heilbare Kreatur) wird weiter aufgetaut.
// Aufruf: node docs/niche-tests/repro/W24/e-03-n5-sonstige-ergaenzungen.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    R.section(`Sitz ${seat}`);
    for (const [lbl, aufbau, erwartet] of [
      ['Leadership im Support (Xalibur)', (t) => { t.put(opp, 0, 0, 'Xalibur'); t.put(opp, 0, 1, 'Leadership'); }, 'Leadership'],
      ['Cloak of Edge', (t) => t.put(opp, 0, 0, 'Cloak of Edge'), 'Cloak of Edge'],
    ]) {
      const hand = [[], []]; hand[seat] = ['Magic Amethyst'];
      const t = await H.fresh({ active: seat, hand, abilities: { [opp]: { 0: [['Fighting'], [], []] } } });
      aufbau(t);
      t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { const c = d.cards.find(x => x.name === erwartet) || d.cards[0]; return { cardName: c.name, source: c.source }; } });
      t.script.push({ match: d => d.type === 'cardGallery' || d.type === 'confirm', answer: () => null });   // „behalten?"-Frage ablehnen
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === opp && y.heroIdx === 0); return x ? [x.id] : undefined; };
      const abl0 = t.pile(opp, 'discardPile').length;
      const r = await t.play(seat, 'Magic Amethyst', {});
      const imSupport = t.inst(c => c.name === erwartet && c.zone === 'support' && c.owner === opp).length;
      R.check(`${lbl}: Ability wird abgeworfen (Support Zone leer, Ablage des Helden-Besitzers +1)`, r === true && imSupport === 0 && t.pile(opp, 'discardPile').includes(erwartet) && t.pile(opp, 'discardPile').length === abl0 + 1, { r, imSupport, abl: t.pile(opp, 'discardPile') });
      R.check(`${lbl}: Ability-Zone-Stapel (Fighting) bleibt`, (t.gs.players[opp].abilityZones[0] || []).some(z => z.includes('Fighting')), t.gs.players[opp].abilityZones[0]);
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {   // Piercer: Abbruch
      const hand = [[], []]; hand[seat] = ['Piercer of Heavens'];
      const t = await H.fresh({ active: seat, hand });
      t.targetFn = () => null;
      const hp0 = t.hp(opp, 0);
      await t.play(seat, 'Piercer of Heavens', { hero: 0 });
      R.check('Piercer: Abbruch der Zielwahl → Karte bleibt auf der Hand, kein Schaden', t.pile(seat, 'hand').includes('Piercer of Heavens') && t.hp(opp, 0) === hp0, { hand: t.pile(seat, 'hand'), hp: t.hp(opp, 0) });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {   // Potion of Greed: frei
      const hand = [[], []]; hand[seat] = ['Potion of Greed'];
      const pd = [[], []]; pd[seat] = Array(5).fill('Healing Potion');
      const t = await H.fresh({ active: seat, hand, potionDeck: pd });
      const r = await t.play(seat, 'Potion of Greed', {});
      R.check('Potion of Greed (ohne Sperre): gespielt, 2 Tränke gezogen, Aktionsphase übersprungen', r === true && t.pile(seat, 'hand').filter(n => n === 'Healing Potion').length === 2 && t.gs.players[seat]._skipActionPhaseTurn === t.gs.turn, { r, hand: t.pile(seat, 'hand') });
    }
    {   // The Melting: heilbarer Freeze wird weiter aufgetaut
      const hand = [[], []]; hand[opp] = ['The Melting'];
      const t = await H.fresh({ active: seat, hand });
      t.grantFor(opp, 0, 'The Melting');
      const k = t.put(opp, 0, 0, H.INERT.creature);
      t.policy.confirm = true;
      await t.run(() => t.engine.applyCreatureStatus(k, 'frozen', { sourceOwner: seat, source: 'Test', duration: 9999 }));
      R.check('heilbarer Freeze (ohne unheilbar-Marke): The Melting taut die Kreatur auf', !k.counters.frozen && !k.counters.frozenUnhealable, { c: { ...k.counters } });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
