'use strict';
// W74d-01 · Hot Skull Potato (Creature Normal Lv2, 1 HP)
// „Summon this card into the free Support Zone of any Hero your opponent controls and put a Skull Counter on it. This Creature is unaffected by all other cards and effects. At the end
//  of your turn, if this Creature is in one of your Heroes' Support Zones, you may discard cards from your hand equal to the number of Skull Counters on this Creature to place it into
//  the free Support Zone of any Hero your opponent controls and place a Skull Counter on it. Otherwise, this Creature is defeated and all targets you control take 50 damage +50 times
//  the number of Skull Counters on this card."   (Der zahlende Spieler ist immer der, in dessen Zone die Karte gerade liegt.)
const H = require('../../lib/h.js');
const CARD = 'Hot Skull Potato';
const fertig = (t) => t.run(() => t.engine._runPostChainActions());
const potato = (t) => t.engine.cardInstances.find(c => c.name === CARD && c.zone === 'support');
const zugEnde = (t, seat) => { t.gs.activePlayer = seat; return t.run(async () => { await t.engine.runHooks('onTurnEnd', { turn: t.gs.turn, activePlayer: seat }); await t.engine._runPostChainActions(); }); };

async function aufbau(o = {}) {
  const t = await H.fresh({ hand: [[CARD, 'ZZ Filler', 'ZZ Filler'], ['ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']], gold: 100, ...(o.fresh || {}) });
  t.grantFor(0, 0, CARD);
  return t;
}

(async () => {
  const R = H.runner();

  R.section('A · Spielen: in die freie Zone eines gegnerischen Helden, Skull Counter 1, Schild, Level 2');
  {
    const t = await aufbau();
    R.check('Level 2 in cards.json', t.DB[CARD].level === 2, t.DB[CARD].level);
    const r = await t.play(0, CARD, { hero: 0 });
    const p = potato(t);
    R.check('gespielt', r === true && !!p, r);
    R.check('liegt beim Gegner (Seite 1), Besitzer bleibt Spieler 0, Kontrolleur = Gegner', p && t.engine.physicalSide(p) === 1 && p.owner === 0 && (p.controller ?? p.owner) === 1, p && [t.engine.physicalSide(p), p.owner, p.controller]);
    R.check('Skull Counter = 1', p && p.counters.skullCounter === 1, p && p.counters);
    R.check('Immunschild gesetzt', p && !!p.counters._cardinalImmune);
    // Der Prüfer kennt seitenfremde Platzierungen nicht (Besitzer ≠ Brettseite) — dasselbe meldet er für den Plant Golem; nur Fremdmeldungen zählen.
    const fremd = t.audit().filter(x => !/Hot Skull Potato/.test(x));
    R.check('Zustand sauber (ohne die bekannte seitenfremde Platzierung)', t.errors.length === 0 && fremd.length === 0, [t.errors, fremd]);
  }

  R.section('B · „unaffected by all other cards and effects"');
  {
    const t = await aufbau();
    await t.play(0, CARD, { hero: 0 });
    const p = potato(t);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'ZZ Test', owner: 0, heroIdx: 0 }, p, 500, 'creature', { sourceOwner: 0, canBeNegated: true }));
    R.check('Schaden ändert nichts', !!potato(t), potato(t) && potato(t).zone);
    await t.run(() => t.engine.actionDestroyCard({ name: 'ZZ Test', owner: 0 }, p));
    R.check('Zerstörung ändert nichts', !!potato(t) && potato(t).zone === 'support');
    await t.run(() => t.engine.actionMoveCard(p, 'hand', -1, -1, { source: 'Test', sourceOwner: 0 }));
    R.check('Bounce ändert nichts', !!potato(t) && potato(t).zone === 'support');
  }

  R.section('C · Zugende des Halters: bezahlen (Counter-Zahl Karten) → weiterreichen, Counter +1');
  {
    const t = await aufbau();
    await t.play(0, CARD, { hero: 0 });
    const p = potato(t);
    const hand1 = t.pile(1, 'hand').length;
    await zugEnde(t, 1);   // Halter = Spieler 1
    R.check('Angebot an den HALTER (Sitz 1)', t.prompts.some(pr => pr.pi === 1 && pr.d && pr.d.type === 'confirm' && pr.d.title === CARD), t.prompts.map(pr => [pr.pi, pr.d && pr.d.title]));
    R.check('1 Karte abgeworfen (Counter 1)', t.pile(1, 'hand').length === hand1 - 1, [hand1, t.pile(1, 'hand').length]);
    const q = potato(t);
    R.check('liegt jetzt beim Spieler 0, Counter 2, Kontrolleur Spieler 0', q && t.engine.physicalSide(q) === 0 && q.counters.skullCounter === 2 && (q.controller ?? q.owner) === 0, q && [t.engine.physicalSide(q), q.counters.skullCounter, q.controller]);
    R.check('Schild noch gesetzt', q && !!q.counters._cardinalImmune);
    R.check('keine Explosion: keine Schadens-Abzüge', t.hp(1, 0) === 800 && t.hp(0, 0) === 800, [t.hp(1, 0), t.hp(0, 0)]);
    // zweite Runde: jetzt zahlt Spieler 0 zwei Karten
    t.setHand(0, ['ZZ Filler', 'ZZ Filler', 'ZZ Filler']);
    t.gs.turn += 1;
    await zugEnde(t, 0);
    const r2 = potato(t);
    R.check('zweite Runde: Spieler 0 zahlt 2 Karten, Counter 3 beim Gegner', r2 && t.pile(0, 'hand').length === 1 && r2.counters.skullCounter === 3 && t.engine.physicalSide(r2) === 1, r2 && [t.pile(0, 'hand').length, r2.counters.skullCounter]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().filter(x => !/Hot Skull Potato/.test(x)).length === 0, [t.errors, t.audit()]);
  }

  R.section('D · Ablehnen: Explosion, 50 + 50 × Counter auf ALLE Ziele des Halters, Karte besiegt');
  {
    const t = await aufbau({ fresh: { confirm: false } });
    t.put(1, 1, 0, 'ZZ Dummy Big');     // eigene Kreatur des Halters
    t.put(0, 1, 0, 'ZZ Dummy Big');     // Kreatur des Gegners (darf nichts abbekommen)
    await t.play(0, CARD, { hero: 0 });
    const hp = [0, 1, 2].map(i => t.hp(1, i)), opp = [0, 1, 2].map(i => t.hp(0, i));
    await zugEnde(t, 1);
    R.check('Karte besiegt', !potato(t), potato(t) && potato(t).zone);
    R.check('alle drei Helden des Halters: −100', [0, 1, 2].every(i => t.hp(1, i) === hp[i] - 100), [0, 1, 2].map(i => t.hp(1, i)));
    const krea = t.engine.cardInstances.find(c => c.name === 'ZZ Dummy Big' && c.owner === 1);
    R.check('seine Kreatur: −100', krea && (krea.counters.currentHp ?? 1000) === 900, krea && krea.counters.currentHp);
    R.check('Helden des Gegners unberührt', [0, 1, 2].every(i => t.hp(0, i) === opp[i]), [0, 1, 2].map(i => t.hp(0, i)));
    const geg = t.engine.cardInstances.find(c => c.name === 'ZZ Dummy Big' && c.owner === 0);
    R.check('Kreatur des Gegners unberührt', geg && (geg.counters.currentHp ?? 1000) === 1000, geg && geg.counters.currentHp);
    R.check('Karte landet in der Ablage des BESITZERS (Spieler 0)', t.pile(0, 'discardPile').includes(CARD), t.pile(0, 'discardPile'));
    R.check('große Explosion gesendet', t.evs('play_zone_animation').some(e => e.type === 'hot_potato_blast'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('E · Explosion auch ohne Angebotsmöglichkeit: zu wenige Handkarten / kein freier Platz');
  {
    const t = await aufbau();
    await t.play(0, CARD, { hero: 0 });
    potato(t).counters.skullCounter = 3;
    t.setHand(1, ['ZZ Filler', 'ZZ Filler']);   // nur 2 Karten, Counter 3
    const hp0 = t.hp(1, 0);
    await zugEnde(t, 1);
    R.check('zu wenige Karten: kein Angebot, Explosion mit 50 + 150 = 200', !potato(t) && t.hp(1, 0) === hp0 - 200 && !t.prompts.some(pr => pr.d && pr.d.title === CARD && pr.d.type === 'confirm'), [t.hp(1, 0), hp0]);
  }
  {
    const t = await aufbau();
    await t.play(0, CARD, { hero: 0 });
    for (let hi = 0; hi < 3; hi++) for (let si = 0; si < 3; si++) if (!(t.gs.players[0].supportZones[hi][si] || []).length) t.put(0, hi, si, 'ZZ Dummy');   // keine freie Zone beim Gegner des Halters
    const hp0 = t.hp(1, 0);
    await zugEnde(t, 1);
    R.check('kein freier Platz: Explosion', !potato(t) && t.hp(1, 0) === hp0 - 100, [t.hp(1, 0), hp0]);
  }

  R.section('F · nur am Zugende des HALTERS');
  {
    const t = await aufbau();
    await t.play(0, CARD, { hero: 0 });
    const hp0 = t.hp(0, 0);
    await zugEnde(t, 0);   // Zugende des Besitzers, Halter ist der Gegner
    R.check('am Ende des Zuges des NICHT-Halters passiert nichts', !!potato(t) && t.hp(0, 0) === hp0 && !t.prompts.some(pr => pr.d && pr.d.title === CARD && pr.d.type === 'confirm'), t.prompts.map(pr => pr.d && pr.d.title));
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
