// ═══════════════════════════════════════════
//  CARD EFFECT: „Teocuilatl, the Embodiment of Gods"
//  Hero (500 HP / 80 ATK, Leadership + Wealth, PP MSAZ, Banned)
//
//  „You may once per turn sacrifice a Creature you control that was not
//   summoned this turn to gain 10 Gold OR a Hero you control, except
//   this one, to gain 30 Gold. After you sacrificed a Hero with this
//   effect, immediately end your turn. You can only sacrifice 1 Hero
//   per game with this effect."
//
//  BAUART
//  ──────
//  • Aktivierbarer Heldeneffekt. Das „once per turn" stempelt der
//    Server beim Aktivieren selbst (wie bei jedem `heroEffect`).
//    KEINE Aktionskosten: der Text sagt nichts davon, und aktive
//    Effekte kosten nur dann eine Aktion, wenn sie es sagen (★-Regel
//    7.9.).
//
//  • ★ KEIN SUBMENUE (Als Vorgabe 12.9.): der Effekt oeffnet EINE
//    Zielwahl. Hervorgehoben ist alles, was gerade legal ist — eigene
//    Kreaturen, die nicht in diesem Zug beschworen wurden, und eigene
//    Helden AUSSER Teocuilatl selbst, solange das Einmal-je-Partie noch
//    offen ist. Der Klick entscheidet den Weg: Kreatur → 10 Gold,
//    Held → 30 Gold und Zugende.
//
//  • ★ UND TROTZDEM UEBER `resolveSacrificeCost` (Als Vorgabe 12.9.:
//    „dass Chosen Sacrifice funktioniert, IST wichtig"). Der Helfer
//    bringt den Hand-Ersatz mit — samt der Sonderbehandlung, dass die
//    Handkarte erst NACH ihrer eigenen Belohnung in die Ablage fliegt —
//    dazu Immunitaeten, Opferfenster, Animation und Buchhaltung.
//    Die Helden haengen als `spec.extraTargets` (v972) im SELBEN
//    Waehler; klickt man einen, opfert der Helfer nichts und meldet
//    `{ extraPicked }` zurueck.
//
//  • KREATUR: `filter: c => c.inst.turnPlayed !== turn` — dieselbe
//    Auslegung von „not summoned this turn", die die drei
//    Teocuilatl-Kreaturen benutzen.
//
//  • HELD: `actionDefeatHero(..., { isSacrifice: true,
//    respectFirstTurnProtection: false })` — der Weg von Divine Gift of
//    Sacrifice. `isSacrifice` markiert die Niederlage als freiwilliges
//    Opfer (Temple of Sacrifice liest das), und eine freiwillige
//    Selbst-Niederlage darf an keinem Schutz scheitern.
//
//  • „immediately end your turn" ueber die Terror-Mechanik
//    (`gs._terrorForceEndTurn` + `_terrorForceEndSource`): der Server
//    wartet, bis Prompts, Effekte und eine laufende Kette durch sind,
//    und faehrt dann die End Phase. NUR nach dem Helden-Opfer.
//
//  • „1 Hero per game": Marke am Spielerzustand
//    (`ps._teocuilatlHeroSacrificed`). Unterstrich-Felder sind die
//    etablierte Form fuer karteneigenen Kramzustand; sie ueberlebt den
//    Zugwechsel und gilt damit fuer die ganze Partie.
// ═══════════════════════════════════════════

const CARD_NAME = 'Teocuilatl, the Embodiment of Gods';
const GOLD_CREATURE = 10;
const GOLD_HERO = 30;

/** Ist der Helden-Weg in dieser Partie noch offen? */
function heldMoeglich(engine, pi) {
  const ps = engine.gs.players[pi];
  return !!ps && !ps._teocuilatlHeroSacrificed;                   // 1 je Partie
}

/**
 * Opferbare Helden als Picker-Ziele — ★ OHNE Teocuilatl selbst
 * („a Hero you control, EXCEPT THIS ONE", Als Textfassung 12.9.).
 */
function heldenZiele(engine, pi, eigenerIdx) {
  if (!heldMoeglich(engine, pi)) return [];
  return engine.getHeroTargets(pi).filter(t => t.heroIdx !== eigenerIdx);
}

/** Opfer-Vorgabe fuer den Kreatur-Weg; die Helden haengen als Fremdziele dran. */
function kreaturSpec(engine, extra) {
  const turn = engine.gs.turn;
  return {
    minCount: 1, maxCount: 1,
    title: CARD_NAME,
    description: (extra && extra.length > 0)
      ? `Sacrifice a Creature (not summoned this turn) for ${GOLD_CREATURE} Gold — or a Hero for ${GOLD_HERO} Gold, which ends your turn.`
      : `Sacrifice a Creature (not summoned this turn) for ${GOLD_CREATURE} Gold.`,
    confirmLabel: '🗡️ Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: true,
    filter: (c) => c.inst.turnPlayed !== turn,
    extraTargets: extra || [],
  };
}

/** Kann der Kreatur-Weg bezahlt werden? (Hand-Ersatz zaehlt mit.) */
function kreaturMoeglich(engine, pi) {
  return engine.canSatisfySacrifice(pi, kreaturSpec(engine, []));
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // Abbrechbare Prompts bricht die Engine fuer die CPU pauschal ab
  // (Befund v828). Die Zielwahl laeuft ueber `effectTarget`; die CPU
  // nimmt IMMER eine Kreatur — 30 Gold sind einen eigenen Helden und
  // das sofortige Zugende nicht wert.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    if (promptData?.config?.title !== CARD_NAME) return undefined;
    const kreatur = (promptData.validTargets || []).find(t => t.type !== 'hero');
    return kreatur ? [kreatur.id] : undefined;
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const hero = engine.gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return kreaturMoeglich(engine, pi)
      || heldenZiele(engine, pi, ctx.cardHeroIdx).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const extra = heldenZiele(engine, pi, ctx.cardHeroIdx);
    const kannKreatur = kreaturMoeglich(engine, pi);
    if (!kannKreatur && extra.length === 0) return false;

    // ── EINE Zielwahl: Tribute + Helden im selben Waehler ───────────
    const ergebnis = await engine.resolveSacrificeCost(ctx, kreaturSpec(engine, extra));

    // ── Weg 2: ein HELD wurde geklickt ─────────────────────────────
    if (ergebnis && ergebnis.extraPicked) {
      const ziel = ergebnis.extraPicked;
      const opfer = ps.heroes?.[ziel.heroIdx];
      if (!opfer?.name || opfer.hp <= 0) return false;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      engine._broadcastEvent('play_zone_animation', {
        type: 'knife_sacrifice', owner: pi, heroIdx: ziel.heroIdx, zoneSlot: -1,
      });
      await engine._delay(500);

      // Einmal je Partie — VOR der Niederlage gesetzt, damit eine Kette,
      // die daran haengt, den Weg nicht ein zweites Mal sieht.
      ps._teocuilatlHeroSacrificed = true;

      await engine.actionDefeatHero(
        { name: CARD_NAME, owner: pi },
        opfer,
        { reason: CARD_NAME, respectFirstTurnProtection: false, isSacrifice: true },
      );

      await ctx.gainGold(GOLD_HERO);
      engine.log('teocuilatl_offering', {
        player: ps.username, kind: 'hero', hero: opfer.name, gold: GOLD_HERO,
      });

      if (!gs.result) {
        gs._terrorForceEndTurn = pi;
        gs._terrorForceEndSource = { name: CARD_NAME, owner: pi };
      }
      engine.sync();
      return true;
    }

    // ── Weg 1: Kreatur (oder Chosen Sacrifice aus der Hand) ────────
    if (!ergebnis) return false;                       // abgebrochen
    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
    await ctx.gainGold(GOLD_CREATURE);
    engine.log('teocuilatl_offering', {
      player: ps.username, kind: 'creature', gold: GOLD_CREATURE,
    });
    engine.sync();
    return true;
  },
};
