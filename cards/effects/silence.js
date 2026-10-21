// ═══════════════════════════════════════════
//  CARD EFFECT: "Silence"
//  Spell (Reaction) — Decay Magic Lv2
//
//  ★ W34a (Al, 22.10.2026): reagiert auch auf Effekte, die als Spell ZÄHLEN
//  (Alice, the Puppeteer Girl: virtuelle Spell-Kette `alsSpellKette`) —
//  negiert den Effekt, sperrt Spells für den Rest des Zuges und gewährt den
//  einen Bonus-Spell wie beim echten Spell. Kartentext: „… plays a Spell."
//  (das Relikt „that is not a Creature" ist gestrichen — Creatures sind
//  keine Spells, die Unterscheidung läuft über `cardType`).
//
//  When the opponent plays a Spell, negate it.
//  The opponent may immediately play ONE more
//  Spell as an additional Action (doesn't cost
//  their Main/Action-Phase Action). After that
//  single Spell resolves (or they decline), no
//  more Spells this turn.
//
//  Implementation:
//    • Negate the target chain link.
//    • Set opp._spellLockTurn = gs.turn to lock
//      Spell plays for the rest of the turn.
//    • Grant a one-use bypass token
//      (opp._silenceBonusSpell = gs.turn) that
//      _engine.js consults at the three Spell-
//      lock sites (validateActionPlay + the two
//      CPU hand-filter loops). doPlaySpell in
//      server.js consumes the token on the
//      first successful validation — from that
//      point the lock is absolute.
//    • Once per game.
//
//  ★ W48a: der Bonus-Spell wird SOFORT angeboten (Post-Chain-Fenster, siehe `resolve`), nicht mehr für den Rest des Zuges bereitgehalten.
// ═══════════════════════════════════════════

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'plague_smoke' }, impactMs: 260 },

  isReaction: true,
  oncePerGame: true,
  oncePerGameKey: 'silence',

  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (!lastLink || lastLink.owner === pi) return false;
    if (lastLink.cardType !== 'Spell') return false;

    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps._oncePerGameUsed?.has('silence')) return false;

    const cardData = engine._getCardDB()['Silence'];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;   // W13 (Al, A2): `negated` sperrt die Reaktion nicht mehr
      if (engine.heroMeetsLevelReq(pi, hi, cardData)) return true;
    }
    return !!engine.fremderHeldKannStufe(pi, 'Silence');   // W20c: auch ein uebernommener Held wirkt
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const targetIndex = myIndex - 1;
    if (targetIndex < 0) return;
    const targetLink = chain[targetIndex];
    if (!targetLink) return;

    const oppIdx = targetLink.owner;
    const oppPs = gs.players[oppIdx];

    // Claim once-per-game
    const ps = gs.players[pi];
    if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
    ps._oncePerGameUsed.add('silence');

    // Animation on the opponent's side
    engine._broadcastEvent('play_zone_animation', {
      type: 'plague_smoke', owner: oppIdx,
      heroIdx: targetLink.heroIdx ?? 0, zoneSlot: -1,
    });
    await engine._delay(500);

    // Negate the Spell
    engine.negateChainLink(chain, targetIndex);

    // Set lock + one-use bypass token on opponent
    if (oppPs) {
      oppPs._spellLockTurn = gs.turn;
      oppPs._silenceBonusSpell = gs.turn;
      // ★ W48a (Al, 22.10.2026, Punkt 3: „Silence soll den Gegner SOFORT einen zusätzlichen Spell ausführen lassen, wie beispielsweise Victory Phoenix Cannon"):
      // der Bonus-Spell ist ein SOFORT-Fenster (wie The Master's Plan / Shamanic Curse nach der ganzen Kette angeboten, abbrechbar), kein Zeitstempel für den Rest
      // des Zuges: wird er nicht gewählt, ist er verfallen (Token wird nach dem Fenster geleert). Im Fenster der Spell-Auswahl ist keine Surprise aktivierbar
      // (`promptSpellAuswahl`), und eine aktivierte Spell-Surprise verbraucht den Bonus nie (`zaehleAlsArt` mit `surprise: true`).
      engine.queuePostChainAction(async () => {
        try {
          await engine.performImmediateActionAnyHero(oppIdx, {
            title: 'Silence',
            allowedCardTypes: ['Spell'],
            description: 'Your Spell was negated by Silence. You may immediately use another Spell as an additional Action — or skip.',
            cancellable: true,
          });
        } finally {
          if (oppPs._silenceBonusSpell === gs.turn) oppPs._silenceBonusSpell = -1;   // verfallen (gewirkt: schon am Anfang des Sofort-Gusses verbraucht)
        }
        engine.sync();
      });
    }

    engine.log('silence_negate', {
      player: engine.gs.players[pi]?.username,
      negated: targetLink.cardName,
      owner: oppIdx,
    });
    engine.sync();
  },
};
