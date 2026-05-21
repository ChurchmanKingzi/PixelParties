// ═══════════════════════════════════════════
//  CARD EFFECT: "Laser Volley"
//  Spell (Normal, Lv2, Destruction Magic)
//
//  Deal 200 damage to all targets your opponent
//  controls. Your opponent may discard any number
//  of cards from their hand, and if they do, they
//  choose that many of their targets. The chosen
//  targets take no damage from this Spell. Once
//  per turn (by name).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Laser Volley';
const VOLLEY_DAMAGE = 200;

module.exports = {
  // Once-per-turn-by-name gate. The play is rejected upstream by
  // doPlaySpell when this returns false; the same `gs.hoptUsed` map
  // every other HOPT keys into.
  spellPlayCondition(gs, pi) {
    return gs.hoptUsed?.[`spell-played:${CARD_NAME}:${pi}`] !== gs.turn;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps || !ops) return;

      // Stream the card image to the opponent NOW — without this,
      // doPlaySpell's `_firePendingCardReveal` only runs AFTER the
      // opp's spare-discard prompts finish, leaving the opponent
      // staring at a mystery cast for the entire counter-window.
      if (gs._pendingCardReveal) engine._firePendingCardReveal();

      // Stamp the per-turn-by-name HOPT NOW so a chain re-cast (Bartas
      // second cast, etc.) can't slip a second Laser Volley through
      // before the spellPlayCondition refresh.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[`spell-played:${CARD_NAME}:${pi}`] = gs.turn;

      // Build the full target list — every alive Hero opp controls
      // and every face-up Creature in their support zones.
      const cardDB = engine._getCardDB();
      const targets = [];
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const h = ops.heroes[hi];
        if (h?.name && h.hp > 0) {
          targets.push({
            kind: 'hero', heroIdx: hi, slotIdx: -1,
            id: `hero-${oi}-${hi}`, cardName: h.name,
          });
        }
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== oi) continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({
          kind: 'creature', heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          id: `equip-${oi}-${inst.heroIdx}-${inst.zoneSlot}`,
          cardName: inst.name, instId: inst.id,
        });
      }
      if (targets.length === 0) {
        engine.log('laser_volley_no_targets', { player: ps.username });
        return;
      }

      // Opp counter-window: each spare costs 1 hand card. Iterate
      // discard → spare-pick until opp opts out (cancel) or runs out
      // of either hand cards or targets to spare. Cap at
      // `min(opp.hand.length, targets.length)` so neither side runs
      // dry mid-loop.
      const sparedIds = new Set();
      let discardsPaid = 0;
      const maxIter = Math.min(ops.hand?.length || 0, targets.length);

      for (let iter = 0; iter < maxIter; iter++) {
        const remaining = targets.filter(t => !sparedIds.has(t.id));
        if (remaining.length === 0) break;
        if ((ops.hand?.length || 0) === 0) break;

        const dRes = await engine.promptGeneric(oi, {
          type: 'forceDiscardCancellable',
          title: CARD_NAME,
          description: `Discard a card to spare 1 of your targets from ${VOLLEY_DAMAGE} damage. (${discardsPaid} discarded so far) — Cancel to stop.`,
          instruction: 'Click a card in your hand to discard it.',
          eligibleIndices: (ops.hand || []).map((_, i) => i),
          cancellable: true,
          cancelLabel: 'Done',
        });
        if (!dRes || dRes.cancelled || dRes.cardName == null) break;

        const ok = await engine.actionDiscardHandCard(oi, dRes.cardName, dRes.handIndex, {
          source: CARD_NAME,
        });
        if (!ok) break;
        discardsPaid++;

        // Spare-target picker — non-cancellable; the discard already
        // committed.
        const sparePick = await engine.promptGeneric(oi, {
          type: 'cardGallery',
          cards: remaining.map(t => ({
            name: t.cardName, source: t.kind === 'hero' ? 'hero' : 'support',
            heroIdx: t.heroIdx,
          })),
          title: CARD_NAME,
          description: `Choose a target to spare from ${VOLLEY_DAMAGE} damage.`,
          confirmLabel: '🛡️ Spare',
          confirmClass: 'btn-success',
          cancellable: false,
        });
        if (!sparePick?.cardName) break;
        // Match by name AND slot to avoid picking a duplicate-named
        // creature that was already spared.
        const matchedSpare = remaining.find(t =>
          t.cardName === sparePick.cardName,
        );
        if (matchedSpare) sparedIds.add(matchedSpare.id);
      }

      engine.log('laser_volley_resolve', {
        player: ps.username, opponent: ops.username,
        discardedToSpare: discardsPaid, totalTargets: targets.length,
      });

      // Pre-check the AoE surprise window across every UNSPARED hero
      // target. A Spike Trap (or any other surprise that returns
      // `effectNegated`) on ANY of the heroes Laser Volley is about to
      // hit must fizzle the entire spell — not just the damage on the
      // single trapped Hero. Without this pre-check, the per-target
      // `actionDealDamage` below would only catch the negation locally
      // (skipping that one damage), letting the rest of the volley
      // continue and hit the other targets.
      //
      // Spared targets are excluded — opp already paid a discard cost
      // to dodge, so they shouldn't get a free surprise window on top
      // of the dodge.
      const unsparedHeroTargets = targets
        .filter(t => t.kind === 'hero' && !sparedIds.has(t.id))
        .map(t => ({
          type: 'hero', owner: oi, heroIdx: t.heroIdx, cardName: t.cardName,
        }));
      if (unsparedHeroTargets.length > 0) {
        if (ctx.card) ctx.card._isAoeCheck = true;
        const surpriseResult = await engine._checkSurpriseWindow(
          unsparedHeroTargets, ctx.card, { damageType: 'destruction_spell' }
        );
        if (ctx.card) delete ctx.card._isAoeCheck;
        if (surpriseResult?.effectNegated) {
          gs._spellNegatedByEffect = true;
          engine.log('laser_volley_negated', {
            player: ps.username, opponent: ops.username,
          });
          engine.sync();
          return;
        }
        // Mark these heroes as already-surprise-checked so the per-
        // target `actionDealDamage` below doesn't re-open the window.
        if (!gs._surpriseCheckedHeroes) gs._surpriseCheckedHeroes = new Set();
        for (const t of unsparedHeroTargets) {
          gs._surpriseCheckedHeroes.add(`${t.owner}-${t.heroIdx}`);
        }
      }

      // Volley animation — fire one big red beam per target from the
      // casting Hero. Spared targets get a `miss: true` beam that
      // displaces the endpoint to the side of the card (the dodge
      // landing spot). Beams are staggered ~80ms so the volley reads
      // as a sequence, not a simultaneous flash. We await the full
      // last-beam window (~1100ms) before applying damage so the
      // impact explosions land while the lines are still fading.
      const BEAM_DUR = 1100;
      const STAGGER  = 80;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        engine._broadcastEvent('play_beam_animation', {
          sourceOwner: pi,
          sourceHeroIdx: ctx.cardHeroIdx,
          targetOwner: oi,
          targetHeroIdx: t.heroIdx,
          targetZoneSlot: t.kind === 'creature' ? t.slotIdx : -1,
          color: '#ff2222',
          duration: BEAM_DUR,
          thickness: 1,
          impactOpacity: 0.4,
          miss: sparedIds.has(t.id),
        });
        if (i < targets.length - 1) await engine._delay(STAGGER);
      }
      // Wait out the trailing beam so damage numbers pop in sync with
      // the impact explosions, not before them.
      await engine._delay(Math.max(BEAM_DUR - STAGGER * (targets.length - 1) - 200, 250));

      // Pre-damage post-target hand-reaction window — one consolidated
      // prompt per source for Sculpture Guards / Spectral Armor / etc.
      // covering every unspared target.
      {
        const source = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx };
        const allUnspared = targets
          .filter(t => !sparedIds.has(t.id))
          .map(t => t.kind === 'hero'
            ? { type: 'hero', owner: oi, heroIdx: t.heroIdx, cardName: t.cardName }
            : { type: 'creature', owner: oi, heroIdx: t.heroIdx, slotIdx: t.slotIdx, cardName: t.cardName });
        const _negR = await engine.preDamageMultiTargetWindow(source, allUnspared);
        // Full-negate reaction (Storm Ring / Invisibility Cloak): bail
        // before any damage so the whole Spell is negated.
        if (_negR?.effectNegated) return;
      }

      // Deal 200 to every unspared target. Skip-reaction-check so a
      // single Spell doesn't open multiple nested counter windows
      // — Spike Trap / Anti-Magic etc. already ran in the chain.
      for (const t of targets) {
        if (sparedIds.has(t.id)) continue;
        const source = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx };
        if (t.kind === 'hero') {
          const hero = ops.heroes?.[t.heroIdx];
          if (hero?.name && hero.hp > 0) {
            await engine.actionDealDamage(source, hero, VOLLEY_DAMAGE, 'destruction_spell', {
              _skipReactionCheck: true,
            });
          }
        } else if (t.kind === 'creature') {
          const inst = engine.cardInstances.find(c => c.id === t.instId);
          if (inst) {
            await engine.actionDealCreatureDamage(
              source, inst, VOLLEY_DAMAGE, 'destruction_spell',
              { sourceOwner: pi, _skipReactionCheck: true },
            );
          }
        }
      }

      engine.sync();
    },
  },
};
