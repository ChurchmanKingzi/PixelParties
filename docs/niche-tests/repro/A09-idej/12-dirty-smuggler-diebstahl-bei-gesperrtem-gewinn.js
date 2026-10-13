'use strict';
// A09-12 · Dirty Smuggler: Ist der Goldgewinn des Diebes gesperrt, verliert das Opfer trotzdem Gold – es verschwindet
// Kartentext Dirty Smuggler: „Whenever your opponent draws 1 or more cards through an effect, you may steal four times that much Gold."
// Kartentext Tuscan Aristocrat: „While you control this Creature, your opponent cannot gain any Gold outside their Resource Phase."   Golden Arrow: „You cannot gain or spend Gold for the rest of the turn afterwards."
// Engine: `actionStealGold` (_engine.js Z. 24744) zieht dem Opfer das Gold ab (Z. 24765) und ruft DANACH `actionGainGold` – dessen Rückgabe wird ignoriert; ist der Gewinn gesperrt (goldLocked) oder abgebrochen (Aristocrat), ist das Gold weg.
// Aufbau: Seed 1234. Sitz 0: Dirty Smuggler (Held 0, Slot 0), 30 Gold. Sitz 1: 40 Gold. Szene A: Sitz 1 kontrolliert Tuscan Aristocrat. Szene B: Sitz 0 hat `goldLocked` (Zustand nach Golden Arrow).
// Schritte: Sitz 1 zieht per Effekt 2 Karten (engine.actionDrawCards(1, 2)); Dirty Smuggler: „steal 8 Gold" -> Ja.
// Erwartet: Wer nicht gewinnen darf, kann auch nicht stehlen – der Diebstahl scheitert, das Opfer behält sein Gold (Gold bleibt Summe 70 erhalten; Kontrolle: Diebstahl 8 Gold).
// Beobachtet: Das Opfer verliert 8 Gold, der Dieb erhält 0 (Log trotzdem „gold_steal"). Gold geht aus dem Spiel verloren.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const lauf = async (scen) => {
    const t = await H.fresh({ hand: [[], []], gold: [30, 40] });
    t.put(0, 0, 0, 'Dirty Smuggler');
    if (scen === 'A') t.put(1, 0, 0, 'Tuscan Aristocrat');
    if (scen === 'B') t.gs.players[0].goldLocked = true;
    await t.run(() => t.engine.actionDrawCards(1, 2));
    return { dieb: t.gs.players[0].gold, opfer: t.gs.players[1].gold, summe: t.gs.players[0].gold + t.gs.players[1].gold, fragen: t.prompts.filter(p => p.d.title === 'Dirty Smuggler').length, errors: t.errors };
  };
  R.section('Kontrolle ohne Sperre');
  const k = await lauf('K');
  R.check('Diebstahl 8 Gold (Dieb 38, Opfer 32)', k.dieb === 38 && k.opfer === 32, k);
  R.section('A: Gegner kontrolliert Tuscan Aristocrat (Dieb darf außerhalb seiner Resource Phase kein Gold gewinnen)');
  const a = await lauf('A');
  R.check('Gold bleibt erhalten (Summe 70)', a.summe === 70, a);
  R.section('B: Dieb steht unter Goldsperre (Golden Arrow)');
  const b = await lauf('B');
  R.check('Gold bleibt erhalten (Summe 70)', b.summe === 70, b);
  R.check('keine Engine-Fehler', a.errors.length === 0 && b.errors.length === 0, [a.errors, b.errors]);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
