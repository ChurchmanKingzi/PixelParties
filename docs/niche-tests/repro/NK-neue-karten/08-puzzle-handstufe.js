'use strict';
// NK-08 · Puzzle-Creator: Stufe je Handkopie (23.10.2026)
// Auftrag Al: „Linksklickt man auf eine Karte mit einem Level auf der Hand, sollte man deren Level manuell anpassen können" — für weiteres Testen und als Option für Puzzles.
// Der Editor speichert `handLevels[i]` / `oppHandLevels[i]`; `createPuzzleGame` (server.js, `wendeHandStufenAn`) setzt sie als absolute Setzung der Handinstanz
// (`inst.counters.levelSet`, dasselbe Mittel wie Inconspicuous Lawn Gnome). Diese Datei prüft die ENGINE-Seite dieser Setzung auf dem Weg, den der Puzzle-Start nimmt
// (Handinstanz per `_findHandInstanceAt`, dann `levelSet`): Stufenprüfung, effektive Stufe, Wirkung neben Handsenkungen. Der Editor und die Anzeige sind im Browser geprüft.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const GV = 'Great Vanguard Demon';
  const frisch = async (hand0, hand1 = []) => H.fresh({ hand: [hand0, hand1], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
  /** Wie `wendeHandStufenAn` im Server: Handinstanz am Index suchen, absolute Stufe setzen. */
  const setzeStufe = (t, seat, idx, lv) => {
    const inst = t.engine._findHandInstanceAt(seat, idx);
    inst.counters = inst.counters || {};
    inst.counters.levelSet = lv;
    return inst;
  };
  const stufe = (t, seat, idx, name = GV) => t.engine.effectiveCardLevel(H.DB[name], seat, { handIdx: idx, heroIdx: 0 });
  const darf = (t, seat, idx, name = GV) => t.engine.heroMeetsLevelReq(seat, 0, H.DB[name], { handIdx: idx });

  R.section('A · Gesenkte Stufe: die Kopie ist spielbar, die gedruckte nicht');
  {
    const t = await frisch([GV, GV]);
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], [], []]);           // Summoning Magic Lv2
    setzeStufe(t, 0, 1, 2);
    R.check('gedruckte Kopie (Lv9): effektive Stufe 9', stufe(t, 0, 0) === 9, stufe(t, 0, 0));
    R.check('gesetzte Kopie: effektive Stufe 2', stufe(t, 0, 1) === 2, stufe(t, 0, 1));
    R.check('Held mit Summoning Magic Lv2 darf die Lv2-Kopie, nicht die Lv9-Kopie', darf(t, 0, 1) === true && darf(t, 0, 0) === false, { auf2: darf(t, 0, 1), auf9: darf(t, 0, 0) });
  }

  R.section('B · Erhöhte Stufe (der Editor lässt auch nach oben stellen)');
  {
    const t = await frisch(['Fireball']);
    t.grantFor(0, 0, 'Fireball');
    const lvl0 = H.DB.Fireball.level;
    R.check('Ausgangslage: der Held darf Fireball', darf(t, 0, 0, 'Fireball') === true);
    setzeStufe(t, 0, 0, lvl0 + 5);
    R.check('erhöht: effektive Stufe = gesetzter Wert', stufe(t, 0, 0, 'Fireball') === lvl0 + 5, stufe(t, 0, 0, 'Fireball'));
    R.check('erhöht über die Schulstufe des Helden: nicht mehr spielbar', darf(t, 0, 0, 'Fireball') === false);
  }

  R.section('C · Stufe 0 und Zusammenspiel mit Senkungen in der Hand');
  {
    const t = await frisch([GV]);
    setzeStufe(t, 0, 0, 0);
    R.check('Stufe 0: effektive Stufe 0, ohne Fähigkeiten spielbar', stufe(t, 0, 0) === 0 && darf(t, 0, 0) === true, { lv: stufe(t, 0, 0), ok: darf(t, 0, 0) });
  }
  {
    const t = await frisch([GV]);
    setzeStufe(t, 0, 0, 5);
    t.gs.players[0]._handLevelOffsetsTransient = { 0: -2 };                       // z. B. zwei Reactions des Vanguard Demon
    R.check('gesetzte Stufe 5, Handsenkung −2: 3 (die Senkung wirkt auf die gesetzte Basis)', stufe(t, 0, 0) === 3, stufe(t, 0, 0));
    t.gs.players[0]._handLevelOffsetsTransient = { 0: -9 };
    R.check('Senkung über die Basis hinaus: nie unter 0', stufe(t, 0, 0) === 0, stufe(t, 0, 0));
  }

  R.section('D · Gleichnamige Kopien tragen getrennte Stufen');
  {
    const t = await frisch([GV, GV, GV]);
    setzeStufe(t, 0, 0, 4); setzeStufe(t, 0, 2, 7);
    const s = [0, 1, 2].map(i => stufe(t, 0, i));
    R.check('Index 0 → 4, 1 → 9 (gedruckt), 2 → 7', s[0] === 4 && s[1] === 9 && s[2] === 7, s);
  }

  R.section('E · Gegnerhand (Sitz 1) — dieselbe Setzung');
  {
    const t = await frisch([], [GV]);
    setzeStufe(t, 1, 0, 3);
    R.check('Sitz 1: effektive Stufe 3', stufe(t, 1, 0) === 3, stufe(t, 1, 0));
    R.check('Sitz 0 bleibt unberührt (keine Kopie auf der Hand → gedruckt)', t.engine._handLevelSetFor(0, GV, 0) === null);
  }
  R.finish();
})();
