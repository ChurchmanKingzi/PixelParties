// COST-DISCARD-CHANNEL: n/a — der GEGNER muss abwerfen (v1041)
// ═══════════════════════════════════════════
//  CARD EFFECT: "Jean, the Pillaging Knight"
//  Hero — 400 HP, 50 ATK — BANNED
//  Starting abilities: Pillage × 2
//
//  Whenever 1 or more cards are milled from the
//  opponent's deck to the discard pile (by any
//  effect EXCEPT Jean's own), the opponent must
//  CHOOSE 2 additional cards from their deck and
//  send them to the discard pile (W16f: Gegner wählt;
//  gelöschte Karten lösen nicht aus).
//
//  Uses the onMill hook. Guards against infinite
//  loops with a _jeanTriggered flag on the mill
//  hookCtx so Jean's own 2-card mill does not
//  re-trigger Jean.
// ═══════════════════════════════════════════

const CARD_NAME = 'Jean, the Pillaging Knight';
const BONUS_MILL = 2;

module.exports = {
  activeIn: ['hero'],

  // CPU threat assessment (damage supporter). Jean's value is opponent-deck
  // denial — 2 extra mills per any mill event. Modeled as a modest per-turn
  // "damage" equivalent (deck erosion → fewer future draws for the target).
  supportYield() {
    return { damagePerTurn: 20 };
  },

  hooks: {
    onMill: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;

      // Must be the opponent's deck being milled
      if (ctx.playerIdx !== (engine.opponentOf(pi))) return;

      // Prevent Jean's own bonus mill from re-triggering Jean
      if (ctx._jeanTriggered) return;

      // W16f (H02-01): gelöschte Karten gehen in den Gelöscht-Stapel, nicht „to the discard pile" — kein Auslöser.
      if (ctx.deleteMode) return;

      // Jean must be alive and not incapacitated
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const oppIdx = ctx.playerIdx;
      const oppPs  = gs.players[oppIdx];
      if ((oppPs?.mainDeck || []).length === 0) return;
      // Turn-1 protection: opp's deck is shielded from any effect that
      // mills / peeks the top while protection is active. Jean's bonus
      // mill is blocked the same as the original mill source would
      // have been; an upstream gated mill normally won't reach here
      // anyway, but a non-gated source (e.g., self-mill that splashes
      // both decks) could otherwise feed Jean past the shield.
      if (gs.firstTurnProtectedPlayer === oppIdx) return;

      // Stream Jean's hero card to both players before the bonus mill
      engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });
      await engine._delay(400);

      // W16f (H02-02): gedruckt „your opponent must CHOOSE 2 additional cards from their deck" — der Gegner wählt selbst
      // (Pflicht: kein Abbrechen; fehlt eine Wahl, füllen die obersten Karten auf). Jeans eigener Mill löst nicht erneut aus.
      const need = Math.min(BONUS_MILL, oppPs.mainDeck.length);
      const chosen = [];
      const pool = oppPs.mainDeck.slice();
      const gallery = [];
      const seen = new Set();
      for (const cn of pool) { if (!seen.has(cn)) { seen.add(cn); gallery.push({ name: cn, source: 'deck' }); } }
      const picked = await engine.promptGeneric(oppIdx, {
        type: 'cardGalleryMulti',
        cards: gallery,
        title: CARD_NAME,
        description: `Choose ${need} card${need === 1 ? '' : 's'} from your deck to send to the discard pile.`,
        selectCount: need,
        minSelect: need,
        confirmLabel: '🗑️ Discard',
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      for (const n of (Array.isArray(picked?.selectedCards) ? picked.selectedCards : [])) {
        if (chosen.length >= need) break;
        const k = pool.indexOf(n);
        if (k < 0) continue;
        pool.splice(k, 1);
        chosen.push(n);
      }
      while (chosen.length < need && pool.length > 0) chosen.push(pool.shift());   // Pflicht: Rest von oben

      // Send the chosen cards, flagged so this doesn't re-trigger Jean
      await engine.actionMillCards(oppIdx, chosen.length, {
        targetCardNames: chosen,
        source:        CARD_NAME,
        _jeanTriggered: true,
      });

      engine.log('jean_bonus_mill', {
        player:  gs.players[pi]?.username,
        hero:    hero.name,
        trigger: ctx.source || 'unknown',
        bonus:   BONUS_MILL,
      });
    },
  },
};
