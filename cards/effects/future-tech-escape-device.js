// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Escape Device"
//  Artifact (Reaction, Cost 5)
//
//  "Play this card immediately when a Hero you control would be
//   affected by an Attack or Spell whose level is equal to or lower
//   than the number of \"Future Tech Escape Device\" cards in your
//   discard pile. Negate all effects (including damage) the Attack or
//   Spell has on that Hero. You can only use 1 \"Future Tech Escape
//   Device\" on each of your Heroes per turn."
//
//  ── Die Verteidigung des Archetyps ──
//  Mit leerer Ablage schuetzt sie gegen NICHTS (Stufe ≤ 0 trifft nur
//  stufenlose Karten), mit drei Kopien gegen fast alles. Wieder der
//  Archetyp-Vertrag, diesmal defensiv — und wieder zaehlt sie sich
//  nicht selbst mit (Als Ruling 21.8.).
//
//  ── ZWEI WEGE, und bei Flaeche eine echte Immunitaet ──
//  [Als Vorgabe 21.8.: „Auch bei AoE sollte Escape Device ALLE Effekte
//   an dem gewählten Helden negieren, inklusive Status und anderen
//   Nebeneffekten."]
//
//  ① EIN eigenes Ziel → `isPostTargetReaction` mit
//    `{ effectNegated: true }`. Bauform von Invisibility Cloak: dessen
//    Kniff ist die Ein-Ziel-Bedingung — dann IST „die Karte ganz
//    negieren" dasselbe wie „ihre Effekte auf diesem Helden negieren".
//
//  ② MEHRERE eigene Ziele → die Karte darf NICHT ganz negiert werden
//    (die anderen Ziele sollen getroffen werden). Stattdessen bekommt
//    der gewaehlte Held eine **Effekt-Immunitaet gegen genau diese
//    Quelle** (`engine.grantEffectImmunity`, v543). Die Engine prueft
//    sie im Schadens- UND im Statuspfad, also faellt fuer diesen Helden
//    wirklich ALLES aus, nicht nur der Schaden.
//    Erkannt wird die Quelle ueber die OBJEKTIDENTITAET — dieselbe
//    Technik wie bei Angler Angel: ein Flaechenschlag reicht EIN
//    Quellobjekt an jeden Treffer weiter. Der Schutz endet damit von
//    selbst, sobald die naechste Karte ein neues Objekt baut.
//
//  Der alte `isPreDamageReaction`-Rueckfall ist weg — er konnte nur
//  Schaden und war damit schwaecher als der Kartentext.
//
//  Bei mehreren eigenen Zielen waehlt der Spieler, WELCHER Held
//  entkommt; bei einem Ziel gibt es nichts zu waehlen.
//
//  Beide Wege teilen sich dieselbe Sperre, sodass ein Held pro Zug
//  wirklich nur einmal entkommt.
//
//  ── „1 je Held pro Zug" ──
//  Harte Sperre je HELD, nicht je Spieler: der Schluessel traegt den
//  Heldenindex. (`claimHOPT` haengt den Spielerindex selbst an.)
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Escape Device';

/** Gemeinsame Sperre beider Wege: 1 Einsatz je HELD und Zug. */
function sperreFrei(gs, ownerIdx, heroIdx) {
  return gs.hoptUsed?.[`ft-escape:${heroIdx}:${ownerIdx}`] !== gs.turn;
}

module.exports = {
  // ★ KEIN `isReaction: true` (Als Befund 21.8.: „feuert bei jeder
  //   Gelegenheit, inklusive Phasenwechsel"). Das Flag meldet eine
  //   Karte bei der allgemeinen REAKTIONSKETTE an — und die filtert nur
  //   ueber `reactionCondition`, WENN es eine gibt (_engine.js ~24092).
  //   Diese Karte hatte keine, also wurde sie bei JEDEM Kettenfenster
  //   angeboten. Invisibility Cloak, Bamboo Shield und Anti Magic
  //   Shield tragen das Flag ebenfalls nicht: sie sind reine
  //   Post-Target-Reaktionen und melden sich nur ueber ihr eigenes
  //   Fenster an.
  canActivate: () => false,

  isPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard, opts) {
    if (!targetedHeroes || targetedHeroes.length === 0) return false;
    // Eigene Helden unter den Zielen, fuer die die Sperre noch frei ist.
    const eigene = targetedHeroes.filter(t =>
      t.owner === pi && t.type === 'hero' && sperreFrei(gs, pi, t.heroIdx));
    if (eigene.length === 0) return false;

    // ★ NUR eine echte Attack- oder Spell-KARTE (Als Befund 21.8.:
    //   „feuert bei jeder Kleinigkeit"). Meine erste Fassung liess
    //   zusaetzlich den Laufzeit-Schadenstyp gelten UND behandelte
    //   Quellen ohne Katalogeintrag als Stufe 0 — damit sprang die
    //   Karte auf Statusticks, Heldeneffekte und alles an, was
    //   irgendwann durch ein Zielfenster laeuft. Die Stufe ist
    //   ausserdem der halbe Kartentext: ohne Katalogeintrag gibt es
    //   keine Stufe, also auch keine Entscheidung.
    const db = engine._getCardDB();
    const srcData = sourceCard?.name ? db[sourceCard.name] : null;
    if (!srcData) return false;
    if (srcData.cardType !== 'Attack' && srcData.cardType !== 'Spell') return false;

    return (srcData.level || 0) <= zaehleInAblage(gs, pi, CARD_NAME);
  },

  async postTargetResolve(engine, pi, targetedHeroes, sourceCard) {
    const gs = engine.gs;
    const eigene = (targetedHeroes || []).filter(t =>
      t.owner === pi && t.type === 'hero' && sperreFrei(gs, pi, t.heroIdx));
    if (eigene.length === 0) return {};

    // Bei mehreren eigenen Zielen entscheidet der Spieler, wer entkommt.
    //
    // ★ Die Auswahlliste MUSS aus `engine.getHeroTargets(pi)` kommen
    //   (Als Befund 21.8.: „konnte kein Ziel wählen, saß im Target
    //   Picker fest"). Die Eintraege aus `targetedHeroes` tragen nicht
    //   zwingend die kanonischen Ziel-Ids, auf die der Client seine
    //   Klickflaechen abbildet — mit ihnen bewirkt ein Klick nichts.
    let ziel = eigene[0];
    if (eigene.length > 1) {
      const erlaubt = new Set(eigene.map(t => t.heroIdx));
      const auswahl = engine.getHeroTargets(pi).filter(t => erlaubt.has(t.heroIdx));
      if (auswahl.length > 1) {
        const wahl = await engine.promptEffectTarget(pi, auswahl, {
          title: CARD_NAME,
          description: 'Choose which of your Heroes escapes — it ignores every effect of this card.',
          confirmLabel: '🛡️ Escape!',
          confirmClass: 'btn-success',
          greenSelect: true,
          cancellable: false,
          maxTotal: 1,
        });
        const id = Array.isArray(wahl) ? wahl[0] : wahl;
        const gewaehlt = auswahl.find(t => t.id === id);
        if (gewaehlt) ziel = eigene.find(t => t.heroIdx === gewaehlt.heroIdx) || ziel;
      } else if (auswahl.length === 1) {
        ziel = eigene.find(t => t.heroIdx === auswahl[0].heroIdx) || ziel;
      }
    }

    if (!engine.claimHOPT(`ft-escape:${ziel.heroIdx}`, pi)) return {};

    engine._broadcastEvent('play_zone_animation', {
      type: 'shield_bubble', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1,
    });
    await engine._delay(480);

    engine.log('ft_escape_device', {
      player: gs.players[pi]?.username, hero: ziel.cardName,
      negated: sourceCard?.name || 'an Attack or Spell',
    });

    // ★ IMMER Immunitaet, NIE `effectNegated` (Als Vorgabe 21.8.: „bei
    //   Single-Target-Spells wird keine Animation abgespielt — die
    //   sollte es schon geben, nur die EFFEKTE werden geblockt").
    //   Die Karte laeuft also sichtbar durch; nur an diesem einen
    //   Helden prallt alles ab. Frueher hat der Ein-Ziel-Fall die
    //   ganze Karte negiert — das unterdrueckte auch ihre Anzeige.
    engine.grantEffectImmunity(pi, ziel.heroIdx, sourceCard);
    engine.sync();
    return {};
  },
};
