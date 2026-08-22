// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Fists"
//  Artifact (Equipment, Cost 20)
//
//  "Equip this card to a Hero you control. You may once per turn choose
//   as many targets on the board as there are \"Future Tech Fists\" cards
//   in your discard pile and deal damage equal to the equipped Hero's
//   Base Attack stat to them. You can only activate the effect of
//   \"Future Tech Fists\" once per turn."
//
//  ── Der Streuschlag, jetzt aktiv ──
//  [Als Neufassung 21.8.: die erste Version hing an „trifft genau ein
//   Ziel mit einer Attacke" und war dadurch zu schwach — sie brauchte
//   erst einen Angriff, um überhaupt zu wirken.] Jetzt ein eigener
//   aktivierbarer Effekt: einmal pro Zug, so viele Ziele wie Kopien in
//   der Ablage, je der BASIS-Angriff des ausgerüsteten Helden.
//
//  ── Der Vertrag ──
//  `equipEffect` / `canActivateEquipEffect(ctx)` / `onEquipEffect(ctx)`
//  — die Schnittstelle für Ausrüstung mit aktivem Effekt (Beleg
//  `_crusader-shared.js`; `heroEffect` ist die für HELDENkarten und
//  würde nie angeboten). Rückgabe `false` gibt das Einmal-pro-Zug frei.
//
//  ── „Base Attack" ist NICHT `hero.atk` ──
//  `hero.baseAtk` — der gedruckte Wert, unbeeinflusst von Vampiric
//  Sword, Fighting oder sonstigen Buffs. Konvention von Bamboo Staff.
//
//  ── Die Faust ──
//  `punch_impact` mit `metal: true` (Als Vorgabe 21.8.): dieselbe
//  Animation wie bei Aggressive Town Guard, nur silbrig-metallisch
//  eingefärbt. Sie läuft je Ziel und VOR dem Schaden — erst der Schlag,
//  dann die Wirkung.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Fists';
/** Flugzeit der Faust, bevor der Schaden faellt. */
const FAUST_MS = 400;

/** Alle Ziele auf dem Brett, beide Seiten. */
function alleZiele(engine) {
  return [
    ...engine.getHeroTargets(0), ...engine.getHeroTargets(1),
    ...engine.getCreatureTargets(0), ...engine.getCreatureTargets(1),
  ];
}

module.exports = {
  activeIn: ['support'],
  equipEffect: true,

  canActivateEquipEffect(ctx) {
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = inst.controller ?? inst.owner;
    if (zaehleInAblage(gs, pi, CARD_NAME) <= 0) return false;
    const hero = gs.players[pi]?.heroes?.[inst.heroIdx];
    return !!hero?.name && hero.hp > 0 && (hero.baseAtk || 0) > 0;
  },

  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const pi = inst.controller ?? inst.owner;
    const heroIdx = inst.heroIdx;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const grenze = zaehleInAblage(gs, pi, CARD_NAME);
    if (grenze <= 0) return false;
    const atk = hero.baseAtk || 0;                 // BASIS-Angriff
    if (atk <= 0) return false;

    const kandidaten = alleZiele(engine);
    if (kandidaten.length === 0) return false;

    const wahl = await engine.promptEffectTarget(pi, kandidaten, {
      title: CARD_NAME,
      description: `Choose up to ${grenze} target${grenze !== 1 ? 's' : ''} — each takes ${atk} damage.`,
      confirmLabel: '👊 Strike!',
      confirmClass: 'btn-danger',
      maxTotal: grenze,
      cancellable: true,
      _skipPostTargetReactions: true,
    });
    const ids = Array.isArray(wahl) ? wahl : (wahl ? [wahl] : []);
    if (ids.length === 0) return false;            // Abbruch gibt die Sperre frei

    // EIN Quellobjekt fuer alle Treffer — Reaktionen und die
    // Effekt-Immunitaet sehen den Streuschlag als EINEN Vorgang.
    const quelle = { name: hero.name, owner: pi, heroIdx };
    for (const id of ids) {
      const ziel = kandidaten.find(t => t.id === id);
      if (!ziel) continue;

      // Silbrige Faust — erst der Schlag, dann die Wirkung.
      engine._broadcastEvent('punch_impact', {
        owner: ziel.owner, heroIdx: ziel.heroIdx,
        zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
        metal: true,
      });
      await engine._delay(FAUST_MS);

      if (ziel.type === 'hero') {
        const th = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (th?.name && th.hp > 0) {
          await engine.actionDealDamage(quelle, th, atk, 'attack');
        }
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(
          quelle, ziel.cardInstance, atk, 'attack',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    engine.log('ft_fists', {
      player: gs.players[pi]?.username, hits: ids.length,
      damage: atk, max: grenze,
    });
    engine.sync();
    return true;
  },
};
