// ═══════════════════════════════════════════
//  CARD EFFECT: "Sickly Cheese"
//  Artifact (Normal) — Cost 4
//
//  Choose a Hero you control and inflict 1
//  Stack of Poison to it. Then search your
//  deck for a Decay Magic Spell, reveal it
//  and add it to your hand.
//
//  Cannot be used if no Decay Magic Spells
//  remain in the deck.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { getCardDB: _getCardDB } = require('./_card-db');

/** KOSTEN: 1 Stack Poison auf den gewählten eigenen Helden. `false` = ungültige Wahl (nichts bezahlt). */
async function zahleKosten(engine, pi, selectedIds, validTargets) {
  const target = (validTargets || []).find(t => t.id === (selectedIds || [])[0]);
  if (!target || target.type !== 'hero') return false;
  const hero = engine.gs.players[target.owner ?? pi]?.heroes?.[target.heroIdx];   // W28a: Brettseite des (kontrollierten) Helden
  if (!hero?.name || hero.hp <= 0) return false;
  await engine.addHeroStatus(target.owner ?? pi, target.heroIdx, 'poisoned', {
    addStacks: 1, appliedBy: pi,
  });
  engine.log('poison_applied', {
    target: hero.name, stacks: 1, by: 'Sickly Cheese',
  });
  engine.sync();
  await engine._delay(400);
  return true;
}

/**
 * Eigene lebende Helden als Kostenziel. W7b (F03-12): ein Held, der den Giftstapel nicht annehmen wuerde (giftimmun,
 * `negative_status_immune`, Johanna/Light-Ball-Schutz, Shielded …), ist `ineligible` (ausgegraut, serverseitig nicht waehlbar).
 */
function getValidTargets(gs, pi, engine) {
  // W28a (Al, 21.10.2026: „'you control' = aktuelle Kontrolle, nicht Besitzer"): „a Hero you control" = `getControlledHeroTargets` (abgegebener eigener Held nein,
  // uebernommener Gegnerheld ja; `owner` = Brettseite).
  const targets = engine ? engine.getControlledHeroTargets(pi) : (gs.players[pi].heroes || []).map((hero, hi) => ({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: hero?.name })).filter(t => t.cardName && gs.players[pi].heroes[t.heroIdx].hp > 0);
  for (const t of targets) {
    // W33a (Al, 22.10.2026, ersetzt die W31a-Ausnahme `ohneCharme`): „Sickly Cheese kann spezifisch NUR aktiviert werden, wenn das Ziel vergiftbar ist, also in beiden Fällen
    // unspielbar." Ein Ziel, das den Giftstapel (die Kosten) nicht annähme, ist `ineligible`: echte Giftimmunität (W7b) UND der Charme-Schutz eines temporär übernommenen Helden
    // (`heroBlocksStatusNow` ohne `ohneCharme`). Gilt NUR für diese Karte; Torchure, The Yeeting, Mana Absorbing Crystal, Experimental Potion, Angry Cheese bieten den
    // temporär übernommenen Helden weiter an (W31a). Ist kein Ziel vergiftbar, ist die Karte unspielbar (`canActivate`).
    if (engine && engine.heroBlocksStatusNow(t.owner, t.heroIdx, 'poisoned', { appliedBy: pi })) t.ineligible = true;
  }
  return targets;
}

module.exports = {
  // ★ v1070 (Als Befund 14.9.: „Wieso drei Cheese-Karten? Davon gibt es
  // sechs!"). Die Autoerkennung liess diese Karte als spielbar durch,
  // weil sie neben der Suche noch etwas anderes tut — bei ihr ist das
  // aber eine KOSTE bzw. ein NACHTEIL, kein zweiter Ertrag. Unter der
  // Such-Sperre zahlt man also und bekommt nichts. Handgesetzt, weil
  // ein rein syntaktischer Erkenner Kosten nicht von Ertrag
  // unterscheiden kann; das manuelle Flag gewinnt im Loader.
  blockedBySearchLock: true,
  isTargetingArtifact: true,
  // Tutors a Decay Magic Spell into hand — blocked while hand-locked.
  blockedByHandLock: true,

  canActivate(gs, pi, engine) {
    // Must have at least 1 living hero under control
    const ps = gs.players[pi];
    const hasHero = engine ? engine.getControlledHeroTargets(pi).length > 0 : (ps.heroes || []).some(h => h?.name && h.hp > 0);   // W28a: kontrollierte Helden
    if (!hasHero) return false;
    // ★ W7b (F03-12, Al 14.10.): „Giftimmun macht ein Ziel ineligible" - die Karte ist nur gesperrt, wenn es GAR KEIN
    // waehlbares Ziel gibt, d. h. kein lebender Held, der den Giftstapel (die Kosten) annehmen wuerde.
    if (engine && !getValidTargets(gs, pi, engine).some(t => !t.ineligible)) return false;

    // Must have at least 1 Decay Magic Spell in deck
    const cardDB = _getCardDB();
    return (ps.mainDeck || []).some(name => {
      const cd = cardDB[name];
      return cd && hasCardType(cd, 'Spell')
        && (cd.spellSchool1 === 'Decay Magic' || cd.spellSchool2 === 'Decay Magic');
    });
  },

  getValidTargets(gs, pi, engine) {
    return getValidTargets(gs, pi, engine);
  },

  targetingConfig: {
    description: 'Choose a Hero you control to Poison (1 Stack), then search your deck for a Decay Magic Spell.',
    confirmLabel: '☠️🧀 Poison & Search!',
    confirmClass: 'btn-danger',
    cancellable: true,
    greenSelect: false,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
    // CPU hint: this is a self-poison card. The brain's target picker
    // routes through cpuStatusSelfValue so Fiona / Stellan get hit first
    // (both benefit from a negative status) and Layn gets avoided. If no
    // beneficiary is present the picker still picks something so the
    // deck-search payoff isn't skipped.
    appliesStatus: 'poisoned',
  },

  validateSelection(selectedIds, validTargets) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'poison_vial',

  // ★ W4b (Al, Welle 4): der Giftstapel am eigenen Helden („… to play this card“) ist der KOSTENPUNKT und läuft VOR dem Reaktionsfenster (`payArtifactCost`,
  // Engine `_payArtifactCost`); wird die Karte danach komplett negiert (Rusty Touch, Silence …), bleibt der Preis bezahlt
  // und es wird nichts gesucht. `false` = ungültige Wahl → nichts bezahlt. Normalweg: `resolve` bekommt `kosten`.
  async payArtifactCost(engine, pi, selectedIds, validTargets) {
    return (await zahleKosten(engine, pi, selectedIds, validTargets)) ? {} : false;
  },

  async resolve(engine, pi, selectedIds, validTargets, kosten) {
    if (!selectedIds || selectedIds.length === 0) return;
    // Step 1: 1 Stack Poison auf den gewählten eigenen Helden (cost) — Normalweg schon vor dem Fenster bezahlt (`kosten`).
    if (!kosten && !(await zahleKosten(engine, pi, selectedIds, validTargets))) return;

    const ps = engine.gs.players[pi];

    // Step 2: Deck search for Decay Magic Spells
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      const cd = cardDB[cardName];
      if (!cd || !hasCardType(cd, 'Spell')) continue;
      if (cd.spellSchool1 !== 'Decay Magic' && cd.spellSchool2 !== 'Decay Magic') continue;
      countMap[cardName] = (countMap[cardName] || 0) + 1;
    }

    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) return;

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
        searchToHand: true,   // v1118: Suche AUF DIE HAND
      cards: galleryCards,
      title: 'Sickly Cheese',
      description: 'Choose a Decay Magic Spell to add to your hand.',
      cancellable: false,
    });

    if (!result || !result.cardName) return;

    // Verify the chosen card is actually in the deck and qualifies
    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return;
    const cd = cardDB[result.cardName];
    if (!cd || !hasCardType(cd, 'Spell')) return;
    if (cd.spellSchool1 !== 'Decay Magic' && cd.spellSchool2 !== 'Decay Magic') return;

    // Route through the canonical helper so on-card-added-to-hand
    // fires — Cosmic Depths Analyzer / Gatherer key off this hook to
    // gain Change Counters from any opponent search effect, including
    // Cheese-family tutors. Helper handles deck splice, hand push,
    // instance tracking, deck-search animation, log entry,
    // ON_CARD_ADDED_TO_HAND hook, and the opponent reveal prompt.
    await engine.actionAddCardFromDeckToHand(pi, result.cardName, {
      source: 'Sickly Cheese',
      // v734: „a Decay Magic Spell".
      searchSpec: { label: 'Decay Magic Spell', filter: (cd) => hasCardType(cd, 'Spell')
        && (cd.spellSchool1 === 'Decay Magic' || cd.spellSchool2 === 'Decay Magic') },
      reveal: true,
    });
  },
};
