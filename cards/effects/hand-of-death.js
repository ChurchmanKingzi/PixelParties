// ═══════════════════════════════════════════
//  CARD EFFECT: "Hand of Death"
//  Spell (Destruction Magic Lv 1) — Normal,
//  HOPT (1/turn).
//
//  "If the user is not defeated, Frozen or
//   Stunned at the end of your opponent's next
//   turn, you may choose any target and defeat
//   it. This effect can never affect more than 1
//   target. If a target is defeated by this
//   effect, skip your next turn. You can only
//   play 1 «Hand of Death» per turn."
//
//  Architecture  (★ W66a — der Effekt gehört dem SPIELER, nicht der Karte)
//  ────────────
//  Hand of Death resolves like a normal Spell. Der verzögerte Defeat lebt
//  AUSSCHLIESSLICH am Spielerzustand `ps._handOfDeathArmed` (gesetzt in
//  onPlay) und wird von der ENGINE ausgelöst: `switchTurn` ruft am Zugende
//  (nach `ON_TURN_END`, in einem eigenen Fangnetz — auch wenn ein anderer
//  Zugende-Hook abbricht) `nachholenOhneKarte(engine)`. Es gibt KEINEN
//  Karten-Listener mehr: weder die Ablage-Instanz (`_ensurePileListeners`),
//  noch eine Hand-/Brett-Instanz, noch ein Fantasy Buddy Token (Inya) spielt
//  für das Auslösen eine Rolle — die Karte darf in der Hand, der Ablage, im
//  Deck, als Token auf dem Brett liegen oder weg sein; Token lebt oder stirbt.
//  (Vorher: `hooks.onTurnEnd` an der Ablage-Instanz + Nachhol-Weg der Engine
//  — zwei Wege, die sich gegenseitig verdeckten; Tests mit Direktaufruf
//  sahen nur den einen.)
//
//  ── Trigger window ──
//  Fires at the END of the first turn of a player OTHER than the caster
//  after the cast turn — "the end of your opponent's next turn":
//    `gs.activePlayer !== ownerIdx  AND  gs.turn > armedOnTurn`
//  (W66a: war `gs.turn === armedOnTurn + 1`; ein übersprungener Zugwechsel
//  oder verschobene Zugnummer ließ den Eintrag sonst für immer stehen.)
//
//  Worked example: P0 casts on turn 5.
//    • Turn 5 end (P0): active = caster → skipped. Flag still armed.
//    • Turn 6 end (P1): turn 6 > 5, active ≠ caster → fires.
//  ★ W67a (Al, 23.10.2026): ein ÜBERSPRUNGENER Gegnerzug (Guardian Beast Zhu,
//  „skip your next turn") zählt NICHT als „your opponent's next turn" — er
//  endet zwar formal (`_switchTurnInner({ uebersprungen: true })`), aber dort
//  ruft die Engine `nachholenOhneKarte` NICHT; der Auftrag bleibt liegen und
//  feuert am Ende des nächsten tatsächlich gespielten Gegnerzuges.
//
//  ── Schutzschichten (★ W66a, Al: „Resistance … JEDE Form von defeat") ──
//  Der Kill läuft über `engine.actionDefeat(..., { wirkungsSchutz: true })`:
//  Held → `actionDefeatHero`: Erstrunden-Schutz, Resistance (Stufen),
//  Effekt-Immunität, Spell-Schild, Zielschutz „or HIT" (Dive Down, Jetpack,
//  Alluring Light …), Anti Magic Enchantment, Anti Magic, Charmed,
//  Quellen-Immunität, Versteinert, Submerged, „would be defeated"-
//  Reaktionen. Kreatur → `actionDestroyCard` (Cardinal, Gate Shield,
//  Puppets-Wächter, Monia, Golden Wings …). SCHADENS-Schutz (Schadens-
//  immunität, Inyas „takes no damage") gilt NICHT: kein Schaden.
// ═══════════════════════════════════════════

const CARD_NAME = 'Hand of Death';
const HOPT_KEY = 'hand-of-death';

/** Steht für `pi` ein Auftrag im Fenster „Ende des nächsten gegnerischen Zuges"? */
function imFenster(gs, pi) {
  const armed = gs.players[pi]?._handOfDeathArmed;
  if (!armed || typeof armed.armedOnTurn !== 'number') return false;
  return gs.activePlayer !== pi && gs.turn > armed.armedOnTurn;
}

/**
 * ★ W66a: der verzögerte Effekt — unabhängig von jeder Karteninstanz. Der Auftrag liegt am Spieler (`ps._handOfDeathArmed`) und wird SOFORT
 * verbraucht (genau einmal). Eine kurzlebige Hilfsinstanz in der Ablage des Wirkers trägt nur den Kontext für die Zielwahl (`ctx.promptDamageTarget`).
 */
async function ausloesen(engine, ownerIdx) {
  const gs = engine.gs;
  const ps = gs.players[ownerIdx];
  const armed = ps?._handOfDeathArmed;
  if (!ps || !armed) return;
  delete ps._handOfDeathArmed;

  // ── User-status gate ──
  const userHeroIdx = armed.casterHeroIdx;
  const userSeite = armed.casterHeroOwner ?? ownerIdx;   // Als Befund 29.9.: Brettseite des Wirkers
  const userHero = gs.players[userSeite]?.heroes?.[userHeroIdx];
  if (!userHero?.name || userHero.hp <= 0) {
    engine.log('hand_of_death_fizzle', { player: ps.username, reason: 'user_defeated' });
    return;
  }
  if (userHero.statuses?.frozen) {
    engine.log('hand_of_death_fizzle', { player: ps.username, reason: 'user_frozen' });
    return;
  }
  if (userHero.statuses?.stunned || userHero.statuses?.webbed) {
    engine.log('hand_of_death_fizzle', { player: ps.username, reason: 'user_stunned' });
    return;
  }

  const tmp = engine._trackCard(CARD_NAME, ownerIdx, 'discard');
  tmp.heroIdx = userHeroIdx;
  if (userSeite !== ownerIdx) tmp.heroOwner = userSeite;
  try {
    const ctx = engine._createContext(tmp, { turn: gs.turn, activePlayer: gs.activePlayer });

    // Caster flourish — same dark-swarm cue tying the trigger to the user before the picker opens.
    engine._broadcastEvent('play_zone_animation', {
      type: 'dark_swarm', owner: userSeite,   // Als Befund 29.9.: Brettseite des Wirkers
      heroIdx: userHeroIdx, zoneSlot: -1,
    });
    await engine._delay(300);

    // ── Prompt: pick any target ("you may") ──
    // `dealsDamage: false` opts out of damage-mitigation post-target reactions (Spectral Armor / Bamboo Shield / Sculpture Guards).
    // `damageType: 'destruction_spell'` keeps the school tag. `cancellable: true` = das „may".
    const sourceMeta = {
      name: CARD_NAME, owner: ownerIdx, heroIdx: userHeroIdx, heroOwner: userSeite,   // Als Befund 29.9.: Brettseite des Wirkers
      controller: ownerIdx,
    };
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'destruction_spell',
      dealsDamage: false,
      title: CARD_NAME,
      description: 'Choose any target — it is defeated.',
      confirmLabel: '💀 Defeat!',
      confirmClass: 'btn-danger',
      cancellable: true,
    });

    if (!target) {
      engine.log('hand_of_death_fizzle', { player: ps.username, reason: 'cancelled' });
      return;
    }

    // ── Resolve the defeat ──
    let defeated = false;
    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero?.name && hero.hp > 0) {
        // ★ W66a: EIN Baustein für „defeat" — Resistance, Zielschutz, Anti Magic (Buff + Enchantment), Charmed, Submerged, Versteinerung,
        // Erstrunden-Schutz, Spell-Schild und „would be defeated"-Reaktionen entscheiden in `actionDefeatHero`. Die Strike-Animation
        // läuft erst, wenn der Tod feststeht (`vorTod`), nicht bei einem abgeprallten Effekt.
        const r = await engine.actionDefeat(sourceMeta, hero, {
          sourceOwner: ownerIdx, reason: CARD_NAME,
          damageType: 'destruction_spell', wirkungsSchutz: true,
          vorTod: async () => {
            engine._broadcastEvent('play_zone_animation', {
              type: 'hand_of_death_strike',
              owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
              duration: 1700,
            });
            await engine._delay(900); // sync the defeat with the impact
          },
        });
        defeated = !!r?.defeated;
        if (!defeated) engine.log('hand_of_death_blocked', { target: hero.name, reason: r?.reason || (r?.blocked ? 'effect_cancelled' : 'prevented') });
        else await engine._delay(400);   // let the strike animation finish blooming after the defeat numbers settle
      }
    } else {
      // 'equip' / 'creature' — a Creature in a Support Zone.
      const inst = target.cardInstance || engine.kreaturAnBrett(target.owner, target.heroIdx, target.slotIdx);   // Z1: Brettseite
      if (inst && inst.zone === 'support') {
        engine._broadcastEvent('play_zone_animation', {
          type: 'hand_of_death_strike',
          owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
          duration: 1700,
        });
        await engine._delay(900);
        // `actionDestroyCard` (über `actionDefeat`) kennt jede Kreatur-Immunität (Cardinal Beast, Defending the Gate, Erstrunden-Schutz, _stealImmortal,
        // _damageDestroyImmune, Sparkfly-Geschenk, Puppets-Wächter, Monia …) und löst die Tod-Hooks aus; ob die Zerstörung landete, zeigt die Zone.
        const r = await engine.actionDefeat(sourceMeta, inst, { sourceOwner: ownerIdx, sourceName: CARD_NAME });
        defeated = !!r?.defeated;
        await engine._delay(400);
      }
    }

    // ── Skip-next-turn rider ──
    // Only when a target was actually defeated. Uses the engine's canonical `_skipNextTurn` flag (Guardian Beast Zhu's mechanism) —
    // `switchTurn` reads it and skips the player's upcoming turn automatically.
    if (defeated) {
      ps._skipNextTurn = true;
      engine.log('hand_of_death_skip_turn', { player: ps.username, target: target.cardName });
    }

    engine.log('hand_of_death_resolved', { player: ps.username, target: target.cardName, defeated });
    engine.sync();
  } finally {
    engine._untrackCard(tmp.id);
  }
}

/**
 * Von der Engine am Zugende gerufen (`switchTurn`, nach `ON_TURN_END`, eigenes Fangnetz): löst jeden fälligen Auftrag aus. Der Name stammt aus
 * Welle 14 (Q171, „ohne Karte in der Ablage") — seit W66a ist das der EINZIGE Weg (kein Ablage-Listener mehr).
 */
async function nachholenOhneKarte(engine) {
  const gs = engine.gs;
  for (let pi = 0; pi < engine.playerCount(); pi++) {
    if (gs.result) return;
    if (!imFenster(gs, pi)) continue;
    await ausloesen(engine, pi);
  }
}

module.exports = {
  nachholenOhneKarte,
  neverMultiTarget: true,   // W75b: „This effect can never affect more than 1 target." — Bartas bietet keinen Zweitwurf an (Text-Waechter `scripts/check-never-multi-target.js`)
  // ★ Z7b: FIZZELT die Karte (Wirker beim Auflösen handlungsunfähig, v1328), war sie GESPIELT → Stempel (Engine: `_noteFizzledPlay`).
  // Eine ganz NEGIERTE Karte stempelt nicht (Als Entscheidung, Welle 3).
  onFizzledPlay: ({ engine, gs, pi }) => { engine.claimHOPT(HOPT_KEY, pi); },

  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'dark_swarm' }, impactMs: 260,
  },

  // W66a: nur die Handkarte spielt (onPlay); der verzögerte Teil hängt am Spieler (`ps._handOfDeathArmed`), nicht an einer Instanz.
  activeIn: ['hand'],

  /** Greys out in hand after one cast this turn. */
  spellPlayCondition(gs, pi) {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      // Self-cast gate: only fire when THIS specific hand instance is
      // the played card (filters cross-fires from siblings in hand).
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // HOPT — defensive double-check (the play-gate already runs the
      // same check; this catches a chained / race cast on the same turn).
      if (!ctx.hardOncePerTurn(HOPT_KEY)) {
        gs._spellCancelled = true;
        return;
      }

      // Arm the pending effect on player state (W66a: the ONLY carrier). Overwrites any previous armed entry — HOPT enforces 1/turn so
      // there's only ever at most one pending effect per player.
      ps._handOfDeathArmed = {
        armedOnTurn: gs.turn,
        casterHeroIdx: heroIdx, casterHeroOwner: ctx.cardHeroOwner ?? pi,   // Als Befund 29.9.: Brettseite des Wirkers
      };

      // Pre-fire flourish on the caster — dark swarm rising. The
      // serious animation lands later at trigger time on the picked
      // target.
      engine._broadcastEvent('play_zone_animation', {
        type: 'dark_swarm', owner: ctx.cardHeroOwner ?? pi, heroIdx, zoneSlot: -1,   // Als Befund 29.9.: Brettseite des Wirkers
      });
      await engine._delay(400);

      engine.log('hand_of_death_armed', {
        player: ps.username,
        hero: (ctx.attachedHero || ps.heroes[heroIdx])?.name,   // Als Befund 29.9.: Brettseite des Wirkers
        armedOnTurn: gs.turn,
      });
      engine.sync();
      // No `_spellPlacedOnBoard` — the Spell flows through the
      // standard hand → discard disposition (or Inya's Fantasy Buddy).
    },
  },
};
