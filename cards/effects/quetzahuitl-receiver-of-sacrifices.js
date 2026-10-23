// ═══════════════════════════════════════════
//  CARD EFFECT: "Quetzahuitl, Receiver of Sacrifices"
//  Hero — printed 200 HP / 200 ATK. Despite its `cardType: 'Hero'`,
//  this card sits in the player's MAIN DECK and gets drawn into hand
//  like any other card. It enters play through a reactive "divine
//  descent" trigger, not through the normal Hero-setup path.
//
//  Trigger:
//    When the LAST living Hero you control is defeated during your
//    opponent's turn while Quetzahuitl is in your hand:
//      1. Delete all your Heroes.
//      2. Delete every card in all your Heroes' Support and Ability
//         Zones (route to the Deleted pile, NOT the Discard pile).
//      3. Place Quetzahuitl from hand into the dying Hero's slot.
//      4. Attach up to 3 copies of "Divinity" pulled from your deck,
//         hand, or discard pile (priority order) — stacked into a
//         single ability slot, matching Sacrifice-to-Divinity's
//         placement convention.
//      5. When Quetzahuitl is later defeated, the controller loses
//         the game immediately.
//
//  Engine integration notes:
//    • Trigger lives in the hand-zone listener under `onHeroKO`
//      (`activeIn: ['hand']`). The engine walks all hand-zone
//      CardInstances with a matching hook during the KO cascade, so
//      Quetzahuitl reliably sees the death event before
//      `checkAllHeroesDead` runs — which is critical, because after
//      our placement Quetzahuitl is alive and the "all heroes dead
//      → game over" check correctly returns false.
//
//    • Replacement strategy: install Quetzahuitl in the slot of the
//      Hero that just died. Card text says the player chooses one
//      of their Hero Zones; defaulting to the dying slot keeps the
//      flow non-prompted mid-KO-cascade, which would otherwise be
//      jarring. Can be replaced with an explicit zone prompt later
//      if the user wants the literal "choose a slot" experience.
//
//    • Loss-on-defeat enforcement: a second `onHeroKO` listener
//      (`activeIn: ['hero']`) fires `engine.onGameOver` if this
//      card's own hero object is the one being KO'd. Without this,
//      a future effect that puts an extra Hero on the board next to
//      Quetzahuitl would silently let the game continue past
//      Quetzahuitl's defeat — `checkAllHeroesDead` only triggers
//      loss when EVERY Hero is dead.
//
//    • Divinity attachment: routed through `canAttachAbilityToHero`
//      with `allowRestricted: true` — same gate Sacrifice to
//      Divinity / Very Special Prisoner use to bypass Divinity's
//      `restrictedAttachment` block. The freshly-tracked
//      Quetzahuitl slot has empty ability zones, so the first
//      Divinity lands in slot 0 and copies 2 and 3 stack on top of
//      it (Divinity stacks up to 3 deep on a single slot).
// ═══════════════════════════════════════════

const CARD_NAME = 'Quetzahuitl, Receiver of Sacrifices';
const DIVINITY  = 'Divinity';

module.exports = {
  // Hooks need to fire from the hand (trigger) AND from the hero
  // zone (loss-on-defeat).
  activeIn: ['hand', 'hero'],

  // Never proactively playable. The card enters play only through
  // its reactive descent trigger; until then it sits dimmed in
  // hand. `canActivate: () => false` keeps the standard play paths
  // greyed out, `neverPlayable: true` keeps it out of chain windows
  // and CPU consideration.
  canActivate: () => false,
  neverPlayable: true,

  hooks: {
    onHeroKO: async (ctx) => {
      // Branch by zone — hand triggers the descent, hero triggers
      // the loss enforcement.
      if (ctx.cardZone === 'hero') {
        return handleLossOnDefeat(ctx);
      }
      if (ctx.cardZone === 'hand') {
        return handleHandTrigger(ctx);
      }
    },
  },
};

// ═══════════════════════════════════════════
//  HAND TRIGGER — divine descent
// ═══════════════════════════════════════════

async function handleHandTrigger(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const ps = gs.players[pi];
  if (!ps) return;

  // Card text restricts the trigger to "during your opponent's
  // turn" — `ctx.isMyTurn` is true when this card's controller is
  // the active player, so abort whenever it's our own turn.
  if (ctx.isMyTurn) return;

  const dyingHero = ctx.hero;
  if (!dyingHero?.name) return;
  // ★ W31a (Al, 22.10.2026: „one of your Heroes" / „your Heroes" gilt nach aktueller KONTROLLE; Text: „When the LAST Hero YOU CONTROL is defeated …"): massgeblich ist,
  // wer die Helden GERADE KONTROLLIERT — nicht, in wessen Spalte sie stehen. Ein an den Gegner abgegebener eigener Held zaehlt nicht, ein uebernommener Gegnerheld
  // schon (dauerhaft; auf dem Gegnerzug gibt es keine temporaere Kontrolle des Spielers mehr).
  if (!isLastLivingHero(engine, pi, dyingHero)) return;

  // Reentrancy guard — protects against a second hand-resident
  // Quetzahuitl firing in the same KO cascade.
  if (gs._quetzahuitlAscending) return;
  gs._quetzahuitlAscending = true;
  try {
    await performDescent(engine, pi, dyingHero, ctx.card);
  } finally {
    delete gs._quetzahuitlAscending;
  }
}

function isLastLivingHero(engine, pi, dyingHero) {
  // W31a: Kontrolle statt Spalte (`heroesControlledBy`: eigene Spalte ohne die abgegebenen Helden, plus uebernommene Gegnerhelden).
  const mine = engine.heroesControlledBy(pi);
  if (!mine.some(e => e.hero === dyingHero)) return false;
  for (const { hero: h } of mine) {
    if (h === dyingHero) continue;
    if (h?.name && h.hp > 0) return false;
  }
  return true;
}

/**
 * W31a: Hero Zone in der EIGENEN Spalte, in die Quetzahuitl einzieht. Stand der fallende Held in der eigenen Spalte, ist es sein Platz (wie bisher). War es ein
 * uebernommener Gegnerheld, nimmt Quetzahuitl den ersten Platz der eigenen Spalte, den `pi` kontrolliert (eigener Held, besiegt oder lebend) oder der leer ist —
 * ein an den Gegner abgegebener eigener Held wird nie ueberschrieben. -1 = kein Platz.
 */
function findeHeroZone(engine, pi, dyingHero) {
  const ps = engine.gs.players[pi];
  const imi = (ps.heroes || []).findIndex(h => h === dyingHero);
  if (imi >= 0) return imi;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || engine.heroSideOf(pi, h) === pi) return hi;
  }
  return -1;
}

/**
 * W31a: „delete all your Heroes and all cards in their Support and Ability Zones" fuer einen UEBERNOMMENEN Gegnerhelden (Spalte `phys` ≠ `pi`): seine Zonen werden
 * geleert (jede Karte in den Geloescht-Stapel IHRES Besitzers), die Heldenkarte kommt in den Geloescht-Stapel seines Besitzers (Spalteninhaber, Konvention
 * `engine.deleteHero`), der Platz bleibt als leere Huelle ohne Kontrollmarken. Die eigene Spalte laeuft unveraendert im Hauptzweig von `performDescent`.
 */
async function loescheUebernommenenHelden(engine, phys, hi) {
  const gs = engine.gs;
  const hps = gs.players[phys];
  const hero = hps?.heroes?.[hi];
  if (!hero?.name) return;
  const insts = engine.cardInstances.filter(c => engine.physicalSide(c) === phys && c.heroIdx === hi && (c.zone === 'ability' || c.zone === 'support'));
  for (const inst of insts) {
    await engine.runHooks('onCardLeaveZone', {
      _onlyCard: inst, card: inst, fromZone: inst.zone, fromOwner: inst.owner, fromHeroIdx: inst.heroIdx, fromZoneSlot: inst.zoneSlot, _skipReactionCheck: true,
    });
  }
  const loesche = (zoneKey, zi, name) => {
    const inst = insts.find(c => c.zone === zoneKey && c.zoneSlot === zi && c.name === name);
    const besitzer = gs.players[inst ? engine.kartenBesitzerVon(inst) : phys] || hps;
    if (!besitzer.deletedPile) besitzer.deletedPile = [];
    besitzer.deletedPile.push(name);
  };
  const abZones = hps.abilityZones?.[hi];
  if (Array.isArray(abZones)) for (let zi = 0; zi < abZones.length; zi++) { for (const name of (abZones[zi] || [])) loesche('ability', zi, name); abZones[zi] = []; }
  const supZones = hps.supportZones?.[hi];
  if (Array.isArray(supZones)) for (let zi = 0; zi < supZones.length; zi++) { for (const name of (supZones[zi] || [])) loesche('support', zi, name); supZones[zi] = []; }
  engine.cardInstances = engine.cardInstances.filter(c => !(engine.physicalSide(c) === phys && c.heroIdx === hi && (c.zone === 'ability' || c.zone === 'support' || c.zone === 'hero')));
  if (!hps.deletedPile) hps.deletedPile = [];
  hps.deletedPile.push(hero.name);
  hero.name = null; hero.hp = 0; hero.maxHp = 0; hero.atk = 0; hero.baseAtk = 0; hero.ability1 = null; hero.ability2 = null; hero.statuses = {};
  for (const k of ['permaControlBy', 'permaControlFrom', 'permaControlHeroIdx', 'charmedBy', 'charmedFromOwner', 'charmedHeroIdx', 'controlledBy', '_kontrolleBisZumTod', '_kontrollRechte']) delete hero[k];
  if (Array.isArray(gs._charmedSupportLocked)) gs._charmedSupportLocked = gs._charmedSupportLocked.filter(e => !(e.owner === phys && e.heroIdx === hi));
}

async function performDescent(engine, pi, dyingHero, handInst) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return;

  const targetHeroIdx = findeHeroZone(engine, pi, dyingHero);   // W31a: Hero Zone der eigenen Spalte (bei uebernommenem fallenden Held: ein von `pi` kontrollierter/leerer Platz)
  if (targetHeroIdx < 0) return;
  // Alle Helden, die `pi` GERADE KONTROLLIERT (vor der Loeschung festgehalten) — in der eigenen Spalte und uebernommene der anderen Spalten.
  const kontrolliert = engine.heroesControlledBy(pi);
  const kontrolliertDerHeroen = new Set(kontrolliert.filter(e => e.physOwner === pi).map(e => e.heroIdx));
  const fremdUebernommen = kontrolliert.filter(e => e.physOwner !== pi);

  // ── 1. Pull Quetzahuitl out of hand. ──
  const handIdx = ps.hand.indexOf(CARD_NAME);
  if (handIdx < 0) return;
  // Einsatz-Beleg für den Trainings-Recorder. Als Verdachtsfall
  // "Quetzahuitl 0% — lehnt die CPU ab?": nein, hier gibt es gar keinen
  // Prompt, der Abstieg läuft vollautomatisch und funktioniert (gegen
  // die echte Engine verifiziert). Er war nur unsichtbar: die Karte
  // wandert Hand → Hero-Zone, ohne je die Play-Pfade zu berühren, und
  // die drei quetzahuitl_*-Logs stehen nicht in ACT_EVENTS. Ergebnis:
  // plays 0 trotz realer Abstiege. `asPlay: 'sole'` ist das etablierte
  // Signal dafür (kein afterSpellResolved, keine Doppelzählung möglich).
  // Der Client kennt `to: 'hero'` nicht und bricht sauber ab
  // (`if (!srcEl || !tgtEl) return;`) — die Optik liefert ohnehin die
  // eigene play_zone_animation des Abstiegs.
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: CARD_NAME,
    from: 'hand', to: 'hero',
    fromHandIdx: handIdx, toHeroIdx: targetHeroIdx,
    asPlay: 'sole',
  });
  engine.takeFromPileSync(ps, 'hand', handIdx);
  // ★★ v1222: Abgleich SOFORT nach dem Hand-Abgang. Der Client verdeckt den
  // Startplatz der abfliegenden Karte nur, solange die Hand noch so
  // gross ist wie beim Abflug — bleibt der `sync` aus, taucht sie
  // nach dem Flug wieder auf (Als Befund 18.9. zu „Dive Down").
  engine.sync();
  if (handInst) {
    engine.cardInstances = engine.cardInstances.filter(c => c.id !== handInst.id);
  }

  engine.log('quetzahuitl_descent_begin', {
    player: ps.username,
    dyingHero: dyingHero.name,
    slot: targetHeroIdx,
  });

  // ── 2. Delete every Hero, plus every card in their Support and
  //       Ability Zones, sending the cards to the Deleted pile.
  //       Following Rain of Death's convention: fire
  //       `onCardLeaveZone` BEFORE mutating state so abilities
  //       like Toughness / Fighting can undo their granted bonuses
  //       before their inst is untracked. `_onlyCard: inst` keeps
  //       same-named siblings on unrelated heroes from misfiring.
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    // W31a: ein an den Gegner abgegebener eigener Held ist nicht „your Hero" - er und seine Zonen bleiben unberuehrt.
    if (ps.heroes[hi]?.name && !kontrolliertDerHeroen.has(hi)) continue;
    const abZones = ps.abilityZones?.[hi];
    const supZones = ps.supportZones?.[hi];

    const heroInsts = engine.cardInstances.filter(c =>
      c.owner === pi && c.heroIdx === hi &&
      (c.zone === 'ability' || c.zone === 'support')
    );

    for (const inst of heroInsts) {
      await engine.runHooks('onCardLeaveZone', {
        _onlyCard: inst,
        card: inst,
        fromZone: inst.zone,
        fromOwner: inst.owner,
        fromHeroIdx: inst.heroIdx,
        fromZoneSlot: inst.zoneSlot,
        _skipReactionCheck: true,
      });
    }

    // Now mutate. Zone arrays preserve their slot structure
    // (3 ability slots; support zone count varies with islands but
    // we just clear each existing slot's contents).
    if (Array.isArray(abZones)) {
      for (let zi = 0; zi < abZones.length; zi++) {
        const slot = abZones[zi] || [];
        for (const name of slot) {
          // W64c: Loeschstapel des permanenten BESITZERS der Karte (eine uebernommene Kreatur / fremde Ausruestung in der Zone gehoert nicht dem Nutzer)
          const _inst = heroInsts.find(c => c.zone === 'ability' && c.zoneSlot === zi && c.name === name);
          const _loeschPs = (_inst ? engine.gs.players[engine.kartenBesitzerVon(_inst)] : null) || ps;
          if (!_loeschPs.deletedPile) _loeschPs.deletedPile = [];
          _loeschPs.deletedPile.push(name);
        }
        abZones[zi] = [];
      }
    }
    if (Array.isArray(supZones)) {
      for (let zi = 0; zi < supZones.length; zi++) {
        const slot = supZones[zi] || [];
        for (const name of slot) {
          // W64c: Loeschstapel des permanenten BESITZERS der Karte (eine uebernommene Kreatur / fremde Ausruestung in der Zone gehoert nicht dem Nutzer)
          const _inst = heroInsts.find(c => c.zone === 'support' && c.zoneSlot === zi && c.name === name);
          const _loeschPs = (_inst ? engine.gs.players[engine.kartenBesitzerVon(_inst)] : null) || ps;
          if (!_loeschPs.deletedPile) _loeschPs.deletedPile = [];
          _loeschPs.deletedPile.push(name);
        }
        supZones[zi] = [];
      }
    }

    // Untrack every CardInstance attached to this hero — abilities,
    // supports, and the hero's own hero-zone inst all go. The hero
    // object itself is replaced (target slot) or blanked (other
    // slots) further down.
    engine.cardInstances = engine.cardInstances.filter(c => {
      if (c.owner !== pi) return true;
      if (c.heroIdx !== hi) return true;
      return c.zone !== 'ability' && c.zone !== 'support' && c.zone !== 'hero';
    });
  }

  // Blank out every hero slot. For the target slot we'll install
  // Quetzahuitl right after; the others become empty placeholders
  // (name=null, hp=0) so `checkAllHeroesDead` correctly sees them
  // as gone but Quetzahuitl alive.
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero) continue;
    if (hero.name && !kontrolliertDerHeroen.has(hi)) continue;   // W31a: abgegebener eigener Held bleibt
    // W16f (H03-06): „delete all your Heroes" — die Heldenkarte selbst landet im Gelöscht-Stapel (Konvention `engine.deleteHero`), nicht im Nichts.
    if (hero.name) {
      if (!ps.deletedPile) ps.deletedPile = [];
      ps.deletedPile.push(hero.name);
    }
    hero.name = null;
    hero.hp = 0;
    hero.maxHp = 0;
    hero.atk = 0;
    hero.baseAtk = 0;
    hero.ability1 = null;
    hero.ability2 = null;
    hero.statuses = {};
  }

  // W31a: uebernommene Gegnerhelden gehoeren zu „all your Heroes" und werden mit ihren Zonen geloescht.
  for (const e of fremdUebernommen) await loescheUebernommenenHelden(engine, e.physOwner, e.heroIdx);

  // ── 3. Install Quetzahuitl in the dying Hero's slot. ──
  const cardDB = engine._getCardDB();
  const cd = cardDB[CARD_NAME] || {};
  const baseHp  = cd.hp  || 200;
  const baseAtk = cd.atk || 200;

  ps.heroes[targetHeroIdx] = {
    name: CARD_NAME,
    hp: baseHp,
    maxHp: baseHp,
    atk: baseAtk,
    baseAtk: baseAtk,
    ability1: null,
    ability2: null,
    statuses: {},
  };
  if (!ps.abilityZones[targetHeroIdx]) ps.abilityZones[targetHeroIdx] = [[], [], []];
  if (!ps.supportZones[targetHeroIdx]) ps.supportZones[targetHeroIdx] = [[], [], []];

  engine._trackCard(CARD_NAME, pi, 'hero', targetHeroIdx);
  await engine.amzFensterAufHeldAnwenden(pi, targetHeroIdx);   // W18b: neu ins Spiel kommender Held (Anti Magic Zone)

  engine._broadcastEvent('play_zone_animation', {
    type: 'holy_revival', owner: pi, heroIdx: targetHeroIdx, zoneSlot: -1,
  });
  engine.log('quetzahuitl_arrival', {
    player: ps.username, slot: targetHeroIdx, hp: baseHp, atk: baseAtk,
  });
  engine.sync();
  await engine._delay(800);

  // ── 4. Attach up to 3 Divinity copies from deck / hand / discard. ──
  let attached = 0;
  // ★ W15a (Al, R3: „Ja" — die Divinity-Anleger prallen an Resistance ab): das Anlegen der bis zu drei Kopien ist EIN Effekt auf den Helden — einmal gefragt, vor jeder
  // Kartenbewegung. (Quetzahuitl steht frisch mit leeren Ability Zones da; ein Resistance-Schutz kann hier nur über fremde Wege liegen — die Prüfung ist die Regel, nicht der Normalfall.)
  const blockiert = await engine.abilityAnlegenDurchResistanceBlockiert(pi, pi, targetHeroIdx, CARD_NAME);
  for (let n = 0; n < (blockiert ? 0 : 3); n++) {
    if (!engine.canAttachAbilityToHero(pi, DIVINITY, targetHeroIdx, { allowRestricted: true })) break;
    const pulledFrom = pullDivinityFromAnySource(ps, engine);
    if (!pulledFrom) break;

    const abZones = ps.abilityZones[targetHeroIdx];
    void abZones;
    // v1349: Zonenwahl an EINER Stelle (verwahrte Abilities, Madame Guillotine).
    const targetZone = engine.abilityZielZone(pi, targetHeroIdx, DIVINITY);
    if (targetZone < 0) {
      // Out of room — refund the pulled copy back to where it came from.
      refundDivinity(engine, pi, pulledFrom);
      break;
    }

    if (!abZones[targetZone]) abZones[targetZone] = [];
    abZones[targetZone].push(DIVINITY);
    const divInst = engine._trackCard(DIVINITY, pi, 'ability', targetHeroIdx, targetZone);

    if (pulledFrom === 'deck') {
      engine._broadcastEvent('deck_search_add', { cardName: DIVINITY, playerIdx: pi });
      engine.shuffleDeck(pi, 'main');
    }

    await engine.runHooks('onPlay', {
      _onlyCard: divInst, playedCard: divInst, cardName: DIVINITY,
      zone: 'ability', heroIdx: targetHeroIdx, _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: divInst, toZone: 'ability', toHeroIdx: targetHeroIdx,
      _skipReactionCheck: true,
    });
    engine._broadcastEvent('ability_activated', {
      owner: pi, heroIdx: targetHeroIdx, zoneIdx: targetZone, abilityName: DIVINITY,
    });
    attached++;
  }

  engine.log('quetzahuitl_divinity_attached', {
    player: ps.username, count: attached,
  });
  engine.sync();
}

function pullDivinityFromAnySource(ps, engine) {
  // Order matches the card text "from your deck, hand or discard
  // pile" — but deck-first would force a shuffle reveal even when
  // a free hand copy is available, so prefer hand → deck → discard
  // to minimize information leakage. Switch to deck-first if the
  // user wants strict left-to-right text ordering.
  const fromHand = ps.hand.indexOf(DIVINITY);
  if (fromHand >= 0) { engine.takeFromPileSync(ps, 'hand', fromHand); return 'hand'; }
  const _taken_fromDeck = engine.takeFromPileSync(ps, 'deck', DIVINITY, { source: CARD_NAME });   // v820: Stapel-Schicht
  if (_taken_fromDeck) {
    return 'deck';
  }
  const _taken_fromDisc = engine.takeFromPileSync(ps, 'discard', DIVINITY, { source: CARD_NAME });   // v820: Stapel-Schicht
  if (_taken_fromDisc) {
    return 'discard';
  }
  return null;
}

function refundDivinity(engine, pi, source) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  if (source === 'hand') engine.handZugangSync(ps, DIVINITY, { von: 'rueckgabe', source: CARD_NAME, ohneInstanz: true });
  else if (source === 'deck') { ps.mainDeck.push(DIVINITY); engine.shuffleDeck(pi, 'main'); }
  else if (source === 'discard') ps.discardPile.push(DIVINITY);
}


// ═══════════════════════════════════════════
//  HERO-ZONE LISTENER — loss on defeat
// ═══════════════════════════════════════════

async function handleLossOnDefeat(ctx) {
  // Only fire when THIS card's own hero is the one dying. With
  // `activeIn: ['hero']`, `ctx.attachedHero` is the hero in our
  // slot — if that's the hero in the KO event, Quetzahuitl just
  // died and the controller loses.
  if (ctx.hero !== ctx.attachedHero) return;

  const engine = ctx._engine;
  const gs = engine.gs;
  if (gs.result) return;

  const pi = ctx.cardOwner;
  // Skill Test (2–8 Spieler): Es endet nicht das Spiel, sondern der Kontrolleur scheidet aus — jeder noch lebende
  // Hero von ihm fällt mit, dann zieht die Eliminierungsprüfung des Modus (checkAllHeroesDead) die Folgen.
  if (gs.skillTest) {
    // Der Kontrolleur scheidet zuerst aus, auch wenn im selben Augenblick andere ausscheiden (checkAllHeroesDead wertet `_quetzaLosers` aus).
    (gs._quetzaLosers || (gs._quetzaLosers = [])).push(pi);
    for (const h of gs.players[pi]?.heroes || []) if (h && h.name && h.hp > 0) h.hp = 0;
    engine.log('quetzahuitl_defeated', { loser: gs.players[pi]?.username });
    await engine.checkAllHeroesDead();
    return;
  }
  const winnerIdx = pi === 0 ? 1 : 0;
  engine.log('quetzahuitl_defeated', {
    loser: gs.players[pi]?.username,
    winner: gs.players[winnerIdx]?.username,
  });
  if (engine.onGameOver) {
    engine.onGameOver(engine.room, winnerIdx, 'quetzahuitl_defeated');
  }
}
