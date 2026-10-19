// ═══════════════════════════════════════════
//  CARD EFFECT: "Pollution Piranha"
//  Creature (Summoning Magic Lv0, Normal) — 50 HP.
//  Pollution archetype.
//
//  • Remove a Pollution Token from YOUR side of the
//    board to summon this Creature. (Summon cost.)
//  • Summoning this Creature counts as an additional
//    Action. (Plays as an inherent additional action
//    — does NOT consume the main action, same pattern
//    as Aggressive Town Guard.)
//  • Once per turn, choose a target and deal 50 damage.
//  • When this Creature leaves the board, delete 1
//    card from your hand.
//
//  Summon cost is resolved via _pollution-shared's
//  generic `removePollutionTokens` — same path Victorica
//  and Mana Beacon use. The `beforeSummon` hook runs
//  BEFORE placement so a cancelled/fizzled cost never
//  leaves a ghost Creature on the board.
//
//  Animations:
//    • Summon: the piranha bite engulfs the Pollution
//      Token as it's consumed to pay the summon cost
//      (piranha_bite on the token's zone).
//    • Damage: the same bite animation chomps the
//      targeted hero/creature.
// ═══════════════════════════════════════════

const {
  removePollutionTokens,
  getPollutionTokens,
  countPollutionTokens,
} = require('./_pollution-shared');

const T = require('./_teocuilatl-shared');   // W17a: Landung im frei gewordenen Platz (`placeAfterSacrificeSwap`)
const { isSeat } = require('./_opp');

const CARD_NAME = 'Pollution Piranha';
const BITE_DAMAGE = 50;

// ── W17a (Al, 19.10.2026, A01-20): Ersetzen des Tokens ───────────────────────────────────────────────────────────
// „Das ist eine generelle Regel für ALLE Creatures, die andere Karten in Support Zonen ersetzen" - die Piranha darf bei vollem Brett
// in die Zone ihres Tokens (Wurf auf den Token). NUR für Zonen mit genau EINER Karte (`engine.zoneFreiNachKostenzahlung`):
// mit „Alice, the Transfer Student" kann eine Zone mehrere Karten tragen, dann macht das Entfernen des Tokens sie nicht frei.
/** Mein Token (Kontrolle `pi`) auf dem Platz (`heroOwner` = Brettseite, `heroIdx`, `slotIdx`), dessen Zone danach frei ist - sonst null. */
function tokenImPlatz(engine, pi, heroIdx, slotIdx, heroOwner = pi) {
  if (!engine.zoneFreiNachKostenzahlung(heroOwner, heroIdx, slotIdx)) return null;
  return getPollutionTokens(engine, pi).find(inst =>
    engine.physicalSide(inst) === heroOwner && inst.heroIdx === heroIdx && inst.zoneSlot === slotIdx) || null;
}
/** Kann dieser Held die Piranha beschwören (lebt, Stufe), von `pi` kontrolliert, Zone `heroOwner`? */
function heldKannBeschwoeren(engine, pi, heroIdx, heroOwner = pi) {
  return T.heroCanSummon(engine, pi, heroIdx, CARD_NAME, heroOwner);
}
/** Alle Token-Plätze, in die die Piranha ersetzend fallen darf. `owner` = Brettseite, nur gesetzt, wenn ≠ pi. */
function tokenPlaetze(engine, pi) {
  const out = [];
  for (const inst of getPollutionTokens(engine, pi)) {
    const seite = engine.physicalSide(inst);
    if (!tokenImPlatz(engine, pi, inst.heroIdx, inst.zoneSlot, seite)) continue;
    if (!heldKannBeschwoeren(engine, pi, inst.heroIdx, seite)) continue;
    out.push(seite !== pi ? { heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, owner: seite } : { heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot });
  }
  return out;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'piranha_bite' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],

  // Summoning Pollution Piranha is itself an additional Action —
  // the summon doesn't consume the main Action Phase action.
  inherentAction: true,

  // Cheap gate: is at least one Pollution Token on our side?
  // Used by the engine's hand-play filter AND by summon effects
  // (Living Illusion etc.) via engine.isCreatureSummonable.
  canSummon(ctx) {
    return countPollutionTokens(ctx._engine, ctx.cardOwner) > 0;
  },

  // W17a (A01-20): Ersetzen-Vertrag (Muster Teocuilatl-Trio): die Zone des entfernten Tokens ist nach der Kostenzahlung frei - auch bei
  // sonst vollem Brett. Die Kosten sind eine Handlung des Helden: gefroren/betäubt/negiert kann er sie nicht ausführen.
  requiresActiveCaster: true,
  canBypassFreeZoneRequirement(gs, pi, heroIdx, cardData, engine) {
    return tokenPlaetze(engine, pi).some(s => s.heroIdx === heroIdx && (s.owner ?? pi) === pi);
  },
  canPlaceOnOccupiedSlot(gs, pi, heroIdx, slotIdx, engine, heroOwner = pi) {
    return !!tokenImPlatz(engine, pi, heroIdx, slotIdx, heroOwner) && heldKannBeschwoeren(engine, pi, heroIdx, heroOwner);
  },
  getBouncePlacementTargets(gs, pi, engine) {
    return tokenPlaetze(engine, pi);
  },

  /**
   * Pre-placement cost resolution. Runs BEFORE the Creature
   * touches the board, so a fizzled cost aborts the whole summon
   * without a transient ghost instance. Returning false aborts.
   *
   * Flow:
   *   1. Pick the specific Pollution Token to consume (auto if one,
   *      zone-pick if multiple).
   *   2. Bite-chomp animation on the chosen Token.
   *   3. Remove that exact Token via the shared helper (filter
   *      narrows the pool to the single chosen instance so the
   *      helper's own pick is bypassed — no double prompt).
   */
  // ★ W4b (Al, Welle 4): das Entfernen des Pollution Tokens ist ein KOSTENPUNKT der Beschwörung und wird VOR dem Reaktionsfenster bezahlt (`paySummonCost`,
  // Engine `_payCreatureSummonCost`); wird die Beschwörung danach komplett negiert (Off Duty …), bleibt er bezahlt.
  // `beforeSummon` zahlt nur noch, wenn `paySummonCost` nicht lief (Effekt-Beschwörungen u. ä.; `ctx._summonKosten` fehlt).
  async paySummonCost(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const pool = getPollutionTokens(engine, pi);
    if (pool.length === 0) return false;

    // W17a (A01-20): Wurf auf einen belegten Platz = genau DIESEN Token entfernen und seinen Platz einnehmen (Tausch). Die Marke
    // bleibt gesetzt, `beforeSummon` räumt sie ab; der Platz ist bis zur Landung gehalten (kein Todes-Trigger schnappt ihn weg).
    const req = ps._requestedBouncePlaceSlot;
    if (req) {
      const heroOwner = isSeat(engine.gs, req.heroOwner) ? req.heroOwner : pi;
      const tok = tokenImPlatz(engine, pi, req.heroIdx, req.slotIdx, heroOwner);
      if (!tok || !heldKannBeschwoeren(engine, pi, req.heroIdx, heroOwner)) return false;
      engine.haltePlatzFuerTausch(heroOwner, req.heroIdx, req.slotIdx);
      engine._broadcastEvent('play_zone_animation', {
        type: 'piranha_bite', owner: heroOwner, heroIdx: tok.heroIdx, zoneSlot: tok.zoneSlot,
      });
      await engine._delay(450);
      const tokId = tok.id;
      const { removed } = await removePollutionTokens(engine, pi, 1, CARD_NAME, {
        promptCtx: ctx,
        filter: (inst) => inst.id === tokId,
      });
      if (removed <= 0) return false;
      return { kind: 'swap', heroIdx: req.heroIdx, slotIdx: req.slotIdx, heroOwner, occName: 'Pollution Token' };
    }

    let chosen;
    if (pool.length === 1) {
      chosen = pool[0];
    } else {
      const zones = pool.map(inst => {
        // Styx 28.9.: seitenfremd beschworene Tokens stehen auf der Gegenseite.
        const seite = engine.physicalSide(inst);
        const hero = engine.gs.players[seite]?.heroes?.[inst.heroIdx];
        return {
          owner: seite,
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          label: `${hero?.name || 'Hero'} — Slot ${inst.zoneSlot + 1}`,
        };
      });
      const picked = await ctx.promptZonePick(zones, {
        title: CARD_NAME,
        description: 'Choose a Pollution Token to consume and summon Pollution Piranha in its place.',
        cancellable: false,
        // Es wird eine KARTE gewaehlt, nicht ein Platz: ein Klick auf den Helden
        // darf nicht stillschweigend dessen linkeste waehlen (s. promptZonePick).
        heroShortcut: false,
      });
      if (!picked) return false;
      chosen = pool.find(inst =>
        inst.heroIdx === picked.heroIdx && inst.zoneSlot === picked.slotIdx
      ) || pool[0];
    }
    if (!chosen) return false;

    // Bite animation on the chosen Token only — then let the shared
    // helper run its standard evaporate removal on the same slot.
    engine._broadcastEvent('play_zone_animation', {
      type: 'piranha_bite',
      owner: chosen.owner,
      heroIdx: chosen.heroIdx,
      zoneSlot: chosen.zoneSlot,
    });
    await engine._delay(450);

    const chosenId = chosen.id;
    const { removed } = await removePollutionTokens(engine, pi, 1, CARD_NAME, {
      promptCtx: ctx,
      filter: (inst) => inst.id === chosenId,
    });
    return removed > 0 ? { kind: 'none' } : false;
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    // W4b: Kosten schon vor dem Reaktionsfenster bezahlt -> nur noch landen (W17a: bei einem Tausch im Platz des Tokens).
    const pre = ctx._summonKosten;
    if (pre) {
      if (ps?._requestedBouncePlaceSlot) delete ps._requestedBouncePlaceSlot;
      if (ps?._requestedNormalSummonSlot) delete ps._requestedNormalSummonSlot;
      return pre.kind === 'swap' ? await T.placeAfterSacrificeSwap(engine, pi, pre, CARD_NAME) : true;
    }
    // Ohne `paySummonCost`-Lauf (Effekt-Beschwörung o. ä.): wie früher selbst zahlen; eine Wurf-Marke gilt dort nicht.
    if (ps?._requestedBouncePlaceSlot) delete ps._requestedBouncePlaceSlot;
    return (await module.exports.paySummonCost(ctx)) !== false;
  },

  // ── Activated ability: once per turn, deal 50 damage ──
  creatureEffect: true,
  canActivateCreatureEffect(ctx) {
    // Engine enforces HOPT + summoning sickness generically; this
    // hook is only for extra conditions (we have none).
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    // Kontrolle statt Seite (Styx 28.9.): gestohlen/seitenfremd beschworen
    // handelt die Kreatur fuer ihren Kontrolleur, nicht fuer die Brettseite.
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: BITE_DAMAGE,
      title: CARD_NAME,
      description: `Sink the piranha's teeth into a target for ${BITE_DAMAGE} damage.`,
      confirmLabel: `🦷 Bite! (${BITE_DAMAGE})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });

    if (!target) return false;

    // Bite animation on the target
    const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'piranha_bite',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: tgtSlot,
    });
    await engine._delay(500);

    if (target.type === 'hero') {
      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, BITE_DAMAGE, 'creature');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, BITE_DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('pollution_piranha_bite', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      damage: BITE_DAMAGE,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * When this Piranha leaves the Support Zone — via death, bounce,
     * banish, anything — the owner deletes 1 card from their hand.
     *
     * Guard pattern copied from flying-island-in-the-sky.js: only fire
     * when the LEAVING card (identified by ctx.fromOwner / fromHeroIdx /
     * fromZoneSlot) matches THIS listener's own board coordinates.
     * Crucial because _pollution-shared's `_removeTokenInstance` fires
     * `onCardLeaveZone` WITHOUT an `_onlyCard` filter — every listener
     * on the board gets the event. ctx.card is the listener (always this
     * Piranha), NOT the departing card, so name-matching on ctx.card
     * would false-trigger on every Pollution Token removal. The slot/
     * owner compare narrows correctly to "this Piranha leaving".
     */
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const self = ctx.card; // listener = this Piranha

      if (ctx.fromZone !== 'support') return;
      // ★ W16b (A01-pollution-33): „leaves the board" — ein Umzug auf dem Brett (Transfer/Versetzen) ist kein Verlassen.
      if (ctx.isTransfer || ctx.toZone === 'support') return;
      // Z1 (A01-33): `fromOwner` ist die BRETTSEITE, `cardOwner` der Kontrolleur — eine gestohlene
      // Piranha liegt auf der Seite des Besitzers; verglichen wird deshalb mit ihrer Brettseite.
      const _seite = self ? engine.physicalSide(self) : ctx.cardOwner;
      if (ctx.fromOwner !== undefined && ctx.fromOwner !== _seite) return;
      if (ctx.fromHeroIdx !== undefined && ctx.fromHeroIdx !== ctx.cardHeroIdx) return;
      if (ctx.fromZoneSlot !== undefined && self?.zoneSlot !== undefined
          && ctx.fromZoneSlot !== self.zoneSlot) return;

      const ownerIdx = (self ? engine.kontrolleurVon(self) : null) ?? ctx.cardOwner;   // Z1: „your hand" = Kontrolleur
      if (ownerIdx == null) return;
      const ps = gs.players[ownerIdx];
      if (!ps) return;

      if ((ps.hand || []).length === 0) {
        engine.log('pollution_piranha_leave', {
          player: ps.username, note: 'empty_hand',
        });
        return;
      }

      const result = await engine.promptGeneric(ownerIdx, {
        type: 'forceDiscard',
        count: 1,
        title: CARD_NAME,
        description: 'Pollution Piranha left the board — delete 1 card from your hand.',
        instruction: 'Click a card in your hand to delete it.',
        cancellable: false,
      });

      let deletedName;
      let deletedIdx = -1;
      if (result && result.cardName) {
        const handIdx = result.handIndex;
        if (handIdx != null && handIdx >= 0 && handIdx < ps.hand.length
            && ps.hand[handIdx] === result.cardName) {
          deletedIdx = handIdx;
          deletedName = result.cardName;
        } else {
          const fallback = ps.hand.indexOf(result.cardName);
          if (fallback >= 0) { deletedIdx = fallback; deletedName = result.cardName; }
        }
      }
      // Safety fallback — if nothing was picked (shouldn't normally
      // happen because the prompt is non-cancellable), delete from
      // the end of hand so the effect still resolves.
      if (deletedIdx < 0 && (ps.hand || []).length > 0) {
        deletedIdx = ps.hand.length - 1;
        deletedName = ps.hand[deletedIdx];
      }

      if (deletedIdx >= 0 && deletedName) {
        engine.takeFromPileSync(ps, 'hand', deletedIdx);
        if (!ps.deletedPile) ps.deletedPile = [];
        ps.deletedPile.push(deletedName);
        engine.log('pollution_piranha_delete', {
          player: ps.username, card: deletedName,
        });
      }

      engine.sync();
    },
  },
};
