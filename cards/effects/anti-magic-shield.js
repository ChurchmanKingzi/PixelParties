// ═══════════════════════════════════════════
//  CARD EFFECT: "Anti Magic Shield"
//  Spell (Post-Target Reaction) — Magic Arts Lv1
//  When a hero that can use this is targeted by
//  an opponent's Spell whose level <= that hero's
//  Magic Arts level, negate the Spell entirely.
// ═══════════════════════════════════════════

module.exports = {
  // ★ Z7b: „Negate that Spell/Attack/effect" = die gewirkte Karte löst NIE auf → ihre Einmal-Stempel werden zurückgegeben
  // (Engine: `_merkeGanzeNegation`). Teil-Negierungen („… on that Hero", Schaden) tragen das Flag nicht.
  negatesWholeCard: true,

  isPostTargetReaction: true,

  /**
   * Condition: source is opponent's Spell (or Hero-effect damage
   * "treated as a Spell" via a `_spell`-typed damageType), at least
   * one targeted hero belongs to Shield's owner AND can cast it AND
   * has Magic Arts >= spell level. For Hero-effect "Spell"s the
   * "spell level" defaults to 0 (no card-spec level to read), so
   * the level gate degenerates to "Magic Arts ≥ 0" = always true.
   */
  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard, opts) {
    if (!targetedHeroes || targetedHeroes.length === 0) return false;

    // Source must be an opponent's card
    const srcOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (srcOwner === pi) return false;

    // Source must be a Spell (real card) OR Spell-typed damage from
    // a Hero effect (Alice the Puppeteer Girl etc.).
    const cardDB = engine._getCardDB();
    const srcData = cardDB[sourceCard?.name];
    const isSpellCard = srcData?.cardType === 'Spell';
    const dmgType = opts?.damageType;
    const isSpellDamageType = /_spell$/.test(dmgType || '');
    if (!isSpellCard && !isSpellDamageType) return false;

    // W32a (Al, 22.10.2026): ein Heldeneffekt, der als Spell zählt (Alice), hat als Stufe das ABILITY-LEVEL seines Helden (Destruction Magic) — nicht mehr fix 0.
    const spellLevel = isSpellCard ? (srcData.level || 0) : (engine._heldenEffektStufe?.(sourceCard?.name, dmgType, sourceCard) ?? 0);

    // At least one targeted hero must belong to this player
    // AND have Magic Arts level >= spell level
    const ps = gs.players[pi];
    if (!ps) return false;
    const amsData = cardDB['Anti Magic Shield'];

    for (const tgt of targetedHeroes) {
      // W20c (Al 20.10.: alle Reactions ueber jeden kontrollierten Helden): „a Hero that can use this Spell is hit" — auch ein von `pi`
      // uebernommener Held der Gegenspalte (Brettseite `tgt.owner`), mit SEINEN Ability Zones; Hand/Rabatte des Kontrolleurs `pi`.
      if (tgt.type !== 'hero' || engine.zielSeite(tgt) !== pi) continue;
      const hi = tgt.heroIdx;
      const seite = tgt.owner;
      const hero = gs.players[seite]?.heroes?.[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;   // W13 (Al, A2): `negated` sperrt die Reaktion nicht mehr

      // Must meet Shield's own level req (Magic Arts Lv1)
      if (!engine.heroMeetsLevelReq(seite, hi, amsData, seite !== pi ? { levelSourcePi: pi } : undefined)) continue;

      // Magic Arts-Stufe des Helden ueber den Engine-Helfer (W24a, N1-15): zaehlt auch Abilities in Support Zones (Xal), Performance-Joker und die
      // Negations-Blankung — vorher eine eigene Zaehlung nur ueber die Ability Zones.
      const maLevel = engine.effectiveSchoolLevelForCaster('Magic Arts', pi, hi, seite);

      if (maLevel >= spellLevel) return true;
    }
    return false;
  },

  /**
   * Resolve: negate the effect, play bubble animation on targeted heroes.
   */
  async postTargetResolve(engine, pi, targetedHeroes, sourceCard) {
    const gs = engine.gs;
    const ps = gs.players[pi];

    // Bubble animation on all targeted heroes belonging to this player
    for (const tgt of (targetedHeroes || [])) {
      if (tgt.type !== 'hero') continue;
      engine._broadcastEvent('anti_magic_bubble', { owner: tgt.owner, heroIdx: tgt.heroIdx });
    }
    await engine._delay(600);

    engine.log('anti_magic_shield', {
      player: ps?.username,
      negated: sourceCard?.name || 'a Spell',
    });

    engine.sync();

    // Negate the entire effect
    return { effectNegated: true };
  },
};
