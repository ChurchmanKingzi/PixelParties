'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Celia, the Class Clown"
//  Creature (Normal, Lv1, 50 HP, Summoning Magic)
//
//  „You may once per turn, during your opponent's turn, when your opponent activates a Spell, increase that Spell's level by 1. If that
//   Spell's level is then too high for its user to use, negate it and send it to the discard pile. If this was your opponent's Action, they
//   may immediately perform an additional Action. You can only control 1 "Celia, the Class Clown"."
//
//  ── Bauform ──────────────────────────────────────────────────────
//  Board-Creature-Reaktion im Kettenfenster (wie Spearman): `isCreatureReaction` + `creatureReactionCondition` / `payActivationCost` /
//  `creatureReactionResolve`. Der Level-+1-Teil ist EIN Baustein mit Shamanic Curse (`_level-bump-shared.js`, `stufeErhoehen`).
//
//  ── Auslegung ─────────────────────────────────────────────────────
//  • „during your opponent's turn": der Zugspieler ist ein Gegner von Celias Kontrolleur.
//  • „when your opponent activates a Spell": das oberste Kettenglied ist ein Spell eines Gegners (aus der Hand gespielt ODER als Reaktion), nicht
//    negiert, kein bloss als Spell ZAEHLENDER Effekt (Alice: keine Karte, die in die Ablage ginge — wie bei Shamanic Curse) und von einem HELDEN
//    gewirkt (eine Kreatur, die einen Zauber wirkt, hat keine „Stufe, die ihr Benutzer erreichen muss").
//  • „once per turn": je Exemplar (`inst.counters._celiaTurn`), gestempelt beim Aktivieren; wird Celias Reaktion selbst negiert, ist der Stempel
//    wieder frei (`refundOnNegation`). Zweite Celia gibt es nicht („You can only control 1": `beforeSummon`, Platzieren/Uebernehmen sperrt die Engine).
//  • „If this was your opponent's Action": hat der Zauber seinem Spieler eine Aktion gekostet (Initialglied, kein `inherentAction`; Reaktionen
//    und Zauber, die ein Effekt wirkt, zaehlen nicht) UND wurde er negiert, darf dieser SOFORT eine zusaetzliche Aktion mit einem beliebigen Helden
//    ausfuehren (`performImmediateActionAnyHero`, abbrechbar = „may"). Sofort heisst: gleich nach der Kette — sie wird nicht als Marke fuer spaeter
//    gutgeschrieben (wie bei Victory Phoenix Cannon: jetzt oder gar nicht).
//  • Hat der erhoehte Level noch gespielt werden koennen, passiert nichts weiter (der Zauber laeuft mit Stufe+1; Wisdom-Helden zahlen den Zusatz).
// ═══════════════════════════════════════════

const { stufeErhoehen, kostetteAktion } = require('./_level-bump-shared');
const { kontrolliert } = require('./_double-shared');
const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Celia, the Class Clown';

module.exports = {
  activeIn: ['support'],

  // „You can only control 1 …" — die Hand-Beschwoerung verweigert die zweite Kopie.
  async beforeSummon(ctx) { return !kontrolliert(ctx._engine, ctx.cardOwner, CARD_NAME); },

  // ── Engine-Vertrag: Board-Creature-Reaktion im Kettenfenster ──
  isCreatureReaction: true,

  creatureReactionCondition(gs, pi, engine, chainCtx, inst) {
    if (inst.counters?._celiaTurn === gs.turn) return false;
    // „during your opponent's turn"
    if (!engine.opponentsOf(pi).includes(gs.activePlayer)) return false;
    const chain = chainCtx?.chain || [];
    const last = chain[chain.length - 1];
    if (!last || last.negated || last.chainClosed) return false;
    if (last.cardType !== 'Spell') return false;
    if (!engine.opponentsOf(pi).includes(last.owner)) return false;
    if (last.zaehltAlsArt) return false;                 // Alice & Co.: kein echter Spell, keine Karte fuer die Ablage
    if (last.casterCheck === false) return false;        // von einer Kreatur gewirkt: kein Held als Benutzer
    const hi = last.isInitialCard ? last.heroIdx : (last.casterHeroIdx ?? last.heroIdx);
    if (hi == null || hi < 0) return false;
    return true;
  },

  /** Die Reaktion ist mit dem Aktivieren verbraucht — ausser sie wird selbst negiert (`refundOnNegation`). */
  async payActivationCost(engine, pi, chainCtx, inst) {
    if (!inst.counters) inst.counters = {};
    inst.counters._celiaTurn = engine.gs.turn;
    return true;
  },

  refundOnNegation(engine, link) {
    const inst = engine.cardInstances.find(c => c.id === link.creatureInstId);
    if (inst?.counters) delete inst.counters._celiaTurn;
  },

  async creatureReactionResolve(engine, pi, chain, myIndex, inst) {
    const gs = engine.gs;
    const targetIndex = myIndex - 1;
    const link = chain[targetIndex];
    // Zwischen Aktivieren und Aufloesen kann sich etwas geaendert haben (Celia weg/gebunden, Zauber schon negiert).
    if (!link || link.negated || link.cardType !== 'Spell' || inst.zone !== 'support' || engine.isCreatureEffectSuppressed(inst)) {
      engine.log('celia_fizzle', { player: gs.players[pi]?.username });
      return false;
    }
    const heroSeite = link.casterOwner ?? link.owner;
    const heroIdx = (link.isInitialCard ? link.heroIdx : (link.casterHeroIdx ?? link.heroIdx)) ?? 0;
    engine._broadcastEvent('play_zone_animation', {
      type: 'celia_candles', zoneType: 'board', owner: inst.owner, heroIdx: -1, zoneSlot: -1, duration: 1100,
      targets: [{ owner: heroSeite, heroIdx, zoneSlot: -1, cardName: link.cardName }],
      originOwner: inst.owner, originHeroIdx: inst.heroIdx, originZoneSlot: inst.zoneSlot,
    });
    await engine._delay(700);   // Kerzenflackern vor der Wirkung
    const { status } = await stufeErhoehen(engine, chain, targetIndex, { logPrefix: 'celia', animation: null });
    if (status !== 'negated') return true;

    // „If this was your opponent's Action, they may immediately perform an additional Action."
    if (kostetteAktion(engine, link, loadCardEffect, hasCardType)) {
      const user = link.owner;
      engine.queuePostChainAction(async () => {
        await engine.performImmediateActionAnyHero(user, {
          title: CARD_NAME,
          mitUebernommenenAktionen: true,
          description: 'Your Spell was negated. You may immediately perform an additional Action with any Hero — or skip.',
          cancellable: true,
        });
        engine.sync();
      });
    }
    engine.log('celia_negate', { player: gs.players[pi]?.username, spell: link.cardName, owner: link.owner });
    engine.sync();
    return true;
  },

  cpuMeta: {
    // Ein Level mehr kostet den Gegner etwas, ein negierter Zauber noch mehr — die CPU nimmt das Angebot immer an.
    reactionHeuristic: () => true,
  },

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },
};
