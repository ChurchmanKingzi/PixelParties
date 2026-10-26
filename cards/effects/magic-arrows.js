// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Arrows"
//  Spell (Normal, Lv 1, Destruction Magic)
//
//  „Choose up to 3 targets and deal 50 damage to them."
//
//  ── BAUFORM ───────────────────────────────────────────────────────
//  • „up to 3 targets" ohne Seitenangabe: Helden UND Kreaturen BEIDER
//    Seiten sind wählbar (`side: 'any'`), mindestens 1 (Abbrechen =
//    nichts ist passiert). Idas `forcesSingleTarget` kappt die Wahl
//    jeder Destruction-Mehrfachwahl auf 1 — das erledigt
//    `promptMultiTarget` zentral.
//  • „deal 50 damage to them": EIN Schlag auf alle gewählten Ziele
//    (`engine.dealDamageToTargets`, die eine Stelle für Mehrfachtreffer:
//    Interference-Klammer, Idol-Fenster, EIN Kreaturenstapel). Der
//    Schaden fällt für alle Ziele gleichzeitig, nicht nacheinander.
//  • Animation: je Ziel ein lila Pixelart-Pfeil (`projectileShape:
//    'magicArrow'`, Client `ArkanPfeil`), alle Pfeile starten im selben
//    Augenblick vom Wirker. Die Bilder liegen in `spellVisual` und
//    laufen auch, wenn eine Reaktion den Zauber negiert.
// ═══════════════════════════════════════════

const CARD_NAME = 'Magic Arrows';
const ARROW_DAMAGE = 50;
const MAX_TARGETS = 3;
const FLUG_MS = 380;       // Flugzeit der Pfeile (Client: `ArkanPfeil`, Einschlag bei `dur`)

module.exports = {
  // ★ Als Ruling (Al 26.10., Flame Avalanche: „Wenn du andere Schadenskarten unspielbar machst, müssen das Vial und Rockfall auch sein!"): die Karte richtet NUR Schaden an Zielen an —
  // unter der Schadenssperre (`ps.damageLocked`) unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten; Sperr-Stutzen `engine._cardBlockedBySearchLock`).
  blockedByDamageLock: true,
  // ENTKOPPELTE BILDER (CARD_API „spellVisual"): bei Negation läuft der
  // Effekt-Rumpf nie, die Engine spielt dann diese Pfeile — ohne Einschlag-Zonenbild,
  // der Pfeil bringt seinen eigenen Pixelstern mit.
  spellVisual: {
    projectile: {
      projectileShape: 'magicArrow', noTrail: true, duration: FLUG_MS, sfx: 'projectile',
    },
    stagger: 0,                 // alle Pfeile gleichzeitig
    flightMs: FLUG_MS + 10,
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      const srcHeroIdx = ctx.cardHeroIdx;

      const forced = !!ctx._forcePerform;
      const targets = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: MAX_TARGETS,
        baseDamage: ARROW_DAMAGE,
        damageType: 'destruction_spell',
        title: CARD_NAME,
        description: `Choose up to ${MAX_TARGETS} targets — deal ${ARROW_DAMAGE} damage to each.`,
        confirmLabel: `🏹 Fire! (${ARROW_DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: !forced,
      });

      // [] = abgebrochen oder ganz negiert (promptMultiTarget hat
      // gs._spellCancelled / gs._spellNegatedByEffect schon gesetzt).
      if (!targets || targets.length === 0) return;

      const source = { name: CARD_NAME, owner: pi, heroIdx: srcHeroIdx, controller: pi, heroOwner: ctx.cardHeroOwner ?? pi };

      // ── Ein Pfeil je Ziel, alle zugleich, dann der gemeinsame Schlag ──
      await engine.spielZauberBilder(CARD_NAME, {
        owner: ctx.cardHeroOwner ?? pi, heroIdx: srcHeroIdx, zoneSlot: ctx.card?.zoneSlot,
        targets,
      });

      const heldenZiele = [];
      const kreaturZiele = [];
      for (const t of targets) {
        if (t.type === 'hero') {
          const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (!hero?.name || hero.hp <= 0) continue;
          heldenZiele.push(t);
        } else {
          const inst = t.cardInstance
            || engine.kreaturAnBrett(t.owner, t.heroIdx, t.slotIdx);   // Brettseite
          if (!inst) continue;
          kreaturZiele.push(inst);
        }
      }

      // Reaktions- und Surprise-Fenster liefen schon in promptMultiTarget.
      await engine.dealDamageToTargets(source, [
        ...heldenZiele.map(t => ({ type: 'hero', owner: t.owner, heroIdx: t.heroIdx })),
        ...kreaturZiele.map(inst => ({ type: 'creature', inst })),
      ], {
        damage: ARROW_DAMAGE, damageType: 'destruction_spell', sourceName: CARD_NAME,
        animDelay: 0, hitDelay: 0,
        surpriseCheck: false, postTargetCheck: false,
        trefferOpts: { _skipReactionCheck: true },
      });

      engine.log('magic_arrows', {
        player: ps.username,
        targets: targets.map(t => t.cardName),
        damage: ARROW_DAMAGE,
      });
      engine.sync();
    },
  },
};
