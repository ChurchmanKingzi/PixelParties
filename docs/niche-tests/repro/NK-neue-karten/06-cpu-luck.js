'use strict';
// NK-06 · CPU-Heuristik für Luck und Liquid Luck (Al, 23.10.2026: Reactions/Surprises sind deklarierbar, die CPU-Heuristik zieht nach)
// Stufen des Wählers (`cpuGenericChoice`, Typ `cardNamePicker`): 1. Muster aus dem Log (aktivierte Surprises/Reactions zählen als Plays), 2. Zufallskarte aus der Gegnerhand
// (sichere Plays vor Reactions/Surprises), 3. Deck, 4. verdeckte Surprise des Gegners, 5. Reaction/Surprise aus Hand/Deck. Dazu: Liquid Luck wird nur bei nicht leerem Deck gespielt.
const H = require('../../lib/h.js');
const cpu = require('../../../../cards/effects/_cpu.js');
const { loadCardEffect } = H;
(async () => {
  const R = H.runner();
  const alle = Object.keys(H.DB).filter(n => H.DB[n].cardType !== 'Token');
  for (const titel of ['Luck', 'Liquid Luck']) {
    R.section(`Wähler (${titel})`);
    const frisch = async (hand1, deck1 = ['Fireball'], surprises = []) => {
      const t = await H.fresh({ hand: [[], hand1], deck: [['Fireball', 'Fireball'], deck1], gold: 100 });
      for (const n of surprises) t.putSurprise(1, 0, n);
      return t;
    };
    const wahl = (t) => cpu._test.cpuGenericChoice(t.engine, { type: 'cardNamePicker', title: titel, cardNames: alle, cancellable: true }, 0)?.cardName;
    { const t = await frisch(['Anti-Magnet', 'Fireball', 'Gold Trap']); const n = wahl(t);
      R.check('Hand mit Normal-Spell + Reaction + Surprise: sicherer Play (Fireball) zuerst', n === 'Fireball', n); }
    { const t = await frisch(['Anti-Magnet', 'Gold Trap'], ['Fireball'], []); const n = wahl(t);
      R.check('Hand nur Reaction/Surprise, Deck mit Fireball: das Deck-Spiel (sicherer Play) vor der Reaction', n === 'Fireball', n); }
    { const t = await frisch(['Anti-Magnet', 'Gold Trap'], ['Anti-Magnet'], ['Cactus Creature']); const n = wahl(t);
      R.check('nur Reactions/Surprises: die verdeckte Surprise des Gegners (Cactus Creature)', n === 'Cactus Creature', n); }
    { const t = await frisch(['Anti-Magnet', 'Gold Trap'], ['Gold Trap'], []); const n = wahl(t);
      R.check('keine verdeckte Surprise: Reaction/Surprise aus der Hand', n === 'Anti-Magnet' || n === 'Gold Trap', n); }
    { const t = await frisch([], ['Anti-Magnet'], []); const n = wahl(t);
      R.check('leere Hand, im Deck nur eine Reaction: sie wird deklariert (statt abzubrechen)', n === 'Anti-Magnet', n); }
    { const t = await frisch(['Fireball', 'Heal']);
      t.engine.actionLog = [];
      for (const turn of [1, 2, 3]) t.engine.actionLog.push({ type: 'surprise_activated', player: t.gs.players[1].username, card: 'Gold Trap', turn }, { type: 'spell_played', player: t.gs.players[1].username, card: 'Heal', turn: turn });
      const n = wahl(t);
      R.check('Muster: Gold Trap wurde in jedem Zug AKTIVIERT (und Heal gespielt) — der Wähler nennt eine der beiden Dauerkarten', n === 'Gold Trap' || n === 'Heal', n);
      t.engine.actionLog = t.engine.actionLog.filter(e => e.type === 'surprise_activated');
      const n2 = wahl(t);
      R.check('Muster nur aus aktivierten Surprises: Gold Trap', n2 === 'Gold Trap', n2); }
    { const t = await frisch(['Fireball']); const n = wahl(t);
      R.check('Gegenprobe: keine Heldennamen, keine Tokens', n === 'Fireball' && H.DB[n].cardType !== 'Hero', n); }
    R.check(`${titel}: Wähler gibt nie einen Namen außerhalb der Liste zurück`, await (async () => { const t = await frisch(['Anti-Magnet']); const r = cpu._test.cpuGenericChoice(t.engine, { type: 'cardNamePicker', title: titel, cardNames: ['Fireball'], cancellable: true }, 0); return r === null || r.cardName === 'Fireball'; })(), null);
  }

  R.section('Liquid Luck: Entscheidung „spielen oder nicht" und CPU-Durchlauf');
  {
    const ac = loadCardEffect('Liquid Luck').cpuMeta.alwaysCommit;
    const t = await H.fresh({ hand: [['Liquid Luck'], ['Fireball']], deck: [Array(5).fill('Fireball'), ['Fireball']], gold: 100 });
    R.check('alwaysCommit ist eine Funktion', typeof ac === 'function', typeof ac);
    R.check('Deck gefüllt → CPU spielt den Trank', ac(t.engine, 0) === true, null);
    t.gs.players[0].mainDeck = [];
    R.check('Deck leer → CPU spielt ihn nicht um jeden Preis', ac(t.engine, 0) === false, null);
  }
  {   // CPU-Sitz 0 spielt den Trank durch die installierte CPU-Heuristik; Sitz 1 hat Fireball auf der Hand
    const t = await H.fresh({ hand: [['Liquid Luck'], ['Fireball', 'Heal']], deck: [['Fireball', 'Heal', 'Fireball', 'Heal'], ['Fireball', 'Heal']], gold: 100 });
    cpu.installCpuBrain(t.engine);
    await t.play(0, 'Liquid Luck');
    const marker = t.engine.cardInstances.find(c => c.name === 'Liquid Luck' && c.zone === 'deleted' && c.owner === 0);
    R.check('CPU hat den Trank gespielt und einen Namen deklariert', !!marker && !!marker.counters.liquidLuckZiel, marker && marker.counters);
    R.check('der deklarierte Name ist eine Karte aus der Gegnerhand (Fireball/Heal)', marker && ['Fireball', 'Heal'].includes(marker.counters.liquidLuckZiel), marker && marker.counters.liquidLuckZiel);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
