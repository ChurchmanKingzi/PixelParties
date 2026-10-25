// ═══════════════════════════════════════════
//  CARD EFFECT: "Ladder to the Sky"
//  Artifact (Normal, Cost 10)
//
//  "Sacrifice a Creature you control that was not summoned this turn to
//   play this card. At the beginning of your next turn, you may search
//   your deck for a Creature whose level is up to 1 higher than that of
//   the sacrificed Creature and place it into a free Support Zone of any
//   Hero you control. That Creature may use its once per turn effect the
//   turn it's summoned."
//
//  ── Eligibility (Garius / Xuanwu pattern) ──
//  Deck candidates are filtered to Creatures summonable under their own
//  `canSummon` conditions for some living Hero (Sparkfly Queen needs
//  Hive's Crown active, per-Hero archetype rules, etc.) via the engine's
//  `isCreatureSummonable` — the same gate Garius / Cardinal Beast Xuanwu
//  use. Tribute-summon Creatures keep their cost: it's paid by their own
//  `beforeSummon` when placed (placement uses `isPlacement: true`), and
//  the deck card is refunded if the player can't / won't pay.
//  A board Creature can only be sacrificed for Ladder if sacrificing it
//  yields ≥1 such deck replacement (level ≤ its level + 1); if NO
//  Creature has an eligible replacement, Ladder can't be activated.
//
//  ── Delayed effect ──
//  The played card is re-zoned to the discard pile but kept TRACKED
//  (`activeIn: ['discard']`) so its `onTurnStart` runs the search at the
//  start of the controller's NEXT turn, with haste on the placed
//  Creature. (TEST_IMMEDIATE below resolves it on play for testing.)
// ═══════════════════════════════════════════

const { hasCardType, isSummonablePileCreature } = require('./_hooks');

const CARD_NAME = 'Ladder to the Sky';

// When true, the deck-search + place resolves IMMEDIATELY on play
// instead of "at the beginning of your next turn" (testing only).
const TEST_IMMEDIATE = false;

/** Is `name` summonable (canSummon conditions met) for some living Hero?
 *  The same gate Garius / Xuanwu use — Sparkfly Queen et al. are excluded
 *  when their condition isn't met; tribute Creatures pass here and pay
 *  their cost via `beforeSummon` at placement. */
function summonableForSomeHero(engine, pi, name) {
  // Kontrolle statt Seite (Styx 28.9.): „any Hero you control" — auch
  // uebernommene Helden der Gegenspalte, geprueft ueber ihre physische Adresse.
  for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
    if (!hero?.name || hero.hp <= 0) continue;
    if (engine.isCreatureSummonable(name, physOwner, hi)) return true;
  }
  return false;
}

/** Distinct deck Creatures eligible for placement at level ≤ maxLevel. */
function buildLadderGallery(engine, pi, maxLevel) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  for (const cn of (ps?.mainDeck || [])) {
    if (seen.has(cn)) continue;
    const cd = cardDB[cn];
    if (!cd || !isSummonablePileCreature(cd, cn)) continue;
    if (hasCardType(cd, 'Token') || cd.subtype === 'Token') continue;
    // `pileSide: 'deck'` so "level in your hand" reducers (Ruin Mourner)
    // don't apply to a deck Creature.
    const effLvl = engine.effectiveCardLevel(cd, pi, { pileSide: 'deck' });
    if (effLvl > maxLevel) continue;
    if (!summonableForSomeHero(engine, pi, cn)) continue;
    seen.add(cn);
    out.push({ name: cn, source: 'deck', level: effLvl });
  }
  out.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
  return out;
}

/** Sacrifice-cost filter: a board Creature not summoned this turn whose
 *  level yields ≥1 eligible deck replacement. */
function ladderSacrificeFilter(engine, pi) {
  const turn = engine.gs.turn;
  return (c) => {
    if (c.inst.turnPlayed === turn) return false;
    if (!c.hasLevel) return false;   // "1 higher than that of the sacrificed Creature": Artifact Creatures haben kein Level (Als Ruling 9.10.)
    return buildLadderGallery(engine, pi, (c.level || 0) + 1).length > 0;
  };
}

/** Next-turn (or test-immediate) deck search → place a Creature with haste. */
async function doLadderSearch(engine, pi, sacLevel) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return;
  const maxLevel = (sacLevel || 0) + 1;

  // Free Support Zone under any living Hero you control.
  // Kontrolle statt Seite (Styx 28.9.): jede Zone traegt `owner` (physische Seite).
  // W62a: je Karte — mit Alice-Teilung zaehlt auch die Zone einer GLEICHNAMIGEN Creature (`beschwoerZonenFuer`).
  const zonenOpts = { nachKontrolle: true, livingHeroesOnly: true, source: CARD_NAME };
  const gallery = buildLadderGallery(engine, pi, maxLevel).filter(e => engine.hatBeschwoerZone(pi, e.name, zonenOpts));
  if (gallery.length === 0) return;

  // "you MAY search" — optional.
  const pick = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: gallery,
    title: CARD_NAME,
    description: `Search your deck for a Creature (level ${maxLevel} or lower) to place into a free Support Zone.`,
    confirmLabel: '🪜 Summon!',
    cancellable: true,
  });
  if (!pick || pick.cancelled || !pick.cardName) return;
  const chosenName = pick.cardName;
  if ((ps.mainDeck || []).indexOf(chosenName) < 0) return;

  // Zones where this Creature is actually summonable (per-Hero canSummon).
  const placeable = engine.beschwoerZonenFuer(pi, chosenName, zonenOpts).filter(z => engine.isCreatureSummonable(chosenName, z.owner, z.heroIdx));
  if (placeable.length === 0) return;

  let dest = placeable[0];
  if (placeable.length > 1) {
    const zr = await engine.promptGeneric(pi, {
      type: 'zonePick',
      title: CARD_NAME,
      description: `Place ${chosenName} into which Support Zone?`,
      zones: placeable,
      cancellable: true,
    });
    if (!zr || zr.cancelled) return;
    // Kontrolle statt Seite (Styx 28.9.): gewaehlte Zone samt `owner`.
    // Antwort ohne `owner` (generische CPU) → erste passende Zone.
    const gleich = z => z.heroIdx === zr.heroIdx && z.slotIdx === zr.slotIdx;
    dest = placeable.find(z => gleich(z) && z.owner === (zr.owner ?? pi))
      || (zr.owner == null ? placeable.find(gleich) : null);
    if (!dest) return;
  }

  const _taken_deckIdx = await engine.deckEntnahme(ps,  chosenName, { source: CARD_NAME, shuffle: true });   // v820: Stapel-Schicht
  if (!_taken_deckIdx) return;

  const res = await engine.summonCreatureWithHooks(
    chosenName, dest.owner, dest.heroIdx, dest.slotIdx,
    { source: CARD_NAME, isPlacement: true, hookExtras: engine.deckHookExtras(),   // v1393
      controller: pi },   // Kontrolle statt Seite (Styx 28.9.): Feldseite + Kontrolleur
  );
  if (!res?.inst) {
    engine.returnToPile(ps, 'deck', chosenName);
    engine.shuffleDeck(pi);
    return;
  }
  // Haste — may use its once-per-turn effect the turn it's summoned.
  if (!res.inst.counters) res.inst.counters = {};
  res.inst.counters._hasHaste = true;

  // ── Flashy "Ladder to the Sky" summon — golden holy light rising
  //    skyward + a gold sparkle burst on the placed Creature (on top of
  //    the default summon glow). ──
  engine._broadcastEvent('play_zone_animation', {
    type: 'holy_revival', owner: dest.owner, heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx,
  });
  engine._broadcastEvent('play_zone_animation', {
    type: 'gold_sparkle', owner: dest.owner, heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx,
  });
  await engine._delay(600);

  engine.log('ladder_to_sky_summon', { player: ps.username, summoned: chosenName, maxLevel });
  engine.sync();
}

/**
 * KOSTEN: genau eine Kreatur opfern (nicht in diesem Zug beschworen, mit passendem Deck-Ersatz).
 * Rückgabe: Level des Opfers, `null` = abgebrochen / gerettet (nichts bezahlt).
 */
async function zahleOpfer(engine, pi) {
  let sacLevel = 0;
  const shimCtx = { cardOwner: pi, card: { id: null }, cardName: CARD_NAME, cardHeroIdx: -1 };
  const paid = await engine.resolveSacrificeCost(shimCtx, {
    minCount: 1,
    maxCount: 1,
    title: `${CARD_NAME} — Sacrifice`,
    description: 'Sacrifice 1 of your Creatures (not summoned this turn, with an eligible deck replacement) to play Ladder to the Sky.',
    confirmLabel: '🗡️ Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: true,
    filter: ladderSacrificeFilter(engine, pi),
    onResolved: (_ctx, picked) => { sacLevel = picked?.[0]?._meta?.level ?? 0; },
  });
  return paid ? sacLevel : null;
}

module.exports = {
  // ★ W66a: KEIN Ablage-Träger mehr. Der verzögerte Teil ("At the beginning of your next turn …") hängt am SPIELER (`ps._ladderPending`), nicht an der Artefakt-Instanz in der Ablage —
  // verließ die Karte die Ablage vor dem nächsten Zug (Meditation, Magic Sapphire …), ging die Suche verloren. Die Engine ruft `nachholen` nach den Zugbeginn-Hooks (Bug-Klasse, Hand-of-Death-Audit).

  // Playable only while a Creature not summoned this turn has an eligible
  // deck replacement (Gold is gated by the handler).
  canActivate(gs, pi, engine) {
    const filt = ladderSacrificeFilter(engine, pi);
    return engine.getSacrificableCreatures(pi).some(c => filt(c));
  },

  // ★ W4b (Al, Welle 4): das Opfer ist der KOSTENPUNKT („… to play this card") und läuft VOR dem Reaktionsfenster
  // (`payArtifactCost`, Engine `_payArtifactCost`); wird das Artefakt danach komplett negiert (Rusty Touch, Silence …),
  // bleibt die Kreatur geopfert und es wird nichts scharfgestellt. `false` = Opferwahl abgebrochen (nichts bezahlt):
  // die Karte bleibt auf der Hand, kein Gold.
  async payArtifactCost(engine, pi) {
    const sacLevel = await zahleOpfer(engine, pi);
    return sacLevel == null ? false : { sacLevel };
  },

  async resolve(engine, pi, selectedIds, validTargets, kosten) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // ── Pay the sacrifice cost; record the tribute's level. Only
    //    Creatures that have an eligible deck replacement are offered. ──
    // (Normalweg: schon vor dem Fenster bezahlt, `kosten`; sonst — z. B. Gratis-Spiel durch Sky Archeologist — jetzt.)
    const sacLevel = kosten ? kosten.sacLevel : await zahleOpfer(engine, pi);
    // Cancel → card stays in hand, no Gold spent.
    if (sacLevel == null) return { cancelled: true };

    engine.log('ladder_to_sky_played', { player: ps.username, sacrificedLevel: sacLevel });

    // ⚠️ TEST: resolve the next-turn effect right now. The card goes to
    // discard normally (no delayed arming / re-zone).
    if (TEST_IMMEDIATE) {
      await doLadderSearch(engine, pi, sacLevel);
      engine.sync();
      return;
    }

    // ── W66a: den verzögerten Auftrag am SPIELER merken (die Karte geht ganz normal in die Ablage; ihre Instanz ist für die Wirkung unwichtig). ──
    if (!Array.isArray(ps._ladderPending)) ps._ladderPending = [];
    ps._ladderPending.push({ level: sacLevel, armedTurn: gs.turn });
    engine.sync();
  },

  /**
   * Von der Engine nach den Zugbeginn-Hooks gerufen: jeder fällige Auftrag des AKTIVEN Spielers (Beginn SEINES nächsten Zuges, also ein späterer Zug als der des Spielens)
   * läuft genau einmal — unabhängig davon, wo die Karte liegt (Ablage, Hand, Deck, gelöscht).
   */
  async nachholen(engine) {
    const gs = engine.gs;
    for (let pi = 0; pi < engine.playerCount(); pi++) {
      const ps = gs.players[pi];
      if (!ps || !Array.isArray(ps._ladderPending) || ps._ladderPending.length === 0) continue;
      if (gs.activePlayer !== pi) continue;
      const faellig = ps._ladderPending.filter(a => gs.turn > a.armedTurn);
      if (faellig.length === 0) continue;
      ps._ladderPending = ps._ladderPending.filter(a => !(gs.turn > a.armedTurn));      // zuerst verbrauchen (kein Doppelfeuer)
      if (ps._ladderPending.length === 0) delete ps._ladderPending;
      for (const a of faellig) {
        if (gs.result) return;
        await doLadderSearch(engine, pi, a.level ?? 0);
      }
    }
  },
};
