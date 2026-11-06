'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Flesh-Eating Swarm Trap"  (W74b)
//  Spell / Reaction (Decay Magic Lv2)
//
//  „Immediately play this card when your opponent plays a card from their hand that chooses exactly 1 Hero they control. That card's effect becomes "Deal 150 damage to that Hero.""
//  Ist die Karte permanent (Equip, Attachment), wandert sie nach den 150 Schaden auf den Ablagestapel.
//
//  Zwei Fenster, weil Karten ihren Helden an zwei Stellen wählen:
//   ① WAHL BEIM SPIELEN (Kettenfenster, `isReaction`): Ausrüstung, Attachment-Spells, Ability-Anlegen und Tränke wählen ihren Helden mit dem Ausspielen. Der Server trägt ihn als
//      `chosenHero` am Anfangsglied der Kette ein (`executeCardWithChain`); die Falle negiert dieses Glied (die Karte geht — auch als Permanent — auf die Ablage, NACH dem Schaden)
//      und trifft den gewählten Helden mit 150.
//   ② WAHL IM EFFEKT (Zielfenster, `isPostTargetReaction`): Spells/Attacks, die ihren Helden erst beim Auflösen wählen (Heilung, Buff …), laufen über das Ziel-Fenster; die Falle
//      ersetzt den Effekt durch den Schaden (`effectNegated`).
//  Bedingungen für beide: der Gegner (Kontrolleur der Quelle) spielt die Karte AUS DER HAND (keine Brett-Aktivierung, keine Platzierung), wählt GENAU EINEN Helden, und dieser Held wird
//  von ihm kontrolliert („they control"). Beschwörungen wählen ihren Helden nicht als Ziel und lösen die Falle nicht aus.
//  Bild: `flesh_swarm` (Insektenschwarm umkreist den Helden und beißt).
// ═══════════════════════════════════════════

const CARD_NAME = 'Flesh-Eating Swarm Trap';
const DAMAGE = 150;
const ANIM_MS = 1500;
const QUELL_TYPEN = new Set(['Spell', 'Attack', 'Potion', 'Artifact', 'Ability']);

/** Kann einer meiner Helden die Karte wirken (lebt, nicht gefroren/betäubt, Stufe)? */
function kannWirken(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return false;
  const cardData = engine._getCardDB()[CARD_NAME];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    if (engine.heroMeetsLevelReq(pi, hi, cardData)) return true;
  }
  return !!engine.fremderHeldKannStufe?.(pi, CARD_NAME);
}

/** Schwarm auf den Helden und 150 Schaden. */
async function beissen(engine, pi, ziel, casterIdx) {
  const gs = engine.gs;
  const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
  if (!hero?.name || hero.hp <= 0) return;
  engine._broadcastEvent('play_zone_animation', { type: 'flesh_swarm', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1, duration: ANIM_MS + 300 });
  await engine._delay(ANIM_MS * 0.55);
  const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: typeof casterIdx === 'number' ? casterIdx : -1 };
  await engine.actionDealDamage(quelle, hero, DAMAGE, 'other');
  engine.log('flesh_swarm_bite', { player: gs.players[pi]?.username, hero: hero.name, damage: DAMAGE });
  engine.sync();
  await engine._delay(ANIM_MS * 0.45);
}

module.exports = {
  spellVisual: { impact: { type: 'flesh_swarm' }, impactMs: 600 },

  isReaction: true,
  canActivate: () => false,   // nur als Reaktion spielbar

  // ── ① Wahl beim Spielen (Kettenfenster) ─────────────────────────
  reactionCondition(gs, pi, engine, chainCtx) {
    const chain = chainCtx?.chain;
    if (!chain || chain.length < 1) return false;
    const link = chain[chain.length - 1];
    if (!link || !link.isInitialCard || link.owner === pi || link.fromBoard || link.isPlacement) return false;
    const ziel = link.chosenHero;
    if (!ziel || !Number.isInteger(ziel.heroIdx)) return false;
    const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (engine.zielSeite({ type: 'hero', owner: ziel.owner, heroIdx: ziel.heroIdx }) !== link.owner) return false;   // „a Hero they control"
    return kannWirken(gs, pi, engine);
  },

  async resolve(engine, pi, selectedIds, validTargets, chain, myIndex) {
    if (!chain || myIndex === undefined || myIndex < 1) return;
    const link = chain[myIndex - 1];
    const eigen = chain[myIndex];
    if (!link?.chosenHero) return;
    if (engine._currentEffectSource) engine._currentEffectSource.chosenHeroHandled = true;   // das Zielfenster ② darf dieselbe Karte nicht noch einmal abfangen
    // Die Karte wird ersetzt: negiert (geht nach dem Schaden auf die Ablage, auch als Permanent).
    engine.negateChainLink(chain, myIndex - 1);
    await beissen(engine, pi, link.chosenHero, eigen?.casterHeroIdx ?? eigen?.heroIdx);
  },

  // ── ② Wahl im Effekt (Zielfenster) ──────────────────────────────
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard, opts) {
    if (opts?.heroChoiceIsCost) return false;   // die Heldenwahl ist nur der Kostenpunkt (Torchure), nicht das Ziel des Effekts
    const srcOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (srcOwner < 0 || srcOwner === pi) return false;
    const helden = (targetedHeroes || []).filter(t => t && t.type === 'hero');
    if (helden.length !== 1 || (targetedHeroes || []).length !== 1) return false;   // „exactly 1 Hero"
    const t = helden[0];
    if (engine.zielSeite(t) !== srcOwner) return false;   // „a Hero they control"
    // Nur eine Karte, die der Gegner AUS DER HAND gespielt hat (nicht Brett-Aktivierung/Platzierung).
    const es = engine._currentEffectSource;
    if (!es || es.owner !== srcOwner || es.fromBoard || es.isPlacement || es.chosenHeroHandled) return false;
    if (!QUELL_TYPEN.has(es.cardType)) return false;
    if (sourceCard?.name && es.cardName !== sourceCard.name) return false;
    return kannWirken(gs, pi, engine);
  },

  async postTargetResolve(engine, pi, targetedHeroes, sourceCard, opts) {
    const t = (targetedHeroes || []).find(x => x && x.type === 'hero');
    if (!t) return null;
    if (engine._currentEffectSource) engine._currentEffectSource.chosenHeroHandled = true;
    await beissen(engine, pi, { owner: t.owner, heroIdx: t.heroIdx }, opts?.casterIdx);
    return { effectNegated: true };
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm' && promptData.title === CARD_NAME) return { confirmed: true };   // 150 Schaden + Effekt weg ist praktisch immer ein Gewinn
    return undefined;
  },
};
