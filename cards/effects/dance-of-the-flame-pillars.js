// ═══════════════════════════════════════════
//  CARD EFFECT: "Dance of the Flame Pillars"
//  Spell (Destruction Magic Lv 2, Normal)
//
//  Choose as many DIFFERENT TARGETS as there are
//  Destruction Magic Spells WITH DIFFERENT NAMES
//  in your discard pile and deal 100 damage to
//  each. If there are MORE different DM Spells in
//  your discard than there are targets on the
//  board, deal 150 damage to ALL targets instead
//  (both sides included).
//
//  Implementation
//  ──────────────
//  • Count distinct Destruction Magic Spell
//    names in the controller's discard. The
//    "different names" wording is satisfied by
//    deduplicating the discard pile by name.
//  • Count viable on-board targets — alive
//    Heroes on either side + every Creature in
//    a support zone on either side.
//  • If `distinctCount > viableTargets`: full-
//    board AOE for 150 via `aoeHit`.
//  • Else: prompt for EXACTLY `distinctCount` (Als Befund 12.9.)
//    DIFFERENT targets via `promptMultiTarget`
//    (the multi-target prompt enforces unique
//    selections natively).
//  • Both modes deal damage type
//    `destruction_spell` so reactions /
//    Anti-Magic / Smug Coin all gate normally.
// ═══════════════════════════════════════════
// v875: Namensvergleiche ueber den BASISNAMEN — „[B]"/„[W]" sind
// Kosmetik (siehe CARD_API, „Namen vergleichen").
const { baseCardName } = require('./_hooks');

const CARD_NAME = 'Dance of the Flame Pillars';
const PER_TARGET_DAMAGE  = 100;
const FULL_BOARD_DAMAGE  = 150;

function isDestructionMagicSpell(cd) {
  if (!cd) return false;
  if (cd.cardType !== 'Spell') return false;
  return cd.spellSchool1 === 'Destruction Magic'
      || cd.spellSchool2 === 'Destruction Magic';
}

function distinctDMSpellsInDiscard(engine, ps) {
  const cardDB = engine._getCardDB();
  const seen = new Set();
  for (const name of (ps.discardPile || [])) {
    if (seen.has(baseCardName(name))) continue;
    if (isDestructionMagicSpell(cardDB[name])) seen.add(baseCardName(name));
  }
  return seen.size;
}

function countAllValidTargets(engine) {
  let n = 0;
  for (let pi = 0; pi < (engine.gs.players || []).length; pi++) {
    const ps = engine.gs.players[pi];
    if (!ps) continue;
    for (const h of (ps.heroes || [])) {
      if (h?.name && h.hp > 0) n++;
    }
    // W16g (S01-06): „Ziele“ = Helden + KREATUREN (nicht jede belegte Support Zone — Ausruestung/Anhaenge sind keine Ziele);
    // dieselbe Menge, aus der die Zielwahl danach waehlt (`getCreatureTargets` = die Kreaturen, die `pi` kontrolliert).
    n += engine.getCreatureTargets(pi).length;
  }
  return n;
}

module.exports = {
  // ★ Als Ruling (Al 26.10., Flame Avalanche: „Wenn du andere Schadenskarten unspielbar machst, müssen das Vial und Rockfall auch sein!"): die Karte richtet NUR Schaden an Zielen an —
  // unter der Schadenssperre (`ps.damageLocked`) unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten; Sperr-Stutzen `engine._cardBlockedBySearchLock`).
  blockedByDamageLock: true,
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'flame_pillars' }, impactMs: 260 },

  /**
   * Need at least one matching Spell in the controller's discard
   * pile, otherwise the card has no targets to even reach for.
   */
  spellPlayCondition(gs, playerIdx, engine) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;
    return distinctDMSpellsInDiscard(engine, ps) > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps     = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // ★ W76a (Al: „Falls Dance exakt ein Ziel trifft, greift Bartas, sonst nicht"): Bartas' Zweitwurf ist ein Einzelziel-Zweitschlag auf EIN weiteres Ziel — die Zahl der
      // Ziele ist dort 1 (nicht neu aus der Ablage gezählt: das zweite Ziel ist ein EINZELziel) und nie die Vollfläche (die träfe das erste Ziel nochmal).
      const zweitwurf = !!gs._zweitzielWurf;
      const N = zweitwurf ? 1 : distinctDMSpellsInDiscard(engine, ps);
      if (N <= 0) { gs._spellCancelled = true; return; }

      const totalTargets = countAllValidTargets(engine);
      // "More different DM in discard than targets on the board" —
      // strict inequality. With distinct === total, we still go for
      // the multi-target mode (the spec wording is "if there are
      // MORE different…").
      const fullBoardMode = !zweitwurf && N > totalTargets;

      const dmgSource = { name: CARD_NAME, owner: pi, heroIdx, heroOwner: ctx.cardHeroOwner ?? pi };   // Als Befund 29.9.: Brettseite des Wirkers

      if (fullBoardMode) {
        // ── 150 damage to ALL targets, both sides ──
        await ctx.aoeHit({
          damage: FULL_BOARD_DAMAGE,
          damageType: 'destruction_spell',
          side: 'both',   // `aoeTargetPlayers` kennt 'own'/'both'/'enemy' — 'any' fiel auf die Gegnerseite zurueck (S01-05)
          types: ['hero', 'creature'],
          animationType: 'flame_pillars',
          sourceName: CARD_NAME,
        });
        engine.log('dance_of_flame_pillars_full', {
          player: ps.username, distinctSpells: N, damage: FULL_BOARD_DAMAGE,
        });
        return;
      }

      // ── Multi-target mode: GENAU N verschiedene Ziele ───────────────
      // ★ „Choose as many different targets as there are …" ist eine
      // ZAHL, kein Hoechstwert (Als Befund 12.9.): wer waehlen kann,
      // MUSS voll waehlen. `min: N` statt `min: 1`. Der Fall „weniger
      // Ziele auf dem Brett als Zahlen in der Ablage" ist oben schon
      // abgefangen — dort schlaegt die Karte flaechendeckend zu; hier
      // unten stehen also immer mindestens N Ziele zur Verfuegung.
      // Unter Ida (Einzelziel-Deckel, H02-heroes-05) kappt die Engine auf 1 Ziel —
      // dann kann `min` nicht N sein.
      const idaEinzel = !!ctx._engine.heroFlagsLive(ctx.cardHeroOwner ?? pi, heroIdx)?.forcesSingleTarget;
      const selected = await ctx.promptMultiTarget({
        side: 'any',
        types: ['hero', 'creature'],
        min: idaEinzel ? 1 : N,
        max: N,
        baseDamage: PER_TARGET_DAMAGE,
        damageType: 'destruction_spell',
        title: CARD_NAME,
        description: `Choose ${N} different target${N > 1 ? 's' : ''}. Deal ${PER_TARGET_DAMAGE} damage to each.`,
        confirmLabel: `🔥 Strike! (${PER_TARGET_DAMAGE} ×N)`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!Array.isArray(selected) || selected.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // ★★ v1185: Der Mehrfachzweig hatte GAR KEINE Flaechenklammer —
      // weder „Interference" noch „Deepsea Idol" sahen ihn, obwohl er
      // ein Schlag auf N Ziele ist. `beginAoeStrike` setzt beides; die
      // Saeulen fallen weiter nacheinander.
      await engine.beginAoeStrike(selected.length, {
        creatures: selected.filter(t => t.type !== 'hero').map(t => t.cardInstance).filter(Boolean),
        heroes: selected.filter(t => t.type === 'hero'),   // W78 (Pythia): Helden, die dieser Schlag faellt, sind todgeweiht
        source: dmgSource, amount: PER_TARGET_DAMAGE,
        type: 'destruction_spell', sourceOwner: pi,
      });
      try {
      for (const t of selected) {
        const tSlot = t.type === 'hero' ? -1 : t.slotIdx;
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_pillars',
          owner: t.owner, heroIdx: t.heroIdx, zoneSlot: tSlot,
        });
        await engine._delay(220);
        if (t.type === 'hero') {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (h && h.hp > 0) {
            await engine.actionDealDamage(dmgSource, h, PER_TARGET_DAMAGE, 'destruction_spell');
          }
        } else if (t.cardInstance) {
          await engine.actionDealCreatureDamage(
            dmgSource, t.cardInstance, PER_TARGET_DAMAGE, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }
      } finally {
        await engine.endMultiHit();
      }

      engine.log('dance_of_flame_pillars_multi', {
        player: ps.username,
        distinctSpells: N,
        targets: selected.map(t => t.cardName),
        damagePerTarget: PER_TARGET_DAMAGE,
      });
      engine.sync();
    },
  },
};
