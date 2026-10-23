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
const { canHeroSummon } = require('./_summon-eligibility');

const CARD_NAME = 'Loyal Pinpom';
const HOPT_KEY  = 'loyal_pinpom_chain';

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      // Fire only when this specific Pinpom enters the support zone —
      // not on activeIn:'hand' phantom calls or hand-tracking churn.
      if (ctx.cardZone !== 'support') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      // Kontrolle statt Seite (Styx 28.9.): „when YOU summon" — der
      // Beschwoerer (ueber einen geliehenen Helden: nicht die Brettseite).
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // HOPT — name-keyed, shared across all Pinpom copies the player owns.
      // Claimed up-front so a recursive trigger fired by the chained
      // summon can't re-fire; refunded on every cancel path below
      // (matches Loyal Shepherd / Orthos pattern).
      if (!engine.claimHOPT?.(HOPT_KEY, pi)) return engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });   // W11/R4: schon benutzt → wirkt nicht → Blob stumm
      const refundHopt = () => { if (gs.hoptUsed) delete gs.hoptUsed[`${HOPT_KEY}:${pi}`]; };

      // ── Eligibility pre-check ──
      // Need at least one Loyal in hand AND at least one free Support
      // Zone on a hero capable of summoning a Lv1 Loyal. If nothing
      // qualifies, no prompt fires (matches the user's "popup only
      // when there's something to do" UX from the immediate-additional
      // pattern).
      const handLoyals = getLoyalsInHand(ps, engine);
      if (handLoyals.length === 0) { refundHopt(); return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true }); }   // W11/R4: wirkt nicht → Blob stumm

      // Find any hero on this side that can host a Lv1 Loyal Summoning-
      // Magic creature. We require Summoning Magic ≥ 1 (Loyals are all
      // Lv1, single school) AND a free Support Zone.
      const cardDB = engine._getCardDB();
      const eligibleHeroes = [];
      // Kontrolle statt Seite (Styx 28.9.): alle Helden, die `pi`
      // kontrolliert (auch uebernommene der Gegenspalte), geprueft ueber
      // ihre physische Adresse — wie beim normalen Ausspielen aus der Hand.
      for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
        if (!hero?.name || hero.hp <= 0) continue;
        // Free zone check.
        // W63a (Al, 22.10.2026: Alices Effekt gilt fuer ALLE Beschwoerungs-Effekte): freie Zone ODER — mit Alice-Teilung des Beschwoerers — die Zone einer
        // GLEICHNAMIGEN Loyal-Creature (`engine.beschwoerZonenFuer`, je Handkarte); geteilte zuerst.
        let freeSlot = -1;
        for (const l of handLoyals) {
          const z0 = engine.ersteBeschwoerZone(pi, l.name, { seite: physOwner, heroIdx: hi, nurBasis: true, namedHeroesOnly: true });
          if (z0) { freeSlot = z0.slotIdx; break; }
        }
        if (freeSlot < 0) continue;
        // Use any-Loyal level-req shortcut: every Loyal is Lv1 with
        // single-school SM, so the same check works for the whole list.
        // heroMeetsLevelReq covers Wisdom / Divinity coverage too.
        const sample = cardDB[handLoyals[0].name];
        if (!sample) continue;
        // Z6 (A06-26): tauglicher Beschwoerer Pflicht (Ruling 8.8., `_summon-eligibility`): nicht Frozen/Stunned/Webbed/Bound/Negated,
        // keine Aktions-/Beschwoerungssperre - plus die Level-Pruefung.
        if (!canHeroSummon(engine, pi, hi, sample, { alsAktion: true, physOwner })) continue;
        eligibleHeroes.push({ owner: physOwner, heroIdx: hi, slot: freeSlot, name: hero.name });
      }
      if (eligibleHeroes.length === 0) { refundHopt(); return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true }); }   // W11/R4: wirkt nicht → Blob stumm

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
      if (!confirmed) { refundHopt(); return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true }); }   // W11/R4: wirkt nicht → Blob stumm

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
        if (!res || res.cancelled || !res.cardName) { refundHopt(); return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true }); }   // W11/R4: wirkt nicht → Blob stumm
        pickedLoyal = res.cardName;
      }
      if (!isLoyalCreature(pickedLoyal, engine)) { refundHopt(); return; }

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
      // Kontrolle statt Seite (Styx 28.9.): `owner` = physische Seite.
      for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
        if (!hero?.name || hero.hp <= 0) continue;
        if (!canHeroSummon(engine, pi, hi, cd, { alsAktion: true, physOwner })) continue;   // Z6 (A06-26)
        for (const zz of engine.beschwoerZonenFuer(pi, pickedLoyal, { seite: physOwner, heroIdx: hi, nurBasis: true, namedHeroesOnly: true })) {   // W63a: frei oder geteilt (Alice)
          dests.push({
            id: `equip-${physOwner}-${hi}-${zz.slotIdx}`,
            type: 'equip', owner: physOwner, heroIdx: hi, slotIdx: zz.slotIdx,
            cardName: '',
            ...(zz.shared ? { shared: true } : {}),
          });
        }
      }
      dests.splice(0, dests.length, ...require('./_alice-shared').geteiltZuerst(dests));   // W63a (Al): erst die geteilte Zone, DANN die erste leere
      if (dests.length === 0) { refundHopt(); return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true }); }   // W11/R4: wirkt nicht → Blob stumm

      let destHero, destSlot, destOwner = dests[0].owner;
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
        if (!ids || ids.length === 0) { refundHopt(); return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true }); }   // W11/R4: wirkt nicht → Blob stumm
        const dest = dests.find(d => d.id === ids[0]);
        if (!dest) { refundHopt(); return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true }); }   // W11/R4: wirkt nicht → Blob stumm
        destOwner = dest.owner;
        destHero = dest.heroIdx;
        destSlot = dest.slotIdx;
      }

      // ── Step 4: pull from hand + summon ──
      const handIdx = ps.hand.indexOf(pickedLoyal);
      if (handIdx < 0) return;
      engine.takeFromPileSync(ps, 'hand', handIdx);

      // `_isNormalSummon: true` mirrors the doPlayCreature hand-summon
      // flag. The chained Loyal lands at a hero the player picked
      // and was level-gated against (`heroMeetsLevelReq` above), so
      // it counts as a hero-driven summon for downstream listeners
      // (Orthos's chain trigger fires correctly when the chained
      // Loyal lands on Orthos).
      const placed = await engine.summonCreatureWithHooks(
        pickedLoyal, destOwner, destHero, destSlot,
        { source: CARD_NAME, hookExtras: { _isNormalSummon: true },
          controller: pi },   // Kontrolle statt Seite (Styx 28.9.): Feldseite + Kontrolleur
      );
      if (!placed) {
        // Refund the hand card if placement aborted (extremely unlikely
        // — the dest slot we picked is guaranteed free above).
        engine.handZugangSync(ps, pickedLoyal, { von: 'rueckgabe', source: CARD_NAME, ohneInstanz: true });
        return;
      }

      engine.log('loyal_pinpom_chain', {
        player: ps.username,
        summoned: pickedLoyal,
        hero: gs.players[destOwner]?.heroes?.[destHero]?.name,
      });
      engine.sync();
    },
  },
};
