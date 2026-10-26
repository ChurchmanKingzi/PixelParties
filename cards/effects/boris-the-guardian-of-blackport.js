// ═══════════════════════════════════════════
//  CARD EFFECT: "Boris, the Guardian of Blackport"
//  Hero — 500 HP, 70 ATK, PP SOB
//  Startabilities: Fighting + Wealth
//
//  "Your opponent cannot add any cards originally
//   owned by you to their hand and cannot activate
//   effects that would take control of any targets
//   you control. You may once per turn ignore any
//   effect that would force you to discard cards
//   from your hand (including as a cost)."
//
//  ★ v1376 (Als Errata 24.9.): Klausel 1 nur noch HAND (nicht mehr Deck
//  und Ablage), Klausel 3 nur noch EINMAL PRO ZUG (pro Spieler,
//  `boris-discard`). Verbraucht wird sie nur, wenn wirklich verzichtet
//  wird — auch beim automatischen Verzicht auf unbezahlbare Kosten.
//
//  Reiner Passiv-Held — kein aktiver Effekt, keine
//  Aktivierung. Alle drei Klauseln laufen ueber
//  Vertraege, die andere Stellen abfragen.
//
//  Als Rulings (5.8.)
//  ──────────────────
//  • Klausel 1+2 sperren die AKTIVIERUNG: eine Karte
//    des Gegners, die eine Karte von mir stehlen und
//    auf seine Hand / sein Deck / seine Ablage
//    bringen wuerde, oder die Kontrolle uebernimmt,
//    ist bei ihm ausgegraut. Sie fizzelt nicht —
//    sie ist gar nicht erst spielbar.
//  • Reine SPIELMECHANIK ist NICHT betroffen: stiehlt
//    der Boris-Spieler selbst eine Creature und die
//    stirbt, geht sie weiterhin in die Ablage ihres
//    urspruenglichen Besitzers. Geblockt werden nur
//    EFFEKTE DES GEGNERS.
//  • Klausel 3 fragt EINMAL PRO ABWURF-STAPEL, nicht
//    je Karte.
//  • Kosten zu ueberspringen negiert den Effekt NICHT
//    — Boris macht solche Karten schlicht gratis.
//  • ★ W74a (Al): Boris wirkt NUR bei ABWURF (discard). Karten von
//    der Hand LOESCHEN (Wheels „delete 2", Potion Juggler, Acid Rain,
//    Dante, Debt-o-Tron/Item Lock …) ist kein Discard: keine Frage,
//    kein Verzicht, HOPT bleibt frei. Wächter: check-boris-delete.js.
//  • Reihenfolge bei fremdem Zwangsabwurf: ERST das
//    Ambush-Reaktionsfenster, und nur wenn dort nicht
//    negiert wurde, fragt Boris.
// ═══════════════════════════════════════════

const CARD_NAME = 'Boris, the Guardian of Blackport';
const HOPT = 'boris-discard';

/** Hat `pi` den Einmal-pro-Zug-Verzicht in diesem Zug schon benutzt? */
function verzichtVerbraucht(engine, pi) {
  return engine?.gs?.hoptUsed?.[`${HOPT}:${pi}`] === engine?.gs?.turn;
}

/**
 * Kontrolliert `pi` einen WIRKSAMEN Boris?
 *
 * Wirksam heisst: am Leben und nicht durch Statuseffekte lahmgelegt.
 * Dieselbe Statusliste, die die Engine an allen anderen Stellen fuer
 * "Held wirkt nicht" benutzt (frozen / stunned / webbed / negated).
 *
 * EINZIGE Definition — Engine und Client fragen beide hierueber, damit
 * das Ausgrauen beim Gegner und das tatsaechliche Blocken nie
 * auseinanderlaufen koennen.
 */
function borisActive(engine, pi) {
  return wirksamerBoris(engine, pi) != null;
}

/**
 * Z1 (H01-04): „Your opponent …" / „you" = KONTROLLEUR. Gesucht wird unter den Helden, die `pi`
 * KONTROLLIERT (eigene Spalte ohne abgegebene + uebernommene), nicht in der Spalte von `pi`.
 * @returns {{physOwner:number, heroIdx:number}|null}
 */
function wirksamerBoris(engine, pi) {
  const liste = engine?.heroesControlledBy ? engine.heroesControlledBy(pi) : null;
  if (!liste) return null;
  const f = liste.find(({ hero: h }) =>
    h && h.name === CARD_NAME && h.hp > 0
    && !h.statuses?.frozen && !h.statuses?.stunned
    && !h.statuses?.webbed && !h.statuses?.negated);
  return f ? { physOwner: f.physOwner, heroIdx: f.heroIdx } : null;
}

/** Index des wirksamen Boris (fuer das Hervorheben im Client), sonst -1. */
function borisHeroIdx(engine, pi) {
  return wirksamerBoris(engine, pi)?.heroIdx ?? -1;
}

/** Brettseite des wirksamen Boris (Spalte kann beim Gegner liegen), sonst `pi`. */
function borisHeroSeite(engine, pi) {
  return wirksamerBoris(engine, pi)?.physOwner ?? pi;
}

module.exports = {
  isHero: true,
  activeIn: ['hero'],

  // Kein aktiver Effekt — Boris wirkt ausschliesslich passiv.
  heroEffect: false,

  /**
   * Klausel 3 — "You may ignore any effects that would force you to
   * discard cards from your hand (including as costs)."
   *
   * Wird von `actionPromptForceDiscard` EINMAL je Stapelabfrage
   * gerufen, nachdem ein etwaiges Ambush-Fenster durch ist.
   * Rueckgabe `true` = der ganze Abwurf entfaellt.
   */
  async offerDiscardSkip(engine, pi, count, opts = {}) {
    // HINWEIS zur Endlosschleifen-Sicherung (Als Vorgabe 5.8.):
    // Bei WECHSELSEITIGEN Abwurfketten (Bottled Flame/Lightning) darf
    // nicht verzichtet werden, wenn BEIDE Spieler einen wirksamen Boris
    // haben — sonst reichen sie die Kette unbegrenzt hin und her. Die
    // Pruefung sitzt beim Aufrufer (_bottled-shared.js), weil nur der
    // weiss, ob seine Abfrage Teil einer solchen Kette ist. Der normale
    // Zwangsabwurf trifft immer nur EINEN Spieler und kann deshalb
    // nicht kreisen.
    // ★ W74a (Al): nur ABWURF — „delete cards from your hand" (Wheels, Potion Juggler, Acid Rain, Dante, Item Lock …) ist kein Discard.
    if (opts.deleteMode || opts.delete || opts.loeschen) return false;
    if (!borisActive(engine, pi)) return false;
    if (verzichtVerbraucht(engine, pi)) return false;   // v1376: einmal pro Zug
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    // ★ v1279 (Als Befund 22.9.): sind die Kosten gar nicht bezahlbar
    // (zu wenige Handkarten), wird NICHT gefragt — Boris verzichtet von
    // selbst. Sonst waere ein Effekt mit Abwurfkosten trotz Boris nicht
    // nutzbar, obwohl seine Kosten ohnehin entfallen. Gilt auch fuer die
    // leere Hand (vorher stieg die Funktion dort aus und der Abwurf lief
    // regulaer weiter ins Leere).
    if ((ps.hand || []).length < count) {
      engine.claimHOPT(HOPT, pi);   // v1376
      engine.log('boris_discard_skipped', {
        player: ps.username, skipped: count,
        source: opts.sourceName || opts.source || undefined,
        reason: 'unpayable',
      });
      engine.sync();
      return true;
    }

    const wieViele = Math.min(count, ps.hand.length);
    const quelle = opts.sourceName || opts.source;
    const skipped = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: quelle
        ? `${quelle} would make you discard ${wieViele} card(s). Skip this discard?`
        : `You must discard ${wieViele} card(s). Skip this discard?`,
      confirmLabel: '🛡️ Skip this discard!',
      cancelLabel: 'Discard normally',
      cancellable: true,
      // W74c: der Verzicht macht die Wirkung wertlos (sie hängt an der ANZAHL der abgeworfenen Karten: Champion, Heinz, Pteranos …) — nur ein Hinweis für die CPU.
      ...(opts.skipVoidsEffect ? { skipVoidsEffect: true } : {}),
    });
    if (!skipped || skipped.cancelled || skipped.confirmed === false) return false;

    engine.claimHOPT(HOPT, pi);   // v1376: einmal pro Zug
    engine.log('boris_discard_skipped', {
      player: ps.username,
      skipped: wieViele,
      source: quelle || undefined,
    });
    engine.sync();
    return true;
  },

  /**
   * CPU-Antwort: Handkarten sind Ressourcen, das Ueberspringen kostet
   * nichts und der Effekt bleibt trotzdem wirksam (Als Ruling: Kosten
   * negieren negiert den Effekt nicht). Es gibt also keinen Grund,
   * jemals abzulehnen. Ohne diesen Eintrag greift der CPU-Standard
   * fuer abbrechbare confirms — und der lehnt ab.
   */
  cpuResponse(engine, promptType, promptData) {
    if (promptType !== 'generic') return undefined;
    if (promptData?.type !== 'confirm') return undefined;
    if (promptData?.skipVoidsEffect) return { confirmed: false };   // W74c: wer verzichtet, bekommt nichts — die CPU wirft dann lieber ab
    return { confirmed: true };
  },

  /**
   * v1279: „(including as costs)" — verzichtet dieser Spieler gerade auf
   * ABWURFKOSTEN? Die EINZIGE Stelle, an der Engine und Client das
   * fragen (`engine.discardCostWaived(pi)`): Spielbarkeits-Listen duerfen
   * einen Effekt mit Abwurfkosten dann nicht mehr an der Handgroesse
   * scheitern lassen.
   */
  waivesDiscardCosts: (engine, pi) => borisActive(engine, pi) && !verzichtVerbraucht(engine, pi),   // v1376

  // Vertrag fuer Engine und Client (Klauseln 1 + 2 sowie das
  // Hervorheben beim Hovern).
  borisActive,
  borisHeroIdx,
  borisHeroSeite,
  verzichtVerbraucht,
  CARD_NAME,
};
