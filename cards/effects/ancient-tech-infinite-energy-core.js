// ═══════════════════════════════════════════
//  CARD EFFECT: "Ancient Tech Infinite Energy Core"
//  Artifact (Equipment, Cost 10)
//
//  Equipped Hero's ATK is increased by 10 × the
//  number of cards with DIFFERENT NAMES in the
//  controller's discard pile. Recomputed live as
//  the pile mutates — every Spell / Attack /
//  non-equip Artifact resolving to discard, every
//  Creature death, every Mill, every forced
//  discard, every revival pulling a name back out.
//
//  Implementation (W58a)
//  ─────────────────────
//  • Das Skript liefert nur die RECHNUNG (`atkZiel`: 10 × Anzahl
//    verschiedener Namen in der Ablage des Kontrolleurs). Gebucht wird
//    ueber `engine.dynamischeAtkBuchen` → `actionSetAtkGrant`: Zielwert,
//    nur am aktuellen Traeger, pro Instanz genau einmal (Stempel).
//
//  • Die Engine gleicht diese Karte bei JEDEM `sync()` und JEDEM
//    `runHooks()` gegen die Ist-Ablage ab (`_dynamischeAtkNachrechnen`,
//    keine Hooks, keine Reaktionsfenster). Damit stimmt der Bonus
//    unabhaengig davon, WIE die Ablage sich aendert — Zauber, Mill,
//    Zwangsabwurf, Kreaturentod, Zerstoerung, Rueckholung, aber auch das
//    Todes-Aufraeumen eines Helden (legt die Ausruestung direkt in die
//    Ablage, ohne `onDiscard`) und Direktzugriffe auf `discardPile`.
//    Die Haken unten rufen dieselbe Buchung zusaetzlich (Anlegen, Zug-
//    beginn, bekannte Ablage-Ereignisse) — alles idempotent.
//
//  • Wird die Karte entfernt, nimmt `onCardLeaveZone` (`ctx.revokeAtk()`)
//    EXAKT den gebuchten Betrag am Stempel-Traeger zurueck; der Held hat
//    danach dieselbe ATK wie einer, an dem nie ein Core lag.
// ═══════════════════════════════════════════

// v876: Namensvergleiche ueber den BASISNAMEN (siehe CARD_API).
const { baseCardName } = require('./_hooks');

const CARD_NAME = 'Ancient Tech Infinite Energy Core';
const BONUS_PER_UNIQUE = 10;

/**
 * W58a: die RECHNUNG (ohne Buchung). Die Engine bucht (`engine.dynamischeAtkBuchen` → `actionSetAtkGrant`) und gleicht diese Karte bei jedem `sync`/`runHooks` gegen die
 * Ist-Ablage ab — auch nach Wegen, die die Ablage ohne Hook veraendern (Todes-Aufraeumung, Direktzugriffe).
 * Kontrolle statt Seite (Styx 28.9.): „your discard pile" = Kontrolleur (`seiten.owner`).
 */
function atkZiel(engine, inst, seiten /* , hero */) {
  const ps = engine.gs.players[seiten.owner];
  const uniqueCount = new Set((ps?.discardPile || []).map(baseCardName)).size;   // v876
  const newBonus = uniqueCount * BONUS_PER_UNIQUE;
  return { betrag: newBonus, log: { typ: 'ancient_tech_atk', daten: { newBonus, uniqueCount } } };
}

/** Haken-Einstieg: Zielwert neu rechnen und buchen (idempotent — ohne Aenderung ein No-op). */
function recomputeBonus(ctx) {
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return;
  ctx._engine.dynamischeAtkBuchen(inst);
}

module.exports = {

  atkZiel,   // W58a: Rechnung fuer `engine.dynamischeAtkBuchen` / den Abgleich der Engine

  /**
   * „Equip this card to a Hero you control." — Seitenbindung, siehe
   * `equipOwnSideOnly` in CARD_API.md. Ohne die Fahne gilt die
   * Hausvorgabe „Ausruestung darf an beide Seiten" (Al, 5.9.: der
   * Kartentext ist bindend).
   */
  equipOwnSideOnly: true,
  activeIn: ['support'],

  hooks: {
    // Initial calc on first placement + puzzle preset boards.
    onPlay:      (ctx) => recomputeBonus(ctx),
    onGameStart: (ctx) => recomputeBonus(ctx),

    // Discard-pile mutation triggers.
    //   afterSpellResolved   — Spell / Attack / Artifact lands in discard
    //   onAnyActionResolved  — hero effects, creature summons, ability
    //                          activations (catch-all post-action)
    //   onDiscard            — forced hand-side discards (Mill, Magenta,
    //                          self-discard equips, …)
    //   onMill               — deck → discard
    //   onCreatureDeath      — creature body to discard (mid-batch so
    //                          chained attacks see the updated ATK)
    //   onTurnStart          — safety-net refresh
    afterSpellResolved:  (ctx) => recomputeBonus(ctx),
    onAnyActionResolved: (ctx) => recomputeBonus(ctx),
    onDiscard:           (ctx) => recomputeBonus(ctx),
    onMill:              (ctx) => recomputeBonus(ctx),
    onCreatureDeath:     (ctx) => recomputeBonus(ctx),
    onTurnStart:         (ctx) => recomputeBonus(ctx),

    // Standard equip-removal revoke. The strict slot match ensures
    // this only fires for THIS Equip leaving its own support slot,
    // not for unrelated cards passing through onCardLeaveZone.
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      // W53a: Identitaet statt Seitenvergleich. Der strenge Vergleich `fromOwner === cardHeroOwner` scheiterte, sobald sich die Seitenlage seit dem Anlegen geaendert hatte
      // (Charme am Wirt endet, Kontrolle wechselt): die Karte ging, der Bonus blieb am Ex-Traeger stehen. Abgezogen wird dort, wo die Buchung liegt (Stempel).
      if (ctx.leavingCard) { if (ctx.leavingCard.id !== ctx.card.id) return; }
      else if (ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
    },
  },
};
