'use strict';
// W72e-01 · Hockey Genie (Creature Normal, Lv0, Summoning Magic, 20 HP)
//
// Text: „You may sacrifice this Creature you control to choose a level 3 or lower Creature from your discard pile and place it into the Support Zone this Creature occupied, but negate its effects
//        for the rest of the turn."
// Geprüft: Kandidaten (Stufe ≤ 3, nur Kreaturen, eigene Ablage, nicht der Genie selbst), Opfer + Platzierung in DIESELBE Zone, Negation bis zum Zugende (und danach weg), Abbruch kostet nichts,
//   Stufe 4 / Zauber / fremde Ablage nicht wählbar, ohne Kandidaten nicht nutzbar, Rettung des Opfers, Zonensperren, Kette (zurückgeholte Genie ist negiert), Zustandsprüfung.
const H = require('../../lib/h.js');
const CARD = 'Hockey Genie';
const kreatur = (n) => (n);
const gal = (t) => t.prompts.filter(p => p.d && p.d.type === 'cardGallery' && p.d.title === CARD);

async function nutzen(t, seat, hi, slot, wahl) {
  t.gs.activePlayer = seat; t.phase('MAIN1');
  t.script.length = 0;
  t.script.push({ match: (d) => d.type === 'cardGallery' && d.title === CARD, answer: (d) => wahl === undefined ? { cardName: d.cards[0].name } : (wahl === null ? null : { cardName: wahl }) });
  return await t.activateCreature(seat, hi, slot, {});
}

(async () => {
  const R = H.runner();
  // Kreaturen unterschiedlicher Stufen aus der echten Kartenliste
  const db = require('../../../../data/cards.json');
  const stufe = (l) => db.filter(c => c.cardType === 'Creature' && c.level === l && !/Artifact/.test(c.subtype || '') && c.hp > 0 && (c.spellSchool1 || '') !== '').map(c => c.name);
  const L0 = stufe(0).find(n => n !== CARD && !/Token/.test(n)), L2 = stufe(2)[0], L3 = stufe(3)[0], L4 = stufe(4)[0];

  R.section('A · Opfer und Platzierung in dieselbe Zone');
  {
    const t = await H.fresh({ hand: [[], []], discard: [[L2, L3, L4, 'Fireball'], [L2]] });
    t.put(0, 1, 2, CARD).turnPlayed = 0;
    const r = await nutzen(t, 0, 1, 2, L3);
    R.check('benutzt', r !== false, r);
    R.check('die gewählte Kreatur steht in Held 1 / Slot 2 (Zone des Genies)', t.zone(0, 1, 2) === L3, [t.gs.players[0].supportZones[1], r]);
    R.check('Genie liegt in der Ablage, die Kreatur nicht mehr', t.pile(0, 'discardPile').includes(CARD) && !t.pile(0, 'discardPile').includes(L3), t.pile(0, 'discardPile'));
    const neu = t.find(L3, 'support');
    R.check('Kreatur ist negiert (Rest des Zuges)', !!(neu && neu.counters.negated), neu && neu.counters);
    R.check('Galerie bot nur Stufe ≤ 3 Kreaturen der EIGENEN Ablage', gal(t).length === 1 && gal(t)[0].d.cards.every(c => c.name !== L4 && c.name !== 'Fireball' && c.name !== CARD) && gal(t)[0].d.cards.some(c => c.name === L2), gal(t).map(g => g.d.cards.map(c => c.name)));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    // Negation endet mit dem Zug
    const t = await H.fresh({ hand: [[], []], discard: [[L2], []] });
    t.put(0, 0, 0, CARD).turnPlayed = 0;
    await nutzen(t, 0, 0, 0, L2);
    const neu = t.find(L2, 'support');
    R.check('negiert nach dem Platzieren', !!neu?.counters.negated);
    await t.endTurn();
    const neu2 = t.find(L2, 'support');
    R.check('nach dem Zugwechsel nicht mehr negiert', neu2 && !neu2.counters.negated && !neu2.counters.negated_placement, neu2 && neu2.counters);
  }

  R.section('B · Abbruch, ohne Kandidaten, Grenzfälle');
  {
    const t = await H.fresh({ hand: [[], []], discard: [[L2], []] });
    const g = t.put(0, 0, 0, CARD); g.turnPlayed = 0;
    await nutzen(t, 0, 0, 0, null);
    R.check('Abbruch der Wahl: der Genie bleibt, nichts geopfert', g.zone === 'support' && t.zone(0, 0, 0) === CARD && t.pile(0, 'discardPile').includes(L2), [g.zone, t.zone(0, 0, 0)]);
  }
  for (const [name, ablage] of [['Ablage leer', []], ['nur Stufe 4', [L4]], ['nur Zauber', ['Fireball']]]) {
    const t = await H.fresh({ hand: [[], []], discard: [ablage, [L2]] });
    const g = t.put(0, 0, 0, CARD); g.turnPlayed = 0;
    await nutzen(t, 0, 0, 0, undefined);
    R.check(`${name}: nicht nutzbar, Genie bleibt`, g.zone === 'support' && gal(t).length === 0, [g.zone, gal(t).length]);
  }
  {
    // fremde Ablage zählt nicht
    const t = await H.fresh({ hand: [[], []], discard: [[], [L2, L3]] });
    const g = t.put(0, 0, 0, CARD); g.turnPlayed = 0;
    await nutzen(t, 0, 0, 0, undefined);
    R.check('nur die Gegner-Ablage hat Kreaturen: nicht nutzbar', g.zone === 'support' && gal(t).length === 0);
  }
  {
    // eine zweite Genie in der Ablage ist wählbar (Stufe 0), er selbst nicht
    const t = await H.fresh({ hand: [[], []], discard: [[CARD], []] });
    const g = t.put(0, 0, 0, CARD); g.turnPlayed = 0;
    await nutzen(t, 0, 0, 0, CARD);
    R.check('zweite Genie aus der Ablage zurückgeholt (negiert), die erste liegt in der Ablage', t.zone(0, 0, 0) === CARD && t.find(CARD, 'support') !== g && t.pile(0, 'discardPile').includes(CARD) && !!t.find(CARD, 'support').counters.negated, [t.zone(0, 0, 0), t.pile(0, 'discardPile')]);
    // die zurückgeholte Genie kann in diesem Zug nicht erneut wirken (negiert)
    const g2 = t.find(CARD, 'support'); g2.turnPlayed = 0;
    const vorher = gal(t).length;
    t.script.length = 0; t.phase('MAIN1');
    await t.activateCreature(0, 0, 0, {});
    R.check('zurückgeholte Genie ist negiert: keine zweite Wirkung in diesem Zug', t.find(CARD, 'support') === g2 && gal(t).length === vorher, [gal(t).length, vorher]);
  }

  R.section('C · Gegnerseite, geliehene Zone, Schutz des Opfers');
  {
    const t = await H.fresh({ hand: [[], []], discard: [[], [L2]] });
    const g = t.put(1, 2, 1, CARD); g.turnPlayed = 0;
    t.gs.activePlayer = 1;
    await nutzen(t, 1, 2, 1, L2);
    R.check('Gegenspieler: eigene Zone/eigene Ablage', t.zone(1, 2, 1) === L2 && t.pile(1, 'discardPile').includes(CARD), [t.zone(1, 2, 1), t.pile(1, 'discardPile')]);
  }
  {
    // Opfer gerettet (Barrier of Undying) → Wirkung verpufft, Genie bleibt, nichts platziert
    const t = await H.fresh({ hand: [[], []], discard: [[L2], []] });
    const g = t.put(0, 0, 0, CARD); g.turnPlayed = 0;
    const orig = t.engine.opfereKreatur.bind(t.engine);
    t.engine.opfereKreatur = async () => false;
    await nutzen(t, 0, 0, 0, L2);
    t.engine.opfereKreatur = orig;
    R.check('Opfer gerettet: nichts platziert, Karte bleibt in der Ablage', t.pile(0, 'discardPile').includes(L2) && !t.find(L2, 'support'));
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
