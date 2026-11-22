// ═══════════════════════════════════════════
//  CARD EFFECT: "Ida, the Adept of Destruction"
//  Hero — Two passive effects:
//
//  1) Destruction Spell damage dealt by cards played
//     through this Hero gets the "cannot be reduced
//     or negated" flag (pierces Diamond, Anti Magic,
//     damage reductions, etc.).
//     Tracked via source.heroIdx matching Ida's index.
//
//     WICHTIG — nur gegen GEGNERISCHE Ziele:
//     "The damage this Hero's Destruction Spells deal
//     to YOUR OPPONENT'S TARGETS cannot be reduced or
//     negated". Bis 8.8. prüften beide Hooks nur die
//     QUELLE und stempelten den Durchschlag deshalb
//     auf jedes Ziel — auch auf eigene. Damit ging
//     z.B. der Rückstoß von Fire Bolts ungebremst
//     durch jeden eigenen Schutzeffekt, obwohl er ein
//     eigenes Ziel trifft. Beide Hooks prüfen jetzt
//     zusätzlich den Zielbesitzer.
//
//  2) Multi-target Destruction Spells cast by this
//     Hero become single-target instead. The normal
//     AoE/multi-target handling is replaced by the
//     generic single-target picker.
//     Implemented via a flag: heroFlags[pi-heroIdx]
//     .forcesSingleTarget = true.
//     Spell scripts check this flag during resolution.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  // Spielgestalter-Entscheidung 16.11.2026: Idas Stempel (`canBeNegated = false`, `ignoreUnaffected`) muss VOR den Schutz-Hooks anderer Karten stehen, die Schaden
  // an Kreaturen verhindern/negieren (Wowkyrie, Guardian Beast Gou …) — sonst entscheidet die Reihenfolge (Zugspieler zuerst), ob Ida durchkommt, wenn sie
  // NICHT am Zug ist (Reaktion). Der Hook ändert keinen Betrag, die Vorrang-Stufe verschiebt nur den Stempel nach vorn.
  // Dasselbe fuer Helden-Schaden (`beforeDamage`): Idas Stempel `cannotBeReduced`/`cannotBeNegated` muss VOR den Schild-Hooks anderer Helden stehen (Chuck: `setAmount(0)`, Inya,
  // Tazune …), sonst haengt der Durchschlag davon ab, wer am Zug ist — reagiert Ida im Zug des Gegners (Booby Trap), liefe Chucks Schild zuerst und haelt den Treffer ab.
  // „Unreduzierbarer Schaden toppt Schilde" (Spielgestalter-Entscheidung 16.11.2026). Der Hook aendert keinen Betrag, die Vorrang-Stufe schiebt nur den Stempel nach vorn.
  hookPriority: { beforeCreatureDamageBatch: 1, beforeDamage: 1 },

  // Spielgestalter-Entscheidung 16.11.2026 („Da soll sie überall durchschlagen!"): Idas Destruction-Zauberschaden gegen Ziele des GEGNERS ignoriert auch die „takes no damage"-FORMEN
  // am HELDEN — Kontrolle durch Deepsea Succubus/Little Lyta (`charmed.nurSchadenSchutz`), `damage_proof` (Storm Piano, Cheat Chair) und Versteinerung (Baihu, Petrifier). Diese Wege
  // stehen in der Schadens-Pipeline VOR/unabhängig vom `beforeDamage`-Stempel unten; die Engine fragt deshalb diesen Vertrag (`_quelleDurchschlaegtHeldenSchutz`), gleiche Bedingungen
  // wie der Stempel (Typ, eigene Quelle, Ziel des Gegners nach KONTROLLE). Kreaturen: `e.ignoreUnaffected` im Hook unten. Bleibt immun: „unaffected by ALL cards and effects"
  // (Cardinal Beasts, Stowaway, Hot Skull Potato; Charme Lv 3), Erstrunden-Schutz, Effekt-Immunitäten.
  piercesDamageProtection(engine, { target, type, sourceOwner, sourceHeroIdx }) {
    if (type !== 'destruction_spell') return false;
    const targetOwner = engine._findHeroOwner(target);
    if (typeof targetOwner !== 'number' || targetOwner < 0) return false;
    // „your opponent's targets" — Kontrolle statt Seite (Styx 28.9.); Idas Kontrolleur wie `ctx.cardOwner` des Hooks.
    const ida = engine.gs.players[sourceOwner]?.heroes?.[sourceHeroIdx];
    return engine.heroSideOf(targetOwner, target) !== engine.heroSideOf(sourceOwner, ida);
  },

  hooks: {
    /**
     * On game start + on play + every turn start: register the single-
     * target override flag. Merged rather than replaced so other flags
     * set on the same hero-slot key (Monia / Nao / Toras / etc.) survive.
     * `onTurnStart` re-asserts defensively in case Ida was KO'd earlier
     * (which deletes the flag) and later revived — revival doesn't fire
     * onGameStart or onPlay, so without this the passive would stay off
     * after any resurrection.
     */
    onGameStart: (ctx) => {
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      const key = `${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
      gs.heroFlags[key] = { ...(gs.heroFlags[key] || {}), forcesSingleTarget: true };
    },

    onPlay: (ctx) => {
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      const key = `${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
      gs.heroFlags[key] = { ...(gs.heroFlags[key] || {}), forcesSingleTarget: true };
    },

    // Geliehen (??? the Shapeshifter): der Einzelziel-Deckel geht mit der
    // Gestalt (H02-heroes-19).
    onIdentityLost: (ctx) => {
      const flags = ctx.gameState.heroFlags?.[`${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`];
      if (flags) delete flags.forcesSingleTarget;
    },

    // W16f (H02-06): Wiederbelebung (Golden Ankh, Styx …) feuert nur `onHeroRevive` — der Deckel muss sofort wieder stehen,
    // nicht erst zum nächsten Zugbeginn (sonst trifft Idas Zauber im selben Zug wieder mehrere Ziele).
    onHeroRevive: (ctx) => {
      const hero = ctx.attachedHero ?? ctx.gameState.players[ctx.cardOriginalOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0 || ctx.hero !== hero) return;
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      const key = `${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
      gs.heroFlags[key] = { ...(gs.heroFlags[key] || {}), forcesSingleTarget: true };
    },

    onTurnStart: (ctx) => {
      // Ida is alive + active (hooks filter dead / frozen / stunned /
      // negated heroes). Re-assert the flag so revives don't leave her
      // passive silently disabled.
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      const key = `${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
      gs.heroFlags[key] = { ...(gs.heroFlags[key] || {}), forcesSingleTarget: true };
    },

    /**
     * Effect 1: Destruction Spell damage dealt by Ida cannot be negated.
     * Hooks into beforeCreatureDamageBatch to modify entries.
     */
    beforeCreatureDamageBatch: (ctx) => {
      const entries = ctx.entries;
      if (!entries) return;

      for (const e of entries) {
        if (e.cancelled) continue;
        // Only affects destruction_spell damage from Ida's hero slot
        if (e.type !== 'destruction_spell') continue;
        // Styx 28.9.: Brettseite der Quelle (`heroOwner`) gegen Idas Seite —
        // der gleich indizierte eigene Held des Kontrolleurs ist nicht Ida.
        if ((e.source?.heroOwner ?? e.sourceOwner) !== (ctx.cardHeroOwner ?? ctx.cardOwner)) continue;
        if (e.sourceHeroIdx !== ctx.cardHeroIdx) continue;
        // ...und nur gegen Ziele des GEGNERS. Maßgeblich ist der
        // KONTROLLEUR, nicht der Besitzer: eine Kreatur, die dir
        // gehört, aber beim Gegner steht, ist sein Ziel. Ohne
        // auflösbare Instanz lässt sich das nicht prüfen — dann
        // bleibt der Durchschlag aus (der Text ist eine Erlaubnis,
        // keine Grundregel).
        if (!e.inst) continue;
        if ((e.inst.controller ?? e.inst.owner) === ctx.cardOwner) continue;
        // Mark as un-negatable
        e.canBeNegated = false;
        // Spielgestalter-Entscheidung 16.11.2026: „ignore any effects that make a target unaffected by them" — Ida durchschlägt ALLE
        // „unaffected by (your opponent's) cards and effects" / „unaffected by [Typ]" (Black-Thorn Dragon, Golden Wings, Sparkfly Attendant,
        // Rook/Board of Kings), NICHT aber „unaffected by ALL cards and effects" (Cardinal Beasts, Stowaway, Hot Skull Potato …).
        // Die Engine liest den Stempel in `_markCreatureDamageImmunity` (Neubewertung nach dieser Hook-Runde).
        // Erweitert (Spielgestalter-Entscheidung 16.11.2026): auch „cannot take damage / cannot be defeated" (Time Bomblebee, Deepsea Succubus) und „damage is negated"
        // (Resilient Monkee, Divine Gift of the Guardian, The Egg of God, Wowkyrie, Guardian Beast Gou) halten Idas Zauberschaden NICHT ab.
        // Dritte Erweiterung (Spielgestalter-Entscheidung 16.11.2026): auch die Versteinerung („takes no damage from any sources": Baihu, Petrifier, `_petrified`) — Helden-Seite: `piercesDamageProtection` oben.
        e.ignoreUnaffected = true;
      }
    },

    /**
     * Effect 1 (hero damage): Destruction Spell damage dealt by Ida
     * TO AN OPPONENT'S HERO cannot be reduced OR negated, and ignores
     * any effect that would make a target unaffected by it (Anti Magic
     * etc.). Damage to Ida's own side is untouched. Stamps both
     * `cannotBeReduced` and `cannotBeNegated` via the engine's
     * canonical mutators — `ctx.lockReduction()` writes to the
     * underlying hookCtx (which the damage pipeline reads to skip the
     * buff multiplier pass), and `ctx.setFlag('cannotBeNegated', true)`
     * writes to the same hookCtx (the Anti Magic gate reads it to
     * skip the void). Direct `ctx.foo = true` assignment doesn't
     * propagate because `_createContext` spreads hookCtx into a fresh
     * object — fixed here so the card text actually works.
     */
    beforeDamage: (ctx) => {
      if (ctx.type !== 'destruction_spell') return;
      if (ctx.sourceHeroIdx < 0 || ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      // Verify source belongs to same player as Ida
      // Styx 28.9.: Brettseite der Quelle gegen Idas Seite.
      const srcOwner = ctx.source?.heroOwner ?? ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (srcOwner !== (ctx.cardHeroOwner ?? ctx.cardOwner)) return;
      // ...und das Ziel muss dem GEGNER gehören. Eigene Helden sind
      // ausgenommen — der Rückstoß von Fire Bolts oder Phoenix Tackle
      // ist damit ganz normal reduzier- und negierbar (Tazune fängt
      // ihn also ab). Lässt sich der Besitzer nicht bestimmen, wird
      // NICHT gestempelt.
      const targetOwner = ctx._engine?._findHeroOwner?.(ctx.target);
      if (typeof targetOwner !== 'number' || targetOwner < 0) return;
      // „your opponent's targets" — Kontrolle statt Seite (Styx 28.9.)
      if (ctx._engine.heroSideOf(targetOwner, ctx.target) === ctx.cardOwner) return;
      ctx.lockReduction();
      ctx.setFlag('cannotBeNegated', true);
    },

    /**
     * Clean up flag when Ida is removed from play (hero KO).
     */
    onHeroKO: (ctx) => {
      if (!ctx.hero || ctx.hero.name !== 'Ida, the Adept of Destruction') return;
      // Find which player/hero this is
      const gs = ctx.gameState;
      if (gs.heroFlags) {
        // Styx 28.9.: derselbe Schluessel wie beim Setzen (Brettseite).
        const key = `${ctx.cardHeroOwner ?? ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
        delete gs.heroFlags[key];
      }
    },
  },
};
