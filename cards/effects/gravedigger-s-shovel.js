// ═══════════════════════════════════════════
//  CARD EFFECT: "Gravedigger's Shovel"
//  Artifact / Equipment (Cost 2 — seit v638, vorher 3)
//
//  „Equip this card to a Hero you control. Once per turn, when the
//   equipped Hero defeats a target your opponent controls, send the top
//   5 cards from your opponent's deck to the discard pile."
//   (neuer Text, Al 29.8. — in cards.json v638 nachgezogen)
//
//  · „defeats a target": Als Ruling (Waflav) — jeder DIREKTE Schaden des
//    ausgeruesteten Helden zaehlt (Attack, Spell, Effekt), NICHT Status-
//    Ticks und NICHT Kreaturenschaden. Genau das prueft
//    `isDirectDefeatByThisHero` aus `_waflav-shared` — fuer ein Equip
//    gilt `ctx.card.heroIdx` = der ausgeruestete Held, `cardOriginalOwner`
//    = der Besitzer. `defeatTriggerHooks` liefert das Hook-Paar
//    (afterDamage fuer Helden, onCreatureDeath fuer Kreaturen).
//  · „your opponent controls": das besiegte Ziel gehoert der anderen
//    Seite (Held: Besitzer ≠ Controller des Equips; Kreatur: Controller
//    ≠ Controller des Equips).
//  · Once per turn je Shovel-Instanz (`claimHOPT` mit Instanz-Id).
//  · Mill ueber `actionMillCards(oppIdx, 5, …)` — Flug, Rettungsfenster,
//    Erstzug-Schutz des Gegners und `onMill` kommen von dort.
// ═══════════════════════════════════════════

const W = require('./_waflav-shared');

const CARD_NAME = "Gravedigger's Shovel";
const MILL = 5;

async function onDefeat(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return;
  const ctrl = inst.controller ?? inst.owner;
  const oppIdx = ctrl === 0 ? 1 : 0;
  // Ziel gehoert dem Gegner?
  if (ctx.creature) {
    if ((ctx.creature.controller ?? ctx.creature.owner) !== oppIdx) return;
  } else if (ctx.target) {
    if (engine._findHeroOwner(ctx.target) !== oppIdx) return;
  } else return;
  if (!engine.claimHOPT(`gravediggers-shovel:${inst.id}`, ctrl)) return;
  await engine.announceHookActivation(CARD_NAME, ctrl);
  const milled = await engine.actionMillCards(oppIdx, MILL, { source: CARD_NAME });
  engine.log('gravediggers_shovel', {
    player: gs.players[ctrl]?.username, hero: gs.players[ctrl]?.heroes?.[inst.heroIdx]?.name,
    milled: milled.length,
  });
  engine.sync();
}

module.exports = {

  /**
   * „Equip this card to a Hero you control." — Seitenbindung, siehe
   * `equipOwnSideOnly` in CARD_API.md. Ohne die Fahne gilt die
   * Hausvorgabe „Ausruestung darf an beide Seiten" (Al, 5.9.: der
   * Kartentext ist bindend).
   */
  equipOwnSideOnly: true,
  isEquip: true,
  activeIn: ['support'],
  hooks: { ...W.defeatTriggerHooks(onDefeat) },
};
