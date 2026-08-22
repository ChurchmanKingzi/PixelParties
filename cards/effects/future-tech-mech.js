// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Mech"
//  Creature (Normal, Lv 3) — 250 HP, kein ATK.
//
//  "You may once per turn choose a target and deal 80 damage to it.
//   Repeat this effect as many times as there are \"Future Tech Mech\"
//   cards in your discard pile."
//
//  ── „Repeat" ≠ „Trigger" ──
//  Der Wortlaut unterscheidet sich von Future Tech Barrage, und der
//  Unterschied ist die ganze Karte: dort „Trigger this effect as many
//  times as …" (also GENAU N), hier „Repeat" NACH einem Grundeffekt
//  (also **1 + N**). Der Mech schlägt damit auch mit leerer Ablage
//  einmal zu — im Gegensatz zur Barrage.
//
//  Vorbild ist Elven Leader, dessen Text dieselbe Bauform hat
//  („deal 50 damage. Repeat this effect as many times as you control
//  Creatures other than this one").
//
//  ── Und der Mech zählt sich nicht selbst ──
//  Er steht beim Auslösen im Feld, nicht in der Ablage (Als Ruling
//  21.8.). Gezählt werden also nur ZUSÄTZLICHE Kopien, die vorher
//  entsorgt wurden — ein zweiter Mech im Deck ist dort mehr wert als
//  auf dem Feld. Das ist die Pointe des Archetyps in einer Karte.
//
//  „You may once per turn" ist die WEICHE Form (Als Regel v249): pro
//  Instanz, also die Standard-HOPT `creature-effect:<instId>` der
//  Engine. Zwei Mechs auf dem Feld feuern beide.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Mech';
const DAMAGE = 80;
const ANIM_MS = 320;
/** Breiter als Mr. Jiggles (dort Standard 1) — Als Vorgabe. */
const LASER_BREITE = 2.6;

module.exports = {
  requiresTarget: true,
  creatureEffect: true,

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    // 1 Grundtreffer + eine Wiederholung je Kopie in der Ablage.
    const schuesse = 1 + zaehleInAblage(gs, pi, CARD_NAME);
    let getroffen = 0;

    for (let i = 0; i < schuesse; i++) {
      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: DAMAGE,
        title: schuesse > 1 ? `${CARD_NAME} (${i + 1}/${schuesse})` : CARD_NAME,
        description: `Choose a target and deal ${DAMAGE} damage to it.`,
        confirmLabel: '🤖 Fire!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      // Abbruch beim ERSTEN Schuss lässt die Rundensperre frei
      // (`return false`); danach zählt der Effekt als benutzt.
      if (!ziel) break;

      // ── LASER JE SCHUSS (Als Vorgabe 21.8.) ──
      // „Für jeden Schuss ein Laser, siehe Mr. Jiggles, aber breiter."
      // Derselbe Beam-Kanal wie dort, nur mit `thickness` statt der
      // Standardbreite 1 — die skaliert alle drei Linienlagen und die
      // Einschlagringe mit, ohne eigenes CSS.
      engine._broadcastEvent('play_beam_animation', {
        sourceOwner: pi, sourceHeroIdx: inst.heroIdx, sourceZoneSlot: inst.zoneSlot,
        targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
        targetZoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
        color: '#ff4d2e',
        thickness: LASER_BREITE,
        duration: 900,
      });
      await engine._delay(ANIM_MS);

      if (ziel.type === 'hero') {
        const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (held && held.hp > 0) await ctx.dealDamage(held, DAMAGE, 'creature');
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
          ziel.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      getroffen++;
    }

    if (getroffen === 0) return false;

    engine.log('ft_mech', {
      player: gs.players[pi]?.username, shots: getroffen, damage: DAMAGE,
    });
    engine.sync();
    return true;
  },
};
