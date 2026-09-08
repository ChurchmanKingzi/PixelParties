// ═══════════════════════════════════════════
//  CARD EFFECT: "Aquatic Arrows"
//  Spell (Surprise) — Destruction Magic + Magic Arts Lv 1
//  Archetype "Aquatic" (Mizune-Serie, v697)
//
//  1. TRIGGER (Eintritts-Fenster, v699 — Als
//     neuer Effekttext): "when a Creature enters
//     a Support Zone of your opponent's Hero in
//     the same position as the user" — gleiche
//     Position = gleicher heroIdx auf der
//     Gegenseite (h0↔h0, h1↔h1, h2↔h2). Der
//     bewusst WEITE Begriff deckt Beschwoerungen,
//     place-Effekte (ohne Helden-Beteiligung) UND
//     reine Bewegungen (Slippery-Familie,
//     Slippery Skates, Dark Gear, Hunting-
//     Uebernahmen). Wirkung: 100 Schaden auf ALLE
//     Creatures in den Support Zones dieses
//     Helden (die eingetretene eingeschlossen —
//     das Fenster oeffnet nach der Platzierung).
//     Offene Lesarten: verdeckte Eintritte
//     (Bakhm-Sets) zaehlen nicht (verdeckt ist
//     die Kartenart geheim), und der FLIP eines
//     schon liegenden Bakhm-Hosts betritt die
//     Zone nicht (er lag schon).
//
//  2. DISCARD-RIDER (Board→Discard per Effekt,
//     v697-Fenster `onBoardSentToDiscard`; feuert
//     fuer The Yeeting, Mizunes Opfer usw., NICHT
//     fuer die eigene Aufloesungs-Ablage):
//     "you may choose any Creature on the board
//     and defeat it" — beide Seiten, auch eigene.
//     Danach der geteilte Aquatic-Nachschub
//     (siehe _aquatic-shared.js).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { offerAquaticReplacement, cpuPickReplacement } = require('./_aquatic-shared');

const CARD_NAME = 'Aquatic Arrows';
const AOE_DAMAGE = 100;

/** Alle offenen Creatures in den Support Zones von (owner, heroIdx). */
function creaturesUnderHero(engine, owner, heroIdx) {
  const cardDB = engine._getCardDB();
  return engine.cardInstances.filter(inst => {
    if ((inst.controller ?? inst.owner) !== owner) return false;
    if (inst.zone !== 'support' || inst.faceDown) return false;
    if (inst.heroIdx !== heroIdx) return false;
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
    return !!(cd && hasCardType(cd, 'Creature'));
  });
}

/** Alle offenen Creatures auf dem GANZEN Brett (Rider-Zielpool). */
function allBoardCreatures(engine) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    const owner = inst.controller ?? inst.owner;
    out.push({
      id: `equip-${owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
      owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return out;
}

module.exports = {
  isSurprise: true,

  // ── TRIGGER: Creature betritt die Gegner-Zone gleicher Position ───
  // Signatur des typisierten Triggers: (gs, ownerIdx, hostHeroIdx,
  // triggerInfo, engine). `_checkSurpriseOnCreatureEnterSupport`
  // liefert { zoneOwner, heroIdx, cardName, cardInstance, isMove,
  // isPlacement }. `zoneOwner` ist die BRETTSEITE der betretenen Zone.
  surpriseCreatureEnterSupportTrigger(gs, ownerIdx, hostHeroIdx, info) {
    if (!info) return false;
    if (info.zoneOwner === ownerIdx) return false;          // Gegnerseite
    if ((info.heroIdx ?? -1) !== hostHeroIdx) return false; // gleiche Position
    return true;
  },

  // ── CPU: Aktivierungs-Confirm + Nachschub-Galerie ─────────────────
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'cardGallery' && promptData.title === CARD_NAME) {
      return cpuPickReplacement(promptData, CARD_NAME);
    }
    if (promptData?.type !== 'confirm' || promptData.title !== CARD_NAME) return undefined;
    // Aktivierung lohnt, wenn mindestens eine gegnerische Creature am
    // AoE stirbt oder mindestens zwei getroffen werden.
    const cpuIdx = engine._cpuPlayerIdx;
    const oppIdx = cpuIdx === 0 ? 1 : 0;
    const heroIdx = promptData._hostHeroIdx ?? -1;
    if (heroIdx < 0) return { confirmed: true };
    const ziele = creaturesUnderHero(engine, oppIdx, heroIdx);
    const kills = ziele.filter(z => (z.counters?.currentHp ?? 0) <= AOE_DAMAGE).length;
    return { confirmed: kills >= 1 || ziele.length >= 2 };
  },

  // ── AUFLOESUNG: 100 auf alle Creatures des betretenen Helden ─────
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const zoneOwner = sourceInfo?.zoneOwner ?? sourceInfo?.summonerIdx ?? (pi === 0 ? 1 : 0);
    const heroIdx = sourceInfo?.heroIdx ?? -1;
    if (heroIdx < 0) return null;

    const ziele = creaturesUnderHero(engine, zoneOwner, heroIdx);
    if (ziele.length === 0) {
      engine.log('aquatic_arrows_no_targets', { player: engine.gs.players[pi]?.username });
      return null;
    }

    // v700 (Als Vorgabe, Vergleich Rain of Arrows): etliche
    // Wasserpfeile prasseln von oben auf JEDE getroffene Creature —
    // `animType` am Batch-Eintrag, derselbe Weg wie arrow_rain und
    // die Burn-Ticks. Der Klang laeuft ueber ZONE_ANIM_SFX mit
    // dedupe (eine Salve, nicht drei uebereinander).
    const source = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx ?? -1 };
    await engine.processCreatureDamageBatch(ziele.map(inst => ({
      inst, amount: AOE_DAMAGE, type: 'destruction_spell',
      source, sourceOwner: pi,
      animType: 'aquatic_arrow_rain',
    })));

    engine.log('aquatic_arrows_volley', {
      player: engine.gs.players[pi]?.username,
      hero: engine.gs.players[zoneOwner]?.heroes?.[heroIdx]?.name,
      hit: ziele.length,
    });
    engine.sync();
    return { activated: true };
  },

  // ── DISCARD-RIDER: defeat beliebige Creature + Aquatic-Nachschub ──
  async onBoardSentToDiscard(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;

    const pool = allBoardCreatures(engine);
    if (pool.length > 0) {
      const selected = await engine.promptEffectTarget(pi, pool, {
        title: CARD_NAME,
        description: 'You may choose any Creature on the board and defeat it.',
        confirmLabel: '🌊 Defeat it!',
        confirmClass: 'btn-danger',
        cancellable: true,
        allowNonCreatureEquips: false,
        maxTotal: 1,
      });
      const id = Array.isArray(selected) ? selected[0] : null;
      const ziel = id ? pool.find(t => t.id === id) : null;
      if (ziel?.cardInstance) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'whirlpool', owner: ziel.owner,
          heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx,
        });
        await engine._delay(650);
        await engine.actionDestroyCard(
          { name: CARD_NAME, owner: pi }, ziel.cardInstance,
        );
        engine.sync();
      }
    }

    // Herkunft muss eine Surprise Zone gewesen sein — sonst gibt es
    // keine "Surprise Zone this card occupied".
    if (ctx.fromZone === 'surprise' && ctx.fromHeroIdx >= 0) {
      await offerAquaticReplacement(engine, pi, ctx.fromHeroIdx, CARD_NAME);
    }
  },

  cpuMeta: {
    onDeathBenefit: 0,
  },
};
