// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Narw"
//  Creature (Summoning Magic Lv1, 80 HP — Slippery)
//
//  At the beginning of each of your turns, slide
//  this Creature into the free Support Zone of an
//  adjacent Hero (if possible).
//
//  When this Creature is moved into a different
//  Hero's Support Zone, YOU MAY choose any Creature
//  on the board and defeat it. If the defeated
//  Creature was one you control, you may additionally
//  choose any Creature from your deck or discard
//  pile, reveal it and add it to your hand.
//
//  Both prompts are cancellable — the player can
//  pass on the defeat entirely, or accept the
//  defeat but skip the tutor on an own-Creature
//  pick. "May" wording on both clauses.
// ═══════════════════════════════════════════

const { isPileCreature, hasCardType } = require('./_hooks');
const { onSlipperyTurnStart, slipperyOnMoveGate } = require('./_slippery-shared');

const CARD_NAME = 'Slippery Narw';

/** Distinct Creature card names from the player's deck + discard. */
function buildTutorGallery(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const out = [];
  const seen = new Set();
  const consume = (list, source) => {
    for (const name of (list || [])) {
      const key = name + ':' + source;
      if (seen.has(key)) continue;
      const cd = cardDB[name];
      if (!cd || !isPileCreature(cd)) continue;
      seen.add(key);
      out.push({ name, source });
    }
  };
  consume(ps.mainDeck, 'deck');
  consume(ps.discardPile, 'discard');
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  // ── CPU: Ziel-Intercept (Shield-of-Life-Klasse) ──────────────────
  // Cancellable Utility-Ziel ohne baseDamage fällt sonst auf den
  // Engine-Decline durch. Politik: irgendein Slide ist besser als kein Slide (erstes legales Ziel); Optimierung ist Trainings-Thema
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const vt = payload?.validTargets || [];
    if (vt.length === 0) return undefined;
    const pick = vt[0];
    return [typeof pick === 'object' ? pick.id : pick];
  },


  activeIn: ['support'],

  hooks: {
    onTurnStart: onSlipperyTurnStart,

    onCardEnterZone: async (ctx) => {
      if (!slipperyOnMoveGate(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const cardDB = engine._getCardDB();

      // ── Step 1: pick any board Creature to defeat (or cancel) ──
      // Self-target is excluded — Narw can't defeat itself with its own
      // move trigger. Other Creatures (own or opp) are fair game.
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['creature'],
        title: CARD_NAME,
        description: 'You may defeat any Creature on the board. If it was your own, you may then tutor a Creature from deck/discard to your hand.',
        confirmLabel: '🗡️ Defeat!',
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => {
          if (t.type !== 'equip' && t.type !== 'creature') return false;
          const inst = t.cardInstance;
          if (!inst) return false;
          if (inst.id === ctx.card.id) return false; // not self
          const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
          return !!(cd && hasCardType(cd, 'Creature'));
        },
      });
      if (!target) return; // Player declined — effect ends cleanly.

      const victim = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support'
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx,
      );
      if (!victim) return;

      const wasOwnCreature = (victim.controller ?? victim.owner) === pi;
      const ps = engine.gs.players[pi];

      // Defeat via standard destroy path — fires onCreatureDeath /
      // onDiscard / pile routing same as any other death.
      await engine.actionDestroyCard(
        { name: CARD_NAME, owner: pi, heroIdx: ctx.card.heroIdx },
        victim,
        { fireCreatureDeath: true },
      );
      engine.sync();
      await engine._delay(250);

      engine.log('slippery_narw_defeat', {
        player: ps?.username, target: victim.name, ownSide: wasOwnCreature,
      });

      // ── Step 2: tutor on own-Creature defeat (optional) ──
      if (!wasOwnCreature) return;

      const gallery = buildTutorGallery(engine, pi);
      if (gallery.length === 0) return;

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Choose a Creature from your deck or discard pile to reveal and add to your hand.',
        confirmLabel: '🌊 Tutor!',
        confirmClass: 'btn-info',
        cancellable: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) return;

      const chosenName = picked.cardName;
      // Find which pile the chosen card came from. Players sometimes
      // hold the same name in both — prefer deck (then shuffle), fall
      // back to discard. Matches the standard tutor convention.
      let removedFromDeck = false;
      const deckIdx = (ps.mainDeck || []).indexOf(chosenName);
      if (deckIdx >= 0) {
        ps.mainDeck.splice(deckIdx, 1);
        removedFromDeck = true;
      } else {
        const dIdx = (ps.discardPile || []).indexOf(chosenName);
        if (dIdx < 0) return;
        ps.discardPile.splice(dIdx, 1);
      }

      await engine.revealSearchedCards(pi, [chosenName], CARD_NAME);
      if (removedFromDeck) engine.shuffleDeck(pi);

      // Add to hand + auto-reveal if applicable (Crystals etc.).
      ps.hand.push(chosenName);
      const handIdx = ps.hand.length - 1;
      try { engine._autoRevealOnEnterHand?.(pi, handIdx, chosenName); } catch {}
      try { engine._trackCard?.(chosenName, pi, 'hand'); } catch {}

      engine.log('slippery_narw_tutor', {
        player: ps?.username, creature: chosenName, from: removedFromDeck ? 'deck' : 'discard',
      });
      engine.sync();
    },
  },
};
