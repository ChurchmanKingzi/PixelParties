'use strict';
// W64b-03 · Auftritts-Puffer: Auslöser des Commits und Zustandspuffer (Engine-Ebene, Leitungs-Harness)
//
// Regel (Al, 23.10.2026): der Auftritt kommt VOR dem ersten Effektschritt, NACH der letzten abbrechbaren Wahl; der Gegner sieht bis dahin nichts — auch keinen veränderten Zustand.
// Geprüft wird die Mechanik selbst (ohne eine bestimmte Karte): eine Vormerkung `gs._pendingCardReveal` wird von Hand gesetzt, danach spielt der Test „die Karte" nach:
//   • game_state geht an Gegner (S<n>) und Zuschauer (SPEC) NICHT, solange die Vormerkung offen ist und der Besitzer keine Frage offen hat; der Besitzer bekommt ihn immer;
//   • mit offener ABBRECHBARER Frage: der Zustand von VOR der Karte + nur die Hülle der Frage (kein Titel), Änderungen des Besitzers sind noch unsichtbar;
//   • Commit-Auslöser: Engine-Effektschritt (`engine.action…`, Status …), Pflichtfrage an den Besitzer, Frage an den anderen Spieler, erstes sichtbares Ereignis, `commitAppearance()`;
//     KEIN Commit: bloße Protokollzeile, `sync()`, Pause (`_delay`), abbrechbare Frage (auch nach ihrer Beantwortung);
//   • Reihenfolge des Commits: card_reveal → Protokollzeile der Karte → Zurückgehaltenes (Ankündigungen, Effektzeilen) → Zustand;
//   • Abbruch: die Vormerkung fällt samt Puffer weg, der Gegner bekommt danach wieder den aktuellen Zustand ohne Frage-Hülle;
//   • Resync (`sendGameStateErzwungen`) ist nie blockiert; liegengebliebene Vormerkung eines früheren Zugs verschluckt keinen Zustand.
// Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const CARD = 'Fireball';
const GameEngineProto = require((process.env.PP_ROOT || require('path').resolve(__dirname, '../../../..')) + '/cards/effects/_engine').GameEngine.prototype;
(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat, SO = 'S' + opp, SS = 'S' + seat;
    const szene = async () => {
      const hand = [[], []]; hand[seat] = [CARD, W.INERT.filler]; hand[opp] = [W.INERT.creature];
      const t = await W.fresh({ scanState: true, hand, deck: [Array(10).fill(W.INERT.creature), Array(10).fill(W.INERT.creature)], gold: [100, 100], active: seat });
      return t;
    };
    const vormerken = (t) => { t.gs._pendingCardReveal = { cardName: CARD, ownerIdx: seat }; t.engine._setPendingPlayLog('spell_played', { card: CARD, player: t.gs.players[seat].username }); };
    // Nachrichten seit Marke m
    const seit = (t, m, sid) => t.tl.slice(m).filter(e => e.k === 'wire' && e.sid === sid);
    const evs = (t, m, sid) => seit(t, m, sid).filter(e => e.ev !== 'game_state' && e.ev !== 'spectator_state').map(e => e.ev + (e.data && e.data.type ? ':' + e.data.type : ''));
    const states = (t, m, sid) => seit(t, m, sid).filter(e => e.ev === 'game_state');
    const goldIn = (e) => { try { return JSON.parse(e.json).players[seat].gold; } catch { return null; } };
    const frage = (t, pi, extra) => { const p = t.engine.promptGeneric(pi, { type: 'confirm', title: 'GEHEIM-TITEL', message: 'GEHEIM-TEXT', ...extra }); return p; };
    const offen = (t) => t.gs.effectPrompt;

    R.section(`Sitz ${seat}: Zustandspuffer ohne offene Frage`);
    {
      const t = await szene(); t.host.sendSpectatorGameState(t.room); vormerken(t);     // (der Zuschauer hat vorher schon einen Zustand, wie im Spiel)
      const m = t.tl.length;
      t.gs.players[seat].gold += 7;                 // stille Änderung
      t.engine.sync();
      R.check('Besitzer bekommt den Zustand sofort', states(t, m, SS).length >= 1, states(t, m, SS).length);
      R.check('Gegner bekommt KEINEN Zustand (Vormerkung offen, keine Frage)', states(t, m, SO).length === 0, states(t, m, SO).length);
      R.check('Zuschauer bekommt KEINEN Zustand', states(t, m, 'SPEC').length === 0, states(t, m, 'SPEC').length);
      R.check('Protokollzeile allein committet nicht (Vormerkung bleibt)', (t.engine.log('irgendeine_wirkung', { x: 1 }), !!t.gs._pendingCardReveal));
      R.check('…und geht auch nicht an den Gegner (Puffer)', evs(t, m, SO).length === 0, evs(t, m, SO));
      // Resync wird nie blockiert
      t.host.sendGameStateErzwungen(t.room, opp);
      R.check('Resync (sendGameStateErzwungen) erreicht den Gegner trotz offener Vormerkung', states(t, m, SO).length === 1, states(t, m, SO).length);
      // Commit mit commitAppearance: Reihenfolge reveal → Spielzeile → Zurückgehaltenes → Zustand
      t.engine._broadcastEvent('hand_to_board_fly', { ownerIdx: seat, cardName: CARD, handIndex: 0, zoneType: 'hero', heroIdx: 0 });   // Ankündigung (gehalten)
      const m2 = t.tl.length;
      t.engine.commitAppearance();
      const reihe = seit(t, m2, SO).map(e => e.ev === 'action_log' ? 'log:' + (e.data && e.data.type) : e.ev);
      R.check('Commit-Reihenfolge Gegner: card_reveal → Zeile der Karte → Zurückgehaltenes → Zustand', reihe[0] === 'card_reveal' && reihe[1] === 'log:spell_played' && reihe.indexOf('hand_to_board_fly') > 1 && reihe.indexOf('log:irgendeine_wirkung') > 1 && reihe[reihe.length - 1] === 'game_state', reihe);
      const reiheS = seit(t, m2, 'SPEC').map(e => e.ev === 'action_log' ? 'log:' + (e.data && e.data.type) : e.ev);
      R.check('Commit-Reihenfolge Zuschauer genauso', reiheS[0] === 'card_reveal' && reiheS[reiheS.length - 1] === 'game_state' && reiheS.includes('hand_to_board_fly'), reiheS);
      const letzter = states(t, m2, SO).pop();
      R.check('der nachgelieferte Zustand ist der aktuelle (Gold +7)', letzter && goldIn(letzter) === 107, letzter && goldIn(letzter));
      R.check('Vormerkung nach dem Commit weg', !t.gs._pendingCardReveal);
    }

    R.section(`Sitz ${seat}: Commit-Auslöser`);
    {   // Engine-Effektschritt
      const t = await szene(); vormerken(t); const m = t.tl.length;
      await t.engine.actionGainGold(seat, 5, { source: CARD });
      const e = evs(t, m, SO);
      R.check('Effektschritt (actionGainGold) committet VOR seinem eigenen Ereignis', e[0] === 'card_reveal' && !t.gs._pendingCardReveal, e);
    }
    {   // Status-Primitiv
      const t = await szene(); vormerken(t); const m = t.tl.length;
      await t.engine.addHeroStatus(opp, 0, 'burned', { appliedBy: seat });
      R.check('Primitiv addHeroStatus committet', evs(t, m, SO)[0] === 'card_reveal', evs(t, m, SO));
    }
    {   // Pause: KEIN Auslöser (die Spielwege warten nach der Auflösung, bevor sie über Abbruch oder Erfolg entscheiden — ein Commit dort würde einen Abbruch verraten)
      const t = await szene(); vormerken(t); const m = t.tl.length;
      await GameEngineProto._delay.call(t.engine, 1);
      R.check('Pause (_delay) committet NICHT', !!t.gs._pendingCardReveal && evs(t, m, SO).length === 0, evs(t, m, SO));
    }
    {   // erstes sichtbares Ereignis
      const t = await szene(); vormerken(t); const m = t.tl.length;
      t.engine._broadcastEvent('play_zone_animation', { type: 'fireball', owner: opp, heroIdx: 0, zoneSlot: -1 });
      const e = evs(t, m, SO);
      R.check('erstes sichtbares Ereignis: card_reveal kommt VOR ihm', e[0] === 'card_reveal' && e.includes('play_zone_animation:fireball'), e);
    }
    {   // Pflichtfrage an den Besitzer
      const t = await szene(); vormerken(t); const m = t.tl.length;
      const p = frage(t, seat, {});
      await new Promise(r => setImmediate(r));
      R.check('Pflichtfrage an den Besitzer: card_reveal VOR der Frage', evs(t, m, SO)[0] === 'card_reveal' && !t.gs._pendingCardReveal, evs(t, m, SO));
      t.engine.resolveGenericPrompt({ confirmed: true }, offen(t).promptId); await p;
    }
    {   // Frage an den anderen Spieler
      const t = await szene(); vormerken(t); const m = t.tl.length;
      const p = frage(t, opp, {});
      await new Promise(r => setImmediate(r));
      R.check('Frage an den ANDEREN Spieler: card_reveal vor seiner Frage', evs(t, m, SO)[0] === 'card_reveal' && !t.gs._pendingCardReveal, evs(t, m, SO));
      t.engine.resolveGenericPrompt({ confirmed: true }, offen(t).promptId); await p;
    }

    R.section(`Sitz ${seat}: abbrechbare Frage — kein Commit, Zustand von VOR der Karte`);
    {
      const t = await szene();
      // 1) zuerst der Ausgangszustand bei Gegner und Zuschauer (wie im Spiel: vor dem Spielen der Karte), dann erst die Vormerkung
      t.host.sendGameStateErzwungen(t.room, opp); t.host.sendSpectatorGameState(t.room);
      vormerken(t); const m = t.tl.length;
      const m1 = t.tl.length;
      t.gs.players[seat].gold += 100;               // der Besitzer ändert vor der Frage etwas (Karte hat noch nichts „getan")
      const p = frage(t, seat, { cancellable: true });
      await new Promise(r => setImmediate(r));
      R.check('abbrechbare Frage: kein Commit', !!t.gs._pendingCardReveal && evs(t, m, SO).length === 0, evs(t, m, SO));
      const sg = states(t, m1, SO);
      R.check('Gegner bekommt trotzdem einen Zustand (die Hülle der Frage)', sg.length >= 1, sg.length);
      const stm = sg.length ? JSON.parse(sg[sg.length - 1].json) : null;
      R.check('…mit Gold von VOR der Karte (+100 unsichtbar)', stm && stm.players[seat].gold === 100, stm && stm.players[seat].gold);
      R.check('…ohne Titel/Text der Frage (Hülle)', stm && stm.effectPrompt && stm.effectPrompt.hidden === true && !JSON.stringify(stm.effectPrompt).includes('GEHEIM'), stm && JSON.stringify(stm.effectPrompt).slice(0, 120));
      const sp = states(t, m1, 'SPEC'); const stp = sp.length ? JSON.parse(sp[sp.length - 1].json) : null;
      R.check('Zuschauer genauso (Gold alt, Hülle)', stp && stp.players[seat].gold === 100 && stp.effectPrompt && stp.effectPrompt.hidden === true, stp && stp.players[seat].gold);
      const so = states(t, m1, SS).pop(); const sto = so ? JSON.parse(so.json) : null;
      R.check('der Besitzer sieht Gold 200 und seine Frage im Klartext', sto && sto.players[seat].gold === 200 && sto.effectPrompt && sto.effectPrompt.title === 'GEHEIM-TITEL', sto && sto.players[seat].gold);
      // Antwort bestätigt: immer noch kein Commit (eine bestätigte Antwort allein ist keiner)
      t.engine.resolveGenericPrompt({ confirmed: true }, offen(t).promptId); await p;
      R.check('bestätigte Antwort allein committet nicht', !!t.gs._pendingCardReveal && evs(t, m, SO).length === 0, evs(t, m, SO));
      R.check('…und der Gegner bekommt auch danach keinen neuen Zustand', states(t, m1, SO).length === sg.length, states(t, m1, SO).length);
      // Abbruch an einer zweiten abbrechbaren Frage: Vormerkung weg, Gegner bekommt den aktuellen Zustand ohne Hülle
      const p2 = frage(t, seat, { cancellable: true, title: 'ZWEITE' });
      await new Promise(r => setImmediate(r));
      t.engine.resolveGenericPrompt({ cancelled: true }, offen(t).promptId); await p2;
      delete t.gs._pendingCardReveal; delete t.gs._pendingPlayLog;       // der Abbruchzweig des Spielwegs
      t.host.sendGameState(t.room, opp); t.host.sendSpectatorGameState(t.room);
      const nach = states(t, m1, SO).pop(); const stn = nach ? JSON.parse(nach.json) : null;
      R.check('nach dem Abbruch: Gegner sieht den aktuellen Zustand ohne Frage-Hülle, keine Karte', stn && !stn.effectPrompt && evs(t, m, SO).length === 0, { prompt: stn && stn.effectPrompt, evs: evs(t, m, SO) });
      const nachS = states(t, m1, 'SPEC').pop(); const stns = nachS ? JSON.parse(nachS.json) : null;
      R.check('nach dem Abbruch: Zuschauer ebenso', stns && !stns.effectPrompt, stns && stns.effectPrompt);
    }

    R.section(`Sitz ${seat}: Zuschauer tritt mitten in der offenen Vormerkung bei`);
    {
      const t = await szene();
      t.host.sendSpectatorGameState(t.room);        // SPEC hat schon einen Zustand
      vormerken(t); const m = t.tl.length;
      t.room.spectators.push({ socketId: 'SPEC2', userId: 'spec2', username: 'Neu' });
      t.gs.players[seat].gold += 3;
      t.host.sendSpectatorGameState(t.room);
      R.check('der neue Zuschauer bekommt einen Zustand (kein leerer Bildschirm bis zum Commit)', states(t, m, 'SPEC2').length === 1, states(t, m, 'SPEC2').length);
      R.check('der bisherige Zuschauer bekommt weiter nichts', states(t, m, 'SPEC').length === 0, states(t, m, 'SPEC').length);
      t.host.sendSpectatorGameState(t.room);
      R.check('…und der neue danach auch nichts mehr (jetzt wie die anderen)', states(t, m, 'SPEC2').length === 1, states(t, m, 'SPEC2').length);
    }

    R.section(`Sitz ${seat}: liegengebliebene Vormerkung`);
    {
      const t = await szene(); vormerken(t); t.gs._pendingCardReveal._turn = t.gs.turn - 1;     // aus einem früheren Zug
      const m = t.tl.length;
      t.engine.sync();
      R.check('Vormerkung eines früheren Zugs wird beim nächsten Zustand ausgeliefert, nichts verschluckt', states(t, m, SO).length >= 1 && !t.gs._pendingCardReveal, { n: states(t, m, SO).length });
    }
  }
  R.finish();
})();
