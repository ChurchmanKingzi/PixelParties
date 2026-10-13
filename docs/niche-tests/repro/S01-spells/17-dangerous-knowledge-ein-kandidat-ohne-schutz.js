'use strict';
// S01-17 · Dangerous Knowledge: genau ein Kandidat wird ohne Zielschutz-Prüfung automatisch gewählt (Erste-Runden-Immunität)
// Kartentext: „Choose a Hero your opponent controls with a different name from all Heroes you control (including defeated ones). The user gains that Hero's effects …"
// Regel (CARD_API „Turn-1 Immunity"): in Zug 1 ist alles des Nicht-Zugspielers gegen alles des Zugspielers immun – auch gegen Zielwahl.
// Aufbau: Sitz 0 (Zugspieler, `firstTurnProtectedPlayer = 1`); Sitz 1 hat Barker (Wirkung vorhanden), seine anderen Helden tragen Namen, die Sitz 0 schon hat (also keine Kandidaten).
// Kontrolle: mit zwei Kandidaten öffnet sich keine Zielwahl (nichts wählbar) – der Zauber wird abgebrochen, nichts gelernt.
// Erwartet: auch mit genau einem Kandidaten wird nichts gelernt.
// Beobachtet: `dangerous-knowledge.js` (`let ziel = ziele[0]; if (ziele.length > 1) { promptEffectTarget … }`) nimmt den einzigen Kandidaten ohne die zentrale Schutzprüfung; Sitz 0 lernt Barkers Effekte.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t0 = await H.fresh({ hand: [['Dangerous Knowledge'], []] });
  const n0 = t0.gs.players[0].heroes.map(h => h.name);
  async function lauf(zwei) {
    const t = await H.fresh({ hand: [['Dangerous Knowledge'], []], heroes: [n0, ['Barker, the Monster Tamer', zwei ? 'Alex, Trainer of Heroes' : n0[1], n0[2]]] });
    t.gs.firstTurnProtectedPlayer = 1;
    t.targetFn = (v) => { const ok = v.find(x => !x.ineligible); return ok ? [ok.id] : null; };
    await t.play(0, 'Dangerous Knowledge', { hero: 0 });
    return { gelernt: [...(t.gs.players[0]._dangerousKnowledgeGained || [])], errors: t.errors };
  }
  const a = await lauf(true);
  R.check('Kontrolle (zwei Kandidaten): unter Erste-Runden-Immunität wird nichts gelernt', a.gelernt.length === 0, a.gelernt);
  const b = await lauf(false);
  R.check('genau ein Kandidat: unter Erste-Runden-Immunität wird ebenfalls nichts gelernt', b.gelernt.length === 0, b.gelernt);
  R.check('keine Engine-Fehler', a.errors.length === 0 && b.errors.length === 0);
  R.finish();
})();
