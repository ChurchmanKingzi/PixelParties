// ═══════════════════════════════════════════
//  HERO EFFECT: "Styx, the Gate to the Spirit World"
//
//  Whenever ANOTHER Hero is defeated (regardless
//  of which player controlled it), Styx's
//  controller may permanently increase Styx's
//  current AND max HP by 100 each. "May" is a
//  per-trigger choice — declines don't burn any
//  per-turn slot, and a future death will
//  re-prompt.
//
//  Wiring:
//   • `onHeroKO` hook fires per Styx instance for
//     every hero KO.
//   • Self-protection: skip when the dying hero
//     IS Styx — "another" excludes himself.
//   • Alive gate: a KO'd Styx can't grow further;
//     skip when his hp ≤ 0 already.
//   • `engine.increaseMaxHp(hero, 100)` defaults
//     to `alsoHealCurrent: true`, so a single
//     call covers both clauses ("current and max
//     HP by 100 each"). Permanent because the
//     mutation is on `hero.maxHp` / `hero.hp`
//     directly, not via a per-turn buff.
// ═══════════════════════════════════════════

const CARD_NAME = 'Styx, the Gate to the Spirit World';
const AUFSTIEG_ZIEL = 'Styx, the Opened Gate';
const NOETIGE_WIEDERBELEBUNGEN = 3;

module.exports = {
  activeIn: ['hero'],

  /**
   * Aufstiegsbereitschaft an den Client melden („after Heroes have been
   * revived at least 3 times this game"). Nur die Anzeige — verbindlich
   * prueft `ascensionCondition` auf der aufgestiegenen Karte. Nimmt nur
   * die EIGENE Bereitschaft zurueck.
   */
  /**
   * ★ Revive-Zaehler (Als Vorgabe 28.9.): Hat `pi` „Styx, the Opened
   * Gate" in Rotation (Hand, Deck, Ablage, Geloescht), zeigt jeder
   * seiner Basis-Styx unten mittig die bisherigen Wiederbelebungen.
   * Nur fuer den BESITZER — das Deck ist verdeckt, und der Zaehler
   * verriete sonst, dass die Karte darin liegt.
   * @returns {{ heroIdxs: number[], count: number } | null}
   */
  reviveZaehlerAnzeige(engine, pi) {
    const ps = engine?.gs?.players?.[pi];
    if (!ps) return null;
    const heroIdxs = [];
    (ps.heroes || []).forEach((h, hi) => { if (h?.name === CARD_NAME) heroIdxs.push(hi); });
    if (heroIdxs.length === 0) return null;
    const inRotation = ['hand', 'mainDeck', 'discardPile', 'deletedPile']
      .some(k => (ps[k] || []).includes(AUFSTIEG_ZIEL));
    if (!inRotation) return null;
    return { heroIdxs, count: engine.gs.heroRevivalCount || 0 };
  },

  refreshAscensionReadiness(engine, pi, hi) {
    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero || hero.name !== CARD_NAME) return;
    if (hero.hp > 0 && (engine.gs.heroRevivalCount || 0) >= NOETIGE_WIEDERBELEBUNGEN) {
      hero.ascensionReady = true;
      hero.ascensionTarget = AUFSTIEG_ZIEL;
    } else if (hero.ascensionTarget === AUFSTIEG_ZIEL) {
      delete hero.ascensionReady;
      delete hero.ascensionTarget;
    }
  },

  // ── CPU: Confirm-Prompts pauschal bejahen (Barker-Bugklasse) ──────
  // onHeroKO-Confirm (feuert im Gegner-Zug, plan-los).
  // Ohne Intercept declined der Brain-Default cancellable Confirms in
  // plan-losen Kontexten und der Effekt verpufft still. Der generic-
  // Dispatch lädt dieses Skript nur für Prompts mit dem eigenen
  // Kartentitel — Pauschal-Confirm ist damit korrekt gescopet.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const ourPi = ctx.cardOwner;            // Kontrolleur: wird gefragt
      const ourHi = ctx.cardHeroIdx;
      // Styx 28.9.: Held und Animation auf der Brettseite — uebernommen
      // ist das nicht die Seite des Kontrolleurs.
      const ourSide = ctx.cardHeroOwner ?? ourPi;
      const ourHero = ctx.attachedHero ?? gs.players[ourSide]?.heroes?.[ourHi];
      // A KO'd Styx can't absorb — the trigger only fires while he's
      // still standing. If he himself is the one dying, the
      // "another" gate below catches it; this guard is for chained
      // deaths where Styx was already dropped earlier in the chain.
      if (!ourHero?.name || ourHero.hp <= 0) return;

      const dyingHero = ctx.hero;
      if (!dyingHero?.name) return;

      // Resolve the dying hero's slot so we can self-exclude. The
      // hook payload doesn't carry owner/heroIdx for the KO target,
      // so we walk both player rosters by reference identity. Mirror
      // of the lookup Cannibalism does for the same reason.
      let deadOwner = -1, deadHeroIdx = -1;
      for (let p = 0; p < 2; p++) {
        const heroes = gs.players[p]?.heroes || [];
        for (let h = 0; h < heroes.length; h++) {
          if (heroes[h] === dyingHero) {
            deadOwner = p; deadHeroIdx = h;
            break;
          }
        }
        if (deadOwner >= 0) break;
      }
      if (deadOwner < 0) return;
      // "Another Hero" — never trigger off Styx's own death (Objektvergleich).
      if (dyingHero === ourHero) return;

      const confirmed = await engine.promptGeneric(ourPi, {
        type: 'confirm',
        title: `${CARD_NAME}`,
        message: `${dyingHero.name} has been defeated. Permanently increase ${ourHero.name}'s current and max HP by 100?`,
        showCard: CARD_NAME,
        confirmLabel: '👻 Absorb',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Soul-absorb visual on Styx's hero zone. `heal_sparkle` is the
      // standard "gained HP" zone animation used elsewhere; the
      // vertical ribbon reads as the spirit ascending into the gate.
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle',
        owner: ourSide, heroIdx: ourHi, zoneSlot: -1,
      });
      await engine._delay(300);

      // `alsoHealCurrent` defaults to true — a single call adds 100
      // to both current AND max HP, exactly matching "current and max
      // HP by 100 each".
      engine.increaseMaxHp(ourHero, 100);

      engine.log('styx_absorb', {
        player: gs.players[ourPi]?.username,
        hero: ourHero.name,
        absorbed: dyingHero.name,
        newMax: ourHero.maxHp,
      });
      engine.sync();
    },
  },
};
