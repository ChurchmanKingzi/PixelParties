// ═══════════════════════════════════════════
//  GETEILT: Programmatisches Ausruesten + die Wetterorchester-Familie
//  (Thunder Trumpet, Rain Viola, Storm Piano, The Weather Orchestra)
//
//  ── Ausruesten aus Skripten (v628) ──────────────────────────────
//  Bisher baute jede Karte, die ein Artefakt „ohne Kosten" ausruestet
//  (Cool Repair, Gate to the Armory, Hel, Riffel …), den Vorgang selbst
//  nach: Pile-Splice, Zone-Push, `_trackCard`, Auftritt, `onPlay` +
//  `onCardEnterZone`. Hier steht er EINMAL:
//
//    equipDestinations(engine, pi, cardName, opts) → [{ heroIdx, slotIdx }]
//      freie Basisplaetze (0-2) lebender, nicht eingefrorener Helden, die
//      das Skript-Gate `canEquipToHero` (engine.canEquipCardToHero)
//      bestehen. `opts.sides` = Spielerindizes, die als Ziel zaehlen.
//    equipArtifactToHero(engine, pi, cardName, ownerOfHero, heroIdx, slotIdx, opts)
//      nimmt die Karte aus `opts.from` ('hand' | 'deck' | 'discard') des
//      Spielers `pi`, legt sie in die Zone des Helden `heroIdx` von
//      Spieler `ownerOfHero`, trackt, animiert, feuert die Hook-Kette.
//      Der Besitzer der Karte bleibt `pi` (`inst.owner`), auch wenn sie
//      beim Gegner liegt (Orchester: „Heroes on the board").
//
//  ── Trigger „when this Artifact equipped to a Hero you control is
//     sent to the discard pile" ─────────────────────────────────
//  `instrumentDiscardTrigger(ctx, cardName, hopt)` — die eine Auslegung
//  fuer die drei Instrumente: feuert auf `onCardLeaveZone` der EIGENEN
//  Instanz aus einer Support Zone mit Ziel Discard (auch beim Abbau
//  nach Heldentod: dort fehlt `toZone`, die Equips gehen aber in den
//  Discard), Controller des Helden = Besitzer der Karte, einmal pro Zug
//  je Kartenname (`claimHOPT`).
// ═══════════════════════════════════════════

const { hasCardType, heroCanBeEquipped } = require('./_hooks');

function isEquipArtifact(cd) {
  return !!cd && hasCardType(cd, 'Artifact') && (cd.subtype || '').toLowerCase() === 'equipment';
}

function equipDestinations(engine, pi, cardName, opts = {}) {
  const sides = opts.sides || [pi];
  const out = [];
  const platz = (side, hi) => {
    const ps = engine.gs.players[side];
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones[hi] || [])[si] || []).length === 0) out.push({ side, heroIdx: hi, slotIdx: si });
    }
  };
  for (const side of sides) {
    const ps = engine.gs.players[side];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // W28a (Al, 21.10.2026: „'you control' = aktuelle Kontrolle, nicht Besitzer"): in der Form „a Hero you control" (nur die eigene Seite gefragt) ist ein an den
      // Gegner abgegebener eigener Held (Charme-Marke / dauerhafte Uebernahme) KEIN Ziel; die Orchester-Form („Heroes on the board", mehrere Seiten) bleibt.
      if (sides.length === 1 && side === pi && opts.uebernommene !== false && engine.heroSideOf && engine.heroSideOf(side, hero) !== pi) continue;
      // Als Vorgabe 29.9.: tot/Frozen/Uebernahme ohne `ausruesten` (Charme) sperrt.
      if (!heroCanBeEquipped(hero)) continue;
      if (!engine.canEquipCardToHero(cardName, side, hi)) continue;
      platz(side, hi);
    }
  }
  // Als Vorgabe 29.9.: „a Hero you control" (nur eigene Seite gefragt) —
  // dazu uebernommene Helden der Gegenseite mit Recht `ausruesten`.
  if (sides.length === 1 && sides[0] === pi && opts.uebernommene !== false) {
    for (const { physOwner, heroIdx } of (engine.fremdAusruestHelden?.(pi) || [])) {
      if (!engine.canEquipCardToHero(cardName, physOwner, heroIdx)) continue;
      platz(physOwner, heroIdx);
    }
  }
  return out;
}

async function equipArtifactToHero(engine, pi, cardName, ownerOfHero, heroIdx, slotIdx, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const hps = gs.players[ownerOfHero];
  if (!ps || !hps) return null;
  const from = opts.from || 'hand';
  const pool = from === 'deck' ? ps.mainDeck : from === 'discard' ? ps.discardPile : ps.hand;
  const idx = (pool || []).indexOf(cardName);
  if (idx < 0) return null;
  if (((hps.supportZones[heroIdx] || [])[slotIdx] || []).length > 0) return null;
  // ★ Welle 14 (Al, Q5 aus W13b): Resistance blockt auch EIGENE Effekte auf den Träger — „Ausrüsten per Effekt" (dieser Helfer: Orchester, Lolek, Deepsea Treasure,
  // Free-Artifact-Karten) ist ein Nicht-Schaden-Effekt auf den Helden. Das normale Ausspielen einer Ausrüstung von der Hand (Standard-Spielaktion) läuft nicht hier.
  // Vor jeder Kartenbewegung gefragt: bei `true` bleibt die Karte, wo sie war (Aufrufer lesen `null` als "nicht ausgerüstet").
  // ★ W16a (Al, Frage 3): `opts.blockiert` = von Resistance abgefangen (Einmal-Einsatz des Aufrufers zählt als gewirkt, siehe `_lolek-shared.chooseAndEquip`).
  if (!opts.resistanzGeprueft && await engine.heroNonDamageEffectBlocked(ownerOfHero, heroIdx, 'equip', { sourceOwner: pi, source: opts.source })) { opts.blockiert = true; return null; }
  if (from === 'discard' && !(await engine._discardOutAllowed(pi, opts))) return null;
  pool.splice(idx, 1);
  if (from === 'deck') engine._broadcastEvent('deck_search_add', { cardName, playerIdx: pi });
  if (!hps.supportZones[heroIdx]) hps.supportZones[heroIdx] = [[], [], []];
  if (!hps.supportZones[heroIdx][slotIdx]) hps.supportZones[heroIdx][slotIdx] = [];
  hps.supportZones[heroIdx][slotIdx].push(cardName);
  // Als Vorgabe 29.9.: an einen UEBERNOMMENEN Helden wie beim Handweg —
  // Instanz auf der Brettseite, Karte gehoert `pi` (dient dem Kontrolleur).
  // Sonst (Orchester an einen echten Gegnerhelden) das alte Modell.
  const _kontrolliert = ownerOfHero !== pi && !!engine.darfFremdAusruesten?.(pi, ownerOfHero, heroIdx);
  const inst = engine._trackCard(cardName, _kontrolliert ? ownerOfHero : pi, 'support', heroIdx, slotIdx);
  if (_kontrolliert) inst.originalOwner = pi;
  else if (ownerOfHero !== pi) inst.controller = ownerOfHero;
  inst.turnPlayed = gs.turn || 0;
  engine.log('equip_placed', {
    card: cardName, player: ps.username, hero: hps.heroes[heroIdx]?.name, from, source: opts.source || null,
  });
  engine.sync();
  engine._broadcastEvent('play_zone_animation', {
    type: opts.animationType || 'equip_flash', owner: ownerOfHero, heroIdx, zoneSlot: slotIdx,
  });
  await engine._delay(opts.animDelay ?? 350);
  await engine.runHooks('onPlay', {
    _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: slotIdx,
  });
  // W51c (Al): AUSRUESTENDER ist `pi` (wer die Karte aus Hand/Deck/Ablage ausspielt), NICHT der Kontrolleur der Zone: liegt die Karte bei einem fremden Helden (Orchester: „Heroes on the
  // board"), ist `inst.controller` der Gastgeber — ohne `_equipAnleger` galt dann dieser als Anlegender (Afflicted Pests/LOCUST des Orchester-Spielers feuerten auf die EIGENE Aktion,
  // die des Gegners nicht).
  await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _isEffectEquip: true, _equipAnleger: pi });   // W16e (F03-21): per Effekt angelegt
  engine.sync();
  return inst;
}

/**
 * Gemeinsamer Ausloeser der drei Instrumente. Gibt `{ pi, heroIdx,
 * heroOwner }` zurueck (Kontrolleur, vorher ausgeruesteter Held und
 * dessen Brettseite), wenn der Effekt feuern darf — sonst null.
 *
 * Styx 28.9.: „you" ist der KONTROLLEUR der Karte (`effektiveSeiten`),
 * bei einem uebernommenen Helden also der Uebernehmende, nicht die
 * Brettseite. Held und Zone bleiben auf der Brettseite.
 */
function instrumentDiscardTrigger(ctx, cardName, hoptKey) {
  const inst = ctx.card;
  const leaving = ctx.leavingCard || ctx.card;
  if (!inst || !leaving || leaving.id !== inst.id) return null;   // nur die EIGENE Instanz
  if (ctx.fromZone !== 'support') return null;
  if (ctx.toZone && ctx.toZone !== 'discard') return null;   // Heldentod-Abbau traegt kein toZone → Discard
  if (inst.faceDown) return null;
  const engine = ctx._engine;
  const heroIdx = ctx.fromHeroIdx ?? inst.heroIdx;
  const seiten = engine.effektiveSeiten(inst);
  const du = seiten.controller ?? inst.owner;
  // Orchester-Muster (Karte gehoert A, liegt bei B): Besitz und Kontrolle
  // laufen auseinander — wie bisher kein „Hero you control".
  if ((seiten.owner ?? inst.owner) !== du) return null;
  const heroOwner = engine.physicalSide(inst);
  const held = engine.gs.players[heroOwner]?.heroes?.[heroIdx];
  if (engine.heroSideOf(heroOwner, held) !== du) return null;   // „equipped to a Hero YOU control"
  if (!engine.claimHOPT(hoptKey, du)) return null;              // „once per turn" je Kartenname
  return { pi: du, heroIdx, heroOwner };
}

module.exports = { isEquipArtifact, equipDestinations, equipArtifactToHero, instrumentDiscardTrigger };
