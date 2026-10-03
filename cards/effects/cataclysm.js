// ═══════════════════════════════════════════
//  CARD EFFECT: "Cataclysm"
//  Spell (Destruction Magic Lv3, Normal)
//
//  While ANY Area is in play (own OR opponent's),
//  this Spell's effective level becomes 0.
//
//  On cast: deal 100 destruction-spell damage to
//  EVERY target on the board (heroes + creatures,
//  both sides — including the caster's own side
//  per card text). Then send all Areas on the
//  board to their respective owners' discard
//  piles.
//
//  Animation: a giant orange-red burning meteor
//  crashes from the top-right of the screen into
//  the centre of the battlefield, then radiating
//  flame impacts on every target.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Cataclysm';
const DAMAGE    = 100;

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  // Negiert, bevor der Effekt lief: EIN Komet (nicht einer je Ziel — `impact` feuert je Ziel).
  async spellVisual(engine, info) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'cataclysm', owner: info.heroOwner ?? info.owner ?? 0,
      heroIdx: Math.max(0, info.heroIdx ?? 0), zoneSlot: -1, duration: 3000,
    });
    await engine._delay(1560);
  },

  // Active in 'hand' so the level reduction hook fires while in hand.
  activeIn: ['hand'],

  /**
   * Self-reduction: while ANY Area is in play, drop this card's level
   * from 3 → 0. The engine's `_applyCardLevelReductions` walks every
   * tracked instance the controller owns and sums their hooks, so we
   * only return the rebate when the cardData passed in is THIS card.
   */
  reduceCardLevel(cardData, engine, ownerIdx, inst) {
    if (cardData?.name !== CARD_NAME) return 0;
    if (!require('./_hooks').selbstsenkungZaehlt(engine, inst, CARD_NAME, ownerIdx)) return 0;   // v1293
    const gs = engine?.gs;
    const hasArea = !!(
      (gs?.areaZones?.[0] || []).length > 0 ||
      (gs?.areaZones?.[1] || []).length > 0
    );
    return hasArea ? 3 : 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const cardDB = engine._getCardDB();

      // ── Collect every target on the board (both sides, all heroes + creatures) ──
      const heroTargets = [];
      const creatureTargets = [];
      for (let tpi = 0; tpi < 2; tpi++) {
        const tps = gs.players[tpi];
        if (!tps) continue;
        for (let hi = 0; hi < (tps.heroes || []).length; hi++) {
          const h = tps.heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          heroTargets.push({ owner: tpi, heroIdx: hi, hero: h });
        }
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        creatureTargets.push(inst);
      }

      // Animation (Komet) läuft VOR dem Reaktionsfenster (Als Befund 3.10.) und genau einmal:
      // wird der Zauber danach negiert, spielt die Engine ihn nicht noch einmal (`bilderGespielt`).
      const kometAnimation = async () => {
        engine._broadcastEvent('play_zone_animation', {
          type: 'cataclysm', owner: pi,
          heroIdx: Math.max(0, heroIdx), zoneSlot: -1,
          duration: 3000,   // KRITISCH: sonst hängt die Komponente nach 1000 ms ab (Einschlag bei 1300 ms)
        });
        // Der Komet braucht ~1,3 s bis zur Mitte, dann blüht die Explosion über das ganze Brett;
        // erst danach der Schaden, damit die Explosion ihn „austeilt".
        await engine._delay(1300);
        await engine._delay(260);
      };

      // ── Resolve damage — EIN Flaechenschlag (Prinzip: markieren → reagieren → wirken → Tode) ──
      // `dealDamageToTargets` markiert die Ziele (Immunitaeten inklusive), laesst die getroffenen
      // Ziele reagieren (Helden-Surprises und Hand-Reaktionen, VOR dem ersten Schaden; „is chosen by"-
      // Surprises wie Frost Rune bleiben zu — ein Flaechenschlag waehlt niemanden), trifft dann ALLE Ziele und wertet
      // erst danach die Tode aus (Helden-KOs aufgeschoben, Kreaturen in EINEM Stapel). Negiert eine
      // Reaktion den Zauber, faellt der Schaden an ALLEN Zielen weg — und die Areas bleiben liegen.
      const ziele = [
        ...heroTargets.map(ht => ({ type: 'hero', owner: ht.owner, heroIdx: ht.heroIdx })),
        ...creatureTargets.map(inst => ({ type: 'creature', inst })),
      ];
      await kometAnimation();   // Komet VOR dem Reaktionsfenster
      const res = await engine.dealDamageToTargets(ctx.card, ziele, {
        damage: DAMAGE, damageType: 'destruction_spell', sourceName: CARD_NAME,
        istFlaeche: true, hitDelay: 0,
        bilderGespielt: true,   // der Komet ist schon gefallen — bei Negation kein zweiter
      });
      if (res?.cancelled) return;
      engine.sync();
      await engine._delay(300);

      // ── Wipe every Area on the board ──
      const removed = await engine.removeAllAreas(-2, CARD_NAME);

      engine.log('cataclysm_resolved', {
        player: gs.players[pi]?.username,
        heroes: heroTargets.length,
        creatures: creatureTargets.length,
        areasRemoved: removed,
      });
      engine.sync();
    },
  },
};
