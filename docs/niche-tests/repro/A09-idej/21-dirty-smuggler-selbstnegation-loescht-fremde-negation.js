'use strict';
// A09-21 · Dirty Smuggler: der Ablauf der Selbstnegation löscht auch eine FREMDE, längere Negation
// Kartentext Dirty Smuggler: „If your opponent has no Gold, draw twice that many cards instead and then negate this Creature's effect for the rest of the turn."
// Skript: dirty-smuggler.js ruft `actionNegateCreature(inst, …, { selfInflicted, expiresAtTurn: turn+1, expiresForPlayer })`. Die Engine legt je Quelle einen Eintrag in `counters.buffs` an
// (`clearCountersOnExpire: ['negated']`); läuft DER EINE Eintrag ab, wird `counters.negated` gelöscht, obwohl ein zweiter Eintrag (andere Quelle, noch nicht abgelaufen, oder ohne Ablauf) weiter besteht.
// Gleiche Klasse wie der Prüfauftrag C05-02 (Zugende-Räumung entfernt `negated` ohne `sourceBound`).
// Aufbau: Seed 1234. Sitz 0: Dirty Smuggler. Sitz 1: 0 Gold.
// Schritte: 1. Sitz 1 zieht per Effekt 2 Karten (Smuggler zieht 4 und ist bis Zugende negiert). 2. Danach negiert eine andere Karte den Smuggler länger bzw. dauerhaft. 3. t.endTurn().
// Erwartet: Nach Ablauf der Selbstnegation ist der Smuggler wegen der zweiten Quelle weiter negiert.
// Beobachtet: `counters.negated` ist weg, obwohl der Buff-Eintrag der zweiten Quelle noch in `counters.buffs` steht – die fremde Negation ist vorzeitig erloschen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const fremd of ['permanent', 'bis Zug+6']) {
    const t = await H.fresh({ hand: [[], []], gold: [30, 0] });
    const sm = t.put(0, 0, 0, 'Dirty Smuggler');
    await t.run(() => t.engine.actionDrawCards(1, 2));
    R.check('Voraussetzung (' + fremd + '): Smuggler hat sich selbst negiert', !!sm.counters.negated, sm.counters);
    if (fremd === 'permanent') await t.run(() => t.engine.actionNegateCreature(sm, 'Fremdkarte'));
    else await t.run(() => t.engine.actionNegateCreature(sm, 'Fremdkarte', { expiresAtTurn: t.gs.turn + 6, expiresForPlayer: 0 }));
    await t.endTurn();
    R.check('Fremdnegation (' + fremd + ') überlebt den Ablauf der Selbstnegation', !!sm.counters.negated, { buffs: sm.counters.buffs });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
