'use strict';
// ═══════════════════════════════════════════
//  GETEILT: DER „GEHEIMRAUM" (Create Secret Room, Als Vorgabe 11.10.)
//
//  „Choose a card from your deck and place it into the user's Surprise Zone face-down. Whenever the user is chosen by an opponent's card or effect, you may add
//   the card you placed to your hand. If the card is a Surprise and the user can use it, you may flip it face-up and activate it instead as if its activation
//   condition was fulfilled."
//
//  Die Engine kennt dafür EINE Marke: `inst.counters.secretRoom = { placer, turn, by }` auf der Instanz in der Surprise Zone. Alles andere (Zone, Verdecktheit,
//  Anzeige, Zerstörung durch Breakthrough & Co.) ist die gewöhnliche Surprise Zone — nur dass die Karte JEDE Art Karte sein darf (auch eine, die nie eine
//  Surprise war) und eine eigene Auslösung hat:
//
//    place(engine, o)       → legt die gewählte Deckkarte verdeckt in die Surprise Zone des Helden (Karte aus dem Deck des Einsetzenden, Zone auf der
//                             Brettseite des Helden — auch ein geliehener Held), stempelt sie, fliegt Deck → Zone. Gibt die Instanz zurück (oder null).
//    onHeroChosen(engine, …) → das Fenster „Held wurde von einer gegnerischen Karte/einem Effekt GEWÄHLT": `engine._checkSurpriseWindow` ruft es vor den
//                             gewöhnlichen Surprise-Auslösern; ein Treffer nimmt die Karte aus dem normalen Ablauf (kein zweites Angebot).
//
//  ── AUSLÖSER (Als Vorgabe 11.10.) ───────────────────────────────────────
//  „Die Aktivierung regardless of condition erfolgt, wenn der Hero anvisiert wird, genau wie das Auf-die-Hand-Nehmen; dafür dann bei Surprises zwei Optionen,
//  add to hand oder activate now." Das Fenster ist dasselbe wie für jede Surprise („is targeting …", `_checkSurpriseWindow`): jede Wahl des Helden durch eine
//  Karte/einen Effekt des GEGNERS. Nicht ausgelöst wird bei: Flächenschlägen (wählen niemanden), gewählter Kreatur des Helden (nur der Held selbst), eigenen
//  Effekten, einem Helden, den der Einsetzende gerade nicht kontrolliert, und einem Helden, der keine Surprise auslösen darf (tot, Frozen, Stunned, Webbed, Negated).
//
//  ── DIE ZWEI (DREI) OPTIONEN ────────────────────────────────────────────
//    • „Add to hand": die Karte geht auf die Hand des Einsetzenden (Flug Surprise Zone → Hand). Immer möglich.
//    • „Activate now" (nur bei einer SURPRISE, die der Held auch nutzen kann — `_canHeroActivateSurprise`: Stufe, Schule, Zustand, freier Platz bei Creatures):
//      die Karte dreht sich um und wird über den NORMALEN Aktivierungsweg (`_activateSurprise`) ausgelöst, als wäre ihr Auslöser erfüllt: ohne
//      `surpriseTrigger`-Prüfung, aber mit der echten Quelle (`sourceInfo`) des wählenden Effekts. Danach gilt das Übliche (Ablage bzw. Creature ins Feld).
//    • „No": die Karte bleibt liegen und kann beim nächsten Anvisieren erneut genutzt werden.
//  Die Karte kann dabei NICHT zusätzlich nach ihrem eigenen Auslöser angeboten werden: das Fenster hat sie schon behandelt.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { ZONES } = require('./_hooks');

const CARD_NAME = 'Create Secret Room';
const MARKE = 'secretRoom';
const FLUG_MS = 700;
const OEFFNEN_MS = 520;        // bis die Tür offen steht (`secret_room_open`)

/** Hat diese Instanz die Geheimraum-Marke? */
function istGeheimraumKarte(inst) {
  return !!inst && inst.zone === ZONES.SURPRISE && !!inst.counters?.[MARKE];
}

/** Die Instanz in der Surprise Zone des Helden (Brettseite `seite`), falls dort eine liegt. */
function zonenInstanz(engine, seite, heroIdx) {
  const name = (engine.gs.players[seite]?.surpriseZones?.[heroIdx] || [])[0];
  if (!name) return null;
  return engine.cardInstances.find(c => c.owner === seite && c.zone === ZONES.SURPRISE && c.heroIdx === heroIdx && c.name === name) || null;
}

/** Ist die Karte eine Surprise (Untertyp), die sich überhaupt aktivieren lässt? */
function istAktivierbareSurprise(engine, name) {
  const cd = engine._getCardDB()[name];
  if (!cd || String(cd.subtype || '').toLowerCase() !== 'surprise') return false;
  const s = loadCardEffect(name);
  return !!(s && s.isSurprise && typeof s.onSurpriseActivate === 'function');
}

/**
 * Legt `cardName` aus dem Deck des Spielers `pi` verdeckt in die (freie) Surprise Zone des Helden `heroIdx` auf der Brettseite `seite`.
 * Der Aufrufer hat Wahl, Such-Bestätigung und Mischen schon erledigt. Gibt die Instanz zurück oder null (Zone belegt, Karte nicht im Deck, Stapelsperre).
 */
async function place(engine, o) {
  const { pi, seite, heroIdx, cardName, source = CARD_NAME } = o;
  const gs = engine.gs;
  const deckPs = gs.players[pi];
  const zonePs = gs.players[seite];
  const hero = zonePs?.heroes?.[heroIdx];
  if (!deckPs || !zonePs || !hero?.name || hero.hp <= 0) return null;
  if (!zonePs.surpriseZones) zonePs.surpriseZones = [[], [], []];
  if ((zonePs.surpriseZones[heroIdx] || []).length > 0) return null;          // die Zone muss FREI sein (auch bei Bakhm: nicht seine Support Zones)
  if (!(deckPs.mainDeck || []).includes(cardName)) return null;
  // Stapel-Schicht (Sperren wie Knight [B], Tracking, Log) — wie Trapping.
  if (!(await engine.takeFromPile(deckPs, 'deck', cardName, { source }))) return null;

  zonePs.surpriseZones[heroIdx] = [cardName];
  const inst = engine._trackCard(cardName, seite, ZONES.SURPRISE, heroIdx, 0);
  inst.faceDown = true;
  inst.knownToOpponent = true;            // der Gegner hat die Suche gesehen (wie Trapping): halbtransparent sichtbar
  if (seite !== pi) inst.originalOwner = pi;          // geliehener Held: die Karte bleibt die des Einsetzenden (Ablage, Hand)
  inst.counters = inst.counters || {};
  inst.counters[MARKE] = { placer: pi, turn: gs.turn || 0, by: source };

  engine._broadcastEvent('play_pile_transfer', {
    owner: seite, cardName, from: 'deck', to: 'surprise', toHeroIdx: heroIdx, toSlotIdx: 0, faceDown: true,
    ...(seite !== pi ? { fromOwner: pi, toOwner: seite } : {}),
  });
  engine.log('secret_room_set', { player: deckPs.username, hero: hero.name, card: cardName });
  engine.sync();
  await engine._delay(FLUG_MS);

  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'surprise', toHeroIdx: heroIdx, _skipReactionCheck: true,
  });
  return inst;
}

/** Darf der Held jetzt „reagieren" wie bei einer Surprise? (lebend, nicht Frozen/Stunned/Webbed/Negated, keine Reaktionssperre) */
function heldDarfReagieren(engine, seite, heroIdx, reaktor) {
  if (engine._reaktionGesperrt && engine._reaktionGesperrt(reaktor)) return false;
  const hero = engine.gs.players[seite]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.webbed || hero.statuses?.negated) return false;
  return true;
}

/** Die Karte aus der Surprise Zone auf die Hand des Einsetzenden. */
async function aufDieHand(engine, inst, placer) {
  const gs = engine.gs;
  const seite = inst.owner, heroIdx = inst.heroIdx, name = inst.name;
  const zonePs = gs.players[seite];
  const handPs = gs.players[placer];
  const handIdx = (handPs.hand || []).length;
  engine._broadcastEvent('play_pile_transfer', {
    owner: placer, cardName: name, from: 'surprise', to: 'hand', fromHeroIdx: heroIdx, toHandIdx: handIdx, faceDown: true,
    ...(seite !== placer ? { fromOwner: seite, toOwner: placer } : {}),
  });
  await engine._delay(FLUG_MS * 0.6);
  const z = zonePs.surpriseZones?.[heroIdx];
  if (Array.isArray(z)) { const i = z.indexOf(name); if (i >= 0) z.splice(i, 1); }
  delete inst.counters[MARKE];
  engine._untrackCard(inst.id);
  engine.handZugangSync(placer, name, { von: 'surprise', source: CARD_NAME, ...(inst.originalOwner != null && inst.originalOwner !== placer ? { originalOwner: inst.originalOwner } : {}) });
  engine.sync();
}

/**
 * Das Fenster „der Held wurde gewählt". Wird von `_checkSurpriseWindow` je Kandidat der Surprise Zone gerufen.
 * @returns {Promise<{handled:boolean, effectNegated?:boolean}>} `handled` = die Karte war eine Geheimraum-Karte UND das Angebot wurde gemacht
 *          (egal wie entschieden) — der Aufrufer bietet sie dann nicht noch einmal gewöhnlich an.
 */
async function onHeroChosen(engine, o) {
  const { tOwner, tHeroIdx, hostHeroIdx, sourceInfo, sourceCard, viaCreature } = o;
  const inst = zonenInstanz(engine, tOwner, hostHeroIdx);
  if (!istGeheimraumKarte(inst)) return { handled: false };
  if (viaCreature) return { handled: false };                 // nur der HELD selbst
  if (sourceCard?._isAoeCheck) return { handled: false };     // ein Flächenschlag wählt niemanden
  const placer = inst.counters[MARKE].placer;
  // „by an opponent's card or effect": der Handelnde ist ein Gegner des Einsetzenden.
  const quelle = sourceInfo?.controller;
  if (!Number.isInteger(quelle) || quelle < 0 || quelle === placer || !engine.opponentsOf(placer).includes(quelle)) return { handled: false };
  // Der Held muss dem Einsetzenden gehorchen und reagieren dürfen.
  const reaktor = engine.surpriseKontrolleur(tOwner, tHeroIdx);
  if (reaktor !== placer) return { handled: false };
  if (!heldDarfReagieren(engine, tOwner, tHeroIdx, reaktor)) return { handled: false };

  const name = inst.name;
  const cd = engine._getCardDB()[name];
  const heroName = engine.gs.players[tOwner].heroes[tHeroIdx].name;
  const kannAktivieren = istAktivierbareSurprise(engine, name)
    && engine._canHeroActivateSurprise(tOwner, tHeroIdx, name, { reaktor });
  const options = [
    { id: 'hand', label: '✋ Add to hand', description: `Take ${name} into your hand.`, color: '#44aaff' },
  ];
  if (kannAktivieren) options.push({ id: 'activate', label: '💥 Activate now', description: `Flip ${name} face-up and activate it as if its activation condition was fulfilled.`, color: '#ff6644' });
  options.push({ id: 'no', label: '🚪 Leave it', description: 'The card stays in the Surprise Zone.', color: '#888888' });
  const srcName = sourceInfo?.cardName || 'An effect';
  const wahl = await engine.promptGeneric(reaktor, {
    type: 'optionPicker', title: CARD_NAME, showCard: name,
    description: `${srcName} is choosing ${heroName}! ${kannAktivieren ? 'Add the hidden card to your hand or activate it now?' : 'Add the hidden card to your hand?'}`,
    options, cancellable: true, _hostSeite: tOwner,
  });
  const id = wahl && !wahl.cancelled ? (wahl.optionId || wahl.id || wahl.selected || wahl.option) : 'no';

  if (id === 'hand' || id === 'activate') {
    // Die Tür geht auf (gleiche Animation wie beim Einlegen), während die Karte herauskommt.
    engine._broadcastEvent('play_zone_animation', {
      type: 'secret_room_open', zoneType: 'board', owner: tOwner, heroIdx: -1, zoneSlot: -1, duration: 1000,
      targets: [{ owner: tOwner, heroIdx: hostHeroIdx, zoneType: 'surprise' }],
      originOwner: tOwner, originHeroIdx: hostHeroIdx, originZoneSlot: -1,
    });
    await engine._delay(OEFFNEN_MS);
  }

  if (id === 'hand') {
    await aufDieHand(engine, inst, placer);
    engine.log('secret_room_hand', { player: engine.gs.players[placer]?.username, hero: heroName, card: name, by: srcName });
    return { handled: true };
  }
  if (id === 'activate' && kannAktivieren) {
    delete inst.counters[MARKE];      // die Karte ist ab jetzt eine gewöhnliche Surprise im Ablauf
    engine.log('secret_room_activate', { player: engine.gs.players[placer]?.username, hero: heroName, card: name, by: srcName });
    const script = loadCardEffect(name);
    const res = await engine._activateSurprise(
      tOwner, tHeroIdx, name, sourceInfo, script,
      hostHeroIdx !== tHeroIdx ? { hostHeroIdx } : {},
    );
    return { handled: true, effectNegated: !!res?.effectNegated };
  }
  return { handled: true };
}

module.exports = { CARD_NAME, MARKE, istGeheimraumKarte, zonenInstanz, istAktivierbareSurprise, place, heldDarfReagieren, aufDieHand, onHeroChosen };
