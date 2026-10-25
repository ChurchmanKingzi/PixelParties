// ═══════════════════════════════════════════
//  CARD EFFECT: "500 Piranhas in a Monster Suit"
//  Creature (Summoning Magic Lv0, Normal, 50 HP)
//
//  Choose a Creature your opponent controls and
//  defeat it to play this card. Place this
//  Creature into the Support Zone the defeated
//  Creature occupied. The corresponding Hero
//  takes 80 damage at the end of each of its
//  controller's turns. Playing this card does
//  not cost an Action, but you can only play
//  1 per turn.
//
//  Implementation
//  ──────────────
//  Plays through `beforeSummon`:
//    1. Gate: 1-per-turn HOPT + an opp creature
//       must exist + the engine's standard
//       cardinal/control immunity gate excludes
//       un-defeatable creatures.
//    2. Prompt for opp Creature target.
//    3. Defeat via `actionDestroyCard` so all
//       on-death hooks (Cute Phoenix revive,
//       Loyal Terrier 50-dmg trigger, etc.) fire
//       cleanly. If the destroy gets cancelled
//       (Cool Rescuer Monia or similar saves the
//       target), the play fizzles too.
//    4. Place this Creature into the now-empty
//       slot, OWNED BY THE OPPONENT (so
//       inst.controller = opp → end-of-OPP's-
//       turn fires the 80-dmg trigger), but with
//       `inst.originalOwner` overridden back to
//       the caster so the card routes back to
//       OUR discard pile when later destroyed.
//    5. `_placementConsumedByCard` flag tells the
//       server not to also try its default
//       summon-on-our-side flow.
//
//  ANIMATION: "piranha_bites" — many small bite
//  marks chomping the host hero zone, fired both
//  on the host-takeover (placement) and on every
//  end-of-turn 80-dmg tick.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Piranhas in a Monster Suit'; // matches the partial-name search
// The full name for direct lookups. Engine grep is case-sensitive on
// the cards.json key.
const FULL_NAME = '500 Piranhas in a Monster Suit';
const HOST_DAMAGE = 80;
const HOPT_KEY = 'piranhas-suit';

function _hoptUsed(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn;
}
function _stampHopt(gs, pi) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;
}

/** Opp Creature targets that can actually be defeated (no Cardinal / omni / steal-immortal). */
function _validVictims(engine, pi) {
  const oi = engine.opponentOf(pi);
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    // Filter to opp-CONTROLLED creatures, not opp-owned: a stolen
    // creature is no longer a legal opp target, and a Chilly Wizard
    // cross-side-summoned onto opp's board IS.
    if ((inst.controller ?? inst.owner) !== oi) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (engine.isOmniImmune(inst, pi)) continue;      // Cardinal / omni (Golden Wings: nur gegen den Gegner, W17b)
    if (inst.counters?._damageDestroyImmune) continue; // Time Bomblebee armed
    if (inst.counters?.immovable) continue;
    if (inst.counters?._stealImmortal) continue;      // Stolen-and-immortal
    // ★ W64a (Al, 23.10.2026): „Creatures in einer geteilten Zone sind für diese Effekte schlicht keine legalen Ziele" — die Piranhas nimmt den Platz des
    // Besiegten ein; liegt dort noch eine Karte (Alice-Stapel), wäre die Zone danach nicht frei. Nur Zonen mit genau EINER Karte.
    if (!engine.zoneFreiNachKostenzahlung(engine.physicalSide(inst), inst.heroIdx, inst.zoneSlot, inst)) continue;
    out.push(engine.kreaturZiel(inst));   // Z1: ID/owner = Brettseite
  }
  return out;
}

/**
 * KOSTEN: gegnerische Kreatur wählen und besiegen. `false` = abgebrochen / nicht möglich (nichts bezahlt bzw. Rettung),
 * sonst `{ victimName, destHi, destSlot, vSeite }` für die Platzierung. Eine Stelle für `paySummonCost` und den Fallback.
 */
async function _zahleKosten(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const ps = gs.players[pi];
  if (!ps) return false;
  if (_hoptUsed(gs, pi)) return false;

  const victims = _validVictims(engine, pi);
  if (victims.length === 0) return false;

  // ── Step 1: pick the opp Creature to defeat ────────────────
  const picked = await engine.promptEffectTarget(pi, victims, {
    maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
    title: FULL_NAME,
    description: 'Choose an opponent Creature to defeat. The Piranhas takes its slot.',
    confirmLabel: '🐟 Devour!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1 },
  });
  if (!picked || picked.length === 0) return false;
  const victim = victims.find(t => t.id === picked[0]);
  if (!victim?.cardInstance) return false;

  const targetInst = victim.cardInstance;
  const destHi = targetInst.heroIdx;
  const destSlot = targetInst.zoneSlot;
  // Z1 (C01-06): die Zone des Opfers liegt auf seiner BRETTSEITE (`vSeite`) — bei einer vom
  // Gegner gestohlenen EIGENEN Kreatur ist das MEINE Seite, nicht die des Gegners.
  const vSeite = engine.physicalSide(targetInst);
  const ops = gs.players[vSeite];
  if (!ops) return false;

  // ── Step 2: defeat the chosen Creature ─────────────────────
  // Use actionDestroyCard so on-death hooks fire (Phoenix revive,
  // Loyal Terrier chain, etc.). Source is the Piranhas (owned by
  // us) so reactions correctly attribute the kill.
  const dummySource = { name: FULL_NAME, owner: pi, heroIdx: -1 };
  await engine.actionDestroyCard(dummySource, targetInst, {
    fireCreatureDeath: true,
  });

  // If the target was rescued (Cool Rescuer Monia, Cosmic
  // Malfunction, …) the destroy fizzled — bail and DON'T claim the
  // HOPT (the play didn't go through).
  if (targetInst.zone === 'support') {
    engine.log('piranhas_fizzle', {
      player: ps.username, reason: 'destroy_blocked',
      target: targetInst.name,
    });
    return false;
  }

  // ★ Welle 11 (Q72, Al: „b falls möglich, aber es muss eine Zone desselben Heroes sein, wähle automatisch die erstbeste,
  // sonst c."): belegt ein Todes-Effekt (Cute Bird → Cute Phoenix, Wiederbelebung …) die Zone sofort wieder, ist das KEIN
  // Fizzle mehr — die Ersatzzone (erste freie Zone desselben Helden) bzw. die Ablage entscheidet `beforeSummon` (`_ersatzzone`).
  return { victimName: victim.cardName, destHi, destSlot, vSeite };
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'piranha_bites' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  // No Action cost — plays as an inherent additional Action.
  inherentAction: true,
  // Doesn't need a free zone on a hero on OUR side; the placement
  // happens on the OPP's side after the target's defeat.
  canBypassFreeZoneRequirement: () => true,
  // Lv0 already needs no spell schools but bypassing the gate is
  // belt-and-suspenders for any future hero-school check.
  canBypassLevelReq: () => true,

  // Surface in the picker only when there's at least one valid
  // opp Creature to defeat AND the per-turn HOPT is unclaimed.
  canSummon: (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    if (_hoptUsed(gs, pi)) return false;
    return _validVictims(engine, pi).length > 0;
  },

  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    if (_hoptUsed(gs, pi)) return false;
    return _validVictims(engine, pi).length > 0;
  },

  // ★ W4b (Al, Welle 4): das Besiegen der gegnerischen Kreatur ist der KOSTENPUNKT („… and defeat it to play this card").
  // Wahl + Tod laufen VOR dem Reaktionsfenster der Beschwörung (`paySummonCost`); wird die Beschwörung danach komplett
  // negiert (Off Duty …), bleibt die Kreatur besiegt, die Piranhas gehen in die Ablage und die Rundengrenze bleibt frei.
  // `beforeSummon` platziert danach nur noch in den frei gewordenen Platz (ohne `paySummonCost`, z. B. bei
  // Effekt-Beschwörungen, zahlt es wie früher selbst).
  paySummonCost: async (ctx) => _zahleKosten(ctx),

  beforeSummon: async (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const kosten = ctx._summonKosten || await _zahleKosten(ctx);
    if (!kosten) return false;
    const { victimName, destHi, vSeite } = kosten;
    let destSlot = kosten.destSlot;
    const ops = gs.players[vSeite];
    if (!ops) return false;
    const oi = engine.opponentOf(pi);

    // Der Platz kann sofort nach dem Besiegen (Cute Phoenix …) oder im Reaktionsfenster belegt worden sein.
    // Q72 (Al): (b) automatisch die erste freie Zone DESSELBEN Helden, sonst (c) die Piranhas geht in die Ablage
    // (Opfer ist gefallen, Kosten bezahlt, Karte gespielt und verloren; die Rundengrenze ist verbraucht).
    if (((ops.supportZones?.[destHi] || [])[destSlot] || []).length > 0) {
      const ersatz = engine.getFreeSupportZones(vSeite).find(z => z.heroIdx === destHi);
      if (ersatz) {
        engine.log('piranhas_ersatzzone', { player: ps.username, target: victimName, slot: ersatz.slotIdx });
        destSlot = ersatz.slotIdx;
      } else {
        const handIdx0 = ctx._summonedFromPile ? -1 : (ps.hand || []).indexOf(FULL_NAME);   // W66b: aus Ablage/Deck beschworen (Skullmael, Forceful Revival …) kommt sie NICHT von der Hand — keine andere Kopie von dort nehmen
        if (handIdx0 >= 0) {
          engine.takeFromPileSync(ps, 'hand', handIdx0);
          engine.notePlayedFromHand(pi);
        }
        const ablageSeite = engine._consumeHandCardOrigin(pi, FULL_NAME);
        (gs.players[ablageSeite]?.discardPile || ps.discardPile).push(FULL_NAME);
        _stampHopt(gs, pi);
        ps._placementConsumedByCard = FULL_NAME;
        engine.log('piranhas_verworfen', { player: ps.username, reason: 'no_free_zone_on_hero', target: victimName });
        engine.sync();
        return false;
      }
    }

    // ── Step 3: place the Piranhas on OPP'S side ──────────────
    // Owner = opp so the creature renders on opp's row, controller
    // = opp so end-of-OPP's-turn fires our recurring damage. We
    // manually correct `originalOwner` back to us so destruction
    // routes the card to OUR discard pile (it WAS our card; opp
    // shouldn't get to recover it via their pile).
    const placeRes = engine.summonCreature(FULL_NAME, vSeite, destHi, destSlot, {
      source: FULL_NAME,
      ...(vSeite !== oi ? { controller: oi } : {}),   // Z1: liegt in meiner Zone, wird vom Gegner kontrolliert
    });
    if (!placeRes) {
      engine.log('piranhas_fizzle', {
        player: ps.username, reason: 'place_failed',
      });
      return false;
    }
    const inst = placeRes.inst;
    inst.originalOwner = pi; // discard routes back to us, not opp
    inst.controller = oi;    // explicit — already true via owner (Z1: bei seitenfremder Zone gesetzt von `controller`)

    // Remove the card from our hand (the standard server flow
    // would do this for a normal summon, but we're bypassing it
    // via `_placementConsumedByCard` below). Splice the FIRST
    // matching name; the server's `_resolvingCard` flag pins
    // which copy is the in-flight one.
    const handIdx = ctx._summonedFromPile ? -1 : (ps.hand || []).indexOf(FULL_NAME);   // W66b (siehe oben)
    if (handIdx >= 0) {
      engine.takeFromPileSync(ps, 'hand', handIdx);
      engine.notePlayedFromHand(pi);
    }

    // Visual: many bites on the host hero zone.
    engine._broadcastEvent('play_zone_animation', {
      type: 'piranha_bites',
      owner: vSeite, heroIdx: destHi, zoneSlot: -1,
    });
    await engine._delay(700);

    _stampHopt(gs, pi);
    ps._placementConsumedByCard = FULL_NAME;

    engine.log('piranhas_summon', {
      player: ps.username,
      victim: victimName,
      hostHero: ops.heroes?.[destHi]?.name,
    });
    engine.sync();

    // Returning false stops the server's default summonCreature
    // path (we already placed the inst manually on opp's side).
    return false;
  },

  hooks: {
    // ── End-of-controller's-turn 80 dmg to host ─────────────────
    // Fires for every card every onTurnEnd. ctx.activePlayer = the
    // turn that's ENDING. We trigger when activePlayer matches our
    // controller (opp), since the Piranhas is on opp's side.
    onTurnEnd: async (ctx) => {
      // Standard "controller's turn ending" gate. Piranhas was placed
      // under the opp's ownership in beforeSummon, so cardOwner is opp
      // and isMyTurn is true exactly at the end of opp's turn — which
      // is the spec ("end of each of its controller's turns").
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;

      const host = ctx.attachedHero;
      if (!host?.name || host.hp <= 0) return;
      // ★ Welle 11 (Q69, Al): „Der Schaden wird am Ende der Runde des Spielers applied, der aktuell die
      // permanente Kontrolle über den Hero in question hält." — nicht der Kontrolleur der Piranhas, sondern
      // der des Wirtshelden (Brettseite, bei dauerhafter Übernahme `permaControlBy`; Charme zählt nicht).
      const controller = host.permaControlBy ?? engine.physicalSide(inst);
      if (gs.activePlayer !== controller) return;

      // Animation: bites land on host hero.
      engine._broadcastEvent('play_zone_animation', {
        type: 'piranha_bites',
        owner: ctx.cardHeroOwner ?? controller, heroIdx: inst.heroIdx, zoneSlot: -1,   // Z1: Brettseite
      });
      await engine._delay(450);

      // Damage attributed to the ORIGINAL caster, so reactions that
      // gate on "damage from an opp source" fire correctly for the
      // controller. heroIdx mirrors the host slot so attribution lines
      // up.
      const sourceOwner = inst.originalOwner ?? inst.owner;
      const source = {
        name: FULL_NAME, owner: sourceOwner, heroIdx: inst.heroIdx,
        cardInstance: inst,
      };
      // „The corresponding Hero takes 80 damage": der Host steht fest (Als Ruling 9.10.).
      await engine.actionDealDamage(source, host, HOST_DAMAGE, 'creature', { festesZiel: true });

      engine.log('piranhas_tick', {
        host: host.name, dmg: HOST_DAMAGE, controller,
      });
      engine.sync();
    },
  },
};
