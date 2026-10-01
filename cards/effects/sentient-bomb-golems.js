// ═══════════════════════════════════════════
//  CARD EFFECT: "Sentient Bomb Golems"
//  Creature (Normal, Lv 0, 10 HP — Summoning Magic)
//
//  „At the end of each of your turns, if you haven't summoned a \"Sentient
//   Bomb Golems\" yet this turn, you may choose a \"Sentient Bomb Golems\"
//   from your hand or deck and place it into a free Support Zone of the
//   corresponding Hero. If a Hero you control has 3 copies of \"Sentient
//   Bomb Golems\" in its Support Zones at the end of your turn, defeat them
//   all to choose a target and deal 999 damage to it."
//
//  ── ABLAUF AM ZUGENDE (je Golem, in dieser Reihenfolge) ───────────
//   1) Nachlegen: habe ich in diesem Zug noch keinen Golem beschworen
//      (`ps._golemSummonTurn`, gestempelt bei JEDEM Golem, der meine Zone
//      betritt — Beschwoeren wie Platzieren), darf ich aus Hand ODER Deck
//      einen in einen freien Platz DESSELBEN Helden legen. Abbrechbar. Weil
//      der Platz-Stempel danach gesetzt ist, kommt hoechstens EIN Golem
//      zusammen; lehne ich ab, fragt der naechste Golem (anderer Held) neu.
//   2) Prueffenster NACH der Zusatzbeschwoerung (Als Vorgabe): ein dritter
//      Golem, der gerade erst gelegt wurde, loest SOFORT die Explosion aus.
//      Hat dieser Held 3 Golems in seinen Zonen, werden alle besiegt —
//      dargestellt als DREI RIESIGE Explosionen, je eine auf einem Golem
//      (`mega_explosion`) — und danach ein Ziel gewaehlt (Pflicht), das
//      999 Schaden nimmt.
//   Jeder Golem wickelt nur SEINEN Helden ab; bereits besiegte Golems
//   (zone ≠ support) steigen aus.
// ═══════════════════════════════════════════

const CARD_NAME = 'Sentient Bomb Golems';
const SCHADEN = 999;
const NOETIG = 3;

/** Meine Golems an diesem Platz (Brettseite + Held), offen und unter meiner Kontrolle. */
function golemsBei(engine, pi, seite, heroIdx) {
  return engine.cardInstances.filter(c =>
    c.zone === 'support' && c.name === CARD_NAME && !c.faceDown
    && (c.controller ?? c.owner) === pi
    && engine.physicalSide(c) === seite && c.heroIdx === heroIdx);
}

/** Erster freier, nicht gesperrter Platz des Helden (oder -1). */
function freierPlatz(engine, seite, heroIdx) {
  for (let z = 0; z < 3; z++) {
    if (engine.supportSlotBelegt(seite, heroIdx, z)) continue;
    if (engine.isSupportZoneLocked(seite, heroIdx, { source: CARD_NAME, cardName: CARD_NAME, via: 'place' })) continue;
    return z;
  }
  return -1;
}

module.exports = {
  activeIn: ['support'],
  cpuMeta: { dealsDamage: true },

  /** CPU: bei der Hand/Deck-Frage immer nachlegen (Hand zuerst). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'cardGallery') return undefined;
    const k = (promptData.cards || [])[0];
    return k ? { cardName: k.name, source: k.source } : undefined;
  },

  hooks: {
    /** „haven't summoned … yet this turn": jeder Golem, der meine Zone betritt, zaehlt. */
    onCardEnterZone: (ctx) => {
      const c = ctx.enteringCard;
      if (!c || c.name !== CARD_NAME || ctx.toZone !== 'support') return;
      const pi = c.controller ?? c.owner;
      const ps = ctx._engine.gs.players[pi];
      if (ps) ps._golemSummonTurn = ctx._engine.gs.turn;
    },

    onTurnEnd: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || inst.faceDown) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      if ((inst.controller ?? inst.owner) !== pi) return;
      const ps = gs.players[pi];
      if (!ps) return;
      const seite = engine.physicalSide(inst);
      const heroIdx = inst.heroIdx;
      const host = gs.players[seite]?.heroes?.[heroIdx];

      // ① Nachlegen aus Hand oder Deck.
      if (ps._golemSummonTurn !== gs.turn && host?.name) {
        const slot = freierPlatz(engine, seite, heroIdx);
        const karten = [];
        const inHand = (ps.hand || []).filter(n => n === CARD_NAME).length;
        const imDeck = (ps.mainDeck || []).filter(n => n === CARD_NAME).length;
        if (slot >= 0 && inHand > 0) karten.push({ name: CARD_NAME, source: 'hand', count: inHand });
        if (slot >= 0 && imDeck > 0) karten.push({ name: CARD_NAME, source: 'deck', count: imDeck });
        if (karten.length > 0) {
          const wahl = await engine.promptGeneric(pi, {
            type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
            description: `Place a "${CARD_NAME}" from your hand or deck into a free Support Zone of ${host.name}?`,
            cards: karten, confirmLabel: '💣 Place!', cancellable: true, cancelLabel: 'No',
          });
          if (wahl && !wahl.cancelled && (wahl.source === 'hand' || wahl.source === 'deck')
              && karten.some(k => k.source === wahl.source)) {
            const platz = freierPlatz(engine, seite, heroIdx);
            if (platz >= 0 && ps._golemSummonTurn !== gs.turn) {
              await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
              await engine.placeFromPile(pi, wahl.source, CARD_NAME, heroIdx, platz, {
                source: CARD_NAME, ...(seite !== pi ? { heldSeite: seite } : {}),
              });
              ps._golemSummonTurn = gs.turn;
              engine.sync();
            }
          }
        }
      }

      // ② Prueffenster NACH dem Nachlegen: drei Golems an diesem Helden → Explosion.
      if (inst.zone !== 'support') return;   // schon von einem Vorgaenger besiegt
      const golems = golemsBei(engine, pi, seite, heroIdx);
      if (golems.length < NOETIG) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      // Drei riesige Explosionen, je eine auf einem Golem.
      for (const g of golems) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'mega_explosion', owner: seite, heroIdx, zoneSlot: g.zoneSlot,
        });
      }
      await engine._delay(650);

      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx };
      for (const g of golems) {
        await engine.actionDestroyCard(quelle, g, { sourceName: CARD_NAME });
      }
      engine.log('sentient_bomb_golems_detonate', {
        player: ps.username, hero: host?.name, golems: golems.length,
      });
      engine.sync();

      // „… to choose a target and deal 999 damage to it" — Pflicht.
      const ziel = await ctx.promptDamageTarget({
        side: 'any', types: ['hero', 'creature'], damageType: 'creature',
        baseDamage: SCHADEN, title: CARD_NAME,
        description: `Choose a target and deal ${SCHADEN} damage to it.`,
        confirmLabel: `💥 ${SCHADEN} Damage!`, confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (!ziel) return;
      if (ziel.type === 'hero') {
        const h = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (h && h.hp > 0) await ctx.dealDamage(h, SCHADEN, 'creature');
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(quelle, ziel.cardInstance, SCHADEN, 'creature',
          { sourceOwner: pi, canBeNegated: true });
      }
      engine.sync();
    },
  },
};
