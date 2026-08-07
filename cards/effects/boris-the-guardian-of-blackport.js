// ═══════════════════════════════════════════
//  CARD EFFECT: "Boris, the Guardian of Blackport"
//  Hero — 500 HP, 70 ATK, PP SOB
//  Startabilities: Fighting + Wealth
//
//  "Your opponent cannot add any cards originally
//   owned by you to their hand, deck or discard pile
//   and cannot activate effects that would take
//   control of any targets you control.
//   You may ignore any effects that would force you
//   to discard cards from your hand (including as
//   costs)."
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
//  • Reihenfolge bei fremdem Zwangsabwurf: ERST das
//    Ambush-Reaktionsfenster, und nur wenn dort nicht
//    negiert wurde, fragt Boris.
// ═══════════════════════════════════════════

const CARD_NAME = 'Boris, the Guardian of Blackport';

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
  const heroes = engine?.gs?.players?.[pi]?.heroes || [];
  return heroes.some(h =>
    h && h.name === CARD_NAME && h.hp > 0
    && !h.statuses?.frozen && !h.statuses?.stunned
    && !h.statuses?.webbed && !h.statuses?.negated,
  );
}

/** Index des wirksamen Boris (fuer das Hervorheben im Client), sonst -1. */
function borisHeroIdx(engine, pi) {
  const heroes = engine?.gs?.players?.[pi]?.heroes || [];
  return heroes.findIndex(h =>
    h && h.name === CARD_NAME && h.hp > 0
    && !h.statuses?.frozen && !h.statuses?.stunned
    && !h.statuses?.webbed && !h.statuses?.negated,
  );
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
    if (!borisActive(engine, pi)) return false;
    const ps = engine.gs.players[pi];
    if (!ps || !(ps.hand || []).length) return false;

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
    });
    if (!skipped) return false;

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
    return { confirmed: true };
  },

  // Vertrag fuer Engine und Client (Klauseln 1 + 2 sowie das
  // Hervorheben beim Hovern).
  borisActive,
  borisHeroIdx,
  CARD_NAME,
};
