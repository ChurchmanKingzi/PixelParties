// ═══════════════════════════════════════════
//  CARD EFFECT: "Natas, the Master of Hell"
//  Hero — Decay Magic / Diplomacy, 400 HP, 40 ATK (PP MBS)
//
//  „During your Resource Phase, instead of drawing a card from your
//   deck, you may add a copy of "The Master's Plan" from outside the game
//   to your hand. Whenever you negate an opponent's card or effect via
//   the effect of "The Master's Plan", inflict 2 Stacks of Poison to any
//   target on the board."
//
//  ① RESOURCE PHASE — `onResourceDrawReplace` (Engine, Resource Phase
//    nach den Hand-Reaktionen, vor dem Standard-Zug). Ja-Frage je
//    Durchlauf (auch bei wiederholter Resource Phase). Ja: der Zug
//    entfaellt (`gs._skipResourceDraw`), die Karte kommt von AUSSERHALB
//    des Spiels in die Hand (Muster Barkeeper: kein Flug, kein Stapel).
//    Hat schon Idol of Crestina das Ziehen ersetzt, entfaellt die Frage.
//    Unter Hand-Sperre nicht moeglich (die Karte kaeme nicht an).
//
//  ② NEGATION — `onNegationDealt` (Engine, `_meldeNegation`; Felder
//    `negatorOwner`, `negatedOwner`, `negatedCardName`, `kind`): feuert,
//    wenn eine Karte/ein Effekt des Gegners in der Kette vom Besitzer
//    dieses Helden NEGIERT wird — hier nur, wenn die negierende Karte
//    „The Master's Plan" ist (`ctx.negatedByCard`; Ruling 3.10.).
//    Pflichtwirkung („inflict"): ein Ziel waehlen, 2 Poison-Stacks.
//    Ziele wie Poison Vial: Helden und Kreaturen beider Seiten, ohne
//    Poison-Immune. Keine Ziele → verpufft.
//    Negated-STATUS auf Helden/Kreaturen zaehlt nicht (Ruling).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Natas, the Master of Hell';
const PLAN = "The Master's Plan";
const POISON_STACKS = 2;

function buildPoisonTargets(engine) {
  const gs = engine.gs;
  const targets = [];
  for (let pIdx = 0; pIdx < 2; pIdx++) {
    const pState = gs.players[pIdx];
    for (let hi = 0; hi < (pState.heroes || []).length; hi++) {
      const h = pState.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (h.statuses?.poison_immune) continue;
      targets.push({ id: `hero-${pIdx}-${hi}`, type: 'hero', owner: pIdx, heroIdx: hi, cardName: h.name });
    }
    for (const inst of engine.cardInstances) {
      if (inst.owner !== pIdx || inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      if (!engine.canApplyCreatureStatus(inst, 'poisoned')) continue;
      targets.push({
        id: `equip-${pIdx}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip', owner: pIdx, heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
      });
    }
  }
  return targets;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hero'],

  // Die Ja/Nein-Frage ist abbrechbar; ohne Antwort bricht die Engine sie
  // fuer die CPU ab. Master's Plan gegen eine Zufallskarte ist fuer die
  // CPU die bessere Wahl (kostenlose Reaktion), also immer ja.
  cpuResponse(engine, kind, promptData) {
    if (kind === 'effectTarget') {
      // Gift gehoert auf die Gegnerseite: Helden vor Kreaturen, den
      // gesunden zuerst (mehr Gift-Ticks bis zum Tod).
      const { validTargets, playerIdx } = promptData || {};
      const feinde = (validTargets || []).filter(t => t.owner !== playerIdx && !t.ineligible);
      if (feinde.length === 0) return undefined;
      const hp = (t) => (t.type === 'hero' ? (engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.hp ?? 0) : 0);
      feinde.sort((a, b) => (b.type === 'hero') - (a.type === 'hero') || hp(b) - hp(a));
      return [feinde[0].id];
    }
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    return { confirmed: true };
  },

  hooks: {
    onResourceDrawReplace: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      if (ctx.playerIdx !== pi) return;               // nur MEINE Resource Phase
      if (gs._skipResourceDraw) return;               // Ziehen schon ersetzt (Idol, andere Natas)
      const ps = gs.players[pi];
      if (!ps || ps.handLocked) return;

      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Instead of drawing a card, add "${PLAN}" from outside the game to your hand?`,
        showCard: PLAN,
        confirmLabel: `📜 Add ${PLAN}`,
        cancelLabel: 'Draw normally',
        cancellable: true,
      });
      const bestaetigt = typeof engine._confirmSaidYes === 'function'
        ? engine._confirmSaidYes(ja)
        : !!(ja && !ja.cancelled);
      if (!bestaetigt) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      gs._skipResourceDraw = true;

      // „From outside the game": kein Stapel, kein Flug (Muster Barkeeper).
      engine._broadcastEvent('card_reveal', { cardName: PLAN });
      engine._broadcastEvent('hand_card_materialize', { cardName: PLAN, playerIdx: pi, count: 1 });
      engine.handZugangSync(pi, PLAN, { source: CARD_NAME });
      engine.log('natas_plan', { player: ps.username, card: PLAN });
      engine.sync();
      await engine._delay(300);
    },

    onNegationDealt: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      if (ctx.negatorOwner !== pi) return;            // nur eigene Negationen
      if (ctx.negatedOwner === pi) return;            // nur Karten des GEGNERS
      if (ctx.negatedByCard !== PLAN) return;         // nur „via the effect of The Master's Plan"

      const targets = buildPoisonTargets(engine);
      if (targets.length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      const selectedIds = await engine.promptEffectTarget(pi, targets, {
        title: `${CARD_NAME} — Hellish Poison`,
        source: CARD_NAME,                 // CPU-Dispatch auf `cpuResponse` (Titel traegt ein Suffix)
        description: `You negated ${ctx.negatedCardName}! Choose any target to inflict ${POISON_STACKS} Stacks of Poison.`,
        confirmLabel: '☠️ Poison!',
        confirmClass: 'btn-danger',
        cancellable: false,
        maxTotal: 1,
      });
      if (!selectedIds || selectedIds.length === 0) return;
      const picked = targets.find(t => t.id === selectedIds[0]);
      if (!picked) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'plague_smoke',
        owner: picked.owner,
        heroIdx: picked.heroIdx,
        zoneSlot: picked.type === 'equip' ? picked.slotIdx : -1,
      });
      await engine._delay(500);

      const heroOwner = ctx.cardHeroOwner ?? pi;
      if (picked.type === 'hero') {
        await engine.addHeroStatus(picked.owner, picked.heroIdx, 'poisoned', {
          addStacks: POISON_STACKS,
          appliedBy: pi,
        });
      } else if (picked.cardInstance) {
        await engine.actionApplyCreaturePoison(
          { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx, heroOwner },
          picked.cardInstance,
          POISON_STACKS,
        );
      }

      engine.log('natas_poison', {
        player: gs.players[pi]?.username, target: picked.cardName,
        stacks: POISON_STACKS, negated: ctx.negatedCardName,
      });
      engine.sync();
    },
  },
};
