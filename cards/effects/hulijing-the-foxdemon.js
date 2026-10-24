'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Hulijing, the Foxdemon"
//  Hero — 400 HP, 40 ATK, Startabilities Diplomacy + Magic Arts
//
//  „You may once per turn place a Creature whose level is lower than this Hero's Magic Arts level from your deck or hand on top of this Hero. This Hero becomes that
//   Creature for the rest of the turn, but its HP remain unchanged and it is still treated as a Hero in addition to being treated as a Creature. At the end of the
//   turn, delete the Creature from this Hero."
//
//  ── NEUER TEXT ──────────────────────────────────────────────────────────
//  Der frühere Effekt (Magic-Arts-Spell aus der Ablage wirken) entfällt vollständig (Datenänderung in `data/cards.json`).
//
//  ── INFRASTRUKTUR „HELD ALS KREATUR" ────────────────────────────────────
//  Dieses ist die erste Karte mit „Hero treated as a Creature": Modell, Regeln und alle Anbindungen stehen in `_hero-creature-shared.js`. Kurz: die Kreatur liegt als Überlagerung
//  (Zone `support` ohne Zonenplatz, Marke `_heldKreatur`) AUF Hulijing, ihre Hooks laufen mit Hulijing als Wirt, ihr Schaden ist Heldenschaden (HP unverändert), Wahlen „nur Kreaturen" bieten Hulijing mit
//  an, fällt sie, gilt sie auch als Kreatur besiegt (die Karte bleibt bis zum Zugende liegen), und am Zugende wird die Karte gelöscht.
//
//  ── AKTIVIERUNG ─────────────────────────────────────────────────────────
//  Freier Heldeneffekt (kein „spend your Action" im Text), hart einmal pro Zug (Engine-HOPT). `heroEffect: true` + `onHeroEffect`.
//  NICHT aktivierbar, solange Hulijing stumm ist (Frozen, Stunned, Webbed, Negated — `engine._isHeroEffectSilenced`; mit „Chilly Dog" gilt Frozen wie überall nicht als Sperre).
//    ① Wählbar: Kreaturen aus der HAND (wirksame Handstufe, Handstufen-Effekte zählen) und aus dem DECK (aufgedruckte Stufe) mit Stufe KLEINER als die Magic-Arts-Stufe von
//       Hulijing („lower than this Hero's Magic Arts level"; Stufe 0 / harte Negation der Abilities ⇒ nichts wählbar). Magic Arts 1 ⇒ nur Lv-0-Kreaturen, 2 ⇒ bis Lv 1, 3 ⇒ bis Lv 2.
//       Es gelten die Riegel des Platzierens (`actionPlaceCreature`): keine Artifact Creatures, nichts „nur über den eigenen Effekt", keine Beschwörungssperre, die Spiel-Limits
//       („You can only play/control 1") und das `canSummon` der Karte selbst. Ohne wählbare Karte ist der Effekt nicht aktivierbar. Hulijing trägt höchstens EINE Kreatur.
//    ② Eine Galerie für beide Quellen: jeder Eintrag trägt sein Herkunfts-Abzeichen (HAND / DECK, wie bei Barker, the Monster Tamer); gleichnamige Karten aus Hand und Deck sind zwei
//       Einträge. Abbruch kostet nichts (das „may" entscheidet sich hier; die Einmal-pro-Zug-Sperre bleibt frei). Die Deckwahl mischt das Deck (Karte aus dem Deck genommen).
//    ③ Platzieren: Flug zur Heldenzone, die Karte liegt auf Hulijing; sie zählt als Beschwörung (Einsatz-Hook „When you play/summon this Creature" läuft, Beschwörungszähler,
//       Eintritts-Limit). Sie darf SOFORT ihren aktiven Effekt benutzen (Hulijing selbst war nicht beschwörungsmüde).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `hero_creature_on` (Pixelart, ANIM_REGISTRY: violettes Fuchsfeuer wirbelt um die Heldin, ein Rauchring verhüllt die Verwandlung) beim Auflegen, `hero_creature_off`
//  (Rauch, Funken) beim Löschen am Zugende. Klänge in ZONE_ANIM_SFX; Logs `hero_creature_placed`, `hero_creature_deleted`, `hero_creature_defeated`, `hero_creature_move_fizzle` (die Infrastruktur schreibt sie).
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU benutzt den Effekt NICHT (sie kann die aufgelegte Kreatur nicht gezielt einsetzen; das Auflegen aus dem Deck kostet die Karte): alle Abfragen werden abgelehnt.
// ═══════════════════════════════════════════

const HC = require('./_hero-creature-shared');

const CARD_NAME = 'Hulijing, the Foxdemon';
const SCHULE = 'Magic Arts';
const ON_MS = 1000;       // Länge von `hero_creature_on` im Client

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  /** Aktivierbar, solange irgendeine Kreatur aus Hand oder Deck aufgelegt werden dürfte. */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const seite = ctx.cardHeroOwner ?? ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = engine.gs.players[seite]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0 || hero.heldKreatur) return false;
    if (engine._isHeroEffectSilenced(seite, heroIdx)) return false;      // gelähmt/negiert (Frozen, Stunned, Webbed, Negated): sie verwandelt sich nicht
    const stufe = HC.schulStufe(engine, SCHULE, seite, heroIdx);
    return HC.kandidaten(engine, ctx.cardOwner, seite, heroIdx, stufe).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const seite = ctx.cardHeroOwner ?? pi;
    const heroIdx = ctx.cardHeroIdx;
    const hero = engine.gs.players[seite]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0 || hero.heldKreatur) return false;
    if (engine._isHeroEffectSilenced(seite, heroIdx)) return false;

    const stufe = HC.schulStufe(engine, SCHULE, seite, heroIdx);
    const alle = HC.kandidaten(engine, pi, seite, heroIdx, stufe);
    if (alle.length === 0) return false;

    // ② EIN gemeinsamer Picker für Hand UND Deck: jeder Eintrag trägt sein Herkunfts-Abzeichen (HAND / DECK, wie bei Barker, the Monster Tamer). Gleichnamige Karten aus beiden
    //    Quellen stehen als zwei Einträge da; die Antwort nennt `cardName` + `source`. Erst die Hand, dann das Deck, je alphabetisch.
    const sortiert = alle.slice().sort((a, b) => (a.pile === b.pile ? 0 : a.pile === 'hand' ? -1 : 1) || a.name.localeCompare(b.name));
    const galerie = sortiert.map(k => ({ name: k.name, source: k.pile, ...(k.pile === 'hand' ? { handIdx: k.handIdx } : {}) }));
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galerie,
      title: CARD_NAME,
      description: `Choose a Creature (level lower than ${stufe}) from your hand or deck to place on top of ${hero.name} until the end of the turn.`,
      confirmLabel: '🦊 Transform!',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return false;
    // Herkunft: die Antwort nennt sie; fehlt sie (Automat), gilt die erste passende Karte (Hand vor Deck).
    const treffer = sortiert.find(k => k.name === wahl.cardName && (!wahl.source || k.pile === wahl.source));
    if (!treffer) return false;
    const pile = treffer.pile;

    // ③ Auflegen.
    engine._broadcastEvent('play_zone_animation', { type: 'hero_creature_on', owner: seite, heroIdx, zoneSlot: -1, duration: ON_MS });
    const inst = await HC.platzieren(engine, pi, seite, heroIdx, wahl.cardName, pile, { source: CARD_NAME });
    if (!inst) return false;
    engine.sync();
    return true;
  },

  /** CPU: nutzt den Effekt nicht (lehnt jede Abfrage ab). */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || !payload || payload.title !== CARD_NAME) return undefined;
    return { cancelled: true };
  },

  _test: { SCHULE },
};
