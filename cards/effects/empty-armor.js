// ═══════════════════════════════════════════
//  CARD EFFECT: „Empty Armor"
//  Creature · Normal · Summoning Magic Lv1 · 200 HP · PP SOB   (v1332)
//
//  „A Hero with full HP may summon this Creature as an additional Action
//   by taking 100 damage. The first time every turn the corresponding
//   Hero is chosen by an opponent's Attack, Spell or Creature effect,
//   redirect it to this Creature, if possible."   (Text v1332b)
//
//  ── ① ZUSATZBESCHWOERUNG (Big-Gwen-Guard-Muster) ──────────────────
//  „Full HP" = aktuelle HP ≥ max HP (Als Vorgabe 24.9. — ueberheilt
//  zaehlt). Der Preis sind 100 Schaden am beschwoerenden Helden, Typ
//  'other' (Selbstverletzung als Kosten, wie Ska Harpyformer).
//    • Kein Aktionsplatz mehr frei (Main Phase, Aktion verbraucht) →
//      `inherentAction` ist wahr, `beforeSummon` fragt nur noch, ob der
//      Held die 100 nimmt; Nein laesst die Karte in der Hand.
//    • Aktionsplatz frei → die Engine beschwoert normal (Aktion), und
//      `beforeSummon` bietet beide Wege an. Wer die 100 nimmt, bekommt
//      die Aktion zurueck (`gs._summonModeUpgradedToInherent`).
//  Nur beim NORMALEN Beschwoeren aus der Hand (`_isNormalSummon`) —
//  Platzierungen durch Karteneffekte kennen keinen Preis.
//
//  ── ② PFLICHT-UMLEITUNG (Brett-Waechter, v1332) ───────────────────
//  „redirect it" ohne „may" → `boardRedirectMandatory`, keine Rueckfrage.
//  Bedingungen (`canBoardRedirect`):
//    • gewaehlt wurde DER Held dieser Spalte („corresponding");
//    • die Quelle gehoert dem GEGNER und ist Attack, Spell oder
//      Creature-Effekt (`engine.sourceEffectKind`);
//    • die Ruestung ist fuer DIESE Quelle selbst ein waehlbares Ziel
//      (steht in der Zielliste und ist nicht gesperrt) — sonst waere die
//      Umleitung ein Leerlauf;
//    • ihr Effekt ist aktiv (`isCardEffectActive`: nicht eingefroren,
//      negiert o.ae.);
//    • „the first time every turn … if possible": einmal je Runde und
//      Instanz (Einheitszaehler). Verbraucht wird die Nutzung NUR, wenn
//      wirklich umgeleitet wird — ein Waehlen, das nicht umgeleitet
//      werden kann (die Quelle trifft nur Helden), kostet nichts (Als
//      Bestaetigung 24.9.; der Text sagt es seit v1332b ausdruecklich).
//  Flaechenschaden waehlt nicht und loest nichts aus.
//
//  ── ③ DER DASH (Als Vorgabe 24.9., wie Johanna) ───────────────────
//  Fuer JEDEN abgefangenen Effekt, auch ohne Schaden (Als Klarstellung
//  24.9.): im Moment der Umleitung springt die Ruestung von ihrer Zone
//  vor den Helden und kehrt zurueck — sie faengt ab. Der Effekt selbst
//  loest danach wie gewohnt auf der Ruestung auf (Schadenszahlen,
//  Statusbilder an ihrem Platz). Ein Dash je Umleitung.
// ═══════════════════════════════════════════

const { usesLeft, spendUse } = require('./_charges');

const CARD_NAME = 'Empty Armor';
const PREIS = 100;
const ZAEHLER = { key: 'emptyArmorRedirect', max: 1 };

/** Volle HP im Sinne der Karte: aktuelle HP ≥ max HP. */
function volleHp(hero) {
  return !!hero?.name && hero.hp > 0 && hero.hp >= (hero.maxHp || 0);
}

/**
 * Koennte DIESER Held die Ruestung gerade auf dem normalen Weg
 * beschwoeren? Dieselbe Rechnung wie der Beschwoerungsweg in server.js
 * (`doPlayCreature`): eine Zusatzaktions-Quelle fuer die Karte, oder in
 * der Action Phase eine noch freie (bzw. Bonus-)Aktion. In der Main
 * Phase gibt es fuer Beschwoerungen keine Grund-Aktion.
 */
function aktionFrei(engine, pi, heroIdx) {
  if (!engine) return false;
  const gs = engine.gs;
  const ps = gs.players?.[pi];
  if (!ps || gs.activePlayer !== pi) return false;
  if (engine.findAdditionalActionForCard?.(pi, CARD_NAME, heroIdx)) return true;
  if (gs.currentPhase !== 3) return false;
  if ((ps.heroesActedThisTurn || []).length === 0) return true;
  return (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0)
    || ((ps._bonusMainActions || 0) > 0 && (ps._actionsPlayedThisPhase || 0) === 1);
}

/** Die Ruestung als Ziel in der Zielliste der Quelle (oder null). */
function eigenerEintrag(inst, validTargets) {
  return (validTargets || []).find(t => t && t.type === 'equip' && !t.ineligible && (
    (t.cardInstance && t.cardInstance.id === inst.id)
    || (t.owner === inst.owner && t.heroIdx === inst.heroIdx && t.slotIdx === inst.zoneSlot)
  )) || null;
}

/** Die 100 Schaden als Preis. */
async function preisZahlen(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const hi = ctx.cardHeroIdx;
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return false;
  await ctx.dealDamage(hero, PREIS, 'other');
  engine.log('empty_armor_summon', { player: engine.gs.players[pi]?.username, hero: hero.name, damage: PREIS });
  engine.sync();
  return true;
}

module.exports = {
  activeIn: ['support'],

  // ── ① Zusatzbeschwoerung ─────────────────────────────────────────
  /** Nur ERZWUNGEN (kein Aktionsplatz frei) ist der Weg von vornherein frei. */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    if (!volleHp(gs.players[pi]?.heroes?.[heroIdx])) return false;
    return !aktionFrei(engine, pi, heroIdx);
  },

  async beforeSummon(ctx) {
    if (!ctx._isNormalSummon) return true;          // Karteneffekt-Platzierung: kein Preis
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const hi = ctx.cardHeroIdx;
    const hero = gs.players[pi]?.heroes?.[hi];
    if (!volleHp(hero)) return !ctx.isInherentAction;   // ohne volle HP nur der normale Weg

    if (ctx.isInherentAction) {
      // Erzwungener Zusatzweg — Preis bestaetigen oder abbrechen.
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${hero.name} takes ${PREIS} damage to summon ${CARD_NAME} as an additional Action. Continue?`,
        showCard: CARD_NAME,
        confirmLabel: `🛡️ Take ${PREIS} damage`,
        cancelLabel: 'Cancel',
        cancellable: true,
        _armorHeroHp: hero.hp,
      });
      if (!engine._confirmSaidYes(ja)) return false;
      return await preisZahlen(ctx);
    }

    // Aktionsplatz frei UND volle HP — der Spieler waehlt.
    const wahl = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Choose how to summon ${CARD_NAME}:`,
      showCard: CARD_NAME,
      confirmLabel: `🛡️ Take ${PREIS} damage (additional Action)`,
      cancelLabel: '⚔️ Normal (use the Hero\'s Action)',
      cancellable: true,
      _armorHeroHp: hero.hp,
    });
    if (!engine._confirmSaidYes(wahl)) return true;    // normal — Aktion ist schon verbucht
    if (!(await preisZahlen(ctx))) return false;
    gs._summonModeUpgradedToInherent = pi;             // Aktion zurueck (server.js)
    return true;
  },

  /** CPU: den Preis nur zahlen, wenn der Held danach noch gut dasteht. */
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type !== 'confirm' || promptData?.title !== CARD_NAME) return undefined;
    const hp = promptData._armorHeroHp;
    if (typeof hp !== 'number') return undefined;
    return { confirmed: hp - PREIS >= 200 };
  },

  // ── ② Pflicht-Umleitung ──────────────────────────────────────────
  isBoardRedirect: true,
  boardRedirectMandatory: true,

  canBoardRedirect(gs, ownerIdx, inst, selected, validTargets, config, sourceCard, engine) {
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    if (!selected || selected.type !== 'hero') return false;
    if (selected.owner !== inst.owner || selected.heroIdx !== inst.heroIdx) return false;
    if (!engine.isCardEffectActive(inst)) return false;
    // Gegnerische Quelle — Attack, Spell oder Creature-Effekt.
    const quellSeite = sourceCard?.controller ?? sourceCard?.owner;
    if (quellSeite == null || quellSeite === (inst.controller ?? inst.owner)) return false;
    const art = engine.sourceEffectKind(sourceCard);
    if (art !== 'attack' && art !== 'spell' && art !== 'creature') return false;
    if (usesLeft(inst, gs, ZAEHLER) <= 0) return false;
    return !!eigenerEintrag(inst, validTargets);
  },

  async onBoardRedirect(engine, ownerIdx, inst, selected, validTargets, config, sourceCard) {
    const ziel = eigenerEintrag(inst, validTargets);
    if (!ziel) return null;
    spendUse(inst, engine.gs, ZAEHLER);
    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: inst.controller ?? inst.owner });
    // ③ Der Dash — fuer jeden abgefangenen Effekt, im Moment der Umleitung.
    await engine.rammeBisKontakt({
      sourceOwner: inst.owner, sourceHeroIdx: inst.heroIdx, sourceZoneSlot: inst.zoneSlot,
      targetOwner: inst.owner, targetHeroIdx: inst.heroIdx,
      cardName: CARD_NAME, duration: 1200,
    });
    engine.log('empty_armor_redirect', {
      player: engine.gs.players[inst.controller ?? inst.owner]?.username,
      hero: selected.cardName, source: sourceCard?.name || null,
    });
    return { redirectTo: ziel };
  },
};
