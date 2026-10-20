'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Glass Wall"
//  Spell (Surprise, Magic Arts Lv1)
//
//  „Activate this Surprise when the user is chosen by a level 1 or lower Attack, Spell or Creature effect. Negate that Attack/Spell/effect. You may leave this activated
//   Surprise face-up in the user's Surprise Zone. If the user would be hit by an Attack while this card is in its Surprise Zone face-up, you may send this card to your
//   discard pile to negate any effect the Attack would have on the user."
//
//  ── VORGABE 12.10. ──────────────────────────────────────────────────────
//  „Mit leichter Änderung" (der zweite Satz ist neu). Wichtig: Die „zweite Aktivierung", solange die Karte face-up liegt, ist UNABHÄNGIG vom Level der Attack möglich und
//  auch dann, wenn zusätzlich noch weitere Ziele getroffen werden, aber nur gegen Attacks.
//
//  ── ERSTE AKTIVIERUNG (gewöhnliche Surprise, Bauform „Frost Rune") ──────
//  `surpriseTrigger`: der Träger wird von einem Attack, Spell oder Creature-Effekt GEWÄHLT (`isAttackSpellOrCreatureSource`) und die Quelle hat die Stufe 1 oder niedriger.
//  Die Stufe ist die gedruckte der Quellkarte (Attack/Spell: die Karte; Creature-Effekt: die Kreatur). Quellen ohne Katalogeintrag (Heldeneffekte) haben keine Stufe und
//  lösen nicht aus — außer „als Spell geltende" (`treatedAsSpell`, Alice: Stufe 0; W24b N2-08). `onSurpriseActivate` liefert `{ effectNegated: true }` (die Quelle wird ganz negiert) und fragt: „You may leave this activated Surprise face-up" —
//  `stayFaceUp: true` in der Antwort lässt die Karte offen in der Surprise Zone liegen (neu in der Engine, `_activateSurprise`; wie `staysFaceUpOnActivation`, aber als
//  Entscheidung zur Laufzeit). Nein = die Karte geht wie jede Surprise in die Ablage. Eine offen liegende Karte löst NICHT ein zweites Mal als Surprise aus
//  (`_checkSurpriseWindow` überspringt offene Karten).
//
//  ── ZWEITE AKTIVIERUNG (offen in der Surprise Zone) ─────────────────────
//  „would be hit by an Attack": das Board-Post-Target-Fenster (`isPostTargetBoardReaction`, wie Castling) — feuert einmal je Quelle, nachdem die Ziele feststehen, für
//  Einzelziel UND Fläche; die Engine nimmt dafür seit 12.10. auch OFFEN liegende Karten in Surprise Zonen mit (`_checkPostTargetBoardReactions`). Bedingungen: die Quelle
//  ist ein Attack (`isAttackSpellOrCreatureSource` mit `kinds: ['attack']`: Attack-Karte oder als Attack geltender Effekt), der Träger steht unter den GETROFFENEN Helden
//  (egal wie viele weitere Ziele), er lebt — KEINE Stufenregel, KEIN Fähigkeits-/Statuscheck des Helden (die Karte wirkt von selbst). „you may": Bestätigung. Dann geht die Karte in
//  die Ablage (Ablage ihres Besitzers) und der Held ist gegen diese Quelle immun (`engine.grantEffectImmunity`: Schaden, Status und alles, was über `addHeroStatus` läuft;
//  andere Ziele bleiben betroffen und die Attack läuft sichtbar durch). Eigene Attacks können es ebenfalls auslösen (der Text sagt nicht „opponent's").
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `glass_wall_up` (erste Aktivierung: die Scheibe wächst, der Treffer prallt ab) und `glass_wall_shatter` (zweite: die offene Scheibe zerspringt) —
//  Client: `ppGlasWand`, Pixelart. Klänge in ZONE_ANIM_SFX. Logs `glass_wall_negate`, `glass_wall_shatter`.
// ═══════════════════════════════════════════

const { isAttackSpellOrCreatureSource } = require('./_hooks');

const CARD_NAME = 'Glass Wall';
const MAX_STUFE = 1;            // „level 1 or lower"
const UP_MS = 1000;             // Länge von `glass_wall_up` (deckt sich mit `ppGlasWand` im Client)
const SPLITTER_MS = 1000;       // Länge von `glass_wall_shatter`
const BRUCH_MS = 420;           // bis die Scheibe bricht (deckt sich mit BRUCH in `ppGlasWand`)

/** Gedruckte Stufe der Quellkarte (Attack/Spell: die Karte; Creature-Effekt: die Kreatur); null = keine Karte, keine Stufe. */
function quellStufe(engine, quelle) {
  const name = quelle?.cardName || quelle?.cardInstance?.name || quelle?.name;
  // W30a (Al, 21.10.2026): zählt der Effekt als Attack EINES HELDEN (Stempel `treatedAsAttack`: Infected Greatmaw, Bamboo Staff, Sacrificial Dagger, Alluring Light,
  // Clash of Champions), ist die Quellstufe das Fighting-Level dieses Helden — NICHT die gedruckte Stufe der Karte.
  const stempel = engine._stempelStufe?.(quelle, quelle?.damageType);
  if (stempel != null) return stempel;
  const cd = name ? engine._getCardDB()[name] : null;
  if (cd && typeof cd.level === 'number') return cd.level;
  // W24b N2-08: ein Heldeneffekt, der „als Spell" gilt (Alice, `treatedAsSpell`, Q108), zählt mit der dort erklärten Stufe (Alice: 0).
  // W26a (Al, Welle 26): auch Broghan, Brackle, Arthor, Heragas, Kohta (als Attack geltend) zählen als Stufe 0 (`_heldenEffektStufe`).
  // W27a (Al, 21.10.2026): auch als Attack geltende Gegenstandseffekte (Bamboo Staff, Crusader's, Javelin Throw, Sword in a Bottle …) = Stufe 0.
  const lv = name ? (engine._spellLevelAlsQuelle?.(name, quelle?.damageType) ?? engine._heldenEffektStufe?.(name, quelle?.damageType, quelle)) : null;
  return Number.isFinite(lv) ? lv : null;
}

/** Träger der offen liegenden Karte: Brettseite (`inst.owner`), Heldenindex, Held. */
function traeger(engine, inst) {
  const hero = engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx];
  return hero?.name ? { seite: inst.owner, heroIdx: inst.heroIdx, hero } : null;
}

/** Ist die Quelle des Zielfensters ein Attack? (Attack-Karte oder als Attack geltender Effekt) */
function istAttack(engine, source, info) {
  if (!source) return false;
  return isAttackSpellOrCreatureSource(engine, {
    cardName: source.name, cardInstance: source.cardInstance || source, damageType: info?.damageType,
  }, { kinds: ['attack'] });
}

module.exports = {
  // ★ Z7b: „Negate that Spell/Attack/effect" = die gewirkte Karte löst NIE auf → ihre Einmal-Stempel werden zurückgegeben
  // (Engine: `_merkeGanzeNegation`). Teil-Negierungen („… on that Hero", Schaden) tragen das Flag nicht.
  negatesWholeCard: true,

  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT, läuft ihr Effekt-Rumpf nie — die Engine spielt dann dieses Bild.
  spellVisual: { impact: { type: 'glass_wall_up' }, impactMs: 300 },

  isSurprise: true,

  // Ohne auslösenden Effekt gibt es nichts zu negieren (wie Frost Rune).
  canTelekinesisActivate: false,

  /** Der Träger wurde von einem Attack-, Spell- oder Creature-Effekt der Stufe 1 oder niedriger gewählt. */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (!sourceInfo || sourceInfo.owner == null || sourceInfo.owner < 0) return false;
    if (!isAttackSpellOrCreatureSource(engine, sourceInfo)) return false;      // Helden-/Artefakt-/Trank-Effekte lösen nicht aus
    const stufe = quellStufe(engine, sourceInfo);
    return stufe != null && stufe <= MAX_STUFE;
  },

  /** Negiert die Quelle und fragt, ob die Karte offen liegen bleibt. */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;                          // wer die Surprise auslöst
    const seite = ctx.cardHeroOwner ?? pi;             // Brettseite des Trägers
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[seite]?.heroes?.[heroIdx];

    engine._broadcastEvent('play_zone_animation', { type: 'glass_wall_up', owner: seite, heroIdx, zoneSlot: -1 });
    await engine._delay(UP_MS * 0.65);                 // die Scheibe steht, der Treffer prallt ab

    engine.log('glass_wall_negate', { player: gs.players[pi]?.username, hero: hero?.name, negated: sourceInfo?.cardName || 'an effect' });
    const offen = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      _gwPhase: 'stay',
      message: `${sourceInfo?.cardName || 'The effect'} was negated. Leave ${CARD_NAME} face-up in ${hero?.name || 'the Hero'}'s Surprise Zone? `
        + `While it lies there, it can be sent to the discard pile to negate any effect an Attack would have on ${hero?.name || 'the Hero'}.`,
      showCard: CARD_NAME,
      confirmLabel: '🪟 Leave it face-up',
      cancelLabel: 'Discard it',
      cancellable: true,
    });
    engine.sync();
    return { effectNegated: true, stayFaceUp: !!offen };
  },

  // ── Zweite Aktivierung: offen in der Surprise Zone, „would be hit by an Attack" ──
  isPostTargetBoardReaction: true,

  postTargetBoardCondition(gs, pi, engine, targets, source, inst, info) {
    if (!inst || inst.zone !== 'surprise' || inst.faceDown) return false;
    const t = traeger(engine, inst);
    if (!t || t.hero.hp <= 0) return false;
    if (!istAttack(engine, source, info)) return false;            // nur gegen Attacks, jede Stufe
    return (targets || []).some(z => z.type === 'hero' && z.owner === t.seite && z.heroIdx === t.heroIdx);
  },

  async postTargetBoardResolve(engine, pi, targets, source, inst) {
    const gs = engine.gs;
    const t = traeger(engine, inst);
    if (!t) return;
    const srcName = source?.name || 'an Attack';
    const ja = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      _gwPhase: 'break',
      _gwSourceOwner: source?.controller ?? source?.owner ?? -1,
      message: `${t.hero.name} would be hit by ${srcName}. Send ${CARD_NAME} to the discard pile to negate any effect it would have on ${t.hero.name}?`,
      showCard: CARD_NAME,
      showCardLeft: source?.name,
      confirmLabel: '🪟 Shatter it!',
      cancelLabel: 'No',
      cancellable: true,
    });
    if (!ja) return;

    engine._broadcastEvent('play_zone_animation', { type: 'glass_wall_shatter', owner: t.seite, heroIdx: t.heroIdx, zoneSlot: -1 });
    await engine._delay(BRUCH_MS);                        // die Risse laufen, dann bricht die Scheibe
    engine.grantEffectImmunity(t.seite, t.heroIdx, source);
    engine.log('glass_wall_shatter', { player: gs.players[pi]?.username, hero: t.hero.name, negated: srcName });
    if (inst.zone === 'surprise') {
      // Flug Surprise Zone → Ablage, an die Zone des Trägers gebunden (gleichnamige Karten auf anderen Helden sind sonst nicht unterscheidbar; Muster: Spider Silk Bridge).
      engine._broadcastEvent('play_pile_transfer', {
        owner: inst.owner, cardName: inst.name, fromOwner: inst.owner, toOwner: inst.originalOwner ?? inst.owner,
        from: 'surprise', to: 'discard', fromHeroIdx: inst.heroIdx,
      });
      await engine.actionMoveCard(inst, 'discard', -1, -1, { source: CARD_NAME });
    }
    engine.sync();
    await engine._delay(Math.max(0, SPLITTER_MS - BRUCH_MS - 300));      // die Splitter fliegen noch
  },

  /** CPU: offen liegen lassen; die Wand nur gegen fremde Attacks zerbrechen. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || payload?.type !== 'confirm' || payload?.title !== CARD_NAME) return undefined;
    if (payload._gwPhase === 'stay') return true;
    if (payload._gwPhase === 'break') return payload._gwSourceOwner !== engine._cpuPlayerIdx;
    return undefined;
  },
};
