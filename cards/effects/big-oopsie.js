// ═══════════════════════════════════════════
//  CARD EFFECT: "Big Oopsie"
//  Spell (Destruction Magic Lv1, Normal)
//
//  „Your opponent chooses a target they control and deals 150/300/450 damage to it. If the user is an Ascended Hero, this
//   counts as an additional Action. You can only play 1 "Big Oopsie" per turn."
//
//  ── DER GEGNER WÄHLT ────────────────────────────────────────────────────
//  `ctx.promptMultiTarget({ chooser })` — der Gegner wählt EIN Ziel auf SEINER Seite (Held oder Kreatur; „a target they
//  control"), alle Schutz-Regeln gelten aus seiner Sicht, Quelle, Schaden und Reaktionsfenster bleiben die der Karte (Test Flight,
//  Escape Device … reagieren wie bei jedem Zauber). Die Wahl ist Pflicht (`cancellable: false`). Im Skill Test mit mehreren Gegnern
//  fragt der Mensch zuerst, WEN er wählen lässt (`_stChooseOpponent`, wie Chain Lightning).
//
//  ── SCALING 150/300/450 ─────────────────────────────────────────────────
//  Destruction-Magic-Stufe des Wirkers (`effectiveSchoolLevelForCaster`: Demon's Gate „as if Destruction Magic 3" zählt), 1–3.
//
//  ── ZUSATZAKTION: ASCENDED HERO (wie Capture) ───────────────────────────
//  `inherentAction` als FUNKTION, je Held: wahr genau für einen Ascended Hero (Kartentyp des Helden = „Ascended Hero"). Main Phase:
//  nur von einem Ascended Hero spielbar (gratis); Action Phase: jeder taugliche Held, ein Ascended Hero verbraucht die Aktion nicht,
//  ein gewöhnlicher schon. Kein `spellPlayCondition` für die Zusatzaktion — die Karte bleibt ohne sie spielbar, sie kostet dann nur
//  die Aktion.
//
//  ── „ONLY 1 PER TURN" ───────────────────────────────────────────────────
//  HOPT je Spieler (`claimHOPT`), im Effekt gestempelt, sobald er wirklich läuft; `spellPlayCondition` graut die Karte danach aus.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `big_oopsie` (Pixelart, ANIM_REGISTRY): Pilzwolke über dem gewählten Ziel. Der Schaden fällt, wenn die Wolke
//  steigt (HIT_MS). Klänge in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const CARD_NAME = 'Big Oopsie';
const HOPT_KEY = 'big-oopsie';
const DAMAGE = { 1: 150, 2: 300, 3: 450 };
const HIT_MS = 520;          // Schaden, wenn Feuerball und Welle den Boden erreicht haben (deckt sich mit `big_oopsie` im Client)
const NACH_MS = 380;         // Wolke noch ein Stück weiterziehen lassen, bevor der Zauber endet

/** Ist der Held ein Ascended Hero? (Kartentyp des Helden, nicht seine Basisform) */
function istAscended(engine, pi, heroIdx) {
  const hs = engine.heldSeiteFuer(pi, heroIdx);
  const hero = engine.gs.players[hs]?.heroes?.[heroIdx];
  return !!hero?.name && engine._getCardDB()[hero.name]?.cardType === 'Ascended Hero';
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  cpuMeta: { scalesWithSchool: 'Destruction Magic' },

  // „If the user is an Ascended Hero, this counts as an additional Action" — je Held.
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return istAscended(engine, pi, heroIdx);
  },

  /** „You can only play 1 per turn": graut die Karte nach dem ersten Wurf aus. */
  spellPlayCondition(gs, pi) {
    return gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] !== gs.turn;
  },

  /**
   * CPU (Gegner wählt, ohne Gehirn): so wenig verlieren wie möglich — ein Ziel, das den Schlag überlebt (der Held mit den meisten HP,
   * sonst die billigste Kreatur), nie ohne Not einen sterbenden Helden. Mit CPU-Gehirn entscheidet dessen Zielwahl.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget' || !engine.isPuzzle) return undefined;
    const { validTargets, config, playerIdx } = payload || {};
    if (!Array.isArray(validTargets) || config?.title !== CARD_NAME) return undefined;
    const dmg = Number(config?.baseDamage) || DAMAGE[1];
    const verlust = (t) => {
      if (t.type === 'hero') {
        const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
        const hp = hero?.hp ?? 0;
        return hp <= dmg ? 1000 + (hero?.maxHp || 0) : dmg;
      }
      const cd = t.cardInstance ? (engine.getEffectiveCardData(t.cardInstance) || {}) : {};
      const hp = (cd.hp ?? Infinity) - (t.cardInstance?.counters?.damageTaken || 0);
      return hp <= dmg ? 100 + 40 * (cd.level || 0) : dmg / 2;
    };
    const eigene = validTargets.filter(t => t.owner === playerIdx && !t.ineligible);
    const liste = (eigene.length ? eigene : validTargets.filter(t => !t.ineligible)).sort((a, b) => verlust(a) - verlust(b));
    return liste.slice(0, 1).map(t => t.id);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[ctx.cardHeroOwner ?? pi]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      // Im Skill Test mit mehreren Gegnern fragt der Mensch, WEN er wählen lässt.
      if (gs.skillTest && engine._stChooseOpponent) {
        await engine._stChooseOpponent(pi, CARD_NAME, 'Choose the player who has to choose a target they control.');
      }
      const oppIdx = engine.opponentOf(pi);
      const dmLevel = engine.effectiveSchoolLevelForCaster('Destruction Magic', pi, heroIdx);
      const damage = DAMAGE[Math.max(1, Math.min(dmLevel, 3))];

      // ── Der Gegner wählt ein Ziel, das ER kontrolliert ──
      const gewaehlt = await ctx.promptMultiTarget({
        chooser: oppIdx,
        side: 'my',                       // aus SEINER Sicht: die eigene Seite
        types: ['hero', 'creature'],
        min: 1, max: 1,
        baseDamage: damage,
        damageType: 'destruction_spell',
        title: CARD_NAME,
        description: `${ps.username}'s ${CARD_NAME}: choose a target you control. It takes ${damage} damage.`,
        confirmLabel: `💥 ${damage} Damage!`,
        confirmClass: 'btn-danger',
        // pflichtwahl: der Text zwingt den GEGNER zur Wahl („Your opponent chooses …“) — er ist nicht der Kontrolleur des Zaubers und kann ihn nicht abbrechen
        cancellable: false,
      });
      if (!gewaehlt || gewaehlt.length === 0) { gs._spellCancelled = true; return; }
      const target = gewaehlt[0];

      // Ab hier läuft der Zauber — „only 1 per turn" gilt.
      engine.claimHOPT(HOPT_KEY, pi);

      const slot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'big_oopsie', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot, duration: 1500,
      });
      await engine._delay(HIT_MS);

      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) await ctx.dealDamage(tgtHero, damage, 'destruction_spell');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx, heroOwner: ctx.cardHeroOwner ?? pi },
          target.cardInstance, damage, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('big_oopsie', {
        player: ps.username, chooser: gs.players[oppIdx]?.username, target: target.cardName, damage,
      });
      engine.sync();
      await engine._delay(NACH_MS);
    },
  },
};
