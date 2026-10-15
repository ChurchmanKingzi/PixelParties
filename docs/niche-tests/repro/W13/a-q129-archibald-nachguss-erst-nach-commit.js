'use strict';
// W13a · Q129 (allgemeine Regel für „automatische" Zusatzaktionen dieser Bauart) – hier: Archibald, the Archmage (abgeworfenen Normal Spell als Zusatzaktion wirken).
// Al, 15.10.2026: „Bricht man die Zielwahl … ab, soll die Karte gar nicht erst konsumiert werden … Und once per turn/game wird natürlich auch erst dann konsumiert."
// Erwartet: Abbruch der Zielwahl des Nachgusses → nichts konsumiert: Zauber bleibt in der Ablage (lag dort schon), Einmal-pro-Zug-Stempel frei, kein Eintrag in der
//   „nie 2× derselbe Zauber"-Liste dieses Zuges, keine Wisdom-Kosten; bestätigte Zielwahl → Zauber gewirkt, Stempel und Listeneintrag gesetzt.
const H = require('../../lib/h.js');
const ARCH = 'Archibald, the Archmage';
(async () => {
  const R = H.runner();
  async function szene() {
    const t = await H.fresh({ heroes: [[ARCH, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Burning Finger', H.INERT.filler, H.INERT.filler, H.INERT.filler], []] });
    t.setAbilities(0, 0, [['Wisdom', 'Wisdom'], [], []]);
    t.policy.confirm = true;
    t.gs.activePlayer = 0; t.phase(3);
    return t;
  }
  const abwerfen = (t) => t.run(() => t.engine.actionDiscardHandCard(0, 'Burning Finger', 0, { source: 'Test' }));
  const stempel = (t) => t.gs.hoptUsed?.['archibald-discard-cast:0'] === t.gs.turn;
  const liste = (t) => (t.hero(0, 0)._archibaldSpellsCastThisTurn || []);
  const ziel = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };

  R.section('Abbruch der Zielwahl');
  {
    const t = await szene();
    let n = 0; t.targetFn = () => { n++; return null; };
    await abwerfen(t);
    R.check('Aufbau: Archibald hat angeboten, Zielwahl des Nachgusses wurde geöffnet', n >= 1, n);
    R.check('Burning Finger liegt in der Ablage (wie zuvor, keine zweite Kopie)', t.pile(0, 'discardPile').filter(c => c === 'Burning Finger').length === 1, t.pile(0, 'discardPile'));
    R.check('Einmal-pro-Zug-Stempel frei', !stempel(t), t.gs.hoptUsed);
    R.check('nicht in der „2× derselbe Zauber"-Liste', !liste(t).includes('Burning Finger'), liste(t));
    R.check('keine Wisdom-Kosten: Hand behält die Füller', t.pile(0, 'hand').filter(c => c === H.INERT.filler).length === 3, t.pile(0, 'hand'));
    R.check('kein Schaden', t.hp(1, 0) === 800, t.hp(1, 0));
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.section('Bestätigte Zielwahl (Commit)');
  {
    const t = await szene();
    t.targetFn = ziel;
    await abwerfen(t);
    R.check('Burning Finger gewirkt', t.hp(1, 0) < 800, t.hp(1, 0));
    R.check('Stempel gesetzt, in der Liste', stempel(t) && liste(t).includes('Burning Finger'), { hopt: t.gs.hoptUsed, liste: liste(t) });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
