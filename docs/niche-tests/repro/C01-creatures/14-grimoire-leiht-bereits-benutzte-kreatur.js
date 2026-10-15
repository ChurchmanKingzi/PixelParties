'use strict';
// C01-creatures-14 · Spirit of the Forbidden Grimoire leiht den Effekt von Cannon Tower, obwohl dieser im selben Zug schon benutzt wurde (Giant mit 3/3 Nutzungen wird dagegen ausgeschlossen)
// Kartentext Cannon Tower: „You may once per turn choose a target and deal 150 damage to it."
// Kartentext Grimoire: „This Creature may once per turn use the active effects of up to 2 Creatures on the board with different names, except „Spirit of the Forbidden Grimoire", whose combined levels do not exceed 4. …"
// Aufbau: Seed 1234. Sitz 0: Grimoire-Spirit (Held 2), Cannon Tower (Held 0), 3-Headed Giant (Held 1), alle alt. Main Phase 1; Ziel immer Gegner-Held 0.
// Teil A: Tower normal aktivieren (150), dann Grimoire aktivieren und den Tower wählen.
// Teil B: Giant dreimal normal aktivieren (3/3), dann Grimoire aktivieren – der Giant wird nicht angeboten (das Grimoire hat dann kein Ziel und ist nicht aktivierbar).
// Erwartung (Lesart: „once per turn" bindet jede Verwendung des Effekts, auch die geliehene): Der Tower ist nach dem ersten Einsatz nicht mehr wählbar (wie der erschöpfte Giant).
// Beobachtet: A: der Tower wird als wählbar angeboten und feuert ein zweites Mal (150 Schaden). B: der Giant ist ausgeschlossen (`canActivateCreatureEffect` meldet „keine Nutzung mehr").
// Ursache: grimoire (`spirit-of-the-forbidden-grimoire.js` `sammleKandidaten`) prüft nur `_effectLockedTurn` und die Karten-eigene `canActivateCreatureEffect`; die Engine-Sperre `hoptUsed['creature-effect:<id>']`
//   (`creatureEffectStillAvailable`, _engine.js ~30956) wird nicht gefragt, und `reactivateCreatureEffect` verzichtet bewusst auf den HOPT (_engine.js ~25126 „geschenkte Wiederholung"). Karten, deren
//   `canActivateCreatureEffect` konstant `true` liefert (Cannon Tower, Aggressive Town Guard, Coreling, Assault Eagle, …), sind deshalb mehrfach pro Zug leihbar; Karten mit eigenem Zähler (Giant) nicht.
// ★ Welle 11 (Q73, Al: „Beide dürfen explizit Effekte ein weiteres Mal verwenden … Also ja, sie dürfen sie wiederholen."): Teil A prüft jetzt, dass der Tower geliehen werden DARF (150); Teil B (Giant mit erschöpftem eigenem 3/3-Zähler) bleibt unverändert (Ist-Zustand, Frage an Al offen).
// Stufe C: Ob die Wiederholung eines schon benutzten Einmal-pro-Zug-Effekts gewollt ist (Kohta/Grimoire als „geschenkte Wiederholung"), ist eine Regelfrage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SG = 'Spirit of the Forbidden Grimoire';
  {
    const t = await H.fresh({});
    const gs = t.gs;
    t.put(0, 2, 0, SG).turnPlayed = 1; t.put(0, 0, 0, 'Cannon Tower').turnPlayed = 1;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) return valid.filter(x => !x.ineligible && x.cardName === 'Cannon Tower').map(x => x.id).slice(0, 1);
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    gs.currentPhase = 2;
    let h0 = t.hp(1, 0);
    await t.activateCreature(0, 0, 0);
    const normal = h0 - t.hp(1, 0);
    h0 = t.hp(1, 0);
    await t.activateCreature(0, 2, 0);
    const geliehen = h0 - t.hp(1, 0);
    R.note('A) Tower', { normal, geliehen });
    R.check('A) der im Zug schon benutzte Tower darf über das Grimoire noch einmal feuern (Al: Wiederholung erlaubt)', geliehen === 150, { normal, geliehen });
    R.check('A) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({});
    const gs = t.gs;
    t.put(0, 2, 0, SG).turnPlayed = 1; t.put(0, 1, 0, '3-Headed Giant').turnPlayed = 1;
    let angeboten = null;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) { angeboten = valid.filter(x => !x.ineligible).map(x => x.cardName); return []; }
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    gs.currentPhase = 2;
    for (let i = 0; i < 3; i++) await t.activateCreature(0, 1, 0);
    const rg = await t.activateCreature(0, 2, 0);
    R.note('B) Giant 3/3 – Grimoire aktivierbar? / angebotene Kreaturen', { rg, angeboten });
    // ★ Welle 12 (Q5, Al: „Ja, dürfen sie."): UMGESTELLT – der Giant mit erschöpftem eigenem 3/3-Zähler ist über das Grimoire leihbar.
    R.check('B) erschöpfter Giant wird dem Grimoire angeboten (Q5: eigenes Limit steht nicht im Weg)', rg === true && (angeboten || []).includes('3-Headed Giant'), { rg, angeboten });
  }
  R.finish();
})();
