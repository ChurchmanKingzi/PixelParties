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
//    Ability gelten wie gewohnt). W82 (Sinister Idol, Al): die Zusatznutzung
//    oeffnet dennoch ein Kettenfenster fuer Ability-Aktivierungen (Idol, Ragnarock …) und das
//    Surprise-Fenster, die Stufe wird danach neu gelesen (`engine.abilityAktivierungsFenster`). Bricht der Spieler die Zusatznutzung
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
      // W73a: `(heroIdx, zoneIdx)` gilt nur MIT der Zonenart — Ability Zone 0 und Support Zone 0 tragen dieselbe Nummer (vorher hielt die Lab ein Training in Support Zone 0 fuer die Inventing in Ability Zone 0).
      const zoneKind = ctx.zoneKind === 'support' ? 'support' : 'ability';
      const abSlot = zoneKind === 'ability' ? ps.abilityZones?.[lab.heroIdx]?.[ctx.zoneIdx] : null;
      const supSlot = zoneKind === 'support' && engine.heroAcceptsAbilitiesInSupport(pi, lab.heroIdx) ? ps.supportZones?.[lab.heroIdx]?.[ctx.zoneIdx] : null;
      if ((abSlot || supSlot || [])[0] !== ABILITY) return;   // eine andere Ability wurde genutzt
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
      // ★ W82 (Sinister Idol, Al): auch die Zusatznutzung öffnet das Kettenfenster für Ability-Aktivierungen (Idol, Ragnarock & Co.) samt Surprise-Fenster — sie ist laut Text keine NEUE
      // Aktivierung (die Tagessperre der Ability bleibt unberührt), wird aber „use it an additional time": ein Aktivierungsereignis, auf das Reaktionen antworten dürfen. Stufe danach neu gelesen,
      // Kosten = Stufe beim Aktivieren (`kostenStufe`), gesenkte Stufe = Pflicht-Auflösung. Negiert: die Zusatznutzung ist geschehen (Lab-Stempel gesetzt), die Ability wirkt nicht.
      const fenster = await engine.abilityAktivierungsFenster({ pi, heroIdx: lab.heroIdx, heroOwner: pi, slotHeroIdx: lab.heroIdx, zoneIdx: ctx.zoneIdx, zoneKind, abilityName: ABILITY, level, inst: abInst });
      if (!gs.hoptUsed) gs.hoptUsed = {};
      if (fenster.negated) {
        gs.hoptUsed[`${hoptKey}:${pi}`] = gs.turn;
        engine.log('secret_lab_extra_use_negated', { player: gs.players[pi]?.username });
        engine.sync();
        return;
      }
      const abCtx2 = fenster.inst && fenster.inst !== abInst ? engine._createContext(fenster.inst, {}) : abCtx;
      abCtx2._labZweitnutzung = true;
      abCtx2.kostenStufe = level;
      let ergebnis = await engine.mitPflichtAufloesung(pi, fenster.pflicht, () => engine._alsAkteur(abCtx2, () => script.onFreeActivate(abCtx2, fenster.stufe)));
      if (ergebnis === false && fenster.pflicht) { ergebnis = true; engine.log('sinister_idol_declined', { player: gs.players[pi]?.username, ability: ABILITY }); }
      if (ergebnis === false) return;                          // abgebrochen: Stempel bleibt frei
      gs.hoptUsed[`${hoptKey}:${pi}`] = gs.turn;
      engine.log('secret_lab_extra_use', { player: gs.players[pi]?.username, hero: gs.players[feld]?.heroes?.[lab.heroIdx]?.name });
      engine.sync();
    },
  },
};
