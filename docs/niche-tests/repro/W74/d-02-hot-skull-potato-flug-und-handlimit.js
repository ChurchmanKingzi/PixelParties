'use strict';
// W74d-02 · Hot Skull Potato: (1) Weiterreichen = sichtbarer Sprung der KARTE (`hot_potato_throw`, von → nach, während des Flugs in keiner Zone); (2) die Wirkung (Zahlung/Explosion) kommt VOR dem Abwurf auf die Handgröße.
const H = require('../../lib/h.js');
const CARD = 'Hot Skull Potato';
const potato = (t) => t.engine.cardInstances.find(c => c.name === CARD && c.zone === 'support');

async function aufbau(handGroesse1) {
  const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], Array(handGroesse1).fill('ZZ Filler')], gold: 100 });
  t.grantFor(0, 0, CARD);
  await t.play(0, CARD, { hero: 0 });   // landet bei Sitz 1
  return t;
}

(async () => {
  const R = H.runner();

  R.section('A · Flug: Ereignis mit Start- und Zielzone, Karte liegt währenddessen in keiner Zone');
  {
    const t = await aufbau(3);
    const p = potato(t);
    const von = { owner: t.engine.physicalSide(p), heroIdx: p.heroIdx, zoneSlot: p.zoneSlot };
    t.events.length = 0;
    let inZone = null;
    const orig = t.engine._delay.bind(t.engine);
    t.engine._delay = async (ms) => {
      if (ms === 710) inZone = [0, 1].some(s => t.gs.players[s].supportZones.some(hz => hz.some(z => (z || []).includes(CARD))));
      return orig(ms);
    };
    t.gs.activePlayer = 1;
    await t.run(async () => { await t.engine.runHooks('onTurnEnd', { turn: t.gs.turn, activePlayer: 1 }); await t.engine._runPostChainActions(); });
    const fl = t.evs('play_zone_animation').filter(e => e.type === 'hot_potato_throw');
    R.check('genau ein Flug-Ereignis', fl.length === 1, fl.length);
    const e = fl[0] || {};
    R.check('Start = alte Zone (Sitz 1), Ziel = neue Zone (Sitz 0)', e.targets && e.targets[0].owner === von.owner && e.targets[0].heroIdx === von.heroIdx && e.targets[0].zoneSlot === von.zoneSlot && e.targets[1].owner === 0, e.targets);
    const q = potato(t);
    R.check('die Karte selbst springt: Start-Ziel trägt den Kartennamen', e.targets && e.targets[0].cardName === CARD, e.targets && e.targets[0]);
    R.check('Ziel-Ereignis zeigt die tatsächliche Landezone', q && e.targets && e.targets[1].heroIdx === q.heroIdx && e.targets[1].zoneSlot === q.zoneSlot, [q && [q.heroIdx, q.zoneSlot], e.targets && e.targets[1]]);
    R.check('während des Flugs liegt die Karte in keiner Zone', inZone === false, inZone);
    R.check('nach dem Flug liegt sie beim Spieler 0, Counter 2', q && t.engine.physicalSide(q) === 0 && q.counters.skullCounter === 2, q && [t.engine.physicalSide(q), q.counters.skullCounter]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('B · echte END-Phase: erst die Kartoffel (1 Karte), danach das Handlimit (7) — nicht umgekehrt');
  {
    const t = await aufbau(8);   // Sitz 1 hält 8 Karten, Limit 7
    t.gs.activePlayer = 1; t.gs.currentPhase = 4;
    const disc0 = t.pile(1, 'discardPile').length;
    await t.run(() => t.engine.advanceToPhase(1, 5, { manual: true }));
    await t.run(() => t.engine._runPostChainActions());
    const q = potato(t);
    R.check('Kartoffel weitergereicht (liegt bei Sitz 0)', q && t.engine.physicalSide(q) === 0, q && t.engine.physicalSide(q));
    R.check('Hand danach genau 7 (1 Karte für die Kartoffel — das Handlimit hat nichts mehr abgeworfen)', t.pile(1, 'hand').length === 7, t.pile(1, 'hand').length);
    R.check('genau 1 Karte auf der Ablage dazugekommen', t.pile(1, 'discardPile').length === disc0 + 1, [disc0, t.pile(1, 'discardPile').length]);
  }
  {
    // Explosion: kein Angebot möglich (kein freier Gegnerplatz) — trotzdem VOR dem Handlimit; die Hand wird danach auf 7 gekürzt
    const t = await aufbau(9);
    t.gs.activePlayer = 1; t.gs.currentPhase = 4;
    const reihenfolge = [];
    const e = t.engine;
    const oH = e.enforceHandLimit.bind(e);
    e.enforceHandLimit = async (...a) => { reihenfolge.push('handlimit'); return oH(...a); };
    const oE = e.actionDestroyCard.bind(e);
    e.actionDestroyCard = async (...a) => { if (a[1] && a[1].name === CARD) reihenfolge.push('kartoffel'); return oE(...a); };
    // alle freien Zonen bei Sitz 0 belegen
    for (let hi = 0; hi < 3; hi++) for (let zi = 0; zi < 3; zi++) if (!t.gs.players[0].supportZones[hi][zi]?.length) t.put(0, hi, zi, 'ZZ Dummy');
    await t.run(() => t.engine.advanceToPhase(1, 5, { manual: true }));
    R.check('Reihenfolge: Kartoffel vor Handlimit', reihenfolge[0] === 'kartoffel' && reihenfolge.includes('handlimit'), reihenfolge);
    R.check('Hand auf 7 gekürzt', t.pile(1, 'hand').length <= 7, t.pile(1, 'hand').length);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
