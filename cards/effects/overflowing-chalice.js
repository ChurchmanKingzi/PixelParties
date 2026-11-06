// ═══════════════════════════════════════════
//  CARD EFFECT: "Overflowing Chalice"
//  Potion (Normal) — keine Kosten, keine Schule, kein Level
//
//  Dein Gegner waehlt einen Helden, den du kontrollierst. Dieser Held
//  darf sofort eine zusaetzliche Aktion ausfuehren. Danach kannst du
//  fuer den Rest des Zuges keine Aktionen mehr ausfuehren.
//
//  ── ALS VORGABEN (28.8., bindend) ─────────────────────────────
//  · Der Gegner waehlt aus ALLEN LEBENDEN Helden — auch aus solchen,
//    die gar nicht handeln koennen. Waehlt er einen eingefrorenen,
//    verfaellt die Zusatzaktion einfach. Das ist die Pointe der Karte,
//    kein Fehler: sie hat keine Kosten, dafuer traegt man das Risiko.
//  · Der Nachteil greift IMMER — auch wenn man die Zusatzaktion
//    ablehnt oder sie verfaellt.
//  · Gesperrt wird JEDE Aktion: die normale, Bonus-Aktionen (Psychic
//    Scout) und inherente Zusatzaktionen (Aggressive Town Guard).
//    NICHT gesperrt ist das PLATZIEREN von Creatures — das laeuft
//    ueber `actionPlaceCreature` und ist regeltechnisch keine Aktion.
//  · Ein zweiter Chalice ist bei aktiver Sperre nicht aktivierbar.
//
//  ── WARUM DER NACHTEIL SCHWERER WIEGT ALS ER LIEST ────────────
//  Das Spiel erlaubt EINE Aktion pro Zug insgesamt, nicht eine je
//  Held (server.js: `actionAlreadyUsed`). Wer den Chalice vor seiner
//  Aktion spielt, tauscht also seine normale Aktion gegen eine, die
//  der GEGNER zuteilt. Wer ihn danach spielt, bekommt sie geschenkt.
//  Das Timing ist die ganze Entscheidung.
// ═══════════════════════════════════════════

const CARD_NAME = 'Overflowing Chalice';

/**
 * Alle lebenden Helden, die `pi` KONTROLLIERT — die Wahlmenge des Gegners.
 * Welle 13 (Q147, Al: „Ja, nach aktueller Kontrolle"): `heroesControlledBy`
 * statt physischer Heldenreihe. Ein vom Gegner gecharmter eigener Held steht
 * nicht zur Wahl, ein von mir gecharmter Gegnerheld schon (`phys` = Brettseite).
 */
function lebendeHelden(engine, pi) {
  const out = [];
  for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(pi)) {
    if (hero?.name && (hero.hp || 0) > 0) out.push({ phys: physOwner, idx: heroIdx, name: hero.name });
  }
  return out;
}

module.exports = {
  // ★ OHNE `isPotion` ist die Karte fuer den Server keine Potion und
  // laesst sich gar nicht anklicken. Mein erster Anlauf exportierte
  // stattdessen ein erfundenes `canPlay` — den Vertrag gibt es nicht,
  // er wurde nirgends gelesen, und die Karte war tot.
  isPotion: true,

  /**
   * Zweiter Chalice bei aktiver Sperre: nicht aktivierbar. Der echte
   * Vertrag heisst `canActivate` und bekommt `(gs, pi, engine)` —
   * NICHT den ctx. Dieselbe Wahrheit, die auch das Ausgrauen im Client
   * speist; kein zweiter Zaehler, der auseinanderlaufen koennte.
   */
  canActivate(gs, pi, engine) {
    // ★ 28.8.: fragt jetzt den geteilten Helfer statt des rohen Flags.
    // Damit ist ein zweiter Chalice auch dann gesperrt, wenn die
    // Aktionen aus einem ANDEREN Grund schon liegen (Kent im Minus) —
    // eine Karte, die eine Zusatzaktion verspricht, die niemand
    // ausfuehren darf, waere ein toter Klick.
    if (engine?.areActionsBlocked) return !engine.areActionsBlocked(pi);
    return !gs?.players?.[pi]?.actionLocked;
  },

  /**
   * ★ SIGNATUR: der Server ruft `script.resolve(engine, pi, ids, targets)`
   * POSITIONAL auf, NICHT mit einem ctx. Mein erster Anlauf las
   * `ctx._engine` und `ctx.cardOwner` — beide undefined, die Karte tat
   * nichts und wanderte nur in den Loeschstapel. Abgeglichen mit
   * monster-in-a-bottle.js: `resolve: async (engine, pi) => …`.
   */
  async resolve(engine, pi) {
    const gs = engine.gs;
    const oi = engine.opponentOf(pi);
    const ps = gs.players[pi];
    const helden = lebendeHelden(engine, pi);

    // Kein lebender Held → nichts zu waehlen. Der Nachteil greift
    // trotzdem: der Text knuepft ihn nicht an das Gelingen.
    if (helden.length) {
      // Der GEGNER waehlt — wie bei Timeless King Zi und Magic Lamp.
      const wahl = await engine.promptGeneric(oi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: `Choose a Hero ${ps.username} controls. That Hero may perform an additional Action.`,
        menuSource: CARD_NAME,
        gerrymanderEligible: true,
        cancellable: false,
        options: helden.map(h => ({ id: `${h.phys}:${h.idx}`, label: h.name })),
      });

      let gewaehlterHeld = helden[0];
      const [wp, wi] = String(wahl?.optionId ?? '').split(':').map(x => parseInt(x, 10));
      const treffer = helden.find(h => h.phys === wp && h.idx === wi);
      if (treffer) gewaehlterHeld = treffer;
      const heroIdx = gewaehlterHeld.idx;
      const heldName = engine.gs.players[gewaehlterHeld.phys]?.heroes?.[heroIdx]?.name;

      engine.log('overflowing_chalice_pick', {
        player: ps.username, chooser: gs.players[oi]?.username,
        hero: heldName,
      });

      // Zusatzaktion. `performImmediateAction` traegt das "may" selbst:
      // findet der Held keine spielbare Karte (eingefroren, leere Hand,
      // Beschraenkung), liefert sie `{ played: false }` und der Effekt
      // verfaellt — genau der Fall, auf den der Gegner spekulieren darf.
      await engine.performImmediateAction(pi, heroIdx, {
        title: CARD_NAME,
        description: `${gs.players[oi]?.username || 'Your opponent'} chose `
          + `${heldName || 'this Hero'}. You may perform an additional Action.`,
        // Geliehener Held auf der Gegnerseite: Brettseite mitgeben (Styx-Vertrag).
        ...(gewaehlterHeld.phys !== pi ? { heroOwner: gewaehlterHeld.phys } : {}),
      });
    }

    // ── Der Nachteil. IMMER, auch nach Ablehnen oder Verfallen. ──
    // Spielerweiter Riegel im vorhandenen Lock-System (wie
    // summonLocked / handLocked): Engine setzt ihn beim Zugbeginn
    // beider Spieler zurueck, server.js sendet ihn an den Client,
    // app-board zeigt ihn als Debuff-Banner, der Puzzle-Editor kann
    // ihn direkt setzen.
    ps.actionLocked = true;
    engine.log('overflowing_chalice_lock', { player: ps.username });
    engine.sync();
    return true;
  },
};
