// ═══════════════════════════════════════════
//  CARD EFFECT: "Lolek, the Shard Knight"
//  Hero — 500 HP / 80 ATK — Fighting / Leadership — BANNED
//
//  "You may once per turn send an equippable Artifact from your deck
//   or hand to your discard pile to draw 1 card OR choose an
//   equippable Artifact from your discard pile and equip it to a
//   Hero you control by paying half its Cost."
//
//  Heldeneffekt (kein Aktionsverbrauch), zwei Optionen ueber einen
//  optionPicker — es werden nur die angeboten, die gerade moeglich
//  sind (bei genau einer entfaellt die Frage):
//    · „Discard & Draw": Galerie ueber Deck UND Hand (je Name+Quelle
//      ein Eintrag); Hand → `actionDiscardHandCard`, Deck →
//      `actionMillCards(targetCardName)`; dann 1 Karte ziehen.
//    · „Equip from discard": halber Preis (aufgerundet, wie „Spirit of
//      the Shattered Trident" es ausschreibt), nur bezahlbare und
//      anlegbare Eintraege; Ablauf in `_lolek-shared.chooseAndEquip`.
//
//  Aufstieg zu „Lolek, Mender of the Shattered Trident": Trident +
//  Diver Helmet ausgeruestet — Bereitschaft wird hier ueber die
//  eigenen Support-Zone-Hooks gepflegt (Fiona-Muster), die Bedingung
//  steht in `_lolek-shared.js`.
// ═══════════════════════════════════════════

const {
  BASE_LOLEK, TRIDENT_NAME, HELMET_NAME, halfCost, equippableEntries,
  hasDestination, chooseAndEquip, checkLolekAscension, hasEquipped,
} = require('./_lolek-shared');

const CARD_NAME = BASE_LOLEK;
const ASCENSION_ITEMS = [TRIDENT_NAME, HELMET_NAME];

function discardEntries(engine, pi) {
  return equippableEntries(engine, pi, ['deck', 'hand']);
}

function equipEntries(engine, pi) {
  return equippableEntries(engine, pi, ['discard'], (name, cd) =>
    engine.canAffordGold(pi, halfCost(cd), name) && hasDestination(engine, pi, name));
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  ascensionItems: ASCENSION_ITEMS,
  cheatAscensionBlocked: true,

  ascensionNeedsCard(cardName, _cardData, engine, pi, hi) {
    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero || hero.name !== CARD_NAME || hero.ascensionReady) return false;
    if (!ASCENSION_ITEMS.includes(cardName)) return false;
    return !hasEquipped(engine, pi, hi, cardName);
  },
  ascensionProgress(engine, pi, hi) {
    let n = 0;
    for (const name of ASCENSION_ITEMS) if (hasEquipped(engine, pi, hi, name)) n++;
    return n / ASCENSION_ITEMS.length;
  },

  supportYield() {
    return { drawsPerTurn: 0.6 };
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    if (!ps.handLocked && discardEntries(engine, pi).length > 0) return true;
    return equipEntries(engine, pi).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const canDiscard = !ps.handLocked && discardEntries(engine, pi).length > 0;
    const canEquip = equipEntries(engine, pi).length > 0;
    if (!canDiscard && !canEquip) return false;

    let mode = canDiscard && canEquip ? null : (canDiscard ? 'discard' : 'equip');
    if (!mode) {
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        source: CARD_NAME,
        description: 'Choose one:',
        options: [
          { id: 'discard', label: '🗑 Discard & Draw', description: 'Send an equippable Artifact from your deck or hand to the discard pile, then draw 1 card.' },
          { id: 'equip', label: '🔱 Equip from Discard', description: 'Equip an equippable Artifact from your discard pile to a Hero you control by paying half its Cost.' },
        ],
        cancellable: true,
      });
      mode = choice?.optionId;
      if (!mode) return false;
    }

    if (mode === 'discard') {
      const entries = discardEntries(engine, pi);
      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: entries.map(e => ({ name: e.name, source: e.source })),
        title: CARD_NAME,
        source: `${CARD_NAME}:discard`,
        description: 'Send an equippable Artifact from your deck or hand to the discard pile to draw 1 card.',
        confirmLabel: '🗑 Discard it!',
        cancellable: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) return false;
      const entry = entries.find(e => e.name === picked.cardName && e.source === picked.source)
        || entries.find(e => e.name === picked.cardName);
      if (!entry) return false;

      await engine.effectSourceGlow(pi, CARD_NAME);
      if (entry.source === 'hand') {
        const handIdx = ps.hand.indexOf(entry.name);
        if (handIdx < 0) return false;
        await engine.actionDiscardHandCard(pi, entry.name, handIdx, { source: CARD_NAME, selfInflicted: true, _noGlow: true });
      } else {
        if (!ps.mainDeck.includes(entry.name)) return false;
        await engine.actionMillCards(pi, 1, { targetCardName: entry.name, source: CARD_NAME, selfInflicted: true });
      }
      engine.log('lolek_discard', { player: ps.username, card: entry.name, from: entry.source });
      await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
      engine.sync();
      return true;
    }

    const ok = await chooseAndEquip(engine, pi, equipEntries(engine, pi), {
      title: CARD_NAME,
      source: `${CARD_NAME}:equip`,
      description: 'Equip an equippable Artifact from your discard pile to a Hero you control. You pay half its Cost.',
      costOf: (_name, cd) => halfCost(cd),
    });
    if (ok) engine.sync();
    return ok;
  },

  hooks: {
    onGameStart: (ctx) => {
      checkLolekAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, null);
    },
    onTurnStart: (ctx) => {
      checkLolekAscension(ctx._engine, ctx.cardOriginalOwner, ctx.cardHeroIdx, null);
    },
    onCardEnterZone: (ctx) => {
      if (ctx.toZone !== 'support' || ctx.toHeroIdx !== ctx.cardHeroIdx) return;
      checkLolekAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, null);
    },
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromHeroIdx !== undefined && ctx.fromHeroIdx !== ctx.cardHeroIdx) return;
      // `ctx.card` ist der Lauscher, die gehende Karte `ctx.leavingCard`.
      checkLolekAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, ctx.leavingCard?.id);
    },
  },
};
