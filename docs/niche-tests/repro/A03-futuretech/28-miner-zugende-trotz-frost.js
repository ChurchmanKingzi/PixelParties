'use strict';
// A03-futuretech-28 · Steam Dwarf Miner: der gefrorene/betäubte Miner zieht am Zugende trotzdem (Klasse H04-14: Statusablauf vor den Zugende-Hooks)
//
// Kartentext: „At the end of each of your turns, draw 1 card for every 100 max HP this Creature has.“ (+ „Once per turn, when you discard 1 or more cards, … +50 HP“)
// Aufbau: Miner (max 300) bei Sitz 0; Sitz 1 friert/betäubt ihn in seinem Zug; Sitz 0 ist wieder am Zug, der Miner trägt den Status noch (`isCreatureEffectSuppressed` = true;
//   Kontrolle: ein Abwurf in diesem Zug steigert seine HP NICHT – die Steam Engine ruht).
// Erwartung (Konvention der Engine: Frost/Betäubung legen Kreaturen still): der Miner zieht am Ende dieses Zuges nicht.
// Beobachtet: Er zieht 3 Karten. Grund wie H04-14: `processStatusExpiry('END')` entfernt Frost/Betäubung der Kreaturen des aktiven Spielers VOR `ON_TURN_END` (switchTurn).
// Frage an Al: siehe H04-14 – „Zugende-Effekte trotz Frost des ganzen Zuges“ (bei Kreaturen: Miner, ggf. weitere „At the end of your turn“-Kreaturen).
// ★ W16b: UMGESTELLT auf Als Entscheidung (Welle 3, FIXES-WELLE-3 / FRAGEN-OFFEN „Bereits beantwortet" Nr. 22): „End-of-turn-Trigger nach Frozen/Stunned dürfen feuern, nachdem der Status
//   abgelaufen ist → Ist-Zustand GEWOLLT (C03-18, A03-28, H04-14 = kein Fehler)." Erwartung jetzt: der Miner zieht am Zugende seine 3 Karten (Exit 0).
const H = require('../../lib/h.js');
const MI = 'Steam Dwarf Miner';
(async () => {
  const R = H.runner();
  for (const st of ['frozen', 'stunned']) {
    const t = await H.fresh({ deck: [Array(30).fill(H.INERT.creature), Array(30).fill(H.INERT.creature)], hand: [['Fireball'], []] });
    const m = t.put(0, 0, 0, MI); m.turnPlayed = 1; m.counters.maxHp = 300; m.counters.currentHp = 300;
    await t.endTurn();
    await t.run(() => t.engine.applyCreatureStatus(m, st, { sourceOwner: 1 }));
    await t.endTurn();
    R.check(st + ': Aufbau: Miner ist stillgelegt', t.engine.isCreatureEffectSuppressed(m) === true);
    await t.run(() => t.engine.actionDiscardHandCard(0, 'Fireball', 0));
    R.check(st + ': Aufbau: Abwurf steigert die HP nicht (Steam Engine ruht)', m.counters.maxHp === 300, m.counters.maxHp);
    const h0 = t.pile(0, 'hand').length;
    await t.endTurn();
    R.check(st + ': Miner zieht am Zugende (Status läuft vor den Zugende-Hooks ab — gewollt, Welle 3)', t.pile(0, 'hand').length - h0 === 3, { gezogen: t.pile(0, 'hand').length - h0 });
    R.check(st + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
