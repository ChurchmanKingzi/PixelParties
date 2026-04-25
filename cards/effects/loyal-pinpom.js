// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Pinpom"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  When you summon this Creature, you may
//  immediately summon another "Loyal" Creature
//  from your hand as an additional Action. You
//  can only activate this effect of "Loyal
//  Pinpom" once per turn.
//
//  Wiring: synchronous chain inside onPlay —
//  while Pinpom is mid-summon we prompt the
//  controller to pick a Loyal from hand and
//  drop it via summonCreatureWithHooks (full
//  lifecycle: beforeSummon, onPlay,
//  onCardEnterZone). The chain summon doesn't
//  consume the player's main / additional-action
//  slot because we never go through the
//  validateActionPlay path.
//
//  HOPT is name-keyed: ALL Loyal Pinpom copies
//  share the once-per-turn cap. So even if you
//  summon two Pinpoms in one turn, only the
//  first one's chain triggers — matching "this
//  effect of Loyal Pinpom once per turn".
// ═══════════════════════════════════════════

const { isLoyalCreature, getLoyalsInHand } = require('./_loyal-shared');

const CARD_NAME = 'Loyal Pinpom';
const HOPT_KEY  = 'loyal_pinpom_chain';

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      // Fire only when this specific Pinpom enters the support zone —
      // not on activeIn:'hand' phantom calls or hand-tracking churn.
      if (ctx.cardZone !== 'support') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOriginalOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // HOPT — name-keyed, shared across all Pinpom copies the player owns.
      if (!engine.claimHOPT?.(HOPT_KEY, pi)) return;

      // ── Eligibility pre-check ──
      // Need at least one Loyal in hand AND at least one free Support
      // Zone on a hero capable of summoning a Lv1 Loyal. If nothing
      // qualifies, no prompt fires (matches the user's "popup only
      // when there's something to do" UX from the immediate-additional
      // pattern).
      const handLoyals = getLoyalsInHand(ps, engine);
      if (handLoyals.length === 0) return;

      // Find any hero on this side that can host a Lv1 Loyal Summoning-
      // Magic creature. We require Summoning Magic ≥ 1 (Loyals are all
      // Lv1, single school) AND a free Support Zone.
      const cardDB = engine._getCardDB();
      const eligibleHeroes = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        // Free zone check.
        const zones = ps.supportZones?.[hi] || [];
        let freeSlot = -1;
        for (let z = 0; z < 3; z++) {
          if ((zones[z] || []).length === 0) { freeSlot = z; break; }
        }
        if (freeSlot < 0) continue;
        // Use any-Loyal level-req shortcut: every Loyal is Lv1 with
        // single-school SM, so the same check works for the whole list.
        // heroMeetsLevelReq covers Wisdom / Divinity coverage too.
        const sample = cardDB[handLoyals[0].name];
        if (!sample) continue;
        if (!engine.heroMeetsLevelReq(pi, hi, sample)) continue;
        eligibleHeroes.push({ heroIdx: hi, slot: freeSlot, name: hero.name });
      }
      if (eligibleHeroes.length === 0) return;

      // ── Step 1: confirm the chain ──
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Summon another Loyal Creature from your hand as an additional Action?`,
        showCard: CARD_NAME,
        confirmLabel: '🐶 Summon!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // ── Step 2: pick which Loyal ──
      let pickedLoyal;
      if (handLoyals.length === 1) {
        pickedLoyal = handLoyals[0].name;
      } else {
        const gallery = handLoyals.map(l => ({
          name: l.name, source: 'hand', count: l.count,
        }));
        const res = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: gallery,
          title: CARD_NAME,
          description: 'Choose a Loyal Creature from your hand to summon.',
          cancellable: true,
        });
        if (!res || res.cancelled || !res.cardName) return;
        pickedLoyal = res.cardName;
      }
      if (!isLoyalCreature(pickedLoyal, engine)) return;

      // ── Step 3: pick destination (hero + slot) ──
      // Re-evaluate eligible heroes against THIS specific card so
      // any per-card canPlayWithHero / canSummon constraints apply.
      // Surface EVERY free Support Zone on each eligible hero — not
      // just the leftmost — so the player can drop the chained Loyal
      // wherever they want. The previous "first free slot only" cap
      // matched the deck-tutor placement contract, but Pinpom's
      // chain is a normal summon and the player should keep the same
      // slot freedom they have for any other hand-played Creature.
      const cd = cardDB[pickedLoyal];
      const dests = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (!engine.heroMeetsLevelReq(pi, hi, cd)) continue;
        const zones = ps.supportZones?.[hi] || [];
        for (let z = 0; z < 3; z++) {
          if ((zones[z] || []).length === 0) {
            dests.push({
              id: `equip-${pi}-${hi}-${z}`,
              type: 'equip', owner: pi, heroIdx: hi, slotIdx: z,
              cardName: '',
            });
          }
        }
      }
      if (dests.length === 0) return;

      let destHero, destSlot;
      if (dests.length === 1) {
        destHero = dests[0].heroIdx;
        destSlot = dests[0].slotIdx;
      } else {
        const ids = await engine.promptEffectTarget(pi, dests, {
          title: `${CARD_NAME} — Summon ${pickedLoyal}`,
          description: `Choose a Support Zone to summon ${pickedLoyal} into.`,
          confirmLabel: '🐶 Summon!',
          confirmClass: 'btn-success',
          cancellable: true,
          maxTotal: 1,
        });
        if (!ids || ids.length === 0) return;
        const dest = dests.find(d => d.id === ids[0]);
        if (!dest) return;
        destHero = dest.heroIdx;
        destSlot = dest.slotIdx;
      }

      // ── Step 4: pull from hand + summon ──
      const handIdx = ps.hand.indexOf(pickedLoyal);
      if (handIdx < 0) return;
      ps.hand.splice(handIdx, 1);

      // `_isNormalSummon: true` mirrors the doPlayCreature hand-summon
      // flag. The chained Loyal lands at a hero the player picked
      // and was level-gated against (`heroMeetsLevelReq` above), so
      // it counts as a hero-driven summon for downstream listeners
      // (Orthos's chain trigger fires correctly when the chained
      // Loyal lands on Orthos).
      const placed = await engine.summonCreatureWithHooks(
        pickedLoyal, pi, destHero, destSlot,
        { source: CARD_NAME, hookExtras: { _isNormalSummon: true } },
      );
      if (!placed) {
        // Refund the hand card if placement aborted (extremely unlikely
        // — the dest slot we picked is guaranteed free above).
        ps.hand.push(pickedLoyal);
        return;
      }

      engine.log('loyal_pinpom_chain', {
        player: ps.username,
        summoned: pickedLoyal,
        hero: ps.heroes[destHero]?.name,
      });
      engine.sync();
    },
  },
};
