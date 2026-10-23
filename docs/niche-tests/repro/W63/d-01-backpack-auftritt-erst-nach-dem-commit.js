'use strict';
// W63d-01 · Treasure Hunter's Backpack: der Auftritt geht erst zum Gegner, wenn es keine Abbruchmöglichkeit mehr gibt (Al, 22.10.2026)
//
// Kartentext: „Choose an equippable Artifact with a Cost of 50 or less from your deck and play it immediately without paying its Cost.
//   The Hero you equip the Artifact to cannot perform an Action this turn."
// Befund (Al): „Treasure Hunter's Backpack streamed sein Bild bereits an den Gegner, bevor die Karte committed ist." Regel: Eine Karte streamed ihren Auftritt IMMER erst,
//   nachdem es keine Cancel-Option mehr gibt (alle Auswahlen/Zielwahlen/Kostenwahlen abgeschlossen).
// Ursache: Das Backpack ist ein Ziel-Artefakt (`isTargetingArtifact`) ohne `deferReveal` — `doConfirmPotion` sendete `card_reveal` + Protokollzeile (`card_played`) SOFORT mit dem
//   ersten „Unpack!"-Klick, noch VOR der Artefakt-Wahl aus dem Deck (abbrechbar) und der Träger-/Zonenwahl (abbrechbar). Abbruch → Gegner hat die Karte gesehen, sie liegt aber auf der Hand;
//   die geöffnete Zielwahl wurde nach `aborted` sogar erneut geöffnet und der Auftritt ein zweites Mal gesendet.
// Prüft mit der Leitungs-Harness (lib/wire.js: jede Nachricht an Gegner-Sitz und Zuschauer, verschränkt mit den Fragen an den Spieler, MENSCH-Modus):
//   • Durchlauf: Gegner UND Zuschauer erhalten keinerlei Auftritt (Bild, Protokollzeile, Flug) vor der letzten abbrechbaren Stelle, danach den Auftritt; kein Kartenname im game_state davor;
//   • Abbruch an JEDER der drei Stellen (Unpack-Knopf, Artefakt-Galerie, Träger-/Zonenwahl): weder Gegner noch Zuschauer haben je etwas erhalten; die Karte liegt noch auf der Hand;
//   • beide Sitze (Spieler 0 und Spieler 1 am Zug).
// Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const B = "Treasure Hunter's Backpack";
const EQ = ['Club of Gobbo', 'Cloak of Edge'];
(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    const mk = async () => {
      const hand = [[], []]; hand[seat] = [B];
      const deck = [Array(18).fill(W.INERT.creature), Array(18).fill(W.INERT.creature)]; deck[seat] = [...EQ, ...Array(18).fill(W.INERT.creature)];
      const t = await W.fresh({ scanState: true, hand, deck, active: seat });
      return t;
    };
    R.section(`Sitz ${seat}: Durchlauf + Abbruch an jeder Stelle`);
    const d = await W.durchlauf(mk, seat, B, { seat });
    W.pruefeDurchlauf(R, `Sitz ${seat}`, d, { seat, nCanc: 3 });
    // Sachprüfung des Durchlaufs: die gewählte Ausrüstung liegt, der Träger ist gesperrt, das Backpack ist verbraucht
    const t = d.clean.t, ps = t.gs.players[seat];
    R.check(`Sitz ${seat}: Durchlauf — Ausrüstung liegt am Träger`, ps.supportZones.some(h => h.some(z => z.length && EQ.includes(z[0]))), ps.supportZones);
    R.check(`Sitz ${seat}: Durchlauf — Backpack nicht mehr auf der Hand`, !ps.hand.includes(B), ps.hand);
    R.check(`Sitz ${seat}: Durchlauf — Auftritt genau einmal (ein card_reveal an den Gegner)`, d.clean.r.tl.filter(e => e.k === 'wire' && e.ev === 'card_reveal' && e.sid === 'S' + (1 - seat) && e.data && e.data.cardName === B).length === 1);
    // Abbruch: Aktionen/Gold nicht verbraucht
    for (const { k, t: tc } of d.cancels) {
      const pc = tc.gs.players[seat];
      R.check(`Sitz ${seat}: Abbruch ${k} — Deck unverändert (Ausrüstungen noch drin), Gold unverändert`, EQ.every(e => pc.mainDeck.includes(e)) && pc.gold === 100, { gold: pc.gold });
    }
  }
  // Der Abbruch lässt den Spieler die Karte danach NEU spielen (nichts bleibt hängen): Abbruch an der Galerie, dann vollständig durchspielen
  R.section('Abbruch, dann erneut spielen: der Auftritt kommt genau einmal, nach dem Commit');
  {
    const t = await W.fresh({ scanState: true, hand: [[B], []], deck: [[...EQ, ...Array(18).fill(W.INERT.creature)], Array(18).fill(W.INERT.creature)] });
    const r1 = await W.spiele(t, 0, B, { cancelAt: 1, persist: true });
    R.check('erster Versuch abgebrochen, nichts gesehen', r1.cancelled && r1.appearances.length === 0 && r1.stateLeaks.length === 0, r1.leakEvents);
    const r2 = await W.spiele(t, 0, B, {});
    R.check('zweiter Versuch: gespielt', t.gs.players[0].supportZones.some(h => h.some(z => z.length && EQ.includes(z[0]))));
    R.check('zweiter Versuch: kein Auftritt vor der letzten abbrechbaren Stelle', r2.leaks.length === 0, r2.leakEvents);
    R.check('zweiter Versuch: Auftritt nach dem Commit', r2.appearances.some(i => i > r2.lastCancellableIdx && r2.tl[i].sid === 'S1'), r2.appearances.length);
  }
  R.finish();
})();
