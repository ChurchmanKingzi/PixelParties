// ═══════════════════════════════════════════
//  CARD EFFECT: "Embodiment of Biseria"
//  Creature (Summoning Magic Lv9, Normal) — 400 HP
//
//  „This Creature's level in your hand is reduced by the combined original levels of all Creatures on the board, except
//   "Embodiment of Biseria", to a minimum of 1. This Creature cannot be Frozen. You may once per turn choose a target and
//   deal 300 damage to it OR Freeze all Creatures your opponent controls for 1 turn."
//
//  ── STUFE IN DER HAND ───────────────────────────────────────────────────
//  `reduceCardLevel` (Chaorc-Bauform): die gedruckten („original") Stufen ALLER Kreaturen auf dem Brett — beide Seiten, nur
//  offene Kreaturen in Support Zonen (Ausrüstung zählt nicht; Tokens und Artifact Creatures sind Kreaturen, Letztere ohne
//  Stufe = 0) —, ohne „Embodiment of Biseria" selbst. Die Senkung greift nur für die Handkopie (`pileSide` = Deck/Ablage,
//  Brettkopie = nichts) und ist auf „Stufe − 1" gedeckelt („to a minimum of 1"). `selbstsenkungZaehlt`: mehrere Kopien senken
//  einander nicht doppelt.
//
//  ── NICHT EINFRIERBAR ───────────────────────────────────────────────────
//  Wie Mischief Militia - SnowItAll: `counters.freeze_immune` beim Einsetzen; `canApplyCreatureStatus` blockt jeden Frost.
//  Der Marker `selfFreezeImmune` hält die Karte aus den Auswahlen heraus, die „Freeze it" als Kosten verlangen.
//
//  ── EINMAL PRO ZUG: SCHADEN ODER FROST ──────────────────────────────────
//  `onCreatureEffect` (Harpthenean-Bauform): ein ODER-Wahlfenster, die Einmal-pro-Zug-Sperre der Engine gilt für beide Zweige
//  zusammen; Abbruch (Wahl oder Zielwahl) gibt die Nutzung frei.
//    • Schaden: beliebiges Ziel (Held oder Kreatur), 300 Schaden als Creature-Effekt. Bild: eine Eisfaust zerschmettert das Ziel
//      (`biseria_fist`).
//    • Frost: ALLE Kreaturen, die der Gegner kontrolliert, 1 Zug eingefroren (Helden nicht). Bild: ein Blizzard hüllt die ganze
//      Gegnerhälfte ein (`biseria_blizzard`), der Frost landet, wenn er am dichtesten tobt.
// ═══════════════════════════════════════════

const { selbstsenkungZaehlt } = require('./_hooks');
const { gegnerZiele } = require('./_frost-shared');

const CARD_NAME = 'Embodiment of Biseria';
const DAMAGE = 300;
const FREEZE_TURNS = 1;
const FIST_HIT_MS = 500;        // Schaden, wenn die Faust das Ziel trifft: 400 ms Animationszeit (`biseria_fist` im Client) + 100 ms Einbau-Versatz
const FIST_AFTER_MS = 500;      // Faust noch zerfallen lassen, bevor der Effekt endet
const BLIZZARD_MS = 2400;
const BLIZZARD_FREEZE_MS = 1150; // Frost, wenn der Blizzard am dichtesten ist
const BLIZZARD_AFTER_MS = 700;

/** Gedruckte Stufen aller offenen Kreaturen auf dem Brett (beide Seiten), ohne „Embodiment of Biseria". */
function brettStufen(engine) {
  let summe = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown || inst.name === CARD_NAME) continue;
    if (engine.isEquipInZone(inst.name, inst)) continue;
    const cd = engine.getEffectiveCardData(inst);
    if (!cd || !engine.isChoosableAsCreature(inst, cd)) continue;
    const lvl = Number(cd.level);
    if (Number.isFinite(lvl) && lvl > 0) summe += lvl;
  }
  return summe;
}

/** Kreaturen, die der Gegner kontrolliert (Frost-Ziele). */
function gegnerKreaturen(engine, oi) {
  return gegnerZiele(engine, oi).filter(z => z.type === 'creature' && z.inst?.zone === 'support');
}

module.exports = {
  // „Freeze all Creatures your opponent controls" ist eine Flächenwirkung ohne Schaden → von Hand deklariert (check-aoe-text).
  hitsMultipleTargets: true,
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hand', 'support'],
  creatureEffect: true,
  // Marker für „Freeze it"-Kosten (SnowItAll-Auswahl): diese Kreatur lässt sich nicht einfrieren.
  selfFreezeImmune: true,

  cpuMeta: { onDeathBenefit: 0 },

  /** „level in your hand is reduced by …, to a minimum of 1" */
  reduceCardLevel(cardData, engine, ownerIdx, inst, _heroIdx, evalOpts) {
    if (!cardData || cardData.name !== CARD_NAME) return 0;
    if (evalOpts?.pileSide) return 0;                                   // Deck / Ablage / Gelöscht: gedruckte Stufe
    // Wird eine Karte AUF DEM BRETT geprüft (Instanz kommt mit), gilt die Senkung nicht — nur „in your hand".
    if (evalOpts?.inst && evalOpts.inst.zone !== 'hand') return 0;
    if (!selbstsenkungZaehlt(engine, inst, CARD_NAME, ownerIdx)) return 0;
    const deckel = Math.max(0, (Number(cardData.level) || 0) - 1);      // Mindeststufe 1
    return Math.min(brettStufen(engine), deckel);
  },

  /** CPU: Frost, wenn der Gegner mindestens zwei Kreaturen hat; sonst Schaden. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || payload?.type !== 'optionPicker' || payload?.title !== CARD_NAME) return undefined;
    if (typeof payload.casterIdx !== 'number') return undefined;
    const oi = engine.opponentOf(payload.casterIdx);
    const ziele = gegnerKreaturen(engine, oi).filter(z => !z.inst.counters?.frozen);
    const wahl = ziele.length >= 2 ? 'freeze' : 'damage';
    return { optionId: wahl };
  },

  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id) return;
      if (inst.zone !== 'support') return;
      // „This Creature cannot be Frozen."
      inst.counters.freeze_immune = 1;
    },
  },

  canActivateCreatureEffect() {
    return true;                                                         // Schaden hat immer ein Ziel (Helden)
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const ps = gs.players[pi];
    if (!ps) return false;
    const oi = engine.opponentOf(pi);

    // ── ODER: Schaden oder Frost (Frost nur, wenn der Gegner eine Kreatur kontrolliert) ──
    const feinde = gegnerKreaturen(engine, oi);
    let modus = 'damage';
    if (feinde.length > 0) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Choose which effect to use this turn.',
        showCard: CARD_NAME,
        gerrymanderEligible: true,
        casterIdx: pi,                                                   // für die CPU-Wahl (cpuResponse kennt den Fragenden nicht)
        options: [
          { id: 'damage', label: `🧊 Deal ${DAMAGE} damage`, description: 'Choose a target. A giant fist of ice smashes it.', color: '#4fa3e6' },
          { id: 'freeze', label: '❄️ Freeze all enemy Creatures', description: `Every Creature your opponent controls is Frozen for ${FREEZE_TURNS} turn.`, color: '#9ad8ff' },
        ],
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.optionId) return false;
      modus = wahl.optionId === 'freeze' ? 'freeze' : 'damage';
    }

    // ── Schaden ──
    if (modus === 'damage') {
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to a target.`,
        confirmLabel: `🧊 Smash! (${DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return false;

      const slot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'biseria_fist', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot, duration: 1500,
      });
      await engine._delay(FIST_HIT_MS);

      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) await ctx.dealDamage(hero, DAMAGE, 'creature');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
          target.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.log('biseria_smash', { player: ps.username, target: target.cardName, damage: DAMAGE });
      engine.sync();
      await engine._delay(FIST_AFTER_MS);
      return true;
    }

    // ── Frost ──
    const ziele = gegnerKreaturen(engine, oi);
    engine._broadcastEvent('play_zone_animation', {
      type: 'biseria_blizzard', zoneType: 'board', owner: oi, heroIdx: -1, zoneSlot: -1,
      duration: BLIZZARD_MS, regionOwner: oi,
      originOwner: inst.owner, originHeroIdx: inst.heroIdx, originZoneSlot: inst.zoneSlot,
      targets: ziele.map(z => ({ owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.slotIdx, cardName: z.name })),
    });
    await engine._delay(BLIZZARD_FREEZE_MS);

    let eingefroren = 0;
    for (const z of ziele) {
      if (z.inst.zone !== 'support') continue;
      const ok = await engine.applyCreatureStatus(z.inst, 'frozen', {
        duration: FREEZE_TURNS, sourceOwner: pi, source: CARD_NAME, animationType: 'ice_encase',
      });
      if (ok !== false) eingefroren++;
    }
    engine.log('biseria_blizzard', { player: ps.username, frozen: eingefroren, targets: ziele.length });
    engine.sync();
    await engine._delay(BLIZZARD_AFTER_MS);
    return true;
  },

  _test: { brettStufen, DAMAGE },
};
