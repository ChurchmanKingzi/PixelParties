'use strict';
// W66a · Hilfsmodul für die Hand-of-Death-Repros (echter Zugwechsel im MENSCH-Modus, Fragen wie im Spiel beantwortet).
//
// `bauen(o)`   baut eine Szene (Menschen-Modus, `lib/wire.js`): Wirker-Sitz `seat`, Gegner `opp`, Ziele auf beiden Brettern.
// `Pumpe`      beantwortet offene Fragen wie ein Mensch (Ja/Nein, Zielwahl, Galerien) und PROTOKOLLIERT jede Frage mit Zug/aktivem Spieler:
//                - die Zielwahl von Hand of Death („you may choose any target and defeat it", abbrechbar) — `pick(valid, pt)` liefert ein Ziel oder `null` (= „Nein"),
//                - Inyas „Buddy beschwören?" (`inyaJa`), alle übrigen Ja/Nein-Fragen (`ja`).
// `zugwechsel` führt den ECHTEN Zugwechsel aus (End-Phase über `advanceToPhase`, wie der Knopf „End Turn" in server.js: ON_TURN_END, Statusablauf, Zugbeginn des nächsten Spielers).
const W = require('./wire.js');
const H = W;
const IN = 'Card Game Player Inya';

class Pumpe {
  constructor(t, o = {}) {
    this.t = t; this.o = o; this.fragen = []; this.laeuft = true;
    this.p = this._schleife();
  }
  async _schleife() {
    const { t, o } = this;
    while (this.laeuft) {
      await new Promise(r => setImmediate(r));
      const gs = t.gs, e = t.engine;
      if (e._pendingGenericPrompt && gs.effectPrompt && gs.effectPrompt.promptId !== this._letzteG) {
        const d = gs.effectPrompt; this._letzteG = d.promptId;
        this.fragen.push({ art: 'G', typ: d.type, titel: d.title, pi: d.ownerIdx, turn: gs.turn, aktiv: gs.activePlayer });
        let a;
        if (d.type === 'confirm') a = { confirmed: d.title === IN ? (o.inyaJa ?? true) : (o.ja ?? true) };
        else { try { a = e._getCpuGenericResponse({ ...d, cancellable: false }, d.ownerIdx); } catch { /* unten */ } if (a === undefined || a === null || a === true) a = { cancelled: true }; }
        e.resolveGenericPrompt(a, d.promptId);
      } else if (e._pendingPrompt && gs.potionTargeting && gs.potionTargeting.isEffectPrompt && gs.potionTargeting !== this._letzteT) {
        const pt = gs.potionTargeting; this._letzteT = pt;
        const titel = pt.potionName || (pt.config && (pt.config.title || pt.config.description));
        const valid = (pt.validTargets || []).filter(x => !x.ineligible);
        const hod = titel === 'Hand of Death';
        this.fragen.push({ art: 'T', titel, pi: pt.ownerIdx, turn: gs.turn, aktiv: gs.activePlayer, hod, cancellable: !!(pt.config && pt.config.cancellable), n: valid.length });
        let pick;
        if (hod && o.pick) pick = o.pick(valid, pt);
        else pick = valid[0];
        if (pick == null) { gs.potionTargeting = null; e.resolveEffectPrompt(null, { cancelled: true }); }
        else await t.host.doConfirmPotion(t.room, pt.ownerIdx, { selectedIds: [pick.id] });
      }
    }
  }
  async stop() { this.laeuft = false; await this.p; }
  get hodFragen() { return this.fragen.filter(f => f.hod); }
}

/**
 * Szene. Optionen:
 *   seat (0)     Wirker-Sitz;  inya (false)  Held 0 des Wirkers = Card Game Player Inya;  hand (['Hand of Death'])  Hand des Wirkers
 *   gegnerHelden  Namen der Gegner-Helden (Standard: neutral B)
 *   Ziele (immer vorhanden): Gegner-Kreatur (opp,0,0), Gegner-Kreatur (opp,1,1), eigene Kreatur (seat,1,0), eigene (seat,2,2)
 */
async function bauen(o = {}) {
  const seat = o.seat ?? 0, opp = 1 - seat;
  const eigene = [o.inya ? IN : H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
  const gegner = o.gegnerHelden || [H.BLANK_HEROES_B[0], H.BLANK_HEROES_B[1], H.BLANK_HEROES_B[2]];
  const heroes = seat === 0 ? [eigene, gegner] : [gegner, eigene];
  const hand = [[], []]; hand[seat] = o.hand || ['Hand of Death'];
  const t = await W.fresh({ heroes, hand, turn: o.turn ?? 5, active: seat, deckSize: 20, gold: 300, ...(o.fresh || {}) });
  t.ziele = {
    gegnerKreatur: t.put(opp, 0, 0, H.INERT.creature),
    gegnerKreatur2: t.put(opp, 1, 1, H.INERT.creature),
    eigeneKreatur: t.put(seat, 1, 0, H.INERT.creature),
    eigeneKreatur2: t.put(seat, 2, 2, H.INERT.creature),
  };
  t.seat = seat; t.opp = opp;
  return t;
}
const buddy = (t) => t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.zone === 'support')[0] || null;
/** Zielwahl-Funktionen für `pick` */
const ZIEL = {
  gegnerKreatur: (t) => (v) => v.find(q => q.type === 'equip' && q.owner === t.opp && q.slotIdx === 0 && q.heroIdx === 0),
  gegnerHeld: (t) => (v) => v.find(q => q.type === 'hero' && q.owner === t.opp && q.heroIdx === 0),
  eigeneKreatur: (t) => (v) => v.find(q => q.type === 'equip' && q.owner === t.seat && q.heroIdx === 1),
  eigenerHeld: (t) => (v) => v.find(q => q.type === 'hero' && q.owner === t.seat && q.heroIdx === 1),
  buddy: (t) => (v) => v.find(q => q.type === 'equip' && q.owner === t.seat && q.heroIdx === 0),
  nein: () => () => null,
};
/** Hand of Death über den echten Spielweg spielen (Fragen wie ein Mensch beantwortet). Gibt das Ergebnis von `t.play` zurück. */
async function wirken(t, pumpe, o = {}) {
  return W.spiele(t, t.seat, 'Hand of Death', { hero: o.hero ?? 0, ...(o.optionen || {}) });
}
async function zugwechsel(t) { return t.endTurn(); }

module.exports = Object.assign({}, W, { Pumpe, bauen, buddy, ZIEL, wirken, zugwechsel, IN });
