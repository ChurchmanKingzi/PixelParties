// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Zhu" (Pig)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/game): delete 8 cards from EACH
//    discard pile (16 total), including at least
//    3 different-named "Guardian Beast" Creatures
//    across the deletion. Skip your opponent's
//    next turn. Cannot be activated the turn Zhu
//    was summoned.
//
//  IMPLEMENTATION: per-player once-per-game flag
//  prevents re-activation. Skip-next-turn is a
//  flag on the OPPONENT'S player object that the
//  engine reads at switchTurn (see _engine.js
//  switchTurn extension below).
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  isGuardianBeastCreature,
  promptAndDeleteFromBothDiscards,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast Zhu';
const PER_PILE_COST = 8;
const REQUIRED_UNIQUE_GBS = 3;
const ONCE_PER_GAME_KEY = '_guardianBeastZhuUsed';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  // CPU once-per-game spend awareness. Once Zhu's effect has fired,
  // it can never fire again for the rest of the game — MCTS should
  // recognise this as a finite resource and only burn it on a
  // genuinely game-deciding swing. Without this, MCTS happily
  // activates Zhu the moment its ≥3-unique-GB rider happens to be
  // payable, even when the local upside is small. The eval term in
  // `evaluateState` reads this generically; the cost (200) is
  // calibrated so the activation only beats it when the projected
  // turn-skip + 16-card delete clearly swings the game.
  cpuMeta: {
    oncePerGameSpend: {
      spent(engine, pi) {
        return !!engine.gs?.[ONCE_PER_GAME_KEY]?.[pi];
      },
      cost: 200,
    },
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const gs = engine.gs;
    if (gs[ONCE_PER_GAME_KEY]?.[pi]) return false; // once per game per player
    const ownDp = gs.players[pi]?.discardPile || [];
    const oppDp = gs.players[pi === 0 ? 1 : 0]?.discardPile || [];
    if (ownDp.length < PER_PILE_COST || oppDp.length < PER_PILE_COST) return false;
    if (ctx.card?.turnPlayed === (gs.turn || 0)) return false; // not the summon turn
    // Need at least 3 different-named Guardian Beast Creatures among
    // the COMBINED discards (we don't enforce which side they come
    // from — the player must select that combination at delete-time).
    const allDiscards = [...ownDp, ...oppDp];
    const uniqueGBs = new Set(allDiscards.filter(isGuardianBeastCreature));
    return uniqueGBs.size >= REQUIRED_UNIQUE_GBS;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;

    // ── Step 1: pick the 8 from each pile ────────────────────────
    // We use TWO separate prompts (own pile, then opp pile) so the
    // exactCount per pile is enforced cleanly. Together they form
    // the 16-card deletion the card text demands.
    const own = engine.gs.players[pi];
    const opp = engine.gs.players[oi];
    if ((own?.discardPile?.length || 0) < PER_PILE_COST) return false;
    if ((opp?.discardPile?.length || 0) < PER_PILE_COST) return false;

    const buildPileGallery = (sourceIdx, sideLabel) =>
      (engine.gs.players[sourceIdx]?.discardPile || []).map((name, i) => ({
        name, source: 'discard',
        entryId: `dp-${sourceIdx}-${i}`,
        label: `${name} (${sideLabel})`,
      }));

    // Pre-compute per-pile Guardian Beast inventories so each picker
    // can enforce its share of the "≥3 different Guardian Beasts
    // total" requirement. The first picker has to commit to enough
    // GBs that AREN'T present in the second pile, so the second pile
    // can still satisfy its quota; the second picker then has to
    // top up the unique count to reach 3.
    const ownDiscardGBs = new Set((own.discardPile || []).filter(isGuardianBeastCreature));
    const oppDiscardGBs = new Set((opp.discardPile || []).filter(isGuardianBeastCreature));
    // First-pile (own discard): cards in `requiredOwnPick` are GBs
    // whose names DON'T appear in the opp pile — those are the ones
    // that can only be locked in here. Required count = how many
    // we'd be unable to cover from the opp pile alone.
    const ownExclusiveGBs = [...ownDiscardGBs].filter(n => !oppDiscardGBs.has(n));
    const minOwnUnique = Math.max(0, REQUIRED_UNIQUE_GBS - oppDiscardGBs.size);

    const ownGallery = buildPileGallery(pi, 'yours');
    const ownPick = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: ownGallery,
      title: CARD_NAME,
      description: `Pick exactly ${PER_PILE_COST} cards from YOUR discard pile to delete. The combined deletion must include ≥${REQUIRED_UNIQUE_GBS} different-named Guardian Beasts.`,
      validCounts: [PER_PILE_COST],
      requiredUniqueNames: ownExclusiveGBs,
      requiredUniqueCount: minOwnUnique,
      uniqueGateLabel: 'Guardian Beasts not in opp pile',
      cancellable: true,
    });
    if (!ownPick || ownPick.cancelled) return false;

    // Compute which GBs the player has already locked in from their
    // own pile. The second picker must add enough NEW unique GB
    // names (not already in this set) to reach the 3-unique floor.
    const ownPickedNames = Array.isArray(ownPick.selectedIndices)
      ? ownPick.selectedIndices.map(i => ownGallery[i]?.name).filter(Boolean)
      : (Array.isArray(ownPick.selectedCards) ? ownPick.selectedCards : []);
    const ownPickedUniqueGBs = new Set(ownPickedNames.filter(isGuardianBeastCreature));
    const oppExclusiveGBs = [...oppDiscardGBs].filter(n => !ownPickedUniqueGBs.has(n));
    const minOppUnique = Math.max(0, REQUIRED_UNIQUE_GBS - ownPickedUniqueGBs.size);

    const oppGallery = buildPileGallery(oi, 'opp');
    const oppPick = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: oppGallery,
      title: CARD_NAME,
      description: `Pick exactly ${PER_PILE_COST} cards from your OPPONENT'S discard pile to delete. The combined deletion must include ≥${REQUIRED_UNIQUE_GBS} different-named Guardian Beasts (you've locked ${ownPickedUniqueGBs.size} so far).`,
      validCounts: [PER_PILE_COST],
      requiredUniqueNames: oppExclusiveGBs,
      requiredUniqueCount: minOppUnique,
      uniqueGateLabel: 'New unique Guardian Beasts',
      cancellable: true,
    });
    if (!oppPick || oppPick.cancelled) return false;

    // Map gallery indices back to (owner, idx, cardName). The picker
    // returns `selectedIndices: [galleryIdx, ...]` since the recent
    // shared-picker upgrade — entryId is the canonical map. Fall back
    // to first-match name if a stale client somehow omits indices.
    const claimed = new Set();
    const picks = [];
    const resolveIndices = (pick, gallery, ownerIdx) => {
      const indices = Array.isArray(pick?.selectedIndices) ? pick.selectedIndices : null;
      const ps = engine.gs.players[ownerIdx];
      if (indices) {
        for (const galIdx of indices) {
          const entry = gallery[galIdx];
          if (!entry) continue;
          const m = /^dp-(\d+)-(\d+)$/.exec(entry.entryId || '');
          if (!m) continue;
          const owner = parseInt(m[1], 10);
          const idx = parseInt(m[2], 10);
          if (owner !== ownerIdx) continue;
          if (ps.discardPile[idx] !== entry.name) continue;
          const ck = entry.entryId;
          if (claimed.has(ck)) continue;
          claimed.add(ck);
          picks.push({ owner, idx, cardName: entry.name });
        }
        return;
      }
      // Legacy: only names returned. Linear-search the source pile.
      const names = Array.isArray(pick?.selectedCards) ? pick.selectedCards : [];
      for (const raw of names) {
        const name = typeof raw === 'string' ? raw : raw?.cardName || raw?.name;
        if (!name) continue;
        for (let i = 0; i < ps.discardPile.length; i++) {
          const ck = `dp-${ownerIdx}-${i}`;
          if (claimed.has(ck)) continue;
          if (ps.discardPile[i] !== name) continue;
          claimed.add(ck);
          picks.push({ owner: ownerIdx, idx: i, cardName: name });
          break;
        }
      }
    };
    resolveIndices(ownPick, ownGallery, pi);
    resolveIndices(oppPick, oppGallery, oi);

    // ── Step 2: validate the "≥3 different Guardian Beast" rider ─
    const allPickedNames = picks.map(p => p.cardName);
    const uniqueGBs = new Set(allPickedNames.filter(isGuardianBeastCreature));
    if (uniqueGBs.size < REQUIRED_UNIQUE_GBS) {
      engine.log('guardian_beast_zhu_fizzle', {
        player: own.username, reason: 'not_enough_unique_gb',
        uniqueGBsPicked: uniqueGBs.size, required: REQUIRED_UNIQUE_GBS,
      });
      return false; // selection didn't meet the rider — abort, no deletion
    }

    // ── Step 3: actually delete (shared resolver gives beforeDelete
    // rescues and consistent logging).
    const { deleteSelectedDiscardCards } = require('./_guardian-beasts-shared');
    const deleted = await deleteSelectedDiscardCards(engine, picks, CARD_NAME);
    if (deleted.length < (PER_PILE_COST * 2)) {
      // Mid-resolve drift (rescues, etc.) — only commit if the rider
      // is still met. If too few cards actually moved, fizzle without
      // skipping the opp turn or claiming the once-per-game flag.
      engine.log('guardian_beast_zhu_fizzle', {
        player: own.username, reason: 'partial_delete', deleted: deleted.length,
      });
      return false;
    }

    // ── Step 4: stamp once-per-game + skip-next-turn flags. ──────
    if (!gs[ONCE_PER_GAME_KEY]) gs[ONCE_PER_GAME_KEY] = {};
    gs[ONCE_PER_GAME_KEY][pi] = true;
    opp._skipNextTurn = true;
    engine.log('guardian_beast_zhu_skip', {
      player: own.username, opp: opp.username, deleted: deleted.length,
    });
    // First animation — fires NOW, on resolve. The opponent's "fell
    // asleep" moment, played in the activator's turn so the player
    // sees the consequence of their Zhu activation immediately. The
    // SECOND animation ("slept through their turn") fires later, in
    // switchTurn, when the actual skip happens.
    engine._broadcastEvent('zhu_skip_turn_animation', {
      sleeperOwner: oi,
      sleeperName: opp.username,
      phase: 'fell_asleep',
    });
    engine.sync();
    await engine._delay(1700);
    return true;
  },
};
