'use strict';
// W12a · Rückfrage 13 (Gleichstand ohne jede Karte) · Al, 15.10.2026: „Der Zugspieler gewinnt. Wobei das zumindest durch Status unmöglich ist; immer nur der
//   Zugspieler nimmt Status-Schaden."
// Erwartet: Sind beide Seiten gleichzeitig ausgelöscht und gibt es weder eine Karten-Klausel noch einen Karten-Wirker (reiner Spielablauf, z. B. Statusticks am Zugende),
//   gewinnt der Spieler am Zug (vorher der Sitz-Standard „Sitz 0 verliert"). Rangfolge bleibt: 1. Karten-Klausel (`gs._drawLoserIdx`) > 2. Karten-Wirker
//   (`_kartenWirker`) > 3. Zugspieler.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const alleTot = (t) => { for (const s of [0, 1]) for (const h of t.gs.players[s].heroes) h.hp = 0; };

  R.section('(1) ohne Karte: der Zugspieler gewinnt - beide Sitze');
  for (const aktiv of [0, 1]) {
    const t = await H.fresh({ active: aktiv });
    alleTot(t);
    t.engine._currentEffectSource = null; t.engine._rxResolvingOwner = undefined; t.engine._activationSource = null;
    await t.run(() => t.engine.checkAllHeroesDead());
    const o = t.engine.over;
    R.check(`Sitz ${aktiv} am Zug -> Sitz ${aktiv} gewinnt`, !!o && o.winnerIdx === aktiv && o.reason === 'draw_resolved', o);
    R.check(`Sitz ${aktiv}: Log nennt den Zugspieler (decidedBy turn_player)`, t.lg('draw_resolved').some(l => l.decidedBy === 'turn_player'), t.lg('draw_resolved'));
    R.check(`Sitz ${aktiv}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('(2) Karten-Wirker schlägt den Zugspieler (Reaktion des Nicht-Zugspielers)');
  for (const aktiv of [0, 1]) {
    const wirker = 1 - aktiv;
    const t = await H.fresh({ active: aktiv });
    alleTot(t);
    t.engine._currentEffectSource = { cardName: 'Reaktion', owner: wirker, cardType: 'Spell' };
    await t.run(() => t.engine.checkAllHeroesDead());
    const o = t.engine.over;
    R.check(`Sitz ${aktiv} am Zug, Karte von Sitz ${wirker} löst auf -> Sitz ${wirker} gewinnt`, !!o && o.winnerIdx === wirker, o);
    R.check(`Sitz ${aktiv}: Log nennt den Wirker (decidedBy caster)`, t.lg('draw_resolved').some(l => l.decidedBy === 'caster'), t.lg('draw_resolved'));
    t.engine._currentEffectSource = null;
  }

  R.section('(3) Karten-Klausel schlägt Wirker und Zugspieler (`_drawLoserIdx`: Bunny Bombs „you lose")');
  for (const aktiv of [0, 1]) {
    const t = await H.fresh({ active: aktiv });
    alleTot(t);
    t.gs._drawLoserIdx = aktiv;   // der Zugspieler verliert laut Karte
    t.engine._currentEffectSource = { cardName: 'Bunny Bombs', owner: aktiv, cardType: 'Spell' };
    await t.run(() => t.engine.checkAllHeroesDead());
    const o = t.engine.over;
    R.check(`Sitz ${aktiv} am Zug, Klausel „Sitz ${aktiv} verliert" -> Sitz ${1 - aktiv} gewinnt`, !!o && o.winnerIdx === 1 - aktiv, o);
    R.check(`Sitz ${aktiv}: Log nennt die Karten-Klausel`, t.lg('draw_resolved').some(l => l.decidedBy === 'card_effect'), t.lg('draw_resolved'));
    delete t.gs._drawLoserIdx; t.engine._currentEffectSource = null;
  }

  R.section('(4) Gegenprobe: nur eine Seite ausgelöscht - normaler Sieg des Gegners, kein Gleichstand');
  {
    const t = await H.fresh({ active: 1 });
    for (const h of t.gs.players[0].heroes) h.hp = 0;
    await t.run(() => t.engine.checkAllHeroesDead());
    const o = t.engine.over;
    R.check('Sitz 0 ausgelöscht -> Sitz 1 gewinnt (all_heroes_dead)', !!o && o.winnerIdx === 1 && o.reason === 'all_heroes_dead', o);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
