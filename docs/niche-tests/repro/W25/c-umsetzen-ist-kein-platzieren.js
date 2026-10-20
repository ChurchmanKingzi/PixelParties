'use strict';
// W25c · N3-13 Nachtrag (Al, Welle 25): Bewegung löst NIE On-Summon-Effekte aus – nur „Kreatur in Zone gesetzt"-Beobachter (Ingo, Pes'zet …) feuern über `onCardEnterZone` (`_isMove`).
//   „Platzieren im Sinne von 'place' ja, Platzieren im Sinne von 'von einer Zone in die andere bewegen' nicht": die Stempel von Knight of Kings („diesen Zug beschworen") und
//   Queen of Kings („1 Queen pro Zug") setzt nur ein echtes Platzieren/Beschwören (Karte kommt NEU aufs Board), nie das Umsetzen einer liegenden Kreatur.
// Wege: `actionTransferCreature` (eigene Kreatur auf einen anderen eigenen Helden; fremde Kreatur übernommen = Kontrollwechsel), Guard Change, Slippery Skates.
// Exit 0 = Beobachter feuern bei Bewegung, On-Summon der bewegten Kreatur und die Of-Kings-Stempel nicht.
const H = require('../../lib/h.js');
const OK = require('../../../../cards/effects/_of-kings-shared.js');
const ING = 'Ingo, Investor of Evil';
const heroes = () => [[ING, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
(async () => {
  const R = H.runner();
  const zp = { match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) };

  // Bewegt `name` (liegt bei Sitz 0, Held 1, Platz 0) auf einem von drei Wegen zu Held 0 und liefert den Zustand.
  async function bewege(weg, name, extra) {
    const t = await H.fresh({ heroes: heroes(), hand: weg === 'guard' ? [['Guard Change'], []] : [[], []], ...(extra || {}) });
    if (weg === 'guard') t.setAbilities(0, 1, [['Support Magic', 'Support Magic'], [], []]);
    if (weg === 'skates') t.put(0, 1, 2, 'Slippery Skates');
    const c = t.put(0, 1, 0, name); c.turnPlayed = 1;
    t.reset();
    t.script.push({ match: d => d.type === 'cardGallery' || d.type === 'optionPicker', answer: d => d.cards ? { cardName: d.cards[0].name, selectedCards: [d.cards[0].name] } : { optionId: (d.options || [])[0]?.id } });
    t.script.push(zp);
    t.targetFn = (v) => { const x = v.find(y => y.type === 'equip' && y.owner === 0); return x ? [x.id] : undefined; };
    const v = { gold: t.gs.players[0].gold, deck: t.pile(0, 'mainDeck').length, summoned: t.gs.players[0]._creaturesSummonedThisTurn || 0 };
    let r;
    if (weg === 'transfer') r = await t.run(() => t.engine.actionTransferCreature(c, 0, 0, 1, {}));
    else if (weg === 'guard') r = await t.play(0, 'Guard Change', { hero: 1 });
    else r = await t.activateEquip(0, 1, 2);
    return { t, c, v, r, bewegt: c.heroIdx === 0 };
  }

  R.section('Beobachter („Kreatur in Zone gesetzt") feuern bei Bewegung; On-Summon der bewegten Kreatur nicht');
  for (const weg of ['transfer', 'guard', 'skates']) {
    const o = await bewege(weg, H.INERT.creature);
    R.check(`${weg}: Kreatur wurde zu Held 0 bewegt`, o.bewegt, { heroIdx: o.c.heroIdx });
    R.check(`${weg}: Ingo (Held 0) bekommt für die hereinkommende Kreatur 4 Gold`, o.t.gs.players[0].gold - o.v.gold === 4, o.t.gs.players[0].gold - o.v.gold);
    const k = await bewege(weg, 'Scavenging Crane');
    R.check(`${weg}: Scavenging Crane bewegt – ihr On-Summon (Ordnen/Ziehen) feuert NICHT`, k.bewegt && k.t.pile(0, 'mainDeck').length === k.v.deck && !k.t.prompts.some(p => p.d.type === 'cardReorder'), { deck: k.t.pile(0, 'mainDeck').length - k.v.deck });
    R.check(`${weg}: Ingo feuert für die bewegte Crane trotzdem`, k.t.gs.players[0].gold - k.v.gold === 4, k.t.gs.players[0].gold - k.v.gold);
    R.check(`${weg}: keine Engine-Fehler`, o.t.errors.length + k.t.errors.length === 0 && o.t.audit().length === 0 && k.t.audit().length === 0, { e: o.t.errors.concat(k.t.errors) });
  }
  {   // fremde Kreatur übernehmen (Kontrollwechsel) = ebenfalls Eintritt für Ingo, kein On-Summon der Kreatur
    const t = await H.fresh({ heroes: heroes() });
    const c = t.put(1, 0, 0, 'Scavenging Crane'); c.turnPlayed = 1; t.reset();
    const g0 = t.gs.players[0].gold, d0 = t.pile(0, 'mainDeck').length;
    await t.run(() => t.engine.actionTransferCreature(c, 0, 0, 1, {}));
    R.check('Übernahme einer Gegnerkreatur: Ingo +4 Gold, Crane zieht nicht', c.controller === 0 && t.gs.players[0].gold - g0 === 4 && t.pile(0, 'mainDeck').length === d0, { gold: t.gs.players[0].gold - g0, deck: d0 - t.pile(0, 'mainDeck').length });
  }
  {   // Pes'zet: gleiche Beobachter-Regel
    const hs = [["Pes'zet, the Plague Bringer", H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
    const t = await H.fresh({ heroes: hs });
    const c = t.put(0, 1, 0, H.INERT.creature); c.turnPlayed = 1;
    const ziel = t.put(1, 0, 0, H.INERT.creature);
    t.reset();
    t.targetFn = (v) => { const x = v.find(y => y.type === 'equip' && y.owner === 1); return x ? [x.id] : undefined; };
    await t.run(() => t.engine.actionTransferCreature(c, 0, 0, 1, {}));
    R.check("Pes'zet: die bewegte Kreatur löst seinen Eintritts-Trigger aus (Gift auf dem gewählten Ziel)", !!(ziel.statuses?.poisoned || ziel.counters?.poisoned || ziel.counters?.poisonStacks), { st: ziel.statuses, cn: ziel.counters });
  }

  R.section('Of-Kings-Stempel: nur Platzieren/Beschwören, nie Bewegen');
  const stempel = (t) => ({
    knight: t.gs.hoptUsed?.[`ofkings-summoned:${OK.KNIGHT}:0`] === t.gs.turn,
    queen: t.gs.hoptUsed?.[`ofkings-summoned:${OK.QUEEN}:0`] === t.gs.turn,
  });
  for (const name of ['Knight of Kings [W]', 'Knight of Kings [B]', 'Queen of Kings [W]', 'Queen of Kings [B]']) {
    for (const weg of ['transfer', 'guard', 'skates']) {
      const o = await bewege(weg, name);
      const s = stempel(o.t);
      R.check(`${name} per ${weg} bewegt: weder Knight- noch Queen-Stempel, kein Beschwörungszähler`, o.bewegt && !s.knight && !s.queen && (o.t.gs.players[0]._creaturesSummonedThisTurn || 0) === o.v.summoned, { bewegt: o.bewegt, s, z: o.t.gs.players[0]._creaturesSummonedThisTurn });
    }
  }
  R.section('Gegenprobe: Platzieren („place") setzt die Stempel');
  for (const [name, feld] of [['Knight of Kings [W]', 'knight'], ['Knight of Kings [B]', 'knight'], ['Queen of Kings [W]', 'queen'], ['Queen of Kings [B]', 'queen']]) {
    const t = await H.fresh({ heroes: heroes(), hand: [[name], []] });
    const r = await t.run(() => t.engine.actionPlaceCreature(name, 0, 1, 0, { source: 'hand', sourceName: 'Test' }));
    R.check(`${name} platziert: Stempel „${feld}" gesetzt`, !!(r && r.inst) && stempel(t)[feld], stempel(t));
  }
  R.finish();
})();
