// ═══════════════════════════════════════════
//  CARD EFFECT: "Doctor Fester"
//  Creature (Normal)
//
//  "Heroes with at least Fighting 2 may summon
//  this Creature regardless of its level. If no
//  target on the board is currently Bleeding,
//  you may Bleed the user for the rest of the
//  game to summon this Creature as an additional
//  Action. You may once per turn choose a target
//  and Bleed it for the rest of the game."
//
//  Als Ruling 6 (4.9.): Fighting 2 hebt nur die
//  Level-Anforderung auf; die Zusatzbeschwoerung
//  laeuft ueber den beschwoerenden Helden; der
//  aktive Effekt ist ein normaler Creature-Effekt
//  (ein blutender Doctor nimmt danach selbst 50).
//
//  Umsetzung (v712)
//  ────────────────
//  • Level: `canBypassLevelReq` (Karten-Vertrag)
//    bei Fighting ≥ 2 des Helden.
//  • Zusatzbeschwoerung (v717, Archer-Muster —
//    Als Vorgabe 4.9.): `inherentAction` solange
//    kein Ziel blutet → der NORMALE Summon-Pfad
//    (Drag auf die Zone oder Klick) laeuft als
//    Zusatzaktion, Zonen leuchten wie bei Archer;
//    `beforeSummon` erhebt die Kosten (Held blutet,
//    mit Rueckfrage, Abbruch kostet nichts). Der
//    Summon ist dann die erste Handlung des
//    Blutenden → 50 Bleed-Schaden (Engine).
//    Der Summon ist eine Handlung des blutenden
//    Helden → er nimmt danach 50 (Engine).
//  • Aktiver Effekt (HOPT): Ziel waehlen (beide
//    Seiten, Helden und Creatures) → Bleed.
// ═══════════════════════════════════════════

const {
  bleedHero, bleedTarget, collectPlayerTargets, anyTargetBleeding, heroFightingLevel,
} = require('./_bleed-shared');

const CARD_NAME = 'Doctor Fester';
const FIGHTING_REQ = 2;


module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,
  // v714: der Fighting-2-Bypass ist ein NORMALER Beschwoerungsweg — der
  // Client darf die Zonen des Helden aufleuchten lassen (Engine
  // `getHeroBypassSummonCards`; Deepsea-artige Placement-Bypaesse bleiben
  // ohne dieses Flag ausgeschlossen).
  normalSummonBypass: true,

  /** „Heroes with at least Fighting 2 may summon this Creature regardless of its level." */
  canBypassLevelReq(gs, playerIdx, heroIdx, cardData, engine) {
    return heroFightingLevel(engine, playerIdx, heroIdx) >= FIGHTING_REQ;
  },

  // ── Zusatzbeschwoerung (Archer-Muster, v717) ──────────────────────
  /**
   * Inherent-Action-Gate: solange KEIN Ziel auf dem Brett blutet, spielt
   * sich Doctor Fester als Zusatzaktion — Drag UND Klick laufen dann
   * ueber den normalen Summon-Pfad (Zonen leuchten wie bei Archer).
   * Sobald irgendwo Bleed liegt, bleibt nur der normale Summon.
   */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return !anyTargetBleeding(engine);
  },

  /**
   * Kosten des Zusatz-Pfads (nur bei `isInherentAction`): der
   * beschwoerende Held blutet — mit Rueckfrage, Abbruch laesst die
   * Karte in der Hand und kostet nichts. Der Summon selbst ist danach
   * die erste Handlung des Blutenden → 50 Bleed-Schaden (Engine).
   */
  async beforeSummon(ctx) {
    if (!ctx.isInherentAction) return true;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const hi = ctx.cardHeroIdx;
    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0) return false;
    if (anyTargetBleeding(engine)) return false;
    if (!hero.statuses?.bleeding) {
      const ok = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${hero.name} Bleeds for the rest of the game to summon Doctor Fester as an additional Action. Continue?`,
        showCard: CARD_NAME,
        confirmLabel: '🩸 Bleed & summon',
        cancelLabel: 'Cancel',
        cancellable: true,
      });
      if (!engine._confirmSaidYes(ok)) return false;
      const bled = await bleedHero(engine, pi, hi, CARD_NAME, pi, { animationType: 'bloody_cut' });
      if (!bled) return false;
    }
    engine.log('doctor_fester_bleed_summon', { player: engine.gs.players[pi]?.username, heroIdx: hi });
    engine.sync();
    return true;
  },

  // ── Aktiver Effekt: ein Ziel bluten lassen ────────────────────────
  cpuResponse(engine, kind, promptData) {
    if (kind === 'effectTarget' && promptData?.source === CARD_NAME) {
      const pi = promptData.playerIdx;
      const targets = promptData.validTargets || [];
      const opp = targets.filter(t => t.owner !== pi);
      const pick = opp.find(t => t.type === 'hero') || opp[0] || null;
      return pick ? { selectedIds: [pick.id] } : null;
    }
    return null;
  },
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    return collectPlayerTargets(engine, 0, { notBleeding: true }).length
      + collectPlayerTargets(engine, 1, { notBleeding: true }).length > 0;
  },
  onCreatureEffect: async (ctx) => {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const options = [...collectPlayerTargets(engine, 0, { notBleeding: true }),
                     ...collectPlayerTargets(engine, 1, { notBleeding: true })];
    if (options.length === 0) return false;
    const pick = await engine.promptEffectTarget(pi, options, {
      title: CARD_NAME, source: CARD_NAME,
      description: 'Choose a target to Bleed for the rest of the game.',
      confirmLabel: '🩸 Bleed!', confirmClass: 'btn-danger',
      cancellable: true, maxTotal: 1, minRequired: 1,
      _skipPostTargetReactions: true,
    });
    if (!pick || pick.length === 0) return false;
    const chosen = options.find(t => t.id === pick[0]);
    if (!chosen) return false;
    const ok = await bleedTarget(engine, chosen, CARD_NAME, pi, { animationType: 'bloody_cut' });
    if (ok) engine.log('doctor_fester_bleed', { player: engine.gs.players[pi]?.username, target: chosen.cardName });
    engine.sync();
    return true;
  },
};
