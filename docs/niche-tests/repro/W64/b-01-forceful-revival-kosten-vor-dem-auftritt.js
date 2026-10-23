'use strict';
// W64b-01 · Forceful Revival × wiederbelebte Karte mit abbrechbarer Beschwörungs-Opferwahl: die Kosten stehen VOR dem Auftritt (Rammen/Animation)
//
// Kartentext Forceful Revival: „Choose a level X or lower Creature from your discard pile and place it into a free Support Zone of the user. The user takes damage equal to that
//   Creature's max HP. …" Regel (W63d): eine Karte streamed ihren Auftritt erst, nachdem es keine Cancel-Option mehr gibt.
// Vorher (W63d-Rest): `summonFromDiscard` zeigte den Ramm-Anlauf (`play_ram_animation`) VOR der abbrechbaren Opfer-/Tribut-Wahl der wiederbelebten Karte (Archer / Warrior / Guardian of Teocuilatl,
//   500 Piranhas …); brach der Spieler ab, hatte der Gegner die Karte gesehen. Jetzt: Kosten zuerst (`_beschwoerungKostenVorAuftritt`), Animation (`nachKostenAnim`) danach. Die Karte bietet solche
//   Kreaturen weiter an (kein Ausschluss). Dasselbe gilt für die anderen Pile-Wege (summonFromDeck / summonFromPile): Gegenprobe unten per Engine-Aufruf.
// Szene: reiche Standard-Szene, Sitz hat Fighting Lv3 auf Held 0, Ablage = die gewünschte Kreatur; MENSCH-Modus. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const FR = 'Forceful Revival';
const KREATUREN = ['Archer of Teocuilatl', 'Warrior of Teocuilatl', 'Guardian of Teocuilatl', '500 Piranhas in a Monster Suit'];

(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    for (const kre of KREATUREN) {
      const label = `${FR} → ${kre}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const mk = async () => {
        const t = await W.reicheSzene({ seat, karten: [FR], board: async (t2, s) => {
          t2.setAbilities(s, 0, [['Fighting', 'Fighting', 'Fighting'], [], []]);
          t2.gs.players[s].discardPile.push(kre);
        } });
        t._ablVor = t.gs.players[seat].discardPile.filter(x => x === kre).length;
        return t;
      };
      const antwort = (e) => (e.kind === 'generic' && e.d.type === 'cardGallery') ? { cardName: kre, source: 'discard' } : undefined;
      const d = await W.durchlauf(mk, seat, FR, { seat, hero: 0, maxCancel: 5, answer: antwort });
      W.pruefeDurchlauf(R, label, d, { seat, nCanc: 1 });
      // Die Karte wurde tatsächlich wiederbelebt (Durchlauf) bzw. liegt nach dem Abbruch wieder in der Ablage
      const clean = d.clean.t;
      R.check(`${label}: Durchlauf — ${kre} liegt auf dem Brett (500 Piranhas: auf der Seite des besiegten Gegners; die Szene hat Kopien auch in Hand/Deck)`, clean.inst(c => c.name === kre && c.zone === 'support').length === 1 && (kre.startsWith('500') || clean.gs.players[seat].discardPile.filter(x => x === kre).length === clean._ablVor - 1), { zonen: clean.inst(c => c.name === kre).map(c => c.zone), abl: clean.gs.players[seat].discardPile.filter(x => x === kre).length, vor: clean._ablVor });
      for (const { k, r, t } of d.cancels) {
        if (!r.undone) continue;
        R.check(`${label}: Abbruch an Stelle ${k} — ${kre} liegt wieder in der Ablage, nicht auf dem Brett; Ablage unverändert gezählt`, t.gs.players[seat].discardPile.filter(x => x === kre).length === t._ablVor && t.inst(c => c.name === kre && c.zone === 'support').length === 0, { abl: t.gs.players[seat].discardPile.filter(x => x === kre).length, vor: t._ablVor });
        R.check(`${label}: Abbruch an Stelle ${k} — der Ramm-Anlauf (play_ram_animation) ging nicht an Gegner/Zuschauer`, !r.tl.some(e => e.k === 'wire' && e.ev === 'play_ram_animation' && e.sid !== 'S' + seat), r.tl.filter(e => e.k === 'wire' && e.ev === 'play_ram_animation').map(e => e.sid));
      }
    }
  }
  // ── Dieselbe Reihenfolge-Lücke bei den anderen Pile-Wegen (summonFromPile: Deck / Ablage / Hand / Potion Deck): Kosten zuerst, Flug danach ──
  for (const seat of [0, 1]) {
    for (const pile of ['deck', 'discard', 'hand', 'potionDeck']) {
      const kre = '500 Piranhas in a Monster Suit';
      const label = `summonFromPile(${pile}) → ${kre}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const mk = async () => {
        const t = await W.reicheSzene({ seat, karten: [] });
        const ps = t.gs.players[seat];
        const arr = pile === 'deck' ? ps.mainDeck : pile === 'discard' ? ps.discardPile : pile === 'hand' ? ps.hand : ps.potionDeck;
        arr.unshift(kre);
        t.setHand ? (pile === 'hand' ? t.setHand(seat, ps.hand.slice()) : 0) : 0;
        t._vor = arr.filter(x => x === kre).length;
        t._arr = () => (pile === 'deck' ? ps.mainDeck : pile === 'discard' ? ps.discardPile : pile === 'hand' ? ps.hand : ps.potionDeck);
        return t;
      };
      const lauf = async (cancelAt) => {
        const t = await mk();
        t.gs.activePlayer = seat; t.phase(3);
        const r = await W.spiele(t, seat, kre, { cancelAt, persist: true, call: () => t.engine.summonFromPile(seat, pile, kre, 0, 0, { source: 'W64-Test' }), undoneFn: () => true });
        return { t, r };
      };
      const clean = await lauf(null);
      const flugOpp = (r) => r.tl.filter(e => e.k === 'wire' && e.ev === 'play_pile_transfer' && e.sid !== 'S' + seat);
      const nC = clean.r.tl.filter(e => e.k === 'answer-begin' && e.cancellable).length;
      R.check(`${label}: Durchlauf — die Kosten-Frage ist abbrechbar (${nC} abbrechbare Stelle[n]) und die Karte landet auf dem Brett`, nC >= 1 && clean.t.inst(c => c.name === kre && c.zone === 'support').length === 1, { nC, z: clean.t.inst(c => c.name === kre).map(c => c.zone) });
      const cx = await lauf(0);
      R.check(`${label}: Abbruch der Kosten-Frage — nichts ging an Gegner/Zuschauer (kein Flug), die Karte liegt wieder im Stapel`, flugOpp(cx.r).length === 0 && cx.t._arr().filter(x => x === kre).length === cx.t._vor && cx.t.inst(c => c.name === kre && c.zone === 'support').length === 0, { flug: flugOpp(cx.r).length, im_stapel: cx.t._arr().filter(x => x === kre).length, vor: cx.t._vor });
      if (pile !== 'hand') R.check(`${label}: Durchlauf — der Flug kommt erst NACH der Kosten-Frage`, (() => { const tl = clean.r.tl; const ia = tl.findIndex(e => e.k === 'answer'); const iF = tl.findIndex(e => e.k === 'wire' && e.ev === 'play_pile_transfer' && e.sid !== 'S' + seat); return iF < 0 || ia < 0 || iF > ia; })(), clean.r.tl.map(e => e.k + ':' + (e.ev || e.type || '')).slice(0, 30));
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
