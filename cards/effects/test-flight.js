// ═══════════════════════════════════════════
//  CARD EFFECT: "Test Flight"
//  Spell (Reaction, Lv1, Magic Arts)
//
//  „Play this card immediately when a Hero you control that can use this
//   Spell would be hit by an Attack or Spell whose level is lower than
//   that Hero's Magic Arts level. Negate all effects the Attack/Spell
//   would have on that Hero (including damage)."
//
//  Bauform: Schwester von Future Tech Escape Device (Attack/Spell-Quelle mit Stufenregel, Schutz des EINEN Helden per
//  Effekt-Immunität) und Barrier of Faith (Reaktions-SPELL: es zählt, wer ihn wirkt). Die Vorlage „Future Tech Jetpack"
//  liefert die Regel selbst — ein Held, der der Stufe nach nicht zu treffen ist, weicht aus; hier mit der eigenen
//  Magic-Arts-Stufe statt der Zahl der Karten in der Ablage.
//
//  ── „WOULD BE HIT" = Post-Target-Fenster ───────────────────────────────
//  `isPostTargetReaction`: feuert einmal je Quelle, nachdem die Ziele feststehen — für Einzelziel UND Fläche („hit" heißt
//  getroffen, nicht gewählt; ein Flächenschlag wählt gar nicht). Nur echte Attack- und Spell-KARTEN (ohne Katalogeintrag
//  gibt es keine Stufe, also keine Entscheidung — Lehre aus Escape Device 21.8.). Eigene wie fremde Quellen: der Text sagt
//  nicht „opponent's".
//
//  ── DER WIRKER IST DER GETROFFENE HELD ─────────────────────────────────
//  „a Hero you control THAT CAN USE THIS SPELL would be hit … THAT Hero's Magic Arts level": der getroffene Held muss die
//  Karte wirken können (Schule, Level, Status, Wisdom — `_canHeroActivateSurprise`) UND seine Magic-Arts-Stufe muss die
//  der Quelle ÜBERTREFFEN (strikt: gleiche Stufe schützt nicht). Mit Magic Arts ≥ 1 deckt er Test Flights eigene Stufe 1 ab,
//  Wisdom fällt also nie an. Das Fenster fragt dafür `reactionCasterAllowed` (Info: `{ postTarget, targetedHeroes,
//  sourceCard }`): nur ein getroffener eigener Held, dessen Stufe reicht, darf wirken. Treffen Quellen mehrere eigene
//  Helden, fragt das Fenster wie bei jeder Hand-Reaktion, WELCHER Held wirkt — und genau dieser Held ist der geschützte.
//  Der gewählte Wirker kommt über `opts.casterIdx` in `postTargetResolve`.
//
//  ── SCHUTZ: IMMER IMMUNITÄT, NIE `effectNegated` ───────────────────────
//  Wie Escape Device / Barrier of Faith: die Karte läuft sichtbar durch, nur an diesem einen Helden prallt ALLES ab
//  (`engine.grantEffectImmunity`: Schaden, Status und alles, was über `addHeroStatus` läuft; andere Ziele bleiben
//  betroffen).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_zone_animation` `test_flight` (Client: ANIM_REGISTRY, Pixelart): Zwei Düsenflammen am Rucksack des Helden, Rauchfahne
//  darunter, Windstreifen, an denen der Treffer vorbeigeht. Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const CARD_NAME = 'Test Flight';
const SCHOOL = 'Magic Arts';
const FLUG_MS = 900;      // Länge der Animation (deckt sich mit `test_flight` im Client)

/** Stufe der Quelle, wenn sie eine echte Attack-/Spell-Karte ist; sonst null (keine Entscheidung). */
function quellStufe(engine, sourceCard, damageType) {
  const src = sourceCard?.name ? engine._getCardDB()[sourceCard.name] : null;
  if (!src) return null;
  // W26a (Al, Welle 26): als Attack/Spell geltender Heldeneffekt (Alice, Broghan, Brackle, Arthor, Heragas, Kohta) = Stufe 0.
  if (src.cardType !== 'Attack' && src.cardType !== 'Spell') return engine._heldenEffektStufe?.(sourceCard.name, damageType) ?? null;
  return src.level || 0;
}

/**
 * Darf der getroffene Held `hi` (Brettseite `seite`, Standard = `pi`) Test Flight gegen diese Stufe wirken? (Stufe strikt höher, Held kann die Karte wirken.)
 * W20c (Al 20.10.): „a Hero you control" — auch ein von `pi` übernommener Held der Gegenspalte (`seite` ≠ `pi`); Stufe aus SEINEN Ability Zones.
 */
function heldPasst(engine, pi, hi, stufe, seite = pi) {
  const hero = engine.gs.players[seite]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return false;
  const darf = seite === pi
    ? engine._canHeroActivateSurprise(pi, hi, CARD_NAME, { spellInHand: true })
    : engine._canHeroActivateSurprise(seite, hi, CARD_NAME, { spellInHand: true, reaktor: pi });
  if (!darf) return false;
  return stufe < engine.effectiveSchoolLevelForCaster(SCHOOL, pi, hi, seite);
}

module.exports = {
  // Reaction-Karte: nie aktiv aus der Hand spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard, opts) {
    const stufe = quellStufe(engine, sourceCard, opts?.damageType);
    if (stufe == null) return false;
    return (targetedHeroes || []).some(t => t.type === 'hero' && engine.zielSeite(t) === pi && heldPasst(engine, pi, t.heroIdx, stufe, t.owner));
  },

  /** Wirker: nur ein GETROFFENER eigener Held, dessen Magic-Arts-Stufe die der Quelle übertrifft. */
  reactionCasterAllowed(gs, pi, heroIdx, engine, info, seite = pi) {
    if (!info?.postTarget) return false;
    const stufe = quellStufe(engine, info.sourceCard, info.damageType);
    if (stufe == null) return false;
    const getroffen = (info.targetedHeroes || []).some(t => t.owner === seite && t.type === 'hero' && t.heroIdx === heroIdx && engine.zielSeite(t) === pi);
    return getroffen && heldPasst(engine, pi, heroIdx, stufe, seite);
  },

  async postTargetResolve(engine, pi, targetedHeroes, sourceCard, opts) {
    const gs = engine.gs;
    const hi = opts?.casterIdx;
    if (!Number.isInteger(hi)) return {};
    const seite = opts?.casterSeite ?? pi;   // W20c: Brettseite des Wirkers (übernommener Held)
    // Der Wirker ist der geschützte Held — und muss unter den Zielen stehen.
    const ziel = (targetedHeroes || []).find(t => t.owner === seite && t.type === 'hero' && t.heroIdx === hi);
    if (!ziel) return {};
    const hero = gs.players[seite]?.heroes?.[hi];

    engine._broadcastEvent('play_zone_animation', {
      type: 'test_flight', owner: seite, heroIdx: hi, zoneSlot: -1,
    });
    await engine._delay(FLUG_MS * 0.55);   // der Treffer geht erst vorbei, wenn der Held in der Luft ist

    engine.log('test_flight', {
      player: gs.players[pi]?.username, hero: hero?.name || ziel.cardName,
      negated: sourceCard?.name || 'an Attack or Spell',
    });
    engine.grantEffectImmunity(seite, hi, sourceCard);
    engine.sync();
    return {};
  },

  /**
   * CPU: gegen die EIGENEN Karten (Heilzauber auf den eigenen Helden, eigener Flächenschlag) wehrt sich der Bot nicht —
   * die Karte ist gratis, aber nicht jede Treffer-Gelegenheit ist ein Angriff.
   */
  cpuMeta: {
    reactionHeuristic(engine, promptData) {
      const ctx = promptData?._postTargetContext;
      if (!ctx) return true;
      return ctx.sourceOwner !== engine._cpuPlayerIdx;
    },
  },
};
