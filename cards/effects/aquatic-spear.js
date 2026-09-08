// ═══════════════════════════════════════════
//  CARD EFFECT: "Aquatic Spear"
//  Spell (Surprise) — Destruction Magic + Magic Arts Lv 2
//  Archetype "Aquatic" (Mizune-Serie, v697)
//
//  1. TRIGGER (Verursacher-Fenster, neu in v697:
//     `surpriseDealtDamageTrigger` /
//     `_checkSurpriseOnDealtDamage`):
//     "when you deal damage to any target on the
//     board" — der EIGENE Spieler hat Schaden
//     ausgeteilt (Held ODER Creature als Ziel,
//     beide Seiten; Status-Ticks zaehlen laut
//     Fensterkonvention nicht). Wirkung: 100
//     zusaetzlicher Schaden auf DASSELBE Ziel.
//     Ein bereits am Ausloeser gestorbenes Ziel
//     laesst den Trigger aus (nichts mehr zu
//     treffen).
//
//  2. DISCARD-RIDER (v697-Fenster): "deal 100
//     damage to any target on the board" — freie
//     Zielwahl, beide Seiten. Danach der geteilte
//     Aquatic-Nachschub.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { offerAquaticReplacement, cpuPickReplacement } = require('./_aquatic-shared');

const CARD_NAME = 'Aquatic Spear';
const DAMAGE = 100;

/** Zielpool des Riders: alle lebenden Helden + offenen Creatures. */
function allBoardTargets(engine) {
  const gs = engine.gs;
  const cardDB = engine._getCardDB();
  const out = [];
  for (let owner = 0; owner < 2; owner++) {
    const ps = gs.players[owner];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      out.push({ id: `hero-${owner}-${hi}`, type: 'hero', owner, heroIdx: hi, cardName: h.name });
    }
  }
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

/** 100 Spell-Schaden auf ein Helden- oder Kreaturenziel. */
async function strike(engine, pi, hostHeroIdx, tgt) {
  const source = { name: CARD_NAME, owner: pi, heroIdx: hostHeroIdx };
  const zoneSlot = tgt.kind === 'creature' || tgt.type === 'equip' ? (tgt.slotIdx ?? -1) : -1;
  // v698 (Als Vorgabe): NEBEN dem Wasser auch der Speer, der das Ziel
  // aufspiesst. Der Speer stuerzt zuerst (Einschlag bei ~280 ms), der
  // Strudel bricht beim Einschlag los — zwei Broadcasts, leicht
  // versetzt. Klang: Speer aus ZONE_ANIM_SFX ('projectile', tief),
  // Wasser aus dem whirlpool-Eintrag.
  engine._broadcastEvent('play_zone_animation', {
    type: 'aquatic_spear_strike', owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot,
  });
  await engine._delay(280);
  engine._broadcastEvent('play_zone_animation', {
    type: 'whirlpool', owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot,
  });
  await engine._delay(620);
  if (tgt.kind === 'creature' || tgt.type === 'equip') {
    const inst = tgt.inst || tgt.cardInstance;
    if (!inst || inst.zone !== 'support') return false;
    await engine.actionDealCreatureDamage(source, inst, DAMAGE, 'destruction_spell', { sourceOwner: pi });
  } else {
    const hero = engine.gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
    if (!hero || hero.hp <= 0) return false;
    await engine.actionDealDamage(source, hero, DAMAGE, 'destruction_spell');
  }
  return true;
}

module.exports = {
  isSurprise: true,

  // ── TRIGGER: der Besitzer hat Schaden ausgeteilt ──────────────────
  // (gs, ownerIdx, hostHeroIdx, info, engine) — das Fenster hat
  // Verursacher-Seite, Betrag > 0 und Nicht-Status-Typ schon geprueft.
  surpriseDealtDamageTrigger(gs, ownerIdx, hostHeroIdx, info) {
    if (!info) return false;
    // Am Ausloeser gestorbene Ziele: nichts mehr zu treffen.
    return !!info.targetAlive;
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'cardGallery' && promptData.title === CARD_NAME) {
      return cpuPickReplacement(promptData, CARD_NAME);
    }
    // Aktivierungs-Confirm aus dem Verursacher-Fenster: die CPU teilt
    // im Normalfall an GEGNERISCHE Ziele aus — annehmen. Eigenschaden
    // (Yeeting-Kosten u.ae.) wuerde das eigene Ziel treffen — ablehnen.
    // Zielseite steckt nicht im Prompt; Naeherung: aktiver Spieler ist
    // die CPU und sie schadet fast nie eigenen Zielen absichtlich, also
    // annehmen, ausser der juengste Schadenslog nennt ein eigenes Ziel.
    if (promptData?.type === 'confirm' && promptData.title === CARD_NAME) {
      return { confirmed: promptData._targetIsOwn !== true };
    }
    return undefined;
  },

  // ── AUFLOESUNG: 100 auf das getroffene Ziel ───────────────────────
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const tgt = {
      kind: sourceInfo?.targetKind,
      owner: sourceInfo?.targetOwner,
      heroIdx: sourceInfo?.targetHeroIdx,
      slotIdx: sourceInfo?.targetSlotIdx,
      inst: sourceInfo?.targetInst,
    };
    if (tgt.owner == null || tgt.heroIdx == null) return null;

    const ok = await strike(engine, pi, ctx.cardHeroIdx ?? -1, tgt);
    engine.log('aquatic_spear_followup', {
      player: engine.gs.players[pi]?.username,
      target: sourceInfo?.targetCardName, hit: ok,
    });
    engine.sync();
    return { activated: true };
  },

  // ── DISCARD-RIDER: 100 auf ein beliebiges Ziel + Nachschub ───────
  async onBoardSentToDiscard(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;

    const pool = allBoardTargets(engine);
    if (pool.length > 0) {
      const selected = await engine.promptEffectTarget(pi, pool, {
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to any target on the board.`,
        confirmLabel: '🔱 Pierce!',
        confirmClass: 'btn-danger',
        cancellable: false, // "deal 100 damage" ohne "you may" — Pflicht
        maxTotal: 1,
        minRequired: 1,
        dealsDamage: true,
        baseDamage: DAMAGE,
      });
      const id = Array.isArray(selected) ? selected[0] : null;
      const ziel = id ? pool.find(t => t.id === id) : null;
      if (ziel) {
        await strike(engine, pi, ctx.fromHeroIdx ?? -1, ziel);
        engine.sync();
      }
    }

    if (ctx.fromZone === 'surprise' && ctx.fromHeroIdx >= 0) {
      await offerAquaticReplacement(engine, pi, ctx.fromHeroIdx, CARD_NAME);
    }
  },

  cpuMeta: {
    onDeathBenefit: 0,
  },
};
