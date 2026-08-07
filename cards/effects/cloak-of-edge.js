// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloak of Edge"
//  Artifact (Equipment), Kosten 4, PP THW
//
//  "Equip this card to a Hero you control. While
//   this card is equipped to a Hero, it is treated
//   as an Ability with the following effect:
//   'You may once per turn permanently increase this
//    Hero's Attack stat by 20.'"
//
//  Als Rulings (5.8.)
//  ──────────────────
//  • Sie liegt IMMER in der Support-Zone, NIE in einer
//    Ability-Zone. Innerhalb der Support-Zone zaehlt
//    sie als ABILITY, nicht mehr als Artifact:
//      – Effekte, die gezielt Artifacts treffen,
//        greifen NICHT mehr.
//      – Effekte, die Abilities waehlen oder negieren,
//        KOENNEN sie waehlen.
//  • Nur auf dem BRETT. In Hand, Deck und Ablage ist
//    sie ganz normal ein Artifact — eine Deck-Suche
//    nach Artifacts findet sie, eine nach Abilities
//    nicht.
//  • Beim Spielen aus der Hand ist sie ein ARTIFACT,
//    also NICHT auf eine liegende Cloak legbar, und
//    Performance kann sie nicht upgraden. Es gilt aber
//    die "nur ein Stack pro Ability"-Regel: ein Held
//    kann hoechstens EINE Cloak tragen.
//  • Das Equippen kostet NICHT das Once-per-Turn-
//    Attachment (das gilt nur fuers Anlegen echter
//    Abilities).
//  • Der aktive Effekt kostet keine Aktion und kein
//    Gold, und er ist SOFORT in der Runde nutzbar, in
//    der die Karte gespielt wird — anders als bei
//    Creatures gibt es hier keine Beschwoerungs-
//    krankheit.
//  • Die +20 ATK sind PERMANENT und bleiben beim
//    Helden, auch wenn die Cloak das Feld verlaesst.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cloak of Edge';
const ATK_GAIN = 20;

module.exports = {
  isEquip: true,

  /**
   * DEKLARATIVER VERTRAG (zentral ausgewertet in
   * `engine.countsAsAbilityInZone`): diese Karte zaehlt, solange sie
   * in einer Support-Zone liegt, als Ability statt als Artifact.
   *
   * Bewusst ein Flag und keine Namensliste — kuenftige Karten mit
   * derselben Eigenschaft setzen es einfach ebenfalls.
   */
  countsAsAbilityInZone: true,

  /**
   * Ein Held darf hoechstens EINE Cloak tragen ("nur ein Stack pro
   * Ability"). Beim Spielen aus der Hand ist sie ein Artifact, kann
   * also NICHT auf eine liegende Cloak gelegt werden — die Pruefung
   * verhindert nur die zweite Kopie am selben Helden.
   */
  canEquipToHero(gs, pi, heroIdx, engine) {
    const zones = gs.players[pi]?.supportZones?.[heroIdx] || [];
    for (const slot of zones) {
      if ((slot || []).includes(CARD_NAME)) return false;
    }
    return true;
  },

  // ── Aktiver Effekt ────────────────────────────────────────────────
  // Der `equipEffect`-Vertrag bringt die "einmal pro Runde"-Sperre
  // schon mit (`equip-effect:<instId>` in hoptUsed) — genau das, was
  // der Kartentext verlangt. Keine Aktions- oder Goldkosten.
  equipEffect: true,

  /**
   * HARTE Einmal-pro-Runde-Sperre PRO NAME UND SPIELER (Als Reminder
   * 5.8.: "Alle aktiven Abilities sind hard once per turn, also graut
   * ein einziger Einsatz ALLE Kopien aus").
   *
   * Der `equipEffect`-Vertrag der Engine sperrt nur PRO INSTANZ
   * (`equip-effect:<instId>`) — das reicht hier NICHT: mit zwei Cloaks
   * an zwei Helden waeren sonst zwei Nutzungen pro Runde moeglich.
   * Deshalb derselbe Schluesselraum, den echte Abilities benutzen:
   * `free-ability:<Name>:<Spieler>`. So graut die eine Nutzung alle
   * Kopien dieses Spielers aus — und Charme kann sich keine zweite
   * borgen, weil es denselben Schluessel prueft.
   */
  hoptKeyFor(pi) {
    return `free-ability:${CARD_NAME}:${pi}`;
  },

  canActivateEquipEffect(ctx) {
    const engine = ctx._engine;
    const hero = engine.gs.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx];
    if (!hero || hero.hp <= 0) return false;
    const key = `free-ability:${CARD_NAME}:${ctx.cardOwner}`;
    return engine.gs.hoptUsed?.[key] !== engine.gs.turn;
  },

  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
    if (!hero || hero.hp <= 0) return false;

    // Ueber den kanonischen Helfer, damit die Curse-Sperre (ATK immer
    // 0) auch hier greift, statt `hero.atk` direkt zu erhoehen.
    // Sperre PRO NAME UND SPIELER stempeln — graut alle Kopien aus.
    if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
    engine.gs.hoptUsed[`free-ability:${CARD_NAME}:${pi}`] = engine.gs.turn;

    engine.actionGrantAtk(ctx.card, hero, pi, heroIdx, ATK_GAIN);

    engine.log('cloak_of_edge_atk', {
      player: engine.gs.players[pi]?.username,
      hero: hero.name,
      amount: ATK_GAIN,
    });
    engine.sync();
    return true;
  },
};
