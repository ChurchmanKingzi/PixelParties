// ═══════════════════════════════════════════
//  CARD EFFECT: "Treasure Hunter's Backpack"
//  Artifact (Normal, Cost 10)
//
//  Search the controller's deck for an Equipment
//  Artifact with Cost ≤ 50, place it directly into
//  the chosen Hero's Support Zone (free of charge),
//  then mark that Hero "cannot perform an Action
//  this turn" via the engine's per-hero action
//  lock (`hero._actionLockedTurn = gs.turn`,
//  cleared automatically at turn end).
//
//  The deck-search reveals to the opponent and
//  shuffles afterwards (standard tutor etiquette).
//
//  ★ W63d (Al, 22.10.2026): BEIDE Auswahlen (Ausrüstung aus dem Deck, Träger/Zone) sind abbrechbar und werden
//  VOR dem Reaktionsfenster getroffen (`payArtifactCost`, Vertrag wie bei Hive's Crown & Co.): der Gegner sieht die
//  Karte erst, wenn nichts mehr abgebrochen werden kann (zentraler Auftritts-Puffer der Engine, CARD_API
//  „Auftritt streamen — erst nach dem Commit"). Abbruch an irgendeiner Stelle = Karte bleibt auf der Hand, nichts
//  gesehen, nichts bezahlt. Wird das Artefakt danach negiert, bleibt das Deck unberührt.
// ═══════════════════════════════════════════

const { getCardDB: _getCardDB } = require('./_card-db');
const { loadCardEffect } = require('./_loader');
const { waehleAusruestPlatz, ausruestTraegerMitSeite } = require('./_equip-shared');

const CARD_NAME = "Treasure Hunter's Backpack";
const MAX_EQUIP_COST = 50;

function isEquipByData(cardName) {
  const cd = _getCardDB()[cardName];
  if (!cd) return false;
  return cd.cardType === 'Artifact' && (cd.subtype || '').toLowerCase() === 'equipment';
}

function countCopies(arr, cardName) {
  let n = 0;
  for (const x of arr) if (x === cardName) n++;
  return n;
}

/** Build a deduplicated gallery of eligible equips in the player's deck. */
function buildEligibleGallery(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const seen = new Set();
  const out = [];
  for (const cardName of (ps.mainDeck || [])) {
    if (seen.has(cardName)) continue;
    if (!isEquipByData(cardName)) continue;
    const cd = _getCardDB()[cardName];
    const cost = cd.cost || 0;
    if (cost > MAX_EQUIP_COST) continue;
    // ★ Z7 (F03-06): das Backpack SPIELT die Ausrüstung („play it immediately") — „You can only
    // play 1 … per game" (Smug Coin) gilt also auch hier: kein verbrauchtes Exemplar anbieten.
    const _sc = loadCardEffect(cardName);
    if ((_sc?.oncePerGame || _sc?.oncePerGameKey) && ps._oncePerGameUsed?.has(_sc.oncePerGameKey || cardName)) continue;
    // ★ Als Regel 19.8.: eine Ausruestung ohne legalen Traeger ist
    // keine legale Wahl. Gibt es dadurch gar keine, ist die Karte
    // insgesamt nicht aktivierbar (siehe `canActivate` unten).
    // Ohne Engine (aeltere Aufrufer) bleibt es bei der alten,
    // ungefilterten Liste statt faelschlich alles zu sperren.
    // v1268: dieselbe Traegerpruefung wie die Wahl danach
    // (`_equip-shared`), sonst stuende eine Ausruestung zur Wahl, fuer
    // die es dann keinen Helden gibt (gefroren / gecharmt).
    if (engine && ausruestTraegerMitSeite(engine, pi, cardName).length === 0) continue;   // Als Vorgabe 29.9.: inkl. uebernommener Helden
    seen.add(cardName);
    out.push({
      name: cardName, source: 'deck', cost,
      count: countCopies(ps.mainDeck, cardName),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** True if this player has at least one alive hero with a free Support Zone. */
function hasHeroWithFreeZone(ps) {
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones[hi] || [])[si] || []).length === 0) return true;
    }
  }
  return false;
}

/**
 * Beide abbrechbaren Wahlen des Backpacks: (1) die Ausrüstung aus dem Deck, (2) Träger und Zone.
 * Rückgabe `{ equipName, heroIdx, slot, seite }` oder `null` bei Abbruch / ungültiger Wahl.
 * ★ v1268: Trägerregeln und Zonenwahl kommen aus `_equip-shared.js` (wie bei Riffel und der Weapon Collecting Wight).
 */
async function waehleAusruestungUndPlatz(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return null;
  const gallery = buildEligibleGallery(gs, pi, engine);
  if (gallery.length === 0) return null;
  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: gallery,
    title: CARD_NAME,
    description: `Choose an equippable Artifact (Cost ≤ ${MAX_EQUIP_COST}) from your deck.`,
    cancellable: true,
  });
  if (!picked || picked.cancelled || !picked.cardName) return null;
  const equipName = picked.cardName;
  if (!isEquipByData(equipName)) return null;
  if (ps.mainDeck.indexOf(equipName) < 0) return null;
  const platz = await waehleAusruestPlatz(engine, pi, equipName, {
    title: `${CARD_NAME} — Equip ${equipName}`,
    description: `Select a Support Zone to equip ${equipName} to. The chosen Hero cannot perform an Action this turn.`,
    confirmLabel: '🎒 Equip!',
  });
  if (!platz) return null;
  return { equipName, heroIdx: platz.heroIdx, slot: platz.slot, seite: platz.seite ?? pi };
}

module.exports = {
  isTargetingArtifact: true,
  activeIn: ['hand'],

  canActivate(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (!hasHeroWithFreeZone(ps)) return false;
    return buildEligibleGallery(gs, pi, engine).length > 0;
  },

  // Self-targeting — gallery picker handles selection
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Search your deck for an equippable Artifact (Cost ≤ 50).',
    confirmLabel: '🎒 Unpack!',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'none',

  // ★ W63d: die Wahlen (Ausrüstung aus dem Deck → Träger/Zone) VOR dem Reaktionsfenster. `false` = abgebrochen: Karte bleibt auf der Hand, nichts bezahlt, nichts gezeigt.
  payArtifactCost: async (engine, pi) => {
    const wahl = await waehleAusruestungUndPlatz(engine, pi);
    return wahl ? { wahl } : false;
  },

  resolve: async (engine, pi, selectedIds, validTargets, kosten) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { aborted: true };

    // ── Step 1+2: Ausrüstung aus dem Deck und Träger/Zone — normalerweise schon VOR dem Reaktionsfenster gewählt (`payArtifactCost`).
    // Hat sich der Zustand inzwischen verschoben (Zone belegt, Karte nicht mehr im Deck) oder kam der Aufruf ohne Vorab-Wahl
    // (Gratis-Spiel durch Sky Archeologist u. ä.), wird hier (erneut) gefragt.
    let wahl = kosten && kosten.wahl;
    if (wahl) {
      const _zs = gs.players[wahl.seite];
      const _frei = _zs && (((_zs.supportZones[wahl.heroIdx] || [])[wahl.slot] || []).length === 0);
      const _imDeck = ps.mainDeck.indexOf(wahl.equipName) >= 0;
      const _traeger = ausruestTraegerMitSeite(engine, pi, wahl.equipName).some(t => t.heroIdx === wahl.heroIdx && t.seite === wahl.seite);
      if (!_frei || !_imDeck || !_traeger) wahl = null;
    }
    if (!wahl) wahl = await waehleAusruestungUndPlatz(engine, pi);
    if (!wahl) return { aborted: true };
    const equipName = wahl.equipName;
    const platz = { heroIdx: wahl.heroIdx, slot: wahl.slot, seite: wahl.seite };
    const destHeroIdx = platz.heroIdx;
    const destSlot = platz.slot;
    // Als Vorgabe 29.9.: Brettseite eines uebernommenen Helden; die Karte
    // gehoert weiter mir (`originalOwner`).
    const seite = platz.seite ?? pi;
    const zps = gs.players[seite];

    // Final validation: slot still free + deck still contains the equip
    if (((zps.supportZones[destHeroIdx] || [])[destSlot] || []).length > 0) return { aborted: true };
    // ★ W15a (Al, R3 und Regel W14a Q5): Ausrüsten PER EFFEKT — Resistance des Trägers fängt es ab (vor jeder Kartenbewegung; die Ausrüstung bleibt im Deck, kein Mischen).
    // Der Artefakt-Einsatz ist gespielt und verbraucht.
    if (await engine.heroNonDamageEffectBlocked(seite, destHeroIdx, 'equip', { sourceOwner: pi, source: CARD_NAME })) {
      engine.log('treasure_hunters_backpack_blocked', { player: ps.username, equip: equipName, hero: zps.heroes[destHeroIdx]?.name });
      engine.sync();
      return true;
    }
    const _taken_stillIdx = await engine.takeFromPile(ps, 'deck', equipName, { source: CARD_NAME });   // v820: Stapel-Schicht
    if (!_taken_stillIdx) return { aborted: true };
    if (!zps.supportZones[destHeroIdx]) zps.supportZones[destHeroIdx] = [[], [], []];
    if (!zps.supportZones[destHeroIdx][destSlot]) zps.supportZones[destHeroIdx][destSlot] = [];
    zps.supportZones[destHeroIdx][destSlot].push(equipName);

    const inst = engine._trackCard(equipName, seite, 'support', destHeroIdx, destSlot);
    if (seite !== pi) inst.originalOwner = pi;
    // ★ Z7 (F03-06): … und die gespielte Ausrüstung verbraucht ihre Partie-Grenze.
    {
      const _es = loadCardEffect(equipName);
      if (_es?.oncePerGame || _es?.oncePerGameKey) {
        if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
        ps._oncePerGameUsed.add(_es.oncePerGameKey || equipName);
      }
    }

    engine.sync();

    // ── Step 4: explosion-y animation on the equipped slot ──
    // Sequenced via awaits rather than fire-and-forget setTimeouts so the
    // broadcasts CAN'T leak past an MCTS rollout boundary. `engine._delay`
    // is a no-op while `_fastMode` is true, so rollouts skip the waits
    // entirely; the broadcast itself is also gated on `_fastMode` inside
    // `_broadcastEvent`. With setTimeouts, the timers were scheduled
    // during a rollout and fired AFTER the rollout ended (with `_fastMode`
    // back to false), causing the captured `destHeroIdx` / `destSlot`
    // from imagined rollouts to paint explosions on real client zones.
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: seite,
      heroIdx: destHeroIdx, zoneSlot: destSlot,
    });
    await engine._delay(220);
    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle', owner: seite,
      heroIdx: destHeroIdx, zoneSlot: destSlot,
    });
    await engine._delay(260);
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: seite,
      heroIdx: destHeroIdx, zoneSlot: destSlot,
    });
    await engine._delay(420);

    // ── Step 5: fire entry hooks for the just-equipped card ──
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, cardName: equipName,
      zone: 'support', heroIdx: destHeroIdx, zoneSlot: destSlot,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
      _isEffectEquip: true,   // W16e (F03-21): per Effekt angelegt — Summoning Instructions: X = 1 ohne Frage
    });

    // ── Step 6: lock the chosen Hero out of acting THIS turn ──
    // The engine clears `_actionLockedTurn` automatically when the turn
    // ends (actually, it's just a stamp matched against gs.turn — when
    // the turn number changes, the stamp becomes stale and the gate no
    // longer fires).
    const destHero = zps.heroes[destHeroIdx];
    if (destHero) {
      destHero._actionLockedTurn = gs.turn;
      destHero._actionLockedFremd = gs.turn;   // W8: Fremdsperre (Lethes Selbstabgleich löst nur die eigene)
    }

    // ── Step 7: shuffle deck + reveal to opponent ──
    engine.shuffleDeck(pi, 'main');
    engine._broadcastEvent('deck_search_add', { cardName: equipName, playerIdx: pi });
    const oi = engine.opponentOf(pi);
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: equipName,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });

    engine.log('treasure_hunters_backpack', {
      player: ps.username,
      equip: equipName,
      hero: destHero?.name || '?',
      slot: destSlot,
      lockedTurn: gs.turn,
    });

    engine.sync();
    return true;
  },
};
