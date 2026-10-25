// ═══════════════════════════════════════════
//  CARD EFFECT: "Feral, the Fortress Breaker"
//  Hero (400 HP, 80 ATK, Destruction Magic + Magic Arts)
//
//  „Whenever an Area is played, deal 100 damage to any target on the board. You may once per turn remove all Areas from the board."
//
//  ── PASSIV: 100 SCHADEN BEI JEDER AREA ──────────────────────────────────
//  `onCardEnterZone` mit `toZone: 'area'` — JEDE Area, egal wessen, egal ob gespielt oder per Effekt gelegt (die Engine meldet
//  alles, was in der Area Zone landet). Der Schaden ist PFLICHT (nicht abbrechbar): der Kontrolleur Ferals wählt ein beliebiges
//  Ziel auf dem Brett (Held, Kreatur, Token, der auch als Kreatur zählt — beide Seiten, auch eigene). Schadensart „other"
//  (Heldeneffekt). Gibt es kein Ziel, passiert nichts.
//
//  ── AKTIV: AREAS RÄUMEN ─────────────────────────────────────────────────
//  Heldeneffekt, einmal pro Zug (Engine-HOPT): alle Areas beider Seiten gehen über `removeArea` (Schutzfenster, Leave-Hooks) in
//  die Ablage. Nur aktivierbar, wenn eine Area liegt; „You may" — Feral braucht keine Bestätigung, der Klick ist die Entscheidung.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Wasserprojektil von Feral zum Ziel (`projectileShape: 'water'`, Pixelart, Client `WasserGeschoss`), dort platzt es in eine
//  Wasserexplosion (`water_burst` in ANIM_REGISTRY). Klänge: Start `elem_water`, Einschlag aus ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const CARD_NAME = 'Feral, the Fortress Breaker';
const DAMAGE = 100;
const FLUG_MS = 420;       // Flugzeit des Geschosses (deckt sich mit `WasserGeschoss` im Client)
const BURST_MS = 760;      // Länge der Wasserexplosion (deckt sich mit `water_burst`)

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  cpuMeta: { scalesWithSchool: 'Destruction Magic' },

  hooks: {
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'area') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const feld = ctx.cardHeroOwner ?? pi;
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[feld]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.negated) return;

      // Pflichtwahl: ein beliebiges Ziel auf dem Brett.
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'other',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `An Area was played: deal ${DAMAGE} damage to any target on the board.`,
        confirmLabel: `🌊 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
        noSpellCancel: true,
      });
      if (!target) return;

      const zoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: feld, sourceHeroIdx: heroIdx,
        targetOwner: target.owner, targetHeroIdx: target.heroIdx, targetZoneSlot: target.type === 'hero' ? undefined : target.slotIdx,
        projectileShape: 'water', duration: FLUG_MS, noTrail: true, sfx: 'elem_water',
      });
      await engine._delay(FLUG_MS - 40);
      engine._broadcastEvent('play_zone_animation', {
        type: 'water_burst', owner: target.owner, heroIdx: target.heroIdx, zoneSlot, duration: BURST_MS,
      });
      await engine._delay(180);

      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx, heroOwner: feld, cardType: 'Hero' };
      if (target.type === 'hero') {
        const th = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (th && th.hp > 0) await ctx.dealDamage(th, DAMAGE, 'other');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(quelle, target.cardInstance, DAMAGE, 'other', { sourceOwner: pi, canBeNegated: true });
      }
      engine.log('feral_area_blast', { player: gs.players[pi]?.username, target: target.cardName, damage: DAMAGE });
      engine.sync();
      await engine._delay(Math.max(0, BURST_MS - 180 - 300));
    },
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const feld = ctx.cardHeroOwner ?? ctx.cardOwner;
    const hero = engine.gs.players[feld]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return engine.getAreas().length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const feld = ctx.cardHeroOwner ?? pi;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[feld]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (engine.getAreas().length === 0) return false;

    const removed = await engine.removeAllAreas(-2, CARD_NAME);
    engine.log('feral_area_sweep', { player: gs.players[pi]?.username, removed });
    engine.sync();
    return removed > 0;
  },
};
