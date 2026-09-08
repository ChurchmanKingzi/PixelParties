// ═══════════════════════════════════════════
//  CARD EFFECT: „Land Sharks"
//  Creature (Normal, Lv 1, Summoning Magic) — 100 HP, kein ATK
//
//  „This Creature occupies 3 Support Zones. You may once per turn
//   choose up to 1/2/3 targets on the board, depending on the
//   corresponding Hero's current Summoning Magic level, and deal 100
//   damage to them."
//
//  ── ZWEI VORHANDENE BAUFORMEN ──────────────────────────────────────
//  • Mehrzonen-Belegung: `_multizone-shared.js` (mit „Populated Island
//    Turtle" geteilt). Alle drei Plaetze des Gastgebers muessen frei
//    sein; die uebrigen zwei bekommen den `_ZoneBlocked`-Platzhalter.
//  • Mehrfachziel-Schaden: `promptMultiTarget` wie bei „Mr. Jiggles" —
//    nur `side: 'any'` statt `'enemy'` und ein dynamisches Maximum.
//  • Bild: `shark_bite` — ein Haigebiss schnappt auf JEDEM getroffenen
//    Ziel zu, alle gleichzeitig (Als Vorgabe 5.9.). Gebaut nach dem
//    Schlangenbiss von Guardian Beast She, der dieselbe
//    Gleichzeitigkeit braucht. Klang: `slash` tiefer gefahren,
//    Eintrag in `ZONE_ANIM_SFX`.
//
//  ── ALS RULINGS (5.9.) ─────────────────────────────────────────────
//  • Die Zielzahl folgt der ALLGEMEINEN Skalierungsregel
//    (`scaledByLevel`): Summoning Magic 0 → 1 Ziel (kleinster
//    angegebener Wert), Stufe 4+ → 3 Ziele (groesster). Nie null.
//  • Ist der Gastgeber-Held besiegt, zaehlt seine Stufe WEITER — die
//    Abilities liegen ja noch in seinen Zonen. Das passt zur
//    Grundregel, dass Kreaturen von ihrem Platzhelden unabhaengig sind.
//
//  ── AUSLEGUNGEN ────────────────────────────────────────────────────
//  • „targets on the board" heisst BEIDE Seiten, Helden wie Kreaturen —
//    der bewusste Gegensatz zu Mr. Jiggles' „your opponent controls".
//  • „up to" heisst, man darf weniger nehmen; ein Abbruch verbraucht
//    die Rundennutzung nicht (Standard-HOPT des Creature-Effekts).
//  • 100 Schaden je Ziel, ganz normal reduzier- und negierbar.
//  • Massgeblich ist der Held, in dessen Zonen die Kreatur sitzt.
// ═══════════════════════════════════════════

const { heroAbilityLevel, scaledByLevel } = require('./_hooks');
const multizone = require('./_multizone-shared');

const CARD_NAME = 'Land Sharks';
const DAMAGE = 100;
const ZIELE_JE_STUFE = [1, 2, 3];
const SCHULE = 'Summoning Magic';

/** Wie viele Ziele darf dieser Einsatz nehmen? */
function zielzahl(engine, pi, heroIdx) {
  const stufe = heroAbilityLevel(engine, pi, heroIdx, SCHULE);
  return scaledByLevel(stufe, ZIELE_JE_STUFE);
}

module.exports = {
  activeIn: ['support'],

  /**
   * Wie viele Support Zones diese Kreatur einnimmt. Gelesen von
   * `_multizone-shared.handleIslandRemoval`, um beim Wegfall einer
   * Inselzone zu erkennen, dass hier umgeschichtet statt getoetet wird.
   */
  multiZone: 3,

  /** Alle drei Plaetze des Gastgebers muessen frei sein. */
  canSummon(ctx) {
    return multizone.canSummonMultiZone(ctx, CARD_NAME);
  },

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    // Immer aktivierbar: die Zielzahl faellt nie unter 1 (Als
    // Skalierungsregel), und ob es gerade ein Ziel auf dem Brett gibt,
    // entscheidet der Prompt — es gibt immer mindestens die Helden.
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const max = zielzahl(engine, pi, heroIdx);

    const targets = await ctx.promptMultiTarget({
      types: ['hero', 'creature'],
      side: 'any',
      max,
      min: 1,
      baseDamage: DAMAGE,
      title: CARD_NAME,
      description: `Deal ${DAMAGE} damage to up to ${max} target${max === 1 ? '' : 's'} on the board (${SCHULE} ${heroAbilityLevel(engine, pi, heroIdx, SCHULE)}).`,
      confirmLabel: `🦈 ${DAMAGE} each!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!targets || targets.length === 0) return false;

    // ── HAIGEBISSE, GLEICHZEITIG (Als Vorgabe 5.9.) ────────────────
    // Alle Bisse gehen in EINEM Rahmen los — kein await dazwischen —,
    // danach EIN gemeinsamer Takt, bevor der Schaden faellt. Bei drei
    // Zielen schnappen also drei Gebisse zugleich zu, statt der Reihe
    // nach. Dieselbe Bauform wie beim Schlangenbiss von Guardian
    // Beast She.
    //
    // Die Wartezeit trifft den Biss-Moment: ~310 ms im Keyframe plus
    // die 100 ms Vorlauf, mit denen der Client die Animation mountet
    // (`ZONE_ANIM_MOUNT_DELAY_MS`). Der Schaden landet damit genau
    // dann, wenn die Zahnreihen zusammenkommen.
    for (const target of targets) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'shark_bite',
        owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'equip' ? target.slotIdx : -1,
      });
    }
    await engine._delay(410);

    for (const target of targets) {
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) await ctx.dealDamage(tgtHero, DAMAGE, 'creature');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx },
          target.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    engine.log('land_sharks_bite', {
      player: gs.players[pi]?.username,
      targets: targets.length, max, damage: DAMAGE,
    });
    // Nachlauf, bis sich die Kiefer wieder zurueckgezogen haben.
    await engine._delay(340);
    engine.sync();
    return true;
  },

  hooks: {
    ...multizone.multiZoneHooks(CARD_NAME, { claimLog: 'land_sharks_zones_claimed' }),
  },
};
