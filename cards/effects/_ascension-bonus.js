// ═══════════════════════════════════════════
//  Shared: performAscensionBonus
//  Called from onAscensionBonus on Ascended
//  Hero scripts. Lets the player immediately
//  add copies of one (or their choice of)
//  Ability from the deck directly to the
//  ascending Hero's Ability Zone.
//
//  abilityChoices: array of ability names, e.g.
//    ['Fighting']                 → 1 option
//    ['Fighting','Summoning Magic'] → 2 options
//
//  For each name the max is 3 copies (= Lv3).
//  Fizzles silently if no slots are available
//  or none of the abilities exist in the deck.
// ═══════════════════════════════════════════

/**
 * @param {object} engine
 * @param {number} pi       - player index
 * @param {number} heroIdx  - hero column of the ascending hero
 * @param {string[]} abilityChoices - ability names offered as bonus
 */
async function performAscensionBonus(engine, pi, heroIdx, abilityChoices) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return;

  const abZones = ps.abilityZones?.[heroIdx] || [[], [], []];

  /**
   * For a given ability name, compute:
   *   - howManyCanAdd: min(deckCount, availableRoom) where room = 3 − currentLevel
   *     (or 3 if it needs a free slot — but we also need a free slot to exist)
   *   - targetSlotIdx: existing slot index or first free slot index
   */
  function calcPlacement(name) {
    const deckCount = ps.mainDeck.filter(cn => cn === name).length;
    if (deckCount === 0) return null;

    const existingIdx = abZones.findIndex(
      slot => slot.length > 0 && slot[0] === name,
    );

    if (existingIdx >= 0) {
      const room = 3 - abZones[existingIdx].length;
      if (room <= 0) return null;
      return { slotIdx: existingIdx, canAdd: Math.min(deckCount, room) };
    }

    const freeIdx = abZones.findIndex(slot => slot.length === 0);
    if (freeIdx < 0) return null;
    return { slotIdx: freeIdx, canAdd: Math.min(deckCount, 3) };
  }

  // Filter to only choices that can actually be placed
  const available = abilityChoices
    .map(name => ({ name, ...calcPlacement(name) }))
    .filter(entry => entry.slotIdx !== undefined);

  if (available.length === 0) return; // Fizzle silently

  // ── Prompt ────────────────────────────────────────────────────────────

  let chosen;

  if (available.length === 1) {
    const entry = available[0];
    const result = await engine.promptGeneric(pi, {
      type:        'optionPicker',
      title:       'Ascension Bonus',
      description: `Add up to ${entry.canAdd} ${entry.name} from your deck?`,
      options: [
        { id: 'yes',  label: `✅ Add ${entry.name}`, color: '#44bb44' },
        { id: 'skip', label: '✗ Skip',               color: '#888' },
      ],
      cancellable: false,
    });
    if (!result || result.optionId !== 'yes') return;
    chosen = entry;
  } else {
    const options = available.map(e => ({
      id: e.name, label: e.name, description: `Up to ${e.canAdd} cop${e.canAdd > 1 ? 'ies' : 'y'}`, color: '#44aaff',
    }));
    options.push({ id: 'skip', label: '✗ Skip', color: '#888' });

    const result = await engine.promptGeneric(pi, {
      type:        'optionPicker',
      title:       'Ascension Bonus',
      description: 'Choose your activation bonus!',
      options,
      cancellable: false,
    });
    if (!result || result.optionId === 'skip') return;
    chosen = available.find(e => e.name === result.optionId);
    if (!chosen) return;
  }

  const { name: abilityName, slotIdx, canAdd } = chosen;

  // ── Place abilities from deck → ability zone ──────────────────────────

  const placedInsts = [];
  for (let i = 0; i < canAdd; i++) {
    const deckIdx = ps.mainDeck.indexOf(abilityName);
    if (deckIdx < 0) break;
    ps.mainDeck.splice(deckIdx, 1);
    abZones[slotIdx].push(abilityName);
    const inst = engine._trackCard(abilityName, pi, 'ability', heroIdx, slotIdx);
    placedInsts.push(inst);
  }

  ps.abilityZones[heroIdx] = abZones;
  engine.shuffleDeck(pi);

  // Fire onPlay on each instance so passive bonuses (Fighting ATK, Toughness HP, etc.)
  // are applied exactly as if the ability had been played from hand normally.
  for (const inst of placedInsts) {
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst,
      cardName: abilityName, zone: 'ability',
      heroIdx, zoneSlot: slotIdx,
      _skipReactionCheck: true,
    });
  }

  // Animate: deck → ability zone (one card per copy, staggered)
  engine._broadcastEvent('deck_to_ability_animation', {
    owner:   pi,
    heroIdx,
    slotIdx,
    cardName: abilityName,
    count:   canAdd,
  });

  await engine._delay(canAdd * 300 + 400);

  engine.log('ascension_bonus', {
    player: ps.username, ability: abilityName, count: canAdd,
  });
  engine.sync();
}

module.exports = { performAscensionBonus };
