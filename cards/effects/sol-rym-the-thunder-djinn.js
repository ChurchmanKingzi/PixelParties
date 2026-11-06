// ═══════════════════════════════════════════
//  CARD EFFECT: "Sol Rym, the Thunder Djinn"
//  Hero (300HP, 50ATK) — Can use Chain Lightning
//  regardless of level. Can only perform 1
//  Action per turn total.
// ═══════════════════════════════════════════

module.exports = {
  // W7a (H04-02, Al): der Stempel `levelOverrideCards` ist ein laufender Heldenpassiv — ruht bei Frost/Betäubung/Negation (Engine `_heroLevelOverride`)
  levelOverridesArePassive: true,
  hooks: {
    // „1 Action per turn" schliesst ZUSATZAKTIONEN ein (H04-01): jede aufgeloeste Aktion
    // DIESES Helden — auch eine zusaetzliche/inhaerente — verbraucht die eine Aktion.
    // Danach sperrt der `_maxActionsPerTurn`-Vertrag ihn fuer alles Weitere (wie Friedhelm).
    onAnyActionResolved: (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const feld = ctx.cardHeroOwner ?? pi;
      const hero = engine?.gs?.players?.[feld]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || !hero._maxActionsPerTurn) return;
      const handelnd = ctx.heroOwner ?? ctx.playerIdx;
      if (ctx.heroIdx !== ctx.cardHeroIdx || (handelnd !== pi && handelnd !== feld)) return;
      hero._actionsThisTurn = Math.max(hero._actionsThisTurn || 0, 1);
    },

    onGameStart: (ctx) => {
      const ps = ctx.gameState.players[ctx.cardOriginalOwner];
      const hero = ps?.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;
      // Chain Lightning treated as level 0 for eligibility
      hero.levelOverrideCards = { 'Chain Lightning': 0 };
      // Only 1 action per turn
      hero._maxActionsPerTurn = 1;
    },

    /**
     * ★ v1166: Wird der Effekt nur GELIEHEN (Shapeshifter), muss er beim
     * Ende der Leihe wieder weg — sonst behielte der Held die
     * Stufen-Freigabe und die Aktionsgrenze fuer immer.
     */
    onIdentityLost: (ctx) => {
      const ps = ctx.gameState?.players?.[ctx.cardOriginalOwner];
      const hero = ps?.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;
      if (hero.levelOverrideCards && 'Chain Lightning' in hero.levelOverrideCards) {
        delete hero.levelOverrideCards['Chain Lightning'];
        if (Object.keys(hero.levelOverrideCards).length === 0) delete hero.levelOverrideCards;
      }
      if (hero._maxActionsPerTurn === 1) delete hero._maxActionsPerTurn;
    },
  },
};
