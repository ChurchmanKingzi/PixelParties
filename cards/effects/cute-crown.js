'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Crown"
//  Artifact (Equipment, Cost 8)
//
//  „Equip this card to a Hero you control. You may once per turn summon a "Cute" Creature from your hand as an additional Action with the equipped Hero, but
//   the equipped Hero cannot summon any Creatures except "Cute" Creatures."
//
//  ── KOSTEN UND WORTLAUT (Als Vorgabe 10.10.) ────────────────────────────
//  Kosten jetzt 8 (vorher niedriger), ganz neuer Effekt. Datenänderung in `data/cards.json`. Die Seitenbindung („a Hero you control") bleibt: `equipOwnSideOnly`.
//
//  ── ① DIE ZUSATZAKTION (kein manuelles Auslösen!) ───────────────────────
//  Als Vorgabe 10.10.: „Hier soll man einfach, solange der Crown-Charge verfügbar ist, eine Creature mit dem Hero in der Main-Phase beschwören können (oder in der
//  Action-Phase, ohne dabei die Action zu verbrauchen). Crown muss dazu nicht manuell getriggert werden." Deshalb kein Klick auf die Krone und keine Abfrage — sie ist ein
//  stehender ZUSATZAKTIONS-ANBIETER: Typ `cute_crown_summon` (Kategorie `creature`, `heroRestricted` = nur der Träger, `expiresAtTurnEnd` = eine ungenutzte Ladung
//  verfällt am Zugende), Filter = „Cute" Creature.
//    • Die Ladung wird zu Beginn JEDES eigenen Zuges gewährt (`onTurnStart`) und beim Anlegen, wenn der Besitzer gerade am Zug ist (`onPlay`) — „once per turn".
//      Verbraucht wird sie vom ganz normalen Beschwörungsweg (`doPlayCreature` fragt zuerst `findAdditionalActionForCard`): in der Main Phase ist sie der EINZIGE Weg,
//      in der Action Phase wird sie VOR der Aktion des Helden genommen — die Aktion bleibt frei: Typ-Flag `freeInActionPhase` (server.js `additionalIsFree`) — der Zug zählt
//      nicht als Aktion der Phase und schaltet sie nicht weiter, anders als eine gewöhnliche Zusatzaktion, die in der Action Phase die Phase beendet.
//    • „from your hand": nur Handkarten (der Filter gilt nur für die Beschwörung aus der Hand; Effekt-Beschwörungen aus Deck/Ablage laufen nicht über Zusatzaktionen).
//    • „Cute" Creature = der Name enthält „Cute" als GANZES Wort (`_cute-shared.js`: `hasCuteInName`; „Cuteness Drone"/„Acute …" zählen nicht). Trägt der Held Cute Wings
//      („All Creatures that Hero summons count as Cute"), zählt jede Creature, die er beschwört (`heroHasCuteWings`) — der Filter bekommt dafür den Träger als Kontext.
//    • Mehrere Kronen: jede hat ihre eigene Ladung („once per turn" je Karte).
//
//  ── ② DER NACHTEIL ──────────────────────────────────────────────────────
//  „The equipped Hero cannot summon any Creatures except 'Cute' Creatures": Equip-Hook `canPlayCard` (wie bei Cute Princess Mary, nur an der Ausrüstung statt am Helden; die Krone
//  stempelt sich dafür `counters.treatAsEquip` wie die Idej-Schwerter — nur markierte Ausrüstung wird gefragt):
//  die Engine fragt ihn für JEDE Spielbarkeit — Ausgrauen im Client, `validateActionPlay` beim Beschwören aus der Hand. Spells, Attacks, Abilities und Artifacts bleiben
//  unberührt. Gilt für das Beschwören aus der HAND durch den Träger; Beschwörungen durch Karteneffekte (Living Illusion, Wiederbelebung …) sind keine Plays des Helden.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `crown_flutter` (Pixelart, Brett-Animation am Platz der Krone, Hülle `ppSalve`; Vorlage: das Kartenbild — die goldene Krone mit den beiden weißen Flügeln):
//  beim Verbrauch der Ladung schlagen die Flügel, die Krone hebt sich, goldene Funken stieben. Klänge in ZONE_ANIM_SFX; Log `cute_crown_summon`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { hasCuteInName, heroHasCuteWings } = require('./_cute-shared');

const CARD_NAME = 'Cute Crown';
const ADDITIONAL_TYPE = 'cute_crown_summon';

/** Ist `cardData` für den Träger (Kontext `c`) eine „Cute" Creature? Ohne Kontext zählt nur der Name. */
function istCuteKreatur(cardData, c) {
  if (!cardData || !hasCardType(cardData, 'Creature')) return false;
  if (hasCuteInName(cardData.name)) return true;
  return !!(c && c.engine && heroHasCuteWings(c.engine, c.playerIdx, c.heroIdx));
}

function registerType(engine) {
  engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
    label: CARD_NAME,
    allowedCategories: ['creature'],
    heroRestricted: true,
    expiresAtTurnEnd: true,
    freeInActionPhase: true,       // in der Action Phase gratis: zaehlt nicht als Aktion, schaltet die Phase nicht weiter (server.js `additionalIsFree`)
    filter: istCuteKreatur,
    onConsume: (eng, pi, inst) => {
      const seite = eng.physicalSide(inst);
      eng._broadcastEvent('play_zone_animation', {
        type: 'crown_flutter', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1, duration: 1100,
        targets: [{ owner: seite, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, cardName: CARD_NAME }],
        originOwner: seite, originHeroIdx: inst.heroIdx, originZoneSlot: inst.zoneSlot,
      });
      eng.log('cute_crown_summon', { player: eng.gs.players[pi]?.username, hero: eng.gs.players[seite]?.heroes?.[inst.heroIdx]?.name || null });
    },
  });
}

/**
 * `treatAsEquip` — dieselbe Selbst-Markierung wie bei den Idej-Schwertern: nur MARKIERTE Ausrüstung fragt die Engine in `getHeroPlayableCards` und `validateActionPlay` nach
 * `canPlayCard`. Ohne die Marke bliebe der Nachteil („cannot summon any Creatures except Cute") reine Papierform.
 */
function stempeln(ctx) {
  if (!ctx.card) return;
  ctx.card.counters = ctx.card.counters || {};
  ctx.card.counters.treatAsEquip = 1;
}

/** Gewährt die Ladung, wenn der Besitzer am Zug ist und die Krone wirklich an einem Helden liegt. */
function gewaehre(ctx) {
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support' || inst.faceDown) return;
  if (engine.gs.activePlayer !== ctx.cardOwner) return;
  registerType(engine);
  ctx.grantAdditionalAction(ADDITIONAL_TYPE);
}

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,
  activeIn: ['support'],

  /**
   * „… but the equipped Hero cannot summon any Creatures except 'Cute' Creatures." Equip-Gate der Engine (`canPlayCard`): nur Creatures werden gefiltert;
   * mit Cute Wings zählt jede Creature, die der Held beschwört, als Cute.
   */
  canPlayCard(gs, playerIdx, heroIdx, cardData, engine) {
    if (!cardData || !hasCardType(cardData, 'Creature')) return true;
    return hasCuteInName(cardData.name) || heroHasCuteWings(engine, playerIdx, heroIdx);
  },

  hooks: {
    onPlay: (ctx) => {
      if (ctx.playedCard && ctx.playedCard.id !== ctx.card.id) return;   // nur das eigene Anlegen, nicht jedes Ausspielen
      stempeln(ctx);
      registerType(ctx._engine);
      gewaehre(ctx);
    },
    onGameStart: (ctx) => { stempeln(ctx); registerType(ctx._engine); gewaehre(ctx); },   // schon beim Start angelegte Krone (Puzzle): Ladung für den ersten Zug
    onCardEnterZone: (ctx) => {
      if (ctx.enteringCard?.id === ctx.card?.id) stempeln(ctx);   // auch ein Platzieren/Bewegen ohne Ausspielen (Bounce, Austausch)
    },
    onTurnStart: (ctx) => {
      if (!ctx.isMyTurn) return;
      gewaehre(ctx);
    },
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.leavingCard && ctx.leavingCard.id !== ctx.card.id) return;
      if (!ctx.leavingCard && (ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot)) return;
      // Die Ladung geht mit der Krone.
      ctx.expireAdditionalAction();
    },
  },

  _test: { istCuteKreatur, ADDITIONAL_TYPE },
};
