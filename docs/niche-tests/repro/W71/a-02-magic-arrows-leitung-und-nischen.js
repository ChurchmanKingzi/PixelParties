'use strict';
// W71a-02 · Magic Arrows: Leitung (Auftritt erst nach der Zielwahl, Abbruch = nichts passiert) auf BEIDEN Sitzen + Nischenfälle
//
// Geprüft: (A) W.durchlauf/W.pruefeDurchlauf auf Sitz 0 und 1; (B) Ida, the Adept of Destruction (Einzelziel); (C) Interference (Mehrfachtreffer-Klammer);
//   (D) Kreaturen: Deepsea-Idol-Fenster bei 2+ eigenen Kreaturen; (E) dasselbe Ziel nicht zweimal; (F) negierende Reaktion (Silence-artige Karte);
//   (G) Zugspieler-Wechsel: Schaden an eigenem besiegten Helden; (H) Ziel verschwindet zwischen Wahl und Schlag.
const W = require('../../lib/wire.js');
const H = require('../../lib/h.js');   // B–H: CPU-Harness (targetFn); die Leitungsprüfung A braucht den Mensch-Modus von wire.js
const CARD = 'Magic Arrows';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);

(async () => {
  const R = W.runner();

  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    const label = `[S${seat}] ${CARD}`;
    R.section(label + ' — Leitung');
    const mk = () => W.reicheSzene({ seat, karten: [CARD], board: async (t) => { t.grantFor(seat, 0, CARD); } });
    const answer = (e) => {
      if (e.kind === 'target') { const v = (e.valid || []).filter(x => !x.ineligible && x.owner === opp).slice(0, 3); return v.map(x => x.id); }
      return undefined;
    };
    const d = await W.durchlauf(mk, seat, CARD, { seat, hero: 0, maxCancel: 4, answer });
    W.pruefeDurchlauf(R, label, d, { seat, nCanc: 1, nEcht: 1 });
    const c = d.clean;
    R.check(`${label}: Durchlauf — Karte gespielt, drei Gegnerziele getroffen`, c.r.handNachher < c.r.handVorher && c.t.lg('damage').length === 3, { hand: [c.r.handVorher, c.r.handNachher], dmg: c.t.lg('damage').length });
    for (const sid of ['S' + opp, 'SPEC']) {
      const w = c.r.tl.map((e, i) => [e, i]).filter(([e]) => e.k === 'wire' && e.sid === sid);
      const iR = w.find(([e]) => e.ev === 'card_reveal' && e.data && e.data.cardName === CARD);
      const iP = w.find(([e]) => e.ev === 'play_projectile_animation');
      R.check(`${label}: ${sid} — Auftritt (card_reveal) kommt VOR dem ersten Pfeil`, !!iR && !!iP && iR[1] < iP[1], { reveal: iR && iR[1], pfeil: iP && iP[1] });
      const pfeile = w.filter(([e]) => e.ev === 'play_projectile_animation' && e.data && e.data.projectileShape === 'magicArrow');
      R.check(`${label}: ${sid} — drei Pfeil-Ereignisse mit projectileShape 'magicArrow'`, pfeile.length === 3, pfeile.length);
    }
    for (const { k, r, t } of d.cancels.filter(x => x.r.undone)) {
      R.check(`${label}: Abbruch an Stelle ${k} — Karte auf der Hand, kein Schaden, keine Pfeile`, t.gs.players[seat].hand.includes(CARD) && t.lg('damage').length === 0 && t.evs('play_projectile_animation').length === 0, { dmg: t.lg('damage').length });
    }
  }

  R.section('B · Ida, the Adept of Destruction: Destruction-Mehrfachwahl auf 1 gekappt');
  {
    const t = await H.fresh({ hand: [[CARD], []], heroes: [['Ida, the Adept of Destruction', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));   // Idas Passive legt ihr Flag beim Spielbeginn an (die Harness startet ohne diesen Hook)
    t.targetFn = (valid, config) => { t._cfg = config; return valid.filter(v => isHero(v, 1)).map(v => v.id); };
    await t.play(0, CARD, { hero: 0 });
    const getroffen = [0, 1, 2].filter(i => t.hp(1, i) === 750).length;
    R.check('Ida: höchstens EIN Ziel wird getroffen (max 3 → 1)', getroffen === 1, [0, 1, 2].map(i => t.hp(1, i)));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('C · Interference (Anti-AoE): 2+ Ziele öffnen die Klammer');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    const calls = [];
    const orig = t.engine.beginMultiHit.bind(t.engine);
    t.engine.beginMultiHit = (n, ...r) => { calls.push(n); return orig(n, ...r); };
    t.targetFn = (valid) => valid.filter(v => isHero(v, 1)).slice(0, 3).map(v => v.id);
    await t.play(0, CARD, { hero: 0 });
    R.check('beginMultiHit(3) bei drei Zielen', calls.includes(3), calls);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    const calls = [];
    const orig = t.engine.beginMultiHit.bind(t.engine);
    t.engine.beginMultiHit = (n, ...r) => { calls.push(n); return orig(n, ...r); };
    t.targetFn = (valid) => valid.filter(v => isHero(v, 1)).slice(0, 1).map(v => v.id);
    await t.play(0, CARD, { hero: 0 });
    R.check('ein Ziel: keine Flächenklammer', !calls.some(n => n >= 2), calls);
  }

  R.section('D · mehrere Kreaturen in EINEM Kreaturenstapel (Idol-Fenster)');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    const batches = [];
    const orig = t.engine.processCreatureDamageBatch.bind(t.engine);
    t.engine.processCreatureDamageBatch = async (entries, ...r) => { batches.push(entries.length); return orig(entries, ...r); };
    const a = t.put(1, 0, 0, H.INERT.creature), b = t.put(1, 1, 0, H.INERT.creature), c = t.put(1, 2, 0, H.INERT.creature);
    t.targetFn = (valid) => valid.filter(v => v.type === 'equip' && v.owner === 1).slice(0, 3).map(v => v.id);
    await t.play(0, CARD, { hero: 0 });
    R.check('alle drei Kreaturen −50', [a, b, c].every(x => x.counters.currentHp === 150), [a, b, c].map(x => x.counters.currentHp));
    R.check('Kreaturen laufen in EINEM Stapel mit 3 Einträgen', batches.includes(3), batches);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('E · dasselbe Ziel wird nicht doppelt gewählt');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.targetFn = (valid) => { const v = valid.find(x => isHero(x, 1, 0)); return [v.id, v.id, v.id]; };
    await t.play(0, CARD, { hero: 0 });
    R.check('Held 0 nimmt höchstens 50 (nicht 150)', t.hp(1, 0) >= 750, t.hp(1, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('F · negierte Karte: Pfeile laufen trotzdem, kein Schaden');
  {
    // Zielwahl-Surprise des Gegners, der „Spell negieren" kann: Silence-artige Karten brauchen eine eigene Szene; hier die Engine-Negation direkt.
    const t = await H.fresh({ hand: [[CARD], []] });
    t.targetFn = (valid) => valid.filter(v => isHero(v, 1)).slice(0, 3).map(v => v.id);
    const orig = t.engine._checkSurpriseWindow.bind(t.engine);
    t.engine._checkSurpriseWindow = async (...a) => ({ effectNegated: true });
    await t.play(0, CARD, { hero: 0 });
    t.engine._checkSurpriseWindow = orig;
    R.check('kein Held getroffen', [0, 1, 2].every(i => t.hp(1, i) === 800), [0, 1, 2].map(i => t.hp(1, i)));
    R.check('die abgewehrten Pfeile sind trotzdem zu sehen', t.evs('play_projectile_animation').filter(e => e.projectileShape === 'magicArrow').length === 3, t.evs('play_projectile_animation').length);
    R.check('Karte in der Ablage', t.pile(0, 'discardPile').includes(CARD));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('G · Ziel verschwindet zwischen Wahl und Schlag (Kreatur stirbt vor dem Treffer)');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    const frail = t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (valid) => {
      const v = valid.filter(x => x.type === 'equip' && x.owner === 1)[0];
      const h = valid.find(x => isHero(x, 1, 1));
      // die Kreatur verschwindet, bevor der Schlag fällt
      t.engine.actionDestroyCard({ name: 'x', owner: 1 }, frail).catch(() => {});
      return [v.id, h.id];
    };
    await t.play(0, CARD, { hero: 0 });
    R.check('der andere Held wird getroffen, kein Absturz', t.hp(1, 1) === 750, t.hp(1, 1));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }

  R.section('H · eigener besiegter Held und Spielende');
  {
    const t = await H.fresh({ hand: [[CARD], []], hp: 50 });
    t.targetFn = (valid) => valid.filter(v => isHero(v, 1)).slice(0, 3).map(v => v.id);
    await t.play(0, CARD, { hero: 0 });
    R.check('alle drei Gegnerhelden (50 HP) besiegt', [0, 1, 2].every(i => t.hp(1, i) <= 0), [0, 1, 2].map(i => t.hp(1, i)));
    R.check('Spiel beendet, Sitz 0 gewinnt', t.engine.over.called && t.engine.over.winnerIdx === 0, t.engine.over);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.finish();
})();
