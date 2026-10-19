'use strict';
// W19b · Held unter fremder Kontrolle — Auslegung (b). Al (19.10.2026): „… diese [Surprises] muss der Gegner, wenn er die Kontrolle übernimmt, sehen können, sie werden bekannt!"
// Umsetzung: `sendGameState` (server.js) liefert dem Betrachter die verdeckte Surprise eines Helden, den er gerade KONTROLLIERT (Charme, Paraseed, Styx, FTCD …), mit Namen
//   statt '?'; ebenso `surpriseEffectiveLevels`. Für den Besitzer ändert sich nichts. Keine Live-Anzeige danach: ohne Kontrolle liefert der Server wieder '?'.
//   Nichts anderes wird aufgedeckt: Surprise Zones nicht kontrollierter Helden bleiben '?', ebenso die Zuschauer-Ansicht.
// Der Test lädt `sendGameStateErzwungen` (= `sendGameState` ohne Dedupe-Cache) aus dem Quelltext von server.js (Brücke wie die Harness: PP_ST_SIM) und fängt die Sendungen über einen Ersatz für `Server.prototype.to` ab.
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = process.env.PP_ROOT || path.resolve(__dirname, '../../../..');
const gesendet = [];
require(path.join(ROOT, 'node_modules/socket.io')).Server.prototype.to = function (id) { return { emit: (ev, data) => gesendet.push({ id, ev, data }) }; };
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function ladeSendGameState() {
  process.env.PP_ST_SIM = '1';
  const f = path.join(ROOT, 'server.js');
  const src = fs.readFileSync(f, 'utf8') + '\nmodule.exports.__sendGameState = sendGameStateErzwungen;';
  const m = new Module(f, module); m.filename = f; m.paths = Module._nodeModulePaths(path.dirname(f));
  m._compile(src, f);
  return m.exports.__sendGameState;
}
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 1, gold: [100, 100] });
  const sgs = ladeSendGameState();
  t.room.players[0].socketId = 's0'; t.room.players[1].socketId = 's1';
  t.putSurprise(0, 0, 'Gold Trap'); t.putSurprise(0, 1, 'Flooding'); t.putSurprise(1, 0, 'Frost Rune');
  const sicht = (betrachter) => { gesendet.length = 0; sgs(t.room, betrachter); const st = gesendet.pop(); return st && st.data; };
  const zonen = (betrachter, seite) => JSON.stringify(sicht(betrachter).players[seite].surpriseZones);
  const stufen = (betrachter, seite) => sicht(betrachter).players[seite].surpriseEffectiveLevels;

  R.section('Normalspiel: der Gegner sieht fremde verdeckte Surprises nicht');
  R.check('Sitz 1 sieht die Zonen von Sitz 0 als ?', zonen(1, 0) === '[["?"],["?"],[]]', zonen(1, 0));
  R.check('Sitz 0 sieht seine eigenen Namen', zonen(0, 0) === '[["Gold Trap"],["Flooding"],[]]', zonen(0, 0));
  R.check('Sitz 0 sieht die Zone von Sitz 1 als ?', zonen(0, 1) === '[["?"],[],[]]', zonen(0, 1));
  R.check('Sitz 1 hat für die verdeckte Zone von Sitz 0 keine Stufe (nichts leaken)', stufen(1, 0)[0] == null, stufen(1, 0));

  R.section('Dauerhaft übernommen (Paraseed-Art): der Kontrolleur sieht die Surprise dieses Helden');
  await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300);
  R.check('Sitz 1 sieht Gold Trap in der Zone von 0:0 mit Namen, 0:1 bleibt ?', zonen(1, 0) === '[["Gold Trap"],["?"],[]]', zonen(1, 0));
  R.check('Sitz 1 bekommt für die aufgedeckte Zone eine Stufe, für die verdeckte nicht', stufen(1, 0)[0] != null && stufen(1, 0)[1] == null, stufen(1, 0));
  R.check('für den Besitzer ändert sich nichts', zonen(0, 0) === '[["Gold Trap"],["Flooding"],[]]', zonen(0, 0));
  R.check('Sitz 1 bekommt die Anzeige „bekannt/halbtransparent“ (surpriseKnown) nur für die kontrollierte Zone', JSON.stringify(sicht(1).players[0].surpriseKnown) === '[true,false,false]', sicht(1).players[0].surpriseKnown);
  R.check('der Besitzer bekommt sie nicht', JSON.stringify(sicht(0).players[0].surpriseKnown) === '[false,false,false]', sicht(0).players[0].surpriseKnown);
  R.check('die Zone von Sitz 1 selbst bleibt für Sitz 0 verdeckt', zonen(0, 1) === '[["?"],[],[]]', zonen(0, 1));
  
  R.section('Nach Rückgabe der Kontrolle wieder verdeckt (keine Live-Anzeige mehr)');
  {
    const h0 = t.gs.players[0].heroes[0];
    delete h0.permaControlBy; delete h0.charmedBy; delete h0.charmedFromOwner; delete h0.charmedHeroIdx; delete h0.statuses.charmed;
    R.check('Held 0:0 gehört wieder Sitz 0', t.engine.heroSideOf(0, h0) === 0, t.engine.heroSideOf(0, h0));
    R.check('Sitz 1 sieht die Zone von 0:0 wieder als ?', zonen(1, 0) === '[["?"],["?"],[]]', zonen(1, 0));
    R.check('auch die Stufe ist wieder verdeckt', stufen(1, 0)[0] == null, stufen(1, 0));
  R.check('und die Anzeige „bekannt“ ist weg', JSON.stringify(sicht(1).players[0].surpriseKnown) === '[false,false,false]', sicht(1).players[0].surpriseKnown);
  }

  R.section('Temporäre Übernahme (Charme-Art) bis zum Zugende');
  {
    await t.engine.actionStealHero(1, 0, 1); await sleep(300);
    R.check('während der Übernahme sieht Sitz 1 Flooding in 0:1, Gold Trap in 0:0 nicht', zonen(1, 0) === '[["?"],["Flooding"],[]]', zonen(1, 0));
    await t.endTurn();
    R.check('Held 0:1 ist nach dem Zugende zurück bei Sitz 0', t.engine.heroSideOf(0, t.gs.players[0].heroes[1]) === 0, t.engine.heroSideOf(0, t.gs.players[0].heroes[1]));
    R.check('Sitz 1 sieht danach wieder nur ?', zonen(1, 0) === '[["?"],["?"],[]]', zonen(1, 0));
  }
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
