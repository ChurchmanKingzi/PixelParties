'use strict';
// W73d-01 · Shroomasaur (Creature Normal Lv0, 90 HP)
// „You may once per turn give this Creature the name of any other card in addition to its own name for the rest of the turn. If this Creature leaves the board because of your own card or
//  effect, draw 1 card. You can only control 1 "Shroomasaur" at a time."
const H = require('../../lib/h.js');
const CARD = 'Shroomasaur';

async function nennen(t, seat, hi, slot, name) {
  t.gs.activePlayer = seat; t.phase('MAIN1');
  t.script.length = 0;
  t.script.push({ match: (d) => d.type === 'cardNamePicker' && d.title === CARD, answer: name === null ? null : { cardName: name } });
  return t.activateCreature(seat, hi, slot, {});
}
const picker = (t) => t.prompts.filter(p => p.d && p.d.type === 'cardNamePicker' && p.d.title === CARD);

(async () => {
  const R = H.runner();

  R.section('A · Zusatzname geben');
  {
    const t = await H.fresh({ hand: [[], []] });
    const s = t.put(0, 0, 0, CARD); s.turnPlayed = 0;
    const r = await nennen(t, 0, 0, 0, 'Fireball');
    R.check('benutzt', r !== false, r);
    R.check('Zusatzname „Fireball" an der Karte, gilt für diesen Zug', s.counters._zusatzName === 'Fireball' && s.counters._zusatzNameZug === t.gs.turn, s.counters);
    R.check('eigener Name bleibt', s.name === CARD);
    R.check('Engine: trägt beide Namen', t.engine.instHatName(s, CARD) && t.engine.instHatName(s, 'Fireball') && !t.engine.instHatName(s, 'Icebolt'));
    R.check('Wähler bot alle anderen Karten, nicht Shroomasaur selbst', picker(t).length === 1 && !picker(t)[0].d.cardNames.includes(CARD) && picker(t)[0].d.cardNames.includes('Fireball'), picker(t).map(p => p.d.cardNames.length));
    R.check('Pilz-Animation an der Karte', t.evs('play_zone_animation').some(e => e.type === 'shroomasaur_spores' && e.owner === 0 && e.heroIdx === 0 && e.zoneSlot === 0));
    t.script.length = 0;
    const r2 = await nennen(t, 0, 0, 0, 'Icebolt');
    R.check('zweiter Einsatz im selben Zug: nicht möglich (einmal pro Zug)', s.counters._zusatzName === 'Fireball', s.counters);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    void r2;
  }
  {
    // Abbruch verbraucht nichts
    const t = await H.fresh({ hand: [[], []] });
    const s = t.put(0, 0, 0, CARD); s.turnPlayed = 0;
    await nennen(t, 0, 0, 0, null);
    R.check('Abbruch: kein Name', !s.counters._zusatzName, s.counters);
    await nennen(t, 0, 0, 0, 'Icebolt');
    R.check('danach noch benutzbar', s.counters._zusatzName === 'Icebolt', s.counters);
  }
  {
    // Der Name gilt nur bis zum Zugende
    const t = await H.fresh({ hand: [[], []] });
    const s = t.put(0, 0, 0, CARD); s.turnPlayed = 0;
    await nennen(t, 0, 0, 0, 'Fireball');
    await t.endTurn();
    R.check('nach dem Zugwechsel trägt sie den Zusatznamen nicht mehr', !t.engine.instHatName(s, 'Fireball') && t.engine.instHatName(s, CARD), [t.gs.turn, s.counters]);
  }

  R.section('B · der Zusatzname zählt bei „You can only control 1 …"');
  {
    const t = await H.fresh({ hand: [['Clone'], []] });
    const s = t.put(0, 0, 0, CARD); s.turnPlayed = 0;
    t.put(0, 1, 0, H.INERT.creature);
    R.check('vorher: Clone ist beschwörbar', t.engine.isCreatureSummonable('Clone', 0, 2) === true);
    await nennen(t, 0, 0, 0, 'Clone');
    R.check('Shroomasaur heißt auch „Clone": Clone nicht beschwörbar', t.engine.isCreatureSummonable('Clone', 0, 2) === false);
    R.check('… und die Handkopie ist als gesperrt erkennbar', t.engine.nurEinerSchonKontrolliert(0, 'Clone') === true);
    const ok = await t.engine._runBeforeSummon('Clone', 0, 2);
    R.check('… auch `beforeSummon` verweigert', ok === false, ok);
    R.check('Gegner kann Clone weiterhin beschwören', t.engine.isCreatureSummonable('Clone', 1, 2) === true);
  }

  R.section('C · „leaves the board because of your own card or effect": 1 Karte ziehen');
  {
    const mk = async () => { const t = await H.fresh({ hand: [[], []], deckSize: 12 }); const s = t.put(0, 0, 0, CARD); s.turnPlayed = 0; return { t, s }; };
    const hand = (t) => t.pile(0, 'hand').length;
    {
      const { t, s } = await mk();
      await t.run(() => t.engine.actionDestroyCard({ name: 'Eigener Zauber', owner: 0, heroIdx: 0 }, s));
      R.check('von eigener Karte zerstört: 1 gezogen', hand(t) === 1, hand(t));
    }
    {
      const { t, s } = await mk();
      await t.run(() => t.engine.actionDestroyCard({ name: 'Gegnerischer Zauber', owner: 1, heroIdx: 0 }, s));
      R.check('von GEGNERISCHER Karte zerstört: nichts gezogen', hand(t) === 0, hand(t));
    }
    {
      const { t, s } = await mk();
      await t.run(() => t.engine.actionMoveCard(s, 'hand', -1, -1, { source: 'Eigener Effekt', sourceOwner: 0 }));
      R.check('von eigenem Effekt auf die Hand gebounct: Karte zurück + 1 gezogen', hand(t) === 2, t.pile(0, 'hand'));
    }
    {
      const { t, s } = await mk();
      await t.run(() => t.engine.actionMoveCard(s, 'support', 1, 1, { source: 'Eigener Effekt', sourceOwner: 0 }));
      R.check('Umzug innerhalb des Bretts: nichts gezogen', hand(t) === 0, hand(t));
    }
    {
      const { t, s } = await mk();
      await t.run(() => t.engine.actionDestroyCard({ name: 'Zauber', owner: 0, heroIdx: 0 }, s));
      R.check('Zustand sauber nach dem Abgang', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
    {
      // besiegt durch einen eigenen Zauber (Schaden)
      const t = await H.fresh({ hand: [['Fireball'], []], deckSize: 12 });
      const s = t.put(1, 0, 0, CARD); s.turnPlayed = 0;     // Shroomasaur beim GEGNER, Besitzer ist Sitz 1
      t.grantFor(0, 0, 'Fireball'); t.gs.players[0].heroes[0].atk = 100;
      t.targetFn = (valid) => valid.filter(v => v.id === 'equip-1-0-0').map(v => v.id);
      await t.play(0, 'Fireball', { hero: 0 });
      t.targetFn = null;
      R.check('Shroomasaur des Gegners von MEINEM Zauber besiegt: der Gegner (Besitzer) zieht nicht', t.pile(1, 'hand').length === 0, t.pile(1, 'hand'));
    }
    {
      const t = await H.fresh({ hand: [['Quick Attack'], []], deckSize: 12 });
      const s = t.put(0, 0, 0, CARD); s.turnPlayed = 0;     // eigenes Shroomasaur, vom eigenen Attack erschlagen
      t.gs.players[0].heroes[0].atk = 300; t.gs.players[0].heroes[0].baseAtk = 300;
      const vor = t.pile(0, 'hand').length;
      t.targetFn = (valid) => valid.filter(v => v.id === 'equip-0-0-0').map(v => v.id);
      await t.play(0, 'Quick Attack', { hero: 0 });
      t.targetFn = null;
      R.check(`eigenes Shroomasaur vom eigenen Attack besiegt: 1 gezogen (Hand ${vor} → ${t.pile(0, 'hand').length})`, !t.find(CARD, 'support') && t.pile(0, 'hand').length === vor - 1 + 1, [t.pile(0, 'hand'), t.logs.map(l => l.type)]);
    }
  }

  {
    // vom Gegner mit einem Attack besiegt: keine Karte
    const t = await H.fresh({ hand: [[], ['Quick Attack']], deckSize: 12, active: 1 });
    const s = t.put(0, 0, 0, CARD); s.turnPlayed = 0;
    t.gs.players[1].heroes[0].atk = 300; t.gs.players[1].heroes[0].baseAtk = 300;
    t.targetFn = (valid) => valid.filter(v => v.id === 'equip-0-0-0').map(v => v.id);
    await t.play(1, 'Quick Attack', { hero: 0 });
    t.targetFn = null;
    R.check('vom GEGNER besiegt: Shroomasaur weg, der Besitzer zieht nicht', !t.find(CARD, 'support') && t.pile(0, 'hand').length === 0, [t.pile(0, 'hand')]);
  }

  R.section('D · „only 1 Shroomasaur"');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.put(0, 0, 0, CARD);
    R.check('zweite Shroomasaur nicht beschwörbar', t.engine.isCreatureSummonable(CARD, 0, 1) === false);
    R.check('Gegner darf eine eigene', t.engine.isCreatureSummonable(CARD, 1, 1) === true);
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
