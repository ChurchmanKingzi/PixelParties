// ═══════════════════════════════════════════
//  CARD EFFECT: "Thep, the Court Scribe"
//  Hero — Magic Arts / Learning, 300 HP / 30 ATK.
//
//  HERO EFFECT (1/turn): choose a "Soul Shard"
//  Creature from your discard pile that was NOT
//  sent there this turn, and place it into one of
//  this Hero's free Support Zones.
//
//  Implementation notes:
//  • "Place" is a form of summon. We route through
//    `summonCreatureWithHooks` with `_summonedFromDiscard:
//    true` so the placed Shard's discard-summon
//    trigger fires (Ka searches deck, Khet revives
//    a Creature, Ren tutors any card, Sah binds a
//    mimic, Sekhem strikes, Shut self-mills, Ba
//    grants a second Action, Ib heals).
//  • The "not sent there this turn" rule is gated
//    EXACTLY per discard entry (Welle 13, Al Rueckfrage 6:
//    „Ja, unbedingt auf Instanz umstellen" — wie die
//    Teal Fishing Rod): `engine.ablageAlteEintraege(pi)`
//    liefert je Ablage-Eintrag, ob er zu Zugbeginn schon
//    dort lag und seither nicht herausgenommen und neu
//    hineingelegt wurde. Nur solche Eintraege sind
//    waehlbar; gleichnamige, in diesem Zug abgelegte
//    Kopien zaehlen nicht. Gelegt wird genau ein alter
//    Eintrag (Index), nicht "die erste Kopie".
//  • The Shard's per-name 1/turn cap (shared
//    `canSummonSoulShard`) STILL applies — Thep's
//    placement is still a summon, so Necromancy /
//    hand-play / placement of the same Shard
//    earlier in the turn blocks it.
// ═══════════════════════════════════════════

const {
  isSoulShard, SOUL_SHARD_PILE_FUEL,
} = require('./_soul-shards-shared');

const CARD_NAME = 'Thep, the Court Scribe';

/** W63a: Zonen von Thep fuer `name` — freie, und mit Alice-Teilung die Zone einer GLEICHNAMIGEN Soul Shard (geteilte zuerst; `engine.beschwoerZonenFuer`). */
function zonenFuer(engine, pi, feld, heroIdx, name) {
  return engine.beschwoerZonenFuer(pi, name, { seite: feld, heroIdx, nurBasis: true, namedHeroesOnly: true });
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // Thep IS a Soul-Shard reanimator: while she's alive (zone === 'hero',
  // weight 1.0 from SOUL_SHARD_PILE_FUEL.presenceWeights), every Soul
  // Shard already in her controller's discard pile is worth its
  // discardValue toward eval. Drives the brain to seed discard with
  // Shards via Magenta / Shut / Ren / Book of Doom on its own Shards
  // even when no Shard is on the board yet — a living Thep is a
  // standing reanimation engine on her own.
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;
    // Kontrolle statt Seite (Styx 28.9.): physische Seite des Helden
    const feld = ctx.cardHeroOwner ?? pi;

    // Need at least one free Support Zone on Thep — W63a (Al, 22.10.2026): oder, mit Alice-Teilung, die Zone einer GLEICHNAMIGEN Soul Shard (je Name geprueft).
    // Need at least one Soul Shard in own discard whose name was
    // already there at turn start (i.e. not sent there THIS turn).
    const alt = engine.ablageAlteEintraege(pi);   // W13 (Al, Rueckfrage 6): exakt je Ablage-Instanz
    for (const [i, name] of (ps.discardPile || []).entries()) {
      if (!isSoulShard(name)) continue;
      if (!alt[i]) continue;
      // Per-name 1/turn cap — Thep's placement still goes through
      // canSummonSoulShard, so re-summoning a Shard already played
      // this turn would fizzle. Filter here so the picker never
      // surfaces a fizzling option.
      if (ps._soulShardSummonedThisTurn?.[name]) continue;
      if (zonenFuer(engine, pi, feld, heroIdx, name).length === 0) continue;
      return true;
    }
    return false;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    // Kontrolle statt Seite (Styx 28.9.): physische Seite des Helden
    const feld = ctx.cardHeroOwner ?? pi;
    const hero = gs.players[feld]?.heroes?.[heroIdx];
    if (!ps || !hero?.name) return false;

    // Thep's free Support Zones — placement target (W63a: je Karte, frei oder — Alice-Teilung — geteilt).
    // Build a deduped gallery of eligible Soul Shard names from the
    // own discard pile. "Eligible" = was already in the discard at
    // turn start AND not blocked by the per-name 1/turn cap.
    const alt = engine.ablageAlteEintraege(pi);   // W13 (Al, Rueckfrage 6): exakt je Ablage-Instanz
    const summonedThisTurn = ps._soulShardSummonedThisTurn || {};
    const counts = {};
    for (const [i, name] of ps.discardPile.entries()) {
      if (!isSoulShard(name)) continue;
      if (!alt[i]) continue;
      if (summonedThisTurn[name]) continue;
      if (zonenFuer(engine, pi, feld, heroIdx, name).length === 0) continue;
      counts[name] = (counts[name] || 0) + 1;
    }
    const gallery = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'discard', count }));
    if (gallery.length === 0) return false;

    const pick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Choose a Soul Shard Creature in your discard pile (one that was not sent there this turn) to place into one of this Hero\'s free Support Zones.',
      cancellable: true,
    });
    if (!pick || pick.cancelled || !pick.cardName) return false;
    const chosenName = pick.cardName;

    // Re-validate against the live state (the prompt could have
    // resolved after another effect changed the discard contents).
    if (!isSoulShard(chosenName)) return false;
    if (summonedThisTurn[chosenName]) return false;
    const altJetzt = engine.ablageAlteEintraege(pi);
    const ablageIdx = ps.discardPile.findIndex((n, i) => n === chosenName && altJetzt[i]);
    if (ablageIdx < 0) return false;

    // Pick a free slot on Thep. Auto-resolves if only one is open.
    // W63a (Al, 22.10.2026): erst die geteilte Zone (gleichnamige Soul Shard, Alice), DANN die freien; bei mehreren waehlt der Spieler.
    const freeSlots = zonenFuer(engine, pi, feld, heroIdx, chosenName);
    if (freeSlots.length === 0) return false;
    let chosenSlot;
    if (freeSlots.length === 1) {
      chosenSlot = freeSlots[0].slotIdx;
    } else {
      const zoneOptions = freeSlots.map(z => ({
        heroIdx, slotIdx: z.slotIdx,
        ...(feld !== pi ? { owner: feld, ownerIdx: feld } : {}),   // Kontrolle statt Seite (Styx 28.9.)
        label: `${hero.name} — Support ${z.slotIdx + 1}${z.shared ? ` (×${z.stackDepth})` : ''}`,
        ...(z.shared ? { shared: true, stackDepth: z.stackDepth } : {}),
      }));
      const zp = await ctx.promptZonePick(zoneOptions, {
        title: CARD_NAME,
        description: `Place ${chosenName} into which Support Zone?`,
        cancellable: true,
      });
      if (!zp) return false;
      chosenSlot = zp.slotIdx;
    }

    // Splice the chosen copy out of the discard pile, then place via
    // the canonical summon helper so the Shard's full on-summon-from-
    // discard hooks fire (Ka searches deck, Khet revives, etc.).
    // `_summonedFromDiscard: true` is the discard-trigger flag every
    // Shard reads in its onPlay gate.
    // v1389: über die EINE Ablage-Stelle — Platzieren gilt als
    // „summoned from discard" (Als Ruling 25.9.), die Soul Shards lösen aus.
    const placeRes = await engine.summonFromDiscard(pi, pi, ablageIdx, heroIdx, chosenSlot, {   // W13: genau dieser alte Eintrag
      source: CARD_NAME, flug: false,
      summonOpts: { isPlacement: true },
      hookExtras: { _isNormalSummon: false },
      ...(feld !== pi ? { heldSeite: feld } : {}),   // Kontrolle statt Seite (Styx 28.9.)
    });
    if (!placeRes) {
      // W13: scheiterte das Legen, geht die Karte an ihren Platz zurueck — dann bleibt sie ein ALTER Eintrag (sonst stempelt der Rueckweg „in diesem Zug").
      if (ps.discardPile[ablageIdx] === chosenName && Array.isArray(ps._ablageStamps) && ps._ablageStamps.length === ps.discardPile.length) ps._ablageStamps[ablageIdx] = -1;
      return false;
    }

    // Standard summon glow on the placement zone.
    engine._broadcastEvent('summon_effect', {
      owner: feld, heroIdx, zoneSlot: placeRes.actualSlot, cardName: chosenName,
    });

    engine.log('thep_revive', {
      player: ps.username, revived: chosenName,
      heroIdx, zoneSlot: placeRes.actualSlot,
    });
    engine.sync();
    return true;
  },
};
