// ═══════════════════════════════════════════
//  CARD EFFECT: "Night Mare"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  „At the beginning of each turn, the turn player must choose a target they control (except this Creature) and deal 150 damage to it."
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  `onTurnStart` läuft zu Beginn JEDES Zuges (nicht nur des eigenen Zuges des Kontrolleurs). WÄHLER ist der ZUGSPIELER (`gs.activePlayer`) — auch wenn die Mare
//  dem Gegner gehört: er muss ein Ziel wählen, das ER kontrolliert (Held, Kreatur, Token, der als Kreatur zählt; nicht die Night Mare selbst) und es nimmt 150
//  Schaden (Typ `creature`, Quelle die Night Mare). Pflichtwahl (nicht abbrechbar). Gibt es kein legales Ziel, passiert nichts. Mehrere Night Mares wirken nacheinander.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `black_flames` (ANIM_REGISTRY, Pixelart): schwarze Flammen mit violetten Spitzen lodern um das Ziel; der Schaden fällt, wenn sie am höchsten stehen. Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const CARD_NAME = 'Night Mare';
const DAMAGE = 150;
const FLAMMEN_MS = 1300;       // Länge von `black_flames` im Client
const TREFFER_MS = 650;        // bis die Flammen am höchsten stehen, dann fällt der Schaden
const NACH_MS = 500;

module.exports = {
  activeIn: ['support'],

  cpuMeta: { preferDead: false },

  /** CPU (Zugspieler wählt eigenes Ziel): das, was den Schlag am besten verkraftet — eine Kreatur, die überlebt, sonst die billigste; nie ohne Not einen sterbenden Helden. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = payload || {};
    if (!Array.isArray(validTargets) || config?.title !== CARD_NAME) return undefined;
    const verlust = (t) => {
      if (t.type === 'hero') {
        const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
        const hp = hero?.hp ?? 0;
        return hp <= DAMAGE ? 1000 + (hero?.maxHp || 0) : DAMAGE;
      }
      const cd = t.cardInstance ? (engine.getEffectiveCardData(t.cardInstance) || {}) : {};
      const hp = (t.cardInstance?.counters?.currentHp ?? cd.hp ?? Infinity);
      return hp <= DAMAGE ? 100 + 40 * (cd.level || 0) : DAMAGE / 2;
    };
    const liste = validTargets.filter(t => !t.ineligible).sort((a, b) => verlust(a) - verlust(b));
    return liste.slice(0, 1).map(t => t.id);
  },

  hooks: {
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const ich = ctx.card;
      if (!ich || ich.zone !== 'support' || ich.faceDown) return;
      const zugSpieler = gs.activePlayer;
      if (zugSpieler == null || !gs.players[zugSpieler]) return;
      const mareKontrolle = ich.controller ?? ctx.cardOwner;

      const gewaehlt = await ctx.promptMultiTarget({
        chooser: zugSpieler,
        side: 'my',                         // aus SEINER Sicht: die eigene Seite
        types: ['hero', 'creature'],
        min: 1, max: 1,
        baseDamage: DAMAGE,
        damageType: 'creature',
        title: CARD_NAME,
        description: `${CARD_NAME}: choose a target you control (except ${CARD_NAME}). It takes ${DAMAGE} damage.`,
        confirmLabel: `🌑 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        // pflichtwahl: der Text zwingt den ZUGSPIELER zur Wahl („must choose“); es ist ein ausgelöster Kreatureneffekt, keine gespielte Karte – ein Abbruch würde den Nachteil der Karte aufheben
        cancellable: false,                 // Pflichtwahl: „must choose"
        noSpellCancel: true,
        condition: (t) => !(t.cardInstance && t.cardInstance.id === ich.id),
      });
      if (!gewaehlt || gewaehlt.length === 0) return;
      const target = gewaehlt[0];
      if (target.cardInstance && target.cardInstance.id === ich.id) return;   // Sicherheitsnetz

      const slot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'black_flames', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot, duration: FLAMMEN_MS,
      });
      await engine._delay(TREFFER_MS);

      const quelle = { name: CARD_NAME, owner: mareKontrolle, heroIdx: ich.heroIdx, heroOwner: ctx.cardHeroOwner ?? mareKontrolle, cardType: 'Creature', cardInstance: ich };
      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) await engine.actionDealDamage(quelle, hero, DAMAGE, 'creature');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(quelle, target.cardInstance, DAMAGE, 'creature', { sourceOwner: mareKontrolle, canBeNegated: true });
      }
      engine.log('night_mare', { player: gs.players[zugSpieler]?.username, target: target.cardName, damage: DAMAGE });
      engine.sync();
      await engine._delay(NACH_MS);
    },
  },
};
