'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-16 · Nicolas, the Hidden Alchemist: die Trank-Sperre nach dem 2. Trank gilt auch bei gefrorenem/betäubtem Nicolas (nur „negiert" hebt sie auf)
//
//  Karte: Nicolas, the Hidden Alchemist (`cards/effects/nicolas-the-hidden-alchemist.js`, `potionLockAfterN: 2`; Verbraucher `checkPotionLock` in `server.js` ~4536)
//  Kartentext: „After you have played your second Potion during a turn, you cannot play Potions for the rest of that turn (even if this Hero gets defeated before then)."
//  Skriptkopf: „… while Nicolas is alive and not negated". Engine-Konvention (B-querschnitt B-09, `_isHeroEffectSilenced`): gefrorene, betäubte, negierte und tote Helden
//  verlieren ihre Heldeneffekte – auch passive Sperren.
//  Erwartung: Ist Nicolas beim 2. Trank gefroren/betäubt/negiert, entsteht keine Sperre (3. und 4. Trank spielbar).
//  Beobachtung (✗): nur `negated` (und tot, s. Frage unten) hebt die Sperre auf; `checkPotionLock` prüft `hp <= 0` und `statuses.negated`, nicht frozen/stunned.
//  Frage (Fall E, kein ✗-Check): „(even if this Hero gets defeated before then)" – ist Nicolas nach dem 1. Trank gefallen und wird der 2. Trank gespielt, entsteht aktuell KEINE
//  Sperre. Soll sie trotzdem entstehen (Lesart: „before then" = bevor der Trank-Zähler zählt) oder bleibt es bei „lebt beim 2. Trank" (Lesart des Skriptkopfs)?
//  Aufruf: node docs/niche-tests/repro/H03-heroes/16-nicolas-traenke-sperre-bei-frost-betaeubung-tod.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  async function lauf(vorZweitem) {
    const t = await H.fresh({ heroes: [['Nicolas, the Hidden Alchemist', ...fill], null], hp: 600,
      hand: [Array(4).fill('Elixir of Quickness'), []], deck: [Array(30).fill('Heal'), Array(30).fill('Heal')] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const res = [];
    for (let i = 0; i < 4; i++) {
      if (i === 1 && vorZweitem) vorZweitem(t);
      res.push(await t.play(0, 'Elixir of Quickness', { hero: 0 }));
    }
    return { res, t };
  }
  const st = (s) => (t) => t.heroStatus(0, 0, s, { appliedTurn: t.gs.turn, duration: 3 });
  let x = await lauf(null);
  R.check('Kontrolle: 3. und 4. Trank sind gesperrt', x.res.join() === 'true,true,false,false', x.res);
  await x.t.endTurn(); await x.t.endTurn();
  R.check('Kontrolle: im nächsten eigenen Zug ist die Sperre weg', x.t.gs.players[0].potionLocked === false, x.t.gs.players[0].potionLocked);
  for (const s of ['negated', 'frozen', 'stunned']) {
    x = await lauf(st(s));
    R.note(`Nicolas ${s} ab dem 2. Trank`, x.res);
    R.check(`Nicolas ${s}: keine Trank-Sperre (alle 4 Tränke spielbar)`, x.res.every(r => r === true), x.res);
  }
  x = await lauf((t) => { t.hero(0, 0).hp = 0; });
  R.note('Frage E: Nicolas tot nach dem 1. Trank', x.res);
  R.check('keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  R.finish();
})();
