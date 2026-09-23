'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Albrecht, the Nerd"  (v1307, neuer Text)
//  Creature — Summoning Magic Lv1
//
//  "When the card you draw during your Resource Phase is a Double Spell,
//   you may reveal it to immediately summon this Creature from your hand
//   as an additional Action. Once per turn, when you draw or add a Double
//   Spell to your hand, you may reveal it to draw cards equal to its
//   level. You can only control 1 "Albrecht, the Nerd"."
//
//  ① Aus der HAND: nur der Ressourcen-Zug (`_isResourceDraw`) im eigenen
//     Zug. Mehrere Albrechts auf der Hand → EIN Angebot je gezogener Karte.
//  ② Auf dem BRETT: jeder Zug / jede Hand-Aufnahme eines Double Spells
//     (Deck, Ablage, Suche). „its level" = aufgedrucktes Level (Ruling 3);
//     Level 0 → kein Angebot. Einmal pro Zug (je Instanz).
//  ③ „only control 1": `beforeSummon`.
// ═══════════════════════════════════════════
const { istDoppelSpell, kontrolliert, sofortAusHandBeschwoeren } = require('./_double-shared');

const CARD_NAME = 'Albrecht, the Nerd';

async function ausDerHand(ctx, gezogen) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  if (!ctx._isResourceDraw || gs.activePlayer !== pi) return;
  const schluessel = `${gs.turn}:${ctx._drawBatch ?? 'x'}:${ctx._drawIndex ?? 0}:${gezogen}`;
  if (gs._albrechtHandAngebot === schluessel) return;          // nur EINE Kopie fragt
  gs._albrechtHandAngebot = schluessel;
  const ps = gs.players[pi];
  if (!(ps.hand || []).includes(CARD_NAME) || !(ps.hand || []).includes(gezogen)) return;
  if (kontrolliert(engine, pi, CARD_NAME)) return;
  if (require('./_summon-eligibility').eligibleSummonZones(engine, pi, CARD_NAME).length === 0) return;
  const ja = await engine.promptGeneric(pi, {
    type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
    message: `You drew "${gezogen}" (a Double Spell). Reveal it to summon ${CARD_NAME} from your hand as an additional Action?`,
    confirmLabel: '🤓 Reveal & Summon!', cancelLabel: 'No', cancellable: true,
  });
  if (!engine._confirmSaidYes(ja)) return;
  engine.revealToOpponent(pi, gezogen, { source: CARD_NAME });
  const ok = await sofortAusHandBeschwoeren(engine, pi, CARD_NAME, { source: CARD_NAME });
  if (ok) engine.log('double_class', { player: ps.username, card: CARD_NAME, text: `summoned by revealing ${gezogen}` });
  engine.sync();
}

async function aufDemBrett(ctx, name) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const inst = ctx.card;
  const cd = engine._getCardDB()[name];
  const stufe = cd?.level || 0;
  if (stufe <= 0) return;
  const sperre = `albrecht-draw:${inst.id}`;
  if (gs.hoptUsed?.[sperre] === gs.turn) return;
  const ps = gs.players[pi];
  if (!(ps.hand || []).includes(name) || (ps.mainDeck || []).length === 0) return;
  const ja = await engine.promptGeneric(pi, {
    type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
    message: `Reveal "${name}" to draw ${stufe} card${stufe === 1 ? '' : 's'}?`,
    confirmLabel: `🤓 Draw ${stufe}!`, cancelLabel: 'No', cancellable: true,
  });
  if (!engine._confirmSaidYes(ja)) return;
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[sperre] = gs.turn;
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
  engine.revealToOpponent(pi, name, { source: CARD_NAME });
  engine.log('double_class', { player: ps.username, card: CARD_NAME, text: `revealed ${name} and draws ${stufe}` });
  await engine.actionDrawCards(pi, stufe, { source: CARD_NAME });
  engine.sync();
}

module.exports = {
  activeIn: ['hand', 'support'],

  async beforeSummon(ctx) { return !kontrolliert(ctx._engine, ctx.cardOwner, CARD_NAME); },

  hooks: {
    onDraw: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      const name = ctx.drawnCardName;
      if (!istDoppelSpell(ctx._engine._getCardDB()[name])) return;
      if (ctx.card.zone === 'hand') return ausDerHand(ctx, name);
      if (ctx.card.zone === 'support') return aufDemBrett(ctx, name);
    },
    onCardAddedToHand: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner || ctx.card.zone !== 'support') return;
      if (!istDoppelSpell(ctx._engine._getCardDB()[ctx.addedCardName])) return;
      return aufDemBrett(ctx, ctx.addedCardName);
    },
    onCardAddedFromDiscardToHand: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner || ctx.card.zone !== 'support') return;
      if (!istDoppelSpell(ctx._engine._getCardDB()[ctx.addedCardName])) return;
      return aufDemBrett(ctx, ctx.addedCardName);
    },
  },

  cpuResponse(engine, kind, p) {
    if (kind === 'generic' && p?.title === CARD_NAME && p?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
};
