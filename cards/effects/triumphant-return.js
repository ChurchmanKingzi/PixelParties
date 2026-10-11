// ═══════════════════════════════════════════
//  CARD EFFECT: "Triumphant Return"
//  Spell (Reaction, Magic Arts Lv1)
//
//  „Play this card immediately when a Hero you control, except the user, is revived. Immediately perform an additional Action with
//   that Hero."
//
//  ── FENSTER: `isHeroRevivedReaction` (v1491) ───────────────────────────
//  Neues Hand-Fenster `_checkHeroRevivedHandReactions` (siehe CARD_API): läuft nach JEDER echten Wiederbelebung — `actionReviveHero`
//  (Golden Ankh, Hymn, Cheat Chair …) und Extra Life (Trial of Coolness, Cecilia) —, steht nur dem KONTROLLEUR des Helden offen.
//
//  ── WER SPIELT, WER HANDELT ─────────────────────────────────────────────
//  • „except the user": der Wirker der Karte ist NIE der wiederbelebte Held (`reactionCasterAllowed`). Ein anderer eigener Held,
//    der Magic Arts Lv1 wirken kann (lebend, nicht eingefroren …), muss da sein — sonst wird die Karte nicht angeboten. Der Wirker muss
//    NICHT der wiederbelebte sein, er darf es nicht sein.
//  • Die Zusatzaktion gehört IMMER dem WIEDERBELEBTEN Helden („with that Hero"), nicht dem Wirker: `performImmediateAction(pi, heroIdx)`
//    — SOFORT, mitten in der Aufloesung der Wiederbelebung (also auch im Zug des Gegners). Hat dieser Held in dem Moment keine legitime
//    Aktion (keine spielbare Karte, keine Ability mit Aktionskosten wie Adventurousness, kein Heldeneffekt mit Aktionskosten), liefert die
//    Engine `{ played: false }` ohne Frage: die Bonus-Aktion VERFAELLT, die Karte ist trotzdem verbraucht. Abbruch des Auswahlfensters
//    verfaellt sie ebenso — aufgespart wird nichts.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `triumphant_return` (Pixelart, ANIM_REGISTRY): goldene Lichtsaeule, Strahlenkranz, Sterne und Konfetti ueber dem
//  wiederbelebten Helden. Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const CARD_NAME = 'Triumphant Return';
const BILD_MS = 700;         // Fanfare, bevor die Aktionswahl erscheint (deckt sich mit `triumphant_return` im Client)

module.exports = {
  // Reaction-Karte: nie aktiv aus der Hand spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isHeroRevivedReaction: true,

  /** „except the user": der wiederbelebte Held selbst kann die Karte nicht spielen. */
  reactionCasterAllowed(gs, pi, heroIdx, engine, info, seite) {
    if (!info) return true;
    return !((seite ?? pi) === info.heroOwner && heroIdx === info.heroIdx);
  },

  /** Angeboten fuer den Kontrolleur des wiederbelebten (lebenden) Helden. */
  heroRevivedCondition(gs, pi, engine, info) {
    return !!info && info.controller === pi && info.hero?.hp > 0;
  },

  async heroRevivedResolve(engine, pi, info) {
    const hero = info.hero;
    if (!hero?.name || !(hero.hp > 0)) return;
    engine._broadcastEvent('play_zone_animation', {
      type: 'triumphant_return', owner: info.heroOwner, heroIdx: info.heroIdx, zoneSlot: -1, duration: 1300,
    });
    await engine._delay(BILD_MS);
    if (!(hero.hp > 0)) return;
    // SOFORT, mit dem wiederbelebten Helden. Ohne legitime Aktion gibt die Engine `{ played: false }` zurueck, ohne zu fragen.
    const r = await engine.performImmediateAction(pi, info.heroIdx, {
      title: CARD_NAME,
      description: `${hero.name} has returned — perform an additional Action with ${hero.name} right now!`,
      ...(info.heroOwner !== pi ? { heroOwner: info.heroOwner } : {}),
    });
    engine.log('triumphant_return', {
      player: engine.gs.players[pi]?.username, hero: hero.name, acted: !!r?.played,
    });
  },
};
