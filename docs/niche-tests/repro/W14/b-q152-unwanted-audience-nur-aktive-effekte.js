'use strict';
// W14b · Q152 (R02-06, Unwanted Audience) · Al, 16.10.2026: „NUR aktive Effekte, passive Komponenten bleiben unberührt!"
// Kartentext: „Creatures your opponent controls cannot activate their active effects this turn. This counts as a negative status effect."
// Aufbau: Sitz 0 hat Horned Demon (aktiver Effekt UND passiver Zähler am Zugende, 1 Demon Counter, älter als dieser Zug), Bomb Mite (rein passiv) und einen Dummy; Sitz 1 hält Unwanted Audience.
//   Sitz 1 beendet den Zug; zu Beginn von Zug 6 (Sitz 0) spielt Sitz 1 die Karte (Ja).
// Erwartet: (a) Horned Demon: aktiver Effekt gesperrt (nicht in der Angebotsliste aktivierbar, `doActivateCreatureEffect` lehnt ab, kein Schaden) – aber NICHT `negated`;
//   (b) sein PASSIVER Zähler läuft weiter (am Ende von Zug 6 ein zweiter Demon Counter); (c) Bomb Mite (kein aktiver Effekt) bleibt völlig unberührt und detoniert;
//   (d) der Dummy ohne aktiven Effekt bekommt nichts; (e) Beer/Juice-artiges Reinigen (cleanseCreatureStatuses) hebt die Sperre auf (negativer Status, heilbar);
//   (f) die Sperre endet mit dem Zug (Zugwechsel) und der aktive Effekt ist wieder nutzbar; (g) statusimmune Kreaturen (Light Ball) werden nicht gesperrt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const DEMON = 'Horned Demon';
  async function szene(extra = {}) {
    const t = await H.fresh({ hand: [[], ['Unwanted Audience']], hp: 800 });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], [], []]);
    t.grantFor(1, 0, 'Unwanted Audience');
    const d = t.put(0, 0, 0, DEMON, { counters: { demonCounter: 1 } }); d.turnPlayed = 1;
    const mite = t.put(0, 1, 0, 'Bomb Mite'); mite.turnPlayed = 3;
    const dummy = t.put(0, 2, 0, H.INERT.creature); dummy.turnPlayed = 1;
    if (extra.lightBall) t.put(0, 0, 2, 'Light Ball');
    t.gs.activePlayer = 1; t.gs.turn = 5; t.policy.confirm = true;
    await t.endTurn();                                    // Zug 6 (Sitz 0): Unwanted Audience wird angeboten
    return { t, d, mite, dummy };
  }
  const demonZaehler = (d) => d.counters.demonCounter || d.counters.demon_counter || 0;

  R.section('(a) aktiver Effekt gesperrt, Kreatur NICHT negiert');
  {
    const { t, d, mite, dummy } = await szene();
    R.check('Unwanted Audience wurde gespielt', t.prompts.some(p => p.d.title === 'Unwanted Audience'));
    R.check('Horned Demon trägt den Status active_locked', !!d.counters.active_locked, d.counters);
    R.check('Horned Demon ist NICHT negiert (passive Komponenten bleiben)', !d.counters.negated && !t.engine.isCreatureEffectSuppressed(d), d.counters);
    t.gs.currentPhase = 2;
    const liste = t.engine.getActivatableCreatures(0).filter(x => x.cardName === DEMON);
    R.check('Angebotsliste: Horned Demon nicht aktivierbar', liste.length === 1 && liste[0].canActivate === false, liste);
    R.check('CPU-Sicht (creatureEffectStillAvailable): nicht verfügbar', t.engine.creatureEffectStillAvailable(d) === false);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const hpVorher = t.hp(1, 0);
    const r = await t.activateCreature(0, 0, 0);
    R.check('doActivateCreatureEffect lehnt ab, kein Schaden', r === false && t.hp(1, 0) === hpVorher, { r, hp: t.hp(1, 0) });
    R.check('(c) Bomb Mite (rein passiv): unberührt', !mite.counters.active_locked && !mite.counters.negated, mite.counters);
    R.check('(d) Dummy ohne aktiven Effekt: unberührt', !dummy.counters.active_locked && !dummy.counters.negated, dummy.counters);

    R.section('(b)/(c) Zugende von Sitz 0: passiver Zähler läuft, Bomb Mite detoniert; (f) Sperre endet');
    await t.endTurn();
    R.check('(b) passiver Demon-Zähler am Zugende: 2 statt 1', demonZaehler(d) === 2, d.counters);
    R.check('(c) Bomb Mite detoniert (Ablage, 100 Schaden auf alle Helden von Sitz 1)', mite.zone === 'discard' && t.gs.players[1].heroes.every(h => h.hp === 700), { zone: mite.zone, hp: t.gs.players[1].heroes.map(h => h.hp) });
    await t.endTurn();                                     // Zug 8 (Sitz 0) – eigene Runde, Sperre abgelaufen
    R.check('(f) Sperre ist nach dem Zugwechsel weg', !d.counters.active_locked, d.counters);
    R.check('keine Engine-Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(e) Reinigen hebt die Sperre auf');
  {
    const { t, d } = await szene();
    const entfernt = t.engine.cleanseCreatureStatuses(d, ['active_locked'], 'Beer');
    R.check('cleanseCreatureStatuses entfernt active_locked', entfernt.includes('active_locked') && !d.counters.active_locked, { entfernt, c: d.counters });
    t.gs.currentPhase = 2;
    R.check('danach wieder aktivierbar', t.engine.creatureEffectStillAvailable(d) === true);
  }

  R.section('(g) statusimmune Kreatur (Light Ball) wird nicht gesperrt');
  {
    const { t, d } = await szene({ lightBall: true });
    R.check('mit Light Ball: kein active_locked', !d.counters.active_locked, d.counters);
  }
  R.finish();
})();
