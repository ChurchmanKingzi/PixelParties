// ═══════════════════════════════════════════
//  CARD EFFECT: "Weapon Storm"
//  Attack (Normal, Lv2, Fighting)
//
//  „Send any number of Artifacts equipped and Abilities attached to
//   the user to the discard pile. Then, choose a target and deal
//   damage equal to 40/50/60 times the number of cards sent to it."
//
//  Als Ruling (6.9.): das Fighting-Level des Nutzers NACH dem Senden
//  bestimmt den Schaden je Karte — Lv1 40, Lv2 50, Lv3+ 60. Wer sein
//  gesamtes Fighting mitschickt, steht auf Lv0: dafuer gilt hier die
//  unterste Stufe (40), damit die Karte nicht ins Leere laeuft.
//  (Annahme, Al zur Bestaetigung vorgelegt.)
//
//  Bauform: Attack-Muster (`hooks.onPlay`, `ctx.cardHeroIdx` = user),
//  Brett-Schleife aus `_ability-cost-shared` (min 1, „any number"),
//  danach `ctx.promptDamageTarget` mit dem ausgerechneten Betrag.
//  Ohne sendbare Karte ist der Angriff nicht spielbar (`canPlayWithHero`).
// ═══════════════════════════════════════════

const { sendables, abilityCardCount, sendCardsLoop, cpuSendFallback } = require('./_ability-cost-shared');

const CARD_NAME = 'Weapon Storm';
const RATE = [40, 40, 50, 60];   // Index = Fighting-Level nach dem Senden (0..3+)

function fightingLevel(engine, pi, heroIdx) {
  // v805: inkl. Ability-Stapeln in Support Zones (Xal, Xalibur).
  return engine.effectiveSchoolLevelForCaster('Fighting', pi, heroIdx);
}
function rateFor(engine, pi, heroIdx) {
  return RATE[Math.max(0, Math.min(3, fightingLevel(engine, pi, heroIdx)))];
}

function hasSendable(engine, pi, heroIdx) {
  const { abilities, equips } = sendables(engine, pi, heroIdx);
  return abilityCardCount(abilities) + equips.length > 0;
}

module.exports = {
  requiresTarget: true,

  // „the user" muss etwas zu schicken haben.
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    try { return hasSendable(engine, pi, heroIdx); } catch { return true; }
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (!hasSendable(engine, pi, heroIdx)) { gs._spellCancelled = true; return; }

      // 1) Senden — mindestens eine Karte, beliebig viele.
      const res = await sendCardsLoop(engine, pi, heroIdx, {
        cardName: CARD_NAME, kinds: ['ability', 'equip'], min: 1, amount: 0,
        confirmLabel: '🌪️ Send',
        describe: (sent) => sent === 0
          ? `Click an Artifact equipped or an Ability attached to ${hero.name} to send it to the discard pile — each card adds ${rateFor(engine, pi, heroIdx)} damage.`
          : `Sent ${sent} — currently ${sent * rateFor(engine, pi, heroIdx)} damage (${rateFor(engine, pi, heroIdx)} per card at Fighting ${fightingLevel(engine, pi, heroIdx)}). Click the next card, or stop here.`,
      });
      if (res.aborted || res.sent === 0) return;

      // 2) Schaden nach dem Level NACH dem Senden.
      const rate = rateFor(engine, pi, heroIdx);
      const dmg = rate * res.sent;
      engine.log('weapon_storm', { player: ps.username, hero: hero.name, sent: res.sent, rate, damage: dmg });

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: dmg,
        title: CARD_NAME,
        description: `Deal ${dmg} damage (${res.sent} × ${rate}).`,
        confirmLabel: `🌪️ Storm! (${dmg})`,
        confirmClass: 'btn-danger',
        cancellable: false,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });
      if (!target) return;
      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, dmg);
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'weapon_storm', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: impactSlot,
      });
      // Waffen-Barrage vom Nutzer zum Ziel (v805, Als Vorgabe: 10-20
      // Schwerter/Speere/Aexte als Strahl).
      engine._broadcastEvent('play_weapon_barrage', {
        sourceOwner: pi, sourceHeroIdx: heroIdx,
        targetOwner: target.owner, targetHeroIdx: target.heroIdx, targetZoneSlot: impactSlot,
        count: Math.min(20, Math.max(10, 8 + res.sent * 3)),
      });
      await engine._delay(1100);
      if (target.type === 'hero') {
        const th = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (th && th.hp > 0) await engine.actionDealDamage(attackSource, th, finalDmg, 'attack');
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) await engine.actionDealCreatureDamage(attackSource, inst, finalDmg, 'attack', { sourceOwner: pi, canBeNegated: true });
      }
      engine.sync();
    },
  },

  /**
   * CPU: Lernkanal zuerst (`_abilityCost` am Prompt); Rueckfall —
   * alle Equips und jede Fremdschul-Ability schicken, Fighting
   * behalten (jede gesendete Fighting kostet 10 je Karte am Satz).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    return cpuSendFallback(engine, promptData, {
      school: 'Fighting',
      wantMore: () => (promptData?.validTargets || []).some(t => t.type === 'equip' || t.cardName !== 'Fighting'),
    });
  },
};
