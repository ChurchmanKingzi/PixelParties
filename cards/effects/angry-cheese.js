// ═══════════════════════════════════════════
//  CARD EFFECT: "Angry Cheese"
//  Artifact (Normal) — Cost 4
//
//  Choose a Hero you control and deal 100
//  damage to it. Then search your deck for a
//  Destruction Magic Spell, reveal it, and add
//  it to your hand.
//
//  Sibling of Sickly Cheese (Decay Magic /
//  Poison cost) and Cute Cheese (Creature,
//  no cost). The self-damage is 'other' type so
//  it's straightforward — shields on your own
//  hero can still absorb it, same as Diamond's
//  self-damage.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { getCardDB: _getCardDB } = require('./_card-db');

/**
 * KOSTEN: 100 Schaden an dem gewählten eigenen Helden. `false` = ungültige Wahl (nichts bezahlt).
 * v845: Quelle MIT Besitzer. Ein nacktes `{ name }` hat keinen `owner`, und Tazunes „Schaden durch eigene
 * Karten"-Schild sah darin eine besitzerlose Quelle und liess die 100 durch.
 */
async function zahleKosten(engine, pi, selectedIds, validTargets) {
  const target = (validTargets || []).find(t => t.id === (selectedIds || [])[0]);
  if (!target || target.type !== 'hero') return false;
  const hero = engine.gs.players[target.owner ?? pi]?.heroes?.[target.heroIdx];   // W16e (F01-11): Brettseite des kontrollierten Helden
  if (!hero?.name || hero.hp <= 0) return false;
  await engine.actionDealDamage({ name: 'Angry Cheese', owner: pi, controller: pi }, hero, 100, 'other', { festesZiel: true });   // Selbstkosten (Als Ruling 9.10.)
  engine.sync();
  await engine._delay(400);
  return true;
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
  blockedByHandLock: true,

  canActivate(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need at least 1 living hero to take the damage cost
    const hasHero = engine?.heroesControlledBy
      ? engine.heroesControlledBy(pi).some(({ hero: h }) => h?.name && h.hp > 0)
      : (ps.heroes || []).some(h => h?.name && h.hp > 0);
    if (!hasHero) return false;
    // Must have at least 1 Destruction Magic Spell left in deck
    const cardDB = _getCardDB();
    return (ps.mainDeck || []).some(name => {
      const cd = cardDB[name];
      return cd && hasCardType(cd, 'Spell')
        && (cd.spellSchool1 === 'Destruction Magic' || cd.spellSchool2 === 'Destruction Magic');
    });
  },

  // W16e (F01-11): „a Hero you control" = Kontrolle (`heroesControlledBy`), IDs/`owner` = Brettseite.
  getValidTargets(gs, pi, engine) {
    const targets = [];
    const helden = engine?.heroesControlledBy
      ? engine.heroesControlledBy(pi)
      : (gs.players[pi].heroes || []).map((hero, heroIdx) => ({ physOwner: pi, heroIdx, hero }));
    for (const { physOwner, heroIdx: hi, hero } of helden) {
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({
        id: `hero-${physOwner}-${hi}`,
        type: 'hero', owner: physOwner, heroIdx: hi,
        cardName: hero.name,
      });
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose a Hero you control to take 100 damage, then search your deck for a Destruction Magic Spell.',
    confirmLabel: '💥🧀 Damage & Search!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection(selectedIds /*, validTargets*/) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'explosion',

  // ★ W4b (Al, Welle 4): die 100 Schaden am eigenen Helden („… to activate this card“) sind der KOSTENPUNKT und läuft VOR dem Reaktionsfenster (`payArtifactCost`,
  // Engine `_payArtifactCost`); wird die Karte danach komplett negiert (Rusty Touch, Silence …), bleibt der Preis bezahlt
  // und es wird nichts gesucht. `false` = ungültige Wahl → nichts bezahlt. Normalweg: `resolve` bekommt `kosten`.
  async payArtifactCost(engine, pi, selectedIds, validTargets) {
    return (await zahleKosten(engine, pi, selectedIds, validTargets)) ? {} : false;
  },

  async resolve(engine, pi, selectedIds, validTargets, kosten) {
    if (!selectedIds || selectedIds.length === 0) return;
    // Step 1: 100 damage to the chosen own Hero (cost) — Normalweg schon vor dem Fenster bezahlt (`kosten`).
    if (!kosten && !(await zahleKosten(engine, pi, selectedIds, validTargets))) return;

    const ps = engine.gs.players[pi];

    // Step 2: Deck search for a Destruction Magic Spell
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      const cd = cardDB[cardName];
      if (!cd || !hasCardType(cd, 'Spell')) continue;
      if (cd.spellSchool1 !== 'Destruction Magic' && cd.spellSchool2 !== 'Destruction Magic') continue;
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
      title: 'Angry Cheese',
      description: 'Choose a Destruction Magic Spell to add to your hand.',
      cancellable: false,
    });
    if (!result || !result.cardName) return;

    // Verify the chosen card is still in the deck and qualifies
    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return;
    const cd = cardDB[result.cardName];
    if (!cd || !hasCardType(cd, 'Spell')) return;
    if (cd.spellSchool1 !== 'Destruction Magic' && cd.spellSchool2 !== 'Destruction Magic') return;

    // Route through the canonical helper so the on-card-added-to-hand
    // hook fires — Cosmic Depths Analyzer / Gatherer key off this hook
    // to gain Change Counters from any opponent search effect, including
    // gated ones like the Cheese-family tutors. Manual splice + push
    // bypassed the hook entirely; using the helper keeps the visual
    // flight, opponent reveal, log entry, and instance tracking
    // identical to other tutors.
    await engine.actionAddCardFromDeckToHand(pi, result.cardName, {
      source: 'Angry Cheese',
      // v734: „a Destruction Magic Spell" — Koperniko darf ebenfalls
      // nur eine Destruction-Magic-Spell nachlegen.
      searchSpec: { label: 'Destruction Magic Spell', filter: (cd) => hasCardType(cd, 'Spell')
        && (cd.spellSchool1 === 'Destruction Magic' || cd.spellSchool2 === 'Destruction Magic') },
      reveal: true,
    });
  },
};
