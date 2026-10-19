// ═══════════════════════════════════════════
//  CARD EFFECT: „Secret Lab Entrance"
//  Artifact (Equipment, Cost 0)
//
//  „You can only equip this card to a Hero you control with the
//   Inventing Ability. Once per turn, when you use that Hero's
//   Inventing Ability, you may immediately use it an additional time
//   after that."
//
//  W16e (F02-02): bisher trug das Skript nur die Seitenbindung.
//
//  ① AUSRUESTBESCHRAENKUNG ueber `canEquipToHero`: der Held muss einen
//    Inventing-Stapel fuehren (`heroAbilityStackOf`: Ability Zone oder
//    Support-Zonen-Stapel, Xal).
//  ② ZUSATZNUTZUNG ueber `onActiveEffectUsed` (Meldung jeder freien
//    Ability-Aktivierung, `doActivateFreeAbility`): nutzt der TRAEGER
//    seine Inventing, darf er sie — einmal pro Zug und Lab — gleich ein
//    weiteres Mal ausfuehren (Ja/Nein). Die Zusatznutzung ist KEINE neue
//    Aktivierung: die Tagessperre der Ability (`free-ability:…`) wird nicht
//    angefasst, es gibt keine Kettenfenster und keinen zweiten Reveal; sie
//    laeuft ueber denselben `onFreeActivate`-Weg (Kosten und Abbruch der
//    Ability gelten wie gewohnt). Bricht der Spieler die Zusatznutzung
//    ab (Abwurf abgebrochen), bleibt der Lab-Stempel frei.
//    Nur der Traeger selbst: geliehene Abilities (Lizbeth/Smugbeth) und
//    uebernommene Helden zaehlen nicht ("that Hero's Inventing Ability").
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Secret Lab Entrance';
const ABILITY = 'Inventing';

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,
  activeIn: ['support'],

  /** ① „… a Hero you control with the Inventing Ability" */
  canEquipToHero(gs, pi, heroIdx, engine) {
    const eng = engine || gs?._engineRef;
    if (!eng?.heroAbilityStackOf) return false;
    return !!eng.heroAbilityStackOf(pi, heroIdx, ABILITY);
  },

  hooks: {
    /** ② Zusatznutzung der Inventing des Traegers. */
    onActiveEffectUsed: async (ctx) => {
      if (ctx.kind !== 'ability' || ctx.isActionCost) return;
      if (ctx._labZweitnutzung) return;
      const lab = ctx.card;
      if (!lab || lab.zone !== 'support' || lab.faceDown) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const feld = ctx.cardHeroOwner ?? ctx.cardOwner;            // Brettseite des Traegers
      const pi = ctx.cardController ?? ctx.cardOwner;             // Kontrolleur der Lab
      if (ctx.heroIdx !== lab.heroIdx || ctx.playerIdx !== pi || feld !== pi) return;   // nur die eigene Inventing des Traegers
      const hoptKey = `${CARD_NAME}:${lab.id}`;
      if (gs.hoptUsed?.[`${hoptKey}:${pi}`] === gs.turn) return;

      // Der genutzte Stapel: `ctx.cardName` ist hier die Lab selbst (Hook-Kontext), der Name der genutzten Ability steht nicht
      // im Kontext — er folgt aus Held + Zone der Meldung (`zoneIdx`; Ability Zone, sonst Support-Zonen-Stapel wie bei Xal).
      const ps = gs.players[pi];
      const abSlot = ps.abilityZones?.[lab.heroIdx]?.[ctx.zoneIdx];
      const supSlot = ps.supportZones?.[lab.heroIdx]?.[ctx.zoneIdx];
      const zoneKind = (abSlot && abSlot[0] === ABILITY) ? 'ability'
        : (supSlot && supSlot[0] === ABILITY && engine.heroAcceptsAbilitiesInSupport(pi, lab.heroIdx)) ? 'support' : null;
      if (!zoneKind) return;                                  // eine andere Ability wurde genutzt
      const level = (zoneKind === 'ability' ? abSlot : supSlot).length;
      const abInst = engine.cardInstances.find(c =>
        c.owner === pi && c.heroIdx === lab.heroIdx && c.name === ABILITY && c.zone === zoneKind && c.zoneSlot === ctx.zoneIdx);
      if (!abInst) return;
      const script = loadCardEffect(ABILITY);
      if (!script?.onFreeActivate) return;
      const abCtx = engine._createContext(abInst, {});
      abCtx._labZweitnutzung = true;
      if (script.canFreeActivate && !script.canFreeActivate(abCtx, level)) return;   // Zusatznutzung muss moeglich sein (z. B. Handkarte da)

      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Use ${ABILITY} an additional time with ${gs.players[feld]?.heroes?.[lab.heroIdx]?.name || 'this Hero'}?`,
        showCard: CARD_NAME,
        confirmLabel: '🔬 Use again',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!engine._confirmSaidYes(ja)) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      const ergebnis = await engine._alsAkteur(abCtx, () => script.onFreeActivate(abCtx, level));
      if (ergebnis === false) return;                          // abgebrochen: Stempel bleibt frei
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[`${hoptKey}:${pi}`] = gs.turn;
      engine.log('secret_lab_extra_use', { player: gs.players[pi]?.username, hero: gs.players[feld]?.heroes?.[lab.heroIdx]?.name });
      engine.sync();
    },
  },
};
