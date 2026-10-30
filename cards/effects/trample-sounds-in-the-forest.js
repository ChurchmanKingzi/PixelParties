const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// ═══════════════════════════════════════════
//  CARD EFFECT: "Trample Sounds in the Forest"
//  Spell (Reaction, Magic Arts Lv1)
//
//  Only activatable via the dedicated Ascension
//  reaction window (see `_checkAscensionHandReactions`
//  in cards/effects/_engine.js). It fires AFTER the
//  Ascension Bonus but BEFORE `performAscension`
//  decides whether to advance to End Phase.
//
//  On activation, the ascending player takes one
//  immediate free additional Action WITH THE
//  ASCENDED HERO (the hero that just ascended,
//  not an arbitrary one — matching the card text).
//  After that action — and whatever reaction chain
//  it spawns — resolves, control returns to
//  `performAscension`, which then proceeds to the
//  End Phase as normal.
//
//  Hard once per turn: a single Ascension can
//  only be chained to by one Trample Sounds, and
//  a player can only use one Trample Sounds per
//  turn total.
// ═══════════════════════════════════════════

// Al 30.10.: Die Karte BLEIBT sichtbar in der Hand, bis der gewählte Zauber der freien Aktion bestätigt/aufgelöst ist; dann fliegt zuerst sie, kurz danach
// der Zauber zur Ablage. `_checkAscensionHandReactions` (_engine.js) reicht dafür `ablage.vorspann` herein; die freie Aktion ruft ihn unmittelbar vor dem
// Flug des gewählten Zaubers auf (`ablageVorspann`). Wird kein Zauber aus der Hand gewirkt (Kreatur, Ability, Abbruch), legt die Engine die Karte
// am Ende der freien Aktion ab.
const CARD_NAME = 'Trample Sounds in the Forest';
const HOPT_KEY = 'trample-sounds';

module.exports = {
  // NOTE: intentionally NOT using `isReaction` — that flag opts the card
  // into the generic reaction chain (`_promptReactionsForChain`), which
  // would offer it on every unrelated trigger. Trample Sounds has its
  // own dedicated window (`_checkAscensionHandReactions`), so only the
  // ascension-specific flag below is set. Same design choice as
  // `cards/effects/jump-in-the-river.js`.
  isAscensionReaction: true,

  // Cannot be played proactively — only fires through the Ascension
  // reaction window. The data file's `subtype: "Reaction"` already
  // blocks proactive play server-side (server.js doUseArtifactEffect),
  // but this flag makes the intent explicit at the script level too.
  canActivate: () => false,

  /**
   * Extra gate run by `_checkAscensionHandReactions` on top of the
   * standard school/level + alive-hero checks. Currently just the HOPT
   * — once Trample Sounds is used in a given turn, a second copy in
   * hand can't activate until the next turn rolls around.
   */
  ascensionReactionCondition(gs, pi) {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    return true;
  },

  /**
   * Resolve: claim HOPT, then hand the ascending player a
   * "use one free Action WITH THE ASCENDED HERO" prompt. The prompt
   * cancels cleanly if they change their mind (the Reaction is still
   * spent). Any chain the chosen action spawns runs through the normal
   * play path, so opponent reactions like Master's Plan / Anti Magic
   * Shield can still intercept that FOLLOW-UP action as usual.
   */
  // Als Vorgabe 29.9.: `heroOwner` = Brettseite eines GELIEHENEN
  // aufgestiegenen Helden (fehlt er, ist es die eigene Spalte).
  ascensionReactionResolve: async (engine, pi, castingHeroIdx, ascendedHeroIdx, heroOwner, ablage) => {
    if (!engine.claimHOPT(HOPT_KEY, pi)) return;

    // The free Action is locked to the Hero that just Ascended — matches
    // the card text. `performImmediateAction(pi, heroIdx)` opens the
    // single-hero Action UI; abilities on that hero are eligible too.
    await engine.performImmediateAction(pi, ascendedHeroIdx, {
      title: CARD_NAME,
      description: 'Perform one free additional Action with the Ascended Hero!',
      ...(ablage && typeof ablage.vorspann === 'function' ? { ablageVorspann: ablage.vorspann } : {}),   // Trample Sounds fliegt vor dem gewählten Zauber zur Ablage
      ...((isSeat(engine, heroOwner)) && heroOwner !== pi ? { heroOwner } : {}),
    });
  },
};
