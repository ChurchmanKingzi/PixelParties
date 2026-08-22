// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Organnon"
//  Spell (Normal, Lv 0, Destruction Magic)
//
//  "This Spell can only be used by a Hero with Inventing 3. Deal damage
//   equal to 50 times the number of \"Future Tech Organnon\" cards in
//   your discard pile to all targets your opponent controls. You cannot
//   deal any other damage to targets your opponent controls this turn."
//
//  ── Zwei Bedingungen, beide mit vorhandenen Bauteilen ──────────────
//
//  ① „only be used by a Hero with Inventing 3" — eine Anforderung an
//     den WIRKER, nicht an die Seite. Deshalb `canPlayWithHero` (der
//     Vertrag, den die Engine je Held fragt) PLUS `spellPlayCondition`
//     als seitenweites Tor, damit die Oberfläche die Karte ausgraut,
//     wenn KEIN Held sie wirken könnte. Bauform von Gigantisaur Stomp.
//
//     Gezählt wird über `countAbilitiesForSchool('Inventing', …)` —
//     derselbe Helfer, den Andras für Fighting nimmt. Er rechnet
//     Performance-Joker korrekt mit ein.
//
//  ② „You cannot deal any other damage … this turn" ist WORTGLEICH
//     Flame Avalanche [Als Hinweis 22.8.]. Also exakt dessen Bauform,
//     keine eigene:
//       • `ps.damageLocked = true` NACH dem Schlag — die Sperre ist
//         absolut und wird im Schadenspfad an zwei Stellen gelesen
//         (`_actionDealDamageImpl` und der Kreaturen-Stapel).
//       • `spellPlayCondition` verlangt zusätzlich
//         `!ps.dealtDamageToOpponent`: wer diesen Zug schon Schaden
//         gemacht hat, kann den Zauber gar nicht erst spielen — sonst
//         wäre „any OTHER damage" rückwirkend nicht einzuhalten.
//       • Die Sperre wird ÜBERSPRUNGEN, wenn der Wurf nicht landete
//         (Negation, abgebrochene Ida-Zielwahl). Ohne diesen Riegel
//         bekäme man die Fessel geschenkt.
//
//  ── `ctx.aoeHit` statt einer eigenen Schleife ──────────────────────
//  Der Hausweg für „alle Ziele einer Seite". Er sammelt die Ziele,
//  spielt die Animation, schlägt über die richtigen Kanäle zu — und
//  bringt vor allem **Idas `forcesSingleTarget`** mit, die eine
//  handgeschriebene Schleife stillschweigend ignorieren würde. Meine
//  erste Fassung hatte genau diesen Fehler.
//
//  ── Der Schaden skaliert wie der ganze Archetyp ────────────────────
//  50 je Kopie in der ABLAGE, und die Karte zählt sich dabei NICHT
//  selbst mit (Als Ruling, siehe Kopf von `_future-tech-shared.js`).
//
//  ★ EINE ENTSCHEIDUNG, die ich Al vorlege: bei 0 Kopien richtet der
//  Zauber nichts aus — die Sperre setze ich trotzdem, weil der
//  Kartentext sie an nichts knüpft. Zusammen mit der Archetyp-Regel
//  („die leere Kopie ist der erste Schritt") heisst das: eine früh
//  gespielte Organnon kostet den Schaden des ganzen Zuges. Textgetreu,
//  aber hart — eine Zeile, falls es anders gemeint ist.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Organnon';
const SCHADEN_JE_KOPIE = 50;
const INVENTING_NOETIG = 3;

/** Inventing-Stufe des Helden — Performance-Joker inklusive. */
function inventingStufe(engine, pi, heroIdx) {
  const abZones = engine.gs.players[pi]?.abilityZones?.[heroIdx] || [];
  return engine.countAbilitiesForSchool('Inventing', abZones);
}

/** Darf DIESER Held Organnon wirken? */
function heldTaugt(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  return inventingStufe(engine, pi, heroIdx) >= INVENTING_NOETIG;
}

module.exports = {
  requiresTarget: false,
  // ^ Kein Zielwahl-Gate: der Zauber trifft ALLES auf der Gegenseite.
  //   Die Ida-Ausnahme fragt `aoeHit` selbst ab.

  /**
   * Per-Held-Tor. Die Engine fragt es beim Auflisten der spielbaren
   * Handkarten und als Vorprüfung vor der Auflösung.
   */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    if (gs.players[pi]?.dealtDamageToOpponent) return false;
    return heldTaugt(engine, pi, heroIdx);
  },

  /**
   * Seitenweites Tor — sonst bliebe die Karte in der Hand hell, obwohl
   * kein einziger Held sie wirken könnte.
   *
   * BEWUSST KEIN Gate auf die Ablage: mit 0 Kopien tut der Zauber
   * nichts, muss aber spielbar bleiben (Archetyp-Regel).
   */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    // Flame-Avalanche-Klausel: wer schon Schaden gemacht hat, kann
    // „any other damage" nicht mehr einhalten.
    if (gs.players[pi]?.dealtDamageToOpponent) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (heldTaugt(engine, pi, hi)) return true;
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Beide Bedingungen bei der Auflösung erneut prüfen — zwischen
      // Handklick und Auflösung kann eine Kette dazwischenfahren.
      if (!heldTaugt(engine, pi, heroIdx)) {
        gs._spellCancelled = true;
        engine.log('ft_organnon_fizzle', { player: ps.username, reason: 'inventing' });
        return;
      }
      if (ps.dealtDamageToOpponent) {
        gs._spellCancelled = true;
        engine.log('ft_organnon_fizzle', { player: ps.username, reason: 'already_dealt_damage' });
        return;
      }

      const kopien = zaehleInAblage(gs, pi, CARD_NAME);
      const schaden = SCHADEN_JE_KOPIE * kopien;
      engine.log('ft_organnon', { player: ps.username, copies: kopien, damage: schaden });

      if (schaden > 0) {
        const ergebnis = await ctx.aoeHit({
          side: 'enemy',
          types: ['hero', 'creature'],
          damage: schaden,
          damageType: 'destruction_spell',
          sourceName: CARD_NAME,
          animationType: 'explosion',
          singleTargetPrompt: {
            title: CARD_NAME,
            description: `Ida has to concentrate on one target — choose! Deal ${schaden} damage.`,
            confirmLabel: `🎹 ${schaden} Damage!`,
          },
        });

        // Sperre NUR, wenn der Schlag wirklich gelandet ist — sonst
        // gäbe es die Fessel geschenkt (Flame-Avalanche-Riegel).
        if (ergebnis?.cancelled || gs._spellCancelled || gs._spellNegatedByEffect) return;
      }

      ps.damageLocked = true;
      engine.log('damage_locked', { player: ps.username, by: CARD_NAME });
      engine.sync();
    },
  },
};
