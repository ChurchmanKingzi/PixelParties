'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Shroomasaur"
//  Creature (Normal, Lv 0, Summoning Magic, 90 HP)
//
//  „You may once per turn give this Creature the name of any other card in addition to its own name for the rest of the turn. If this Creature leaves the board because of your own
//   card or effect, draw 1 card. You can only control 1 "Shroomasaur" at a time."
//
//  ── ZUSATZNAME ──────────────────────────────────────────────────────────
//  Aktiver Effekt (einmal pro Zug, die Engine sperrt je Instanz): der Spieler nennt über denselben Kartennamen-Wähler wie Luck (`cardNamePicker`) irgendeinen Kartennamen außer „Shroomasaur"
//  selbst (Tokens gibt es als Karten nicht). Abbruch verbraucht nichts. Der Name wird als `counters._zusatzName` an die Instanz gehängt und gilt nur in diesem Zug (`_zusatzNameZug`);
//  ein zweiter Einsatz im selben Zug gibt es nicht (Sperre je Instanz). Er kommt NEBEN den eigenen Namen: die Karte heißt „Shroomasaur" UND „<Name>".
//  Wo Kartennamen verglichen werden, zählt der Zusatzname dort, wo die Engine es zentral regelt (`instHatName`):
//   • „You can only control 1 X" (Hand-Ausgrauen, Beschwörung, Platzieren): trägt Shroomasaur den Namen X, kann der Spieler kein weiteres X mehr bringen (`zusatzNameSperrt`, `nurEinerSchonKontrolliert`,
//     der gemeinsame Zähler `kontrolliert`) — Clone, Cute Phoenix & Co.;
//  Andere Kartenskripte, die ihre Namen selbst zählen (`c.name === …`), sehen den Zusatznamen nicht — dort gilt weiter nur der eigene Name.
//  Anzeige: grünes Etikett mit dem Zusatznamen auf der Karte und im Tooltip neben dem echten Namen (Client, `counters._zusatzName`).
//
//  ── „LEAVES THE BOARD BECAUSE OF YOUR OWN CARD OR EFFECT" ───────────────
//  `onCardLeaveZone` der Karte selbst: verlässt sie die Support Zones (zerstört, geopfert, besiegt durch eine eigene Karte, zurück auf die Hand, ins Deck …) und der VERURSACHER ist ihr
//  Kontrolleur (`entferntVon`; mit ausdrücklicher Quelle — Statustod und Spielregeln ohne Quelle zählen nicht), zieht der Kontrolleur 1 Karte. Umzug innerhalb des Bretts zählt nicht.
//  „You can only control 1": `beforeSummon` + `canSummon` (Muster Clone).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `shroomasaur_spores` (Pixelart): viele kleine bunte Pilze wachsen rund um die Karte.
// ═══════════════════════════════════════════

const { kontrolliert } = require('./_double-shared');

const CARD_NAME = 'Shroomasaur';
const ANIM_MS = 1000;

/** 1 Karte ziehen — je Abgang nur einmal (Austritts- und Tod-Hook können beide feuern). */
async function ziehen(engine, inst, pi) {
  if (inst._shroomGezogen) return;
  inst._shroomGezogen = true;
  engine.log('shroomasaur_draw', { player: engine.gs.players[pi]?.username });
  await engine.actionDrawCards(pi, 1, { source: inst });
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  cpuSkipProactive: true,                  // der Zusatzname ist für die CPU ohne Nutzen

  async beforeSummon(ctx) { return !kontrolliert(ctx._engine, ctx.cardOwner, CARD_NAME); },
  canSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    return !engine.cardInstances.some(c => c.zone === 'support' && c.name === CARD_NAME && !c.faceDown && (c.controller ?? c.owner) === pi && c.id !== ctx.card?.id);
  },

  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    return !!inst && inst.zone === 'support' && !inst.faceDown;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = engine.kontrolleurVon(inst);
    if (!inst || inst.zone !== 'support') return false;

    const db = engine._getCardDB();
    const namen = Object.keys(db).filter(n => db[n] && db[n].cardType !== 'Token' && n !== CARD_NAME).sort((a, b) => a.localeCompare(b));
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardNamePicker',
      title: CARD_NAME,
      description: 'Choose a card name. Until the end of the turn, Shroomasaur also has that name.',
      cardNames: namen,
      cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName || !db[wahl.cardName] || wahl.cardName === CARD_NAME) return false;

    inst.counters._zusatzName = wahl.cardName;
    inst.counters._zusatzNameZug = gs.turn;
    engine._broadcastEvent('play_zone_animation', { type: 'shroomasaur_spores', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
    engine.log('shroomasaur_name', { player: gs.players[pi]?.username, name: wahl.cardName });
    await engine._delay(ANIM_MS * 0.6);
    engine.sync();
    await engine._delay(ANIM_MS * 0.4);
    return true;
  },

  hooks: {
    /** Verlässt Shroomasaur das Brett durch eine eigene Karte/einen eigenen Effekt: 1 Karte ziehen. */
    onCardLeaveZone: async (ctx) => {
      const weg = ctx.leavingCard;
      const inst = ctx.card;
      if (!weg || !inst || weg.id !== inst.id) return;
      if (ctx.fromZone !== 'support' || ctx.toZone === 'support') return;
      const engine = ctx._engine;
      const pi = engine.kontrolleurVon(inst);
      const hatQuelle = ctx.source != null || typeof ctx.sourceOwner === 'number';
      if (!hatQuelle || ctx.entferntVon !== pi) return;                  // „your own card or effect"
      await ziehen(engine, inst, pi);
    },

    /** Besiegt durch Schaden: der Austritts-Hook trägt dort keine Quelle — die Tod-Meldung schon (`source`, `type`). Nur Karten/Effekte des Kontrolleurs, keine Status-Ticks. */
    onCreatureDeath: async (ctx) => {
      const tod = ctx.creature;
      const inst = ctx.card;
      if (!tod || !inst || tod.instId !== inst.id) return;
      if (['status', 'burn', 'poison', 'bleed'].includes(ctx.type)) return;
      const engine = ctx._engine;
      const pi = engine.kontrolleurVon(inst);
      const q = ctx.source;
      const qOwner = (typeof ctx.sourceOwner === 'number') ? ctx.sourceOwner : (q && typeof q === 'object') ? (q.controller ?? q.owner) : undefined;
      if (qOwner !== pi) return;
      await ziehen(engine, inst, pi);
    },
  },
};
