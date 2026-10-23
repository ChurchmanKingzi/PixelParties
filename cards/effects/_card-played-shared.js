// ═══════════════════════════════════════════
//  GETEILT: „Whenever your opponent plays a card …" — der Beobachter
//
//  Luck („Whenever your opponent plays a card of that name …") und
//  Liquid Luck lauschen auf dasselbe Ereignis: eine gegnerische Karte
//  wird GESPIELT. Die Engine hat dafür keinen einzelnen Hook; je
//  Kartenart meldet sich ein anderer (Stand 23.10.):
//
//    Spell / Attack      `afterSpellResolved`   (Name `ctx.spellName`, Spieler `ctx.casterIdx`)
//    Creature, Ability,  `onCardEnterZone`      (Name `ctx.enteringCard.name`, Spieler = Kontrolleur)
//      Equipment, Surprise, Area, Attachment
//    Potion              `afterPotionUsed`      (`ctx.potionName`, `ctx.potionOwner`)
//    Normal-Artifact     `afterArtifactUsed`    (`ctx.artifactName`, `ctx.playerIdx`)
//
//  Die Entdoppelungen stammen aus Lucks Fehlerhistorie und gelten hier
//  unverändert (M02-13, 23.10.):
//   · Area-/Attachment-Zauber und -Angriffe erzeugen Eintritt UND
//     `afterSpellResolved` — gezählt wird einmal (über den Spell).
//   · Ein Effekt, der nur als Attack/Spell ZÄHLT (`_alsEffekt`, Sword in a
//     Bottle, Heldeneffekte), ist kein gespieltes Exemplar — die Karte
//     meldet sich selbst.
//   · Die Rückkehr einer verwahrten Ability (Madame Guillotine) ist kein
//     Ausspielen (`_verwahrungRueckkehr`).
//   · Ein negierter Spell (`_spellNegatedByEffect`) zählt nicht.
//   · Surprises zählen bei der AKTIVIERUNG, nicht beim verdeckten Setzen (Al 23.10.); Reactions zählen beim Ausspielen
//     (Spell-Reactions über `afterSpellResolved`).
//   · Wiederbelebte Creatures aus der Ablage zählen (Zonen-Eintritt), wiederbelebte Helden nicht (Al 23.10.).
//
//  Verbraucher: Luck (`luck.js`) und Liquid Luck (`liquid-luck.js`) — beide Karten ändern sich hier gemeinsam.
// ═══════════════════════════════════════════

/**
 * Die sechs Beobachter-Hooks. `trigger(ctx, gespielterName, spieler)` wird je
 * gespielter Karte höchstens einmal je Zuhörer aufgerufen; die Prüfung
 * „war das der Gegner / der deklarierte Name?" gehört dem Aufrufer.
 */
function kartenSpielBeobachter(trigger) {
  // Reactions: je nach Fenster meldet sich `onHandPlaySignal` (Reaktionsfenster, selbstspielende Karten), `afterSpellResolved`/`afterArtifactUsed` (Kette, proaktiv)
  // oder beides. Der Zuhörer merkt sich, was er über `onHandPlaySignal` schon gezählt hat, und überspringt die Nachmeldung derselben Karte einmal.
  const istReaction = (engine, name) => String(engine._getCardDB()[name]?.subtype || '').toLowerCase() === 'reaction';
  const schonGezaehlt = (ctx, name, spieler) => {
    const c = ctx.card?.counters;
    if (!c || c._rxGezaehlt !== `${name}|${spieler}`) return false;
    delete c._rxGezaehlt;
    return true;
  };
  return {
    // Reactions und selbstspielende Hand-Karten (Engine: Hook `onHandPlaySignal`, gespeist vom `asPlay`-Marker der Karten-Flüge).
    onHandPlaySignal: async (ctx) => {
      const name = ctx.playedCardName;
      if (name == null || ctx.playedByOwner == null) return;
      if (ctx.card?.counters) ctx.card.counters._rxGezaehlt = `${name}|${ctx.playedByOwner}`;
      await trigger(ctx, name, ctx.playedByOwner);
    },

    afterSpellResolved: async (ctx) => {
      if (ctx._engine.gs._spellNegatedByEffect) return;
      if (ctx._alsEffekt) return;
      if (istReaction(ctx._engine, ctx.spellName) && schonGezaehlt(ctx, ctx.spellName, ctx.casterIdx)) return;
      await trigger(ctx, ctx.spellName, ctx.casterIdx);
    },

    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx._verwahrungRueckkehr) return;
      // Kontrolle statt Seite (Styx 28.9.): gespielt hat der Kontrolleur.
      const spieler = ctx._engine.effektiveSeiten(entering).controller ?? entering.owner;
      if (entering.name === ctx._engine._currentResolvingPlayName()) return;
      // Al 23.10.: bei Surprises zählt die AKTIVIERUNG, nicht das verdeckte Setzen (`onSurpriseActivated` unten bzw. `afterSpellResolved`).
      if (ctx.toZone === 'surprise') return;
      if (ctx._vonSurpriseAktivierung) return;   // die Landung einer aktivierten Kreatur-Surprise: gezählt wurde die Aktivierung
      await trigger(ctx, entering.name, spieler);
    },

    // Surprise aktiviert: Spell-/Attack-Surprises melden sich zusätzlich über `afterSpellResolved` (einmal, dort gezählt); alle übrigen
    // (Kreatur-/Artefakt-Surprises) nur hier.
    onSurpriseActivated: async (ctx) => {
      const name = ctx.surpriseCardName;
      if (name == null) return;
      const cd = ctx._engine._getCardDB()[name];
      if (cd && (cd.cardType === 'Spell' || cd.cardType === 'Attack')) return;
      await trigger(ctx, name, ctx.surpriseController);
    },

    afterPotionUsed: async (ctx) => {
      if (ctx.potionName == null) return;
      await trigger(ctx, ctx.potionName, ctx.potionOwner);
    },

    afterArtifactUsed: async (ctx) => {
      if (ctx.artifactName == null) return;
      if (istReaction(ctx._engine, ctx.artifactName) && schonGezaehlt(ctx, ctx.artifactName, ctx.playerIdx)) return;
      await trigger(ctx, ctx.artifactName, ctx.playerIdx);
    },
  };
}

module.exports = { kartenSpielBeobachter };
