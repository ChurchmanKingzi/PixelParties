'use strict';
// W64b-01 · Staff of Uncontrollable Destruction: der Auftritt wird VOR dem ersten Effektschritt gestreamt (Al, 23.10.2026)
//
// Kartentext: „Discard your entire hand and draw the same number of cards +1. You cannot draw or move cards out of your discard pile for the rest of the turn."
// Regel (Al): „Auftritte sollten VOR BEGINN der Effekte gestreamed werden (aber nach dem Confirm), nicht erst an deren Ende. Der Gegner weiß sonst nicht sofort, *was für einen Effekt* er gerade
//   mitansieht. Reihenfolge: Aktiviere eine Karte, wähle ggf. ihre Ziele, bestätige ggf., DANN streame den Auftritt, dann feuere den Effekt durch."
// Der Stab hat keine abbrechbare Stelle: sein Auftritt muss also vor dem ersten Abwurf kommen — vor jedem Ereignis (Abwurf-Flug, Glimmen), jeder Effekt-Protokollzeile („discard", „draw")
//   und vor jedem Zustandswechsel (Handgröße, Ablage), für Gegner UND Zuschauer, auf beiden Sitzen.
// Prüft mit der Leitungs-Harness (lib/wire.js, MENSCH-Modus, echte `do*`-Handler). Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const N = 'Staff of Uncontrollable Destruction';
(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    const mk = async () => {
      const hand = [[], []]; hand[seat] = [N, W.INERT.filler, W.INERT.creature, W.INERT.creature, W.INERT.filler];
      hand[opp] = [W.INERT.creature, W.INERT.creature];
      const deck = [Array(18).fill(W.INERT.creature), Array(18).fill(W.INERT.creature)];
      return W.fresh({ scanState: true, hand, deck, active: seat });
    };
    R.section(`Sitz ${seat}: Durchlauf`);
    const d = await W.durchlauf(mk, seat, N, { seat });
    W.pruefeDurchlauf(R, `Sitz ${seat}`, d, { seat, nCanc: 0, nEcht: 0 });
    const c = d.clean.r, t = d.clean.t, ps = t.gs.players[seat];
    // Sachprüfung: die Wirkung ist vollständig eingetreten (4 Karten abgeworfen, 5 gezogen, Sperren)
    R.check(`Sitz ${seat}: Stab verbraucht, Hand = 4 abgeworfene + 1 = 5 neue Karten`, !ps.hand.includes(N) && ps.hand.length === 5, ps.hand);
    R.check(`Sitz ${seat}: Zieh- und Ablage-Sperre gesetzt`, ps.drawLocked === true && ps._discardLockedTurn === t.gs.turn, { dl: ps.drawLocked });
    // Reihenfolge je Empfänger
    for (const sid of ['S' + opp, 'SPEC']) {
      const ev = c.tl.map((e, i) => [e, i]).filter(([e]) => e.k === 'wire' && e.sid === sid);
      const reveal = ev.find(([e]) => e.ev === 'card_reveal' && e.data && e.data.cardName === N);
      const ersterAbwurf = ev.find(([e]) => e.ev === 'play_pile_transfer' || (e.ev === 'action_log' && e.data && /^(discard|draw|pile_take)/.test(String(e.data.type))));
      const playLog = ev.find(([e]) => e.ev === 'action_log' && e.data && e.data.type === 'card_played' && e.data.card === N);
      R.check(`${sid}: card_reveal des Stabs vorhanden`, !!reveal);
      R.check(`${sid}: Protokollzeile „card_played" des Stabs vorhanden`, !!playLog);
      R.check(`${sid}: card_reveal VOR dem ersten Abwurf-Ereignis/-Protokoll (reveal ${reveal && reveal[1]}, Abwurf ${ersterAbwurf && ersterAbwurf[1]})`, !!reveal && !!ersterAbwurf && reveal[1] < ersterAbwurf[1]);
      R.check(`${sid}: Zeile „card_played" VOR dem ersten Abwurf-Protokoll`, !!playLog && !!ersterAbwurf && playLog[1] < ersterAbwurf[1]);
      // Zustand: kein game_state mit veränderter Hand/Ablage vor dem Auftritt
      const zust = ev.filter(([e]) => e.ev === 'game_state' || e.ev === 'spectator_state');
      const hk = (e) => { try { const o = JSON.parse(e.json); return JSON.stringify([o.players.map(p => [p.handCount ?? (p.hand && p.hand.length), p.discardPile && p.discardPile.length, p.deckCount])]); } catch { return null; } };
      const basis = zust.length ? hk(zust[0][0]) : null;
      const ersteAenderung = zust.find(([e], k) => k > 0 && hk(e) !== basis);
      R.check(`${sid}: kein veränderter Zustand (Hand/Ablage/Deck) VOR dem Auftritt (Änderung bei ${ersteAenderung && ersteAenderung[1]}, Auftritt ${reveal && reveal[1]})`, !ersteAenderung || (!!reveal && reveal[1] < ersteAenderung[1]));
      R.check(`${sid}: der Auftritt kommt genau einmal`, ev.filter(([e]) => e.ev === 'card_reveal' && e.data && e.data.cardName === N).length === 1);
    }
  }
  // Stille Varianten (ohne sichtbares Abwurf-/Zieh-Ereignis): nur der Stab auf der Hand + Zieh-Sperre — der Stab wirkt dann NUR still (Sperren setzen, Protokollzeile, Zustand).
  // Vorher kam der Auftritt erst am Ende der Auflösung, NACH dem veränderten Zustand.
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    R.section(`Sitz ${seat}: stille Variante (nur der Stab auf der Hand, Zieh-Sperre)`);
    const mk = async () => {
      const hand = [[], []]; hand[seat] = [N]; hand[opp] = [W.INERT.creature];
      const t = await W.fresh({ scanState: true, hand, deck: [Array(18).fill(W.INERT.creature), Array(18).fill(W.INERT.creature)], active: seat });
      t.gs.players[seat].drawLocked = true;
      return t;
    };
    const d = await W.durchlauf(mk, seat, N, { seat });
    W.pruefeDurchlauf(R, `Sitz ${seat} still`, d, { seat, nCanc: 0, nEcht: 0 });
    const c = d.clean.r, ps = d.clean.t.gs.players[seat];
    R.check(`Sitz ${seat} still: Stab verbraucht, Sperren gesetzt, nichts gezogen`, !ps.hand.includes(N) && ps._discardLockedTurn === d.clean.t.gs.turn && ps.hand.length === 0, ps.hand);
    for (const sid of ['S' + opp, 'SPEC']) {
      const ev = c.tl.map((e, i) => [e, i]).filter(([e]) => e.k === 'wire' && e.sid === sid);
      const reveal = ev.find(([e]) => e.ev === 'card_reveal' && e.data && e.data.cardName === N);
      const wirkungsLog = ev.find(([e]) => e.ev === 'action_log' && e.data && e.data.type === 'staff_of_uncontrollable_destruction');
      R.check(`${sid} still: Auftritt (${reveal && reveal[1]}) VOR der Effekt-Protokollzeile (${wirkungsLog && wirkungsLog[1]})`, !!reveal && !!wirkungsLog && reveal[1] < wirkungsLog[1]);
    }
  }
  R.finish();
})();
