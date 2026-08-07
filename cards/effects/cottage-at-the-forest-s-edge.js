// ═══════════════════════════════════════════
//  CARD EFFECT: "Cottage at the Forest's Edge"
//  Area Spell (Lv1)
//
//  "While this Area remains in play, both players may once
//   per turn choose one of their Ascended Heroes and revive
//   it with 100 HP. An Ascended Hero revived by this effect
//   is defeated at the end of its owner's turn. That cannot
//   be negated."
//
//  Wiring:
//    • "both players may once per turn" — `areaEffect`. The
//      engine's HOPT key is `area-effect:<name>:<activator>`,
//      i.e. per PLAYER, so the opponent gets their own use of
//      an Area the other player owns. Activation is gated to
//      the active player's Main Phase, which is also why
//      "end of its owner's turn" collapses to "end of the
//      current turn" — you can only ever revive on your own.
//    • "revive it with 100 HP" — `actionReviveHero`.
//    • "defeated at the end of its owner's turn / cannot be
//      negated" — `forceKillAtTurnEnd`. The engine's
//      `_processForceKills` sets HP to 0 directly, bypassing
//      every protection and negation. It DOES still fire
//      ON_HERO_KO, so a card that reacts to a death — Elixir
//      of Immortality collects there and revives at its next
//      checkpoint — can still save the Hero. That is exactly
//      the intended escape hatch: prevention/reaction yes,
//      negation no.
//
//  ── Waflav (Als Ruling) ──
//  Only revivable while ASCENDED. A Waflav that was Descended
//  all the way back to its base form before dying is NOT an
//  Ascended Hero and stays dead. This needs no Waflav-specific
//  code: the eligibility test reads the dead Hero's CURRENT
//  name from the card database and asks for
//  `cardType === 'Ascended Hero'`. A Hero that died as
//  Thunderstruck still carries that name; one that Descended
//  to base carries the base name and fails the test.
//
//  The doom flag likewise rides on the Hero OBJECT, which
//  Ascension and Descension mutate in place (only `name`
//  changes) — so a revived Hero that climbs or drops forms
//  during the turn still dies at the end of it.
// ═══════════════════════════════════════════

const CARD_NAME = "Cottage at the Forest's Edge";
const REVIVE_HP = 100;

/**
 * Dead Heroes of `pi` that this Area can bring back: an Ascended Hero
 * by CURRENT name. Reading the name at revive time is what implements
 * the Waflav ruling for free.
 */
function revivableHeroes(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp > 0) continue;
    if (cardDB[h.name]?.cardType !== 'Ascended Hero') continue;
    out.push({ heroIdx: hi, hero: h });
  }
  return out;
}

module.exports = {
  // 'hand' so the self-placing onPlay below fires while the card is
  // still in hand, 'area' so the activation stays live once it lies on
  // the board.
  activeIn: ['hand', 'area'],
  areaEffect: true,

  hooks: {
    /**
     * Selbst-Platzierung beim Ausspielen.
     *
     * Areas landen NICHT von selbst im Area-Slot: die Engine erwartet,
     * dass die Karte sich per `placeArea` dorthin bringt und damit
     * `gs._spellPlacedOnBoard` stempelt. Ohne diesen Hook greift in JEDEM
     * Spielpfad die Standard-Entsorgung und die Karte wandert von der
     * Hand direkt auf den Ablagestapel — genau das, was Al über Cooldins
     * Effekt gesehen hat. Cooldin hat den Fehler nur SICHTBAR gemacht;
     * er lag von Anfang an in der Karte, war aber latent, weil die
     * Cottage in den Tests immer direkt in die Area-Zone gesetzt wurde
     * statt gespielt zu werden. Muster identisch zu Deepsea Castle,
     * Crystal Well, Smuggler's Pier, Slippery Ice und Cosmic Depths.
     *
     * Die beiden Wachen sind nötig, weil `onPlay` auch dann feuert, wenn
     * eine ANDERE Karte gespielt wird, während die Cottage schon liegt.
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },
  },

  canActivateAreaEffect(ctx) {
    const engine = ctx._engine;
    const activator = ctx._activator ?? engine.gs.activePlayer;
    if (activator == null || activator < 0) return false;
    return revivableHeroes(engine, activator).length > 0;
  },

  async onAreaEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const activator = ctx._activator ?? gs.activePlayer;
    if (activator == null || activator < 0) return false;

    const candidates = revivableHeroes(engine, activator);
    if (candidates.length === 0) return false;

    // "choose ONE of their Ascended Heroes" — mandatory once activated,
    // the text has no "you may" on the choice itself.
    const targets = candidates.map(c => ({
      id: `hero-${activator}-${c.heroIdx}`,
      type: 'hero',
      owner: activator,
      heroIdx: c.heroIdx,
      cardName: c.hero.name,
    }));

    // IMMER auswaehlen lassen, auch bei nur einem legalen Ziel (Als
    // Vorgabe). Automatisches Durchreichen spart zwar einen Klick, nimmt
    // dem Spieler aber die Bestaetigung, WAS gerade wiederbelebt wird —
    // und bei dieser Karte haengt daran ein Held, der am Zugende stirbt.
    const chosen = await engine.promptEffectTarget(activator, targets, {
      title: CARD_NAME,
      source: CARD_NAME,
      description: `Revive one of your Ascended Heroes with ${REVIVE_HP} HP. It is defeated at the end of your turn.`,
      confirmLabel: '🏚️ Revive!',
      confirmClass: 'btn-success',
      cancellable: false,
      maxTotal: 1,
      minRequired: 1,
      allowDeadHeroes: true,
    });
    if (!chosen || chosen.length === 0) return false;
    const sel = targets.find(t => t.id === chosen[0]) || targets[0];

    const ok = await engine.actionReviveHero(activator, sel.heroIdx, REVIVE_HP, {
      source: CARD_NAME,
      // "defeated at the end of its owner's turn. That cannot be negated."
      forceKillAtTurnEnd: true,
      animationType: 'holy_revival',
    });
    if (!ok) return false;

    engine.log('cottage_revive', {
      player: gs.players[activator]?.username,
      hero: sel.cardName, hp: REVIVE_HP,
    });
    engine.sync();
    return true;
  },

  /**
   * CPU: revive the Hero that gets the most out of one turn of life.
   * A revived Hero is doomed anyway, so raw survivability is worthless —
   * what counts is what it can DO before the end phase, i.e. its ATK.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget' && kind !== 'target') return undefined;
    const { validTargets } = payload || {};
    if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
    const cardDB = engine._getCardDB();
    let best = null, bestScore = -Infinity;
    for (const t of validTargets) {
      const cd = cardDB[t.cardName];
      const score = (cd?.atk || 0);
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best ? [best.id] : undefined;
  },

  cpuMeta: {
    // Wert liegt in einer künftigen Aktivierung, nicht im Moment des
    // Ausspielens — dieselbe Lage wie bei Elixir of Immortality, deren
    // Kommentar den Grund ausführt.
    alwaysCommit: true,
  },
};
