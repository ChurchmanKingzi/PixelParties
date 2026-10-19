'use strict';
// H04-14 · „At the end of your turn"-Heldeneffekte laufen NACH dem Ablauf von Frost/Betäubung/Negation des eigenen Zuges  [Stufe C, Querschnitt]
// W16f: Al hat in Welle 3 entschieden: Ist-Zustand GEWOLLT (FIXES-WELLE-3.md) - das Repro prüft jetzt diese Regel.
//
// Beispiel Sett, the Adept of Necromancy: „At the end of your turn, send all Creatures in this Hero's Support Zones that were not summoned this turn to the discard pile."
// Engine-Regel: Frozen/Stunned/Negated schalten Heldeneffekte stumm (`_isHeroEffectSilenced`, Hook-Verteiler `runHooks`); Sett setzt kein `bypassStatusFilter`.
// Beobachtet: `advanceToPhase(END)` (_engine.js ~Z. 22923) ruft `processStatusExpiry('END')` VOR `ON_PHASE_END` und VOR dem `ON_TURN_END` in `switchTurn`;
//   `processStatusExpiry` entfernt frozen/stunned/negated der Helden des aktiven Spielers. Zum Zeitpunkt von Setts Zugende-Hook ist er also nicht mehr
//   stummgeschaltet – obwohl er den GANZEN Zug über gefroren/betäubt/negiert war, räumt er (Pflichtklausel!) seine alten Kreaturen ab. (Das README der Kampagne
//   nimmt die umgekehrte Reihenfolge an: „End-Phase → Zugende-Hooks → Statusablauf".) Gleiches gilt für jeden „Am Ende deines Zuges"-Effekt eines Helden
//   (z. B. Willys Draw-5 am Ende des ersten Zuges).
// Gegenprobe: ein Status mit `sourceBound` (Water Golem) läuft nicht ab und hält Sett wie erwartet still.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SE = 'Sett, the Adept of Necromancy';
  const dl = Array(30).fill(H.INERT.creature);
  async function lauf(status, extra) {
    const t = await H.fresh({ heroes: [[SE, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []], deck: [dl, dl] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const alt = t.put(0, 0, 0, H.INERT.creature); alt.turnPlayed = 1;
    if (status) await t.run(() => t.engine.addHeroStatus(0, 0, status, { appliedBy: 1, ...(extra || {}) }));
    const stumm = t.engine._isHeroEffectSilenced(0, 0);
    t.gs.currentPhase = 4;
    await t.endTurn();
    return { stummVorZugende: stumm, kreaturNoch: t.zone(0, 0, 0) === H.INERT.creature, err: t.errors };
  }
  const norm = await lauf(null);
  R.check('Kontrolle: gesunder Sett räumt seine alte Kreatur am Zugende ab', norm.kreaturNoch === false, norm);
  for (const st of ['frozen', 'stunned', 'negated']) {
    const o = await lauf(st);
    // W16f (Al, Welle 3: "End-of-turn-Trigger nach Frozen/Stunned dürfen feuern, nachdem der Status abgelaufen ist -> Ist-Zustand gewollt"):
    // Erwartung umgestellt - der Status läuft vor den Zugende-Hooks ab, die Klausel feuert, die alte Kreatur wird abgeräumt.
    R.check(`Sett ${st} über den ganzen Zug (vor dem Zugende stumm: ${o.stummVorZugende}): Status läuft vor den Zugende-Hooks ab, die Klausel feuert (Welle 3: gewollt)`, o.stummVorZugende === true && o.kreaturNoch === false, o);
  }
  const sb = await lauf('negated', { sourceBound: true });
  R.check('Gegenprobe: quellgebundene Negation (läuft nicht ab) hält Sett still', sb.kreaturNoch === true, sb);
  R.finish();
})();
