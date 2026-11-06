// ═══════════════════════════════════════════
//  CARD EFFECT: "Invisibility Cloak"
//  Artifact (Reaction) — Cost 8
//
//  Post-target reaction: fires AFTER an
//  opponent's Attack or Spell selects exactly
//  1 target the IC owner controls, except
//  their last undefeated Hero.
//  Als Ruling (Al, QA-Welle 1 Nr. 13): „Wörtlich
//  nehmen. Cloak kann einen Hero wählen, solange
//  andere eigene Heroes leben." Ist das gewählte
//  Ziel ein Held, muss mindestens ein ANDERER
//  unbesiegter eigener Held leben (Kreaturen als
//  weitere Ziele zählen dafür NICHT). Eine Kreatur
//  als Ziel ist immer schützbar.
//
//  Negates the Attack/Spell. The protected
//  target is automatically the one that was
//  targeted. Opponent may use another Attack
//  or Spell with the same hero, but cannot
//  target the cloaked target.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/**
 * Lebt neben dem Helden (`seite`, `heroIdx`) noch ein anderer unbesiegter Held, den `pi` kontrolliert?
 * (Kontrolle statt Seite, Styx 28.9.; Kreaturen zählen nicht — Al, Welle 1 Nr. 13.)
 */
function anotherUndefeatedHero(engine, pi, seite, heroIdx) {
  for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
    if (physOwner === seite && hi === heroIdx) continue;
    if (hero.hp > 0) return true;
  }
  return false;
}

module.exports = {
  // ★ Z7b: „Negate that Spell/Attack/effect" = die gewirkte Karte löst NIE auf → ihre Einmal-Stempel werden zurückgegeben
  // (Engine: `_merkeGanzeNegation`). Teil-Negierungen („… on that Hero", Schaden) tragen das Flag nicht.
  negatesWholeCard: true,

  isPostTargetReaction: true,

  /**
   * Post-target condition:
   * - Opponent's Attack or Spell targeting exactly 1 of IC owner's targets
   * - A chosen Hero must not be the IC owner's last undefeated Hero (a Creature target is always fine)
   */
  postTargetCondition: (gs, pi, engine, targetedHeroes, sourceCard, opts) => {
    // Source must be from the opponent
    const sourceOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (sourceOwner === pi) return false;

    // Source must be an Attack or Spell — either by the source card's
    // cardType (real Attack / Spell), or by the runtime damageType
    // (Hero-effect damage tagged `'attack'` / `_spell` is "treated as"
    // the corresponding card type, e.g. Alice the Puppeteer Girl).
    // Sources with no card-DB entry (synthetic / puzzle-authored)
    // fall through to the original permissive behavior.
    const cardDB = engine._getCardDB();
    const srcData = sourceCard?.name ? cardDB[sourceCard.name] : null;
    const isAttackOrSpell = srcData
      && (hasCardType(srcData, 'Attack') || hasCardType(srcData, 'Spell'));
    const dmgType = opts?.damageType;
    const dmgTypeMatches = dmgType === 'attack' || /_spell$/.test(dmgType || '');
    // ★ Kartentyp-Filter (Als Vorgabe 21.8.: „nur Attacks und Spells,
    //   so steht es im Kartentext").
    //   Der Riegel hing bisher an `srcData &&` — eine Quelle OHNE
    //   Katalogeintrag rutschte also komplett durch. Solange nur
    //   `promptDamageTarget` das Fenster oeffnete, fiel das nicht auf;
    //   seit auch `promptEffectTarget` es oeffnet (v546), erreichen
    //   deutlich mehr Quellarten diese Stelle. Ohne Eintrag gibt es
    //   keinen Kartentyp — also keine Reaktion.
    //   `dmgTypeMatches` bleibt fuer Heldeneffekte, die ausdruecklich
    //   „als Attack gelten" (Infected Greatmaw): dort ist `srcData` die
    //   HELDENkarte, der Typ passt nicht, der Schadenstyp schon.
    // W39a: ein Effekt, der als Attack/Spell ZÄHLT (Alluring Light: Quelle = der gezwungene Held, Opferwahl ohne Schadenstyp), ist „an Attack or Spell".
    const zaehltAlsArt = !!engine._zaehltAlsArt?.(sourceCard);
    if (!srcData) return false;
    if (!isAttackOrSpell && !dmgTypeMatches && !zaehltAlsArt) return false;

    // Exactly 1 target, belonging to the IC owner
    if (targetedHeroes.length !== 1) return false;
    // Kontrolle statt Seite (Styx 28.9.): ein Held zaehlt fuer den,
    // der ihn gerade kontrolliert.
    const t0 = targetedHeroes[0];
    let t0Seite = t0.owner;
    if (t0.type === 'hero') {
      const h0 = gs.players[t0.owner]?.heroes?.[t0.heroIdx];
      if (h0) t0Seite = engine.heroSideOf(t0.owner, h0);
    }
    if (t0Seite !== pi) return false;

    // „except your last undefeated Hero": ein gewählter Held braucht einen ANDEREN lebenden eigenen Helden
    // (Al, Welle 1 Nr. 13: wörtlich; Kreaturen zählen dafür nicht). Eine Kreatur als Ziel ist immer ok.
    if (t0.type === 'hero' && !anotherUndefeatedHero(engine, pi, t0.owner, t0.heroIdx)) return false;

    return true;
  },

  /**
   * Post-target resolve: negate the spell, protect the targeted target,
   * grant opponent a replacement action.
   */
  postTargetResolve: async (engine, pi, targetedHeroes, sourceCard) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const protectedTarget = targetedHeroes[0];
    const protectedId = protectedTarget.id;

    engine.log('invisibility_cloak', {
      player: ps.username,
      protected: protectedTarget.cardName,
      negated: sourceCard?.name,
    });

    // Grant opponent a replacement action with the SAME hero
    const oppIdx = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (oppIdx < 0) return;
    const oppHeroIdx = sourceCard?.heroIdx ?? -1;
    if (oppHeroIdx < 0) return;

    const oppHero = gs.players[oppIdx]?.heroes?.[oppHeroIdx];
    if (!oppHero?.name || oppHero.hp <= 0) return;

    // Vanish animation: fade out 1s, invisible 1s, fade in 1s
    engine._broadcastEvent('play_cloak_vanish', {
      owner: pi,
      heroIdx: protectedTarget.heroIdx,
      zoneSlot: protectedTarget.type === 'equip' ? protectedTarget.slotIdx : undefined,
    });

    await engine._delay(3100);

    // ★ v1405 (Al Testbefund 25.9., Bartas + Phoenix Tackle): Die Ersatz-
    // Aktion kommt NACH der vollständigen Abwicklung des negierten Spells
    // (`queuePostChainAction`, wie Lunar Eclipse). Bis v1404 lief sie
    // mitten in dessen Auflösung: Der negierte Spell lag noch auf der
    // Hand und ließ sich ein zweites Mal wählen, und das noch gesetzte
    // Negations-Flag des äußeren Spells verhinderte Bartas' Zweitziel.
    engine.queuePostChainAction(async () => {
      const held = gs.players[oppIdx]?.heroes?.[oppHeroIdx];
      if (!held?.name || held.hp <= 0) return;
      await engine.performImmediateAction(oppIdx, oppHeroIdx, {
        title: 'Invisibility Cloak',
        description: `Use an Attack or Spell with ${held.name}. ${protectedTarget.cardName} cannot be targeted.`,
        allowedCardTypes: ['Attack', 'Spell'],
        skipAbilities: true,
        excludeTargets: [protectedId],
      });
      engine.sync();
    });
    engine.sync();

    return { effectNegated: true };
  },
};
