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
//
//  ★ Luck (`luck.js`) trägt noch eine EIGENE Kopie derselben Hooks. Wer
//  hier etwas ändert, prüft dort dasselbe — oder zieht Luck auf diesen
//  Baustein um (dann gehört eine Bugfix-Note für Luck in den Commit).
// ═══════════════════════════════════════════

/**
 * Die vier Beobachter-Hooks. `trigger(ctx, gespielterName, spieler)` wird je
 * gespielter Karte höchstens einmal je Zuhörer aufgerufen; die Prüfung
 * „war das der Gegner / der deklarierte Name?" gehört dem Aufrufer.
 */
function kartenSpielBeobachter(trigger) {
  return {
    afterSpellResolved: async (ctx) => {
      if (ctx._engine.gs._spellNegatedByEffect) return;
      if (ctx._alsEffekt) return;
      await trigger(ctx, ctx.spellName, ctx.casterIdx);
    },

    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx._verwahrungRueckkehr) return;
      // Kontrolle statt Seite (Styx 28.9.): gespielt hat der Kontrolleur.
      const spieler = ctx._engine.effektiveSeiten(entering).controller ?? entering.owner;
      if (entering.name === ctx._engine._currentResolvingPlayName()) return;
      await trigger(ctx, entering.name, spieler);
    },

    afterPotionUsed: async (ctx) => {
      if (ctx.potionName == null) return;
      await trigger(ctx, ctx.potionName, ctx.potionOwner);
    },

    afterArtifactUsed: async (ctx) => {
      if (ctx.artifactName == null) return;
      await trigger(ctx, ctx.artifactName, ctx.playerIdx);
    },
  };
}

module.exports = { kartenSpielBeobachter };
