// ═══════════════════════════════════════════
//  CARD EFFECT: "Chatty Town Guard"
//  Creature (Normal, Lv0 Summoning Magic) — Crystals
//  HP 40
//
//  HOPT — once per turn, choose any card from
//  your hand and add it to your opponent's hand.
//
//  Routes the transfer through `actionTransferCardToOppHand`
//  so Mary Crestmas's "may draw" trigger, Letter of
//  Misinformations's auto-trigger, and any future
//  hand-transfer listener fire naturally.
// ═══════════════════════════════════════════

const CARD_NAME = 'Chatty Town Guard';

module.exports = {
  activeIn: ['support'],

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;
    const ps = engine.gs.players[pi];
    const ops = engine.gs.players[oi];
    if (!ps || !ops) return false;
    if (ps.handLocked) return false;
    // Opp must be able to receive (`actionTransferCardToOppHand`
    // refuses while opp.handLocked).
    if (ops.handLocked) return false;
    return (ps.hand?.length || 0) >= 1;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const oi = pi === 0 ? 1 : 0;
    const ops = engine.gs.players[oi];
    if (!ops) return false;
    if (ps.handLocked || ops.handLocked) return false;

    // Any card in hand qualifies — no originally-owned filter here
    // (Crystal Well's text uses "originally owned by them"; Chatty's
    // text just says "a card", so any hand slot is fair game).
    const eligibleIndices = [];
    for (let i = 0; i < (ps.hand || []).length; i++) eligibleIndices.push(i);
    if (eligibleIndices.length === 0) return false;

    const result = await engine.promptGeneric(pi, {
      type: 'pickHandCard',
      title: CARD_NAME,
      description: `Choose a card from your hand to give to ${ops.username}.`,
      eligibleIndices,
      cancellable: true,
    });
    if (!result || result.cancelled || result.handIndex == null) return false;

    const ok = await engine.actionTransferCardToOppHand(pi, result.handIndex, {
      source: CARD_NAME,
    });
    if (!ok) return false;

    engine.log('chatty_town_guard_gift', {
      player: ps.username, gifted: result.cardName,
    });
    engine.sync();
    return true;
  },
};
