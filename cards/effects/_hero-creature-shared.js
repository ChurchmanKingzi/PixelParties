'use strict';
// ═══════════════════════════════════════════════════════════════════
//  HELD ALS KREATUR — gemeinsame Infrastruktur („This Hero becomes that Creature … it is still treated as a Hero in addition to being treated as a Creature")
//  Erster Nutzer: Hulijing, the Foxdemon (24.10.2026). Wer künftig „Hero is treated as a Creature" baut, nutzt diesen Vertrag.
//
//  ── MODELL ──────────────────────────────────────────────────────────
//  Der Held bleibt ein Held (eigene HP, Abilities, Statuswerte, Heldeneffekt, Zonen). Zusätzlich LIEGT eine Kreaturenkarte „auf" ihm:
//    • Instanz in der EIGENEN Zone `'heroOverlay'` (`ZONES.HERO_OVERLAY`), `zoneSlot` = -1, `heroIdx` = Wirt, `heroOwner` = Brettseite des Wirts, Marke `counters._heldKreatur = { seite,
//      heroIdx }` (`istUeberlagerung(inst)`). Bewusst NICHT `zone: 'support'`: die vielen Schleifen über `cardInstances` mit `zone === 'support'` (Zielwahlen, Opfer, Rückgaben,
//      Kontrollwechsel …) sehen sie nicht — die Kreatur kann nirgendwohin bewegt werden und soll darum nie als Ziel eines wegbewegenden Effekts dastehen. Als Kreatur eingebunden ist sie nur
//      an den Stellen, die dieser Baustein ausdrücklich bedient (zentrale Zielsammler, Flächenschläge, Tod, aktiver Effekt). Die Hooks ihres Skripts laufen wie in einer Support Zone
//      (`isActiveIn`: heroOverlay gilt als support) mit `cardHeroIdx` = Wirt, `cardHeroOwner` = Brettseite, `card.zoneSlot` = -1; ihr Skript sieht `ctx.card.zone === 'support'`
//      (`skriptSicht`, damit Riegel wie `ctx.card.zone !== 'support'` stimmen).
//    • Am Helden: `hero.heldKreatur = { instId, name, turn, _tot? }` — das ist, was der Client zeichnet und was alle Leser abfragen (`istHeldKreatur`).
//  HP: UNVERÄNDERT. Die Kreatur hat keinen eigenen Lebenspunktestand: Schaden an der Instanz wird auf den Helden gebucht (derselbe Weg wie bei geteilten HP,
//  `_reroutePooledCreatureDamage`).
//
//  ── ALS KREATUR ZÄHLEN ──────────────────────────────────────────────
//    • Zielwahl: eine Wahl, die NUR Kreaturen zulässt (`types: ['creature']`), bietet den Helden mit auf (`type: 'hero'`, `alsKreatur: true`, `cardInstance` =
//      Überlagerung). Lässt sie Helden UND Kreaturen zu, steht er ohnehin als Held in der Liste (kein Doppeltreffer).
//    • Flächenschläge nur auf Kreaturen (`collectAoeCreatureTargets`) treffen ihn über die Überlagerung (HP-Umbuchung); mit Helden zusammen nur einmal (als Held).
//    • „Besiegt" als Kreatur: fällt der Held (0 HP) während die Karte auf ihm liegt, feuert `onCreatureDeath` für die Überlagerung (alle Zuhörer: Todes-Trigger der
//      Karte, „when a Creature is defeated" anderer). Die Karte BLEIBT bis zum Zugende liegen. Zerstörende Wege, die die Überlagerung selbst treffen (zerstören,
//      ablegen, löschen, opfern), besiegen den HELDEN (`actionDefeatHero`) und lassen die Karte ebenfalls liegen; Wege, die sie ANDERSWOHIN bewegen (auf die Hand,
//      ins Deck, in eine andere Zone, stehlen), laufen ins Leere (sie liegt nicht in einer Support Zone).
//    • Statuslage: ist der Held stumm (Frozen / Stunned / Webbed / Negated), ruhen auch die Effekte der Karte (`isCreatureEffectSuppressed`).
//
//  ── LEBENSDAUER ─────────────────────────────────────────────────────
//  `platzieren` legt die Karte auf (aus Hand oder Deck; Flug zur Heldenzone, Einsatz-Hook, zählt als Beschwörung); `zugendeAufraeumen` (EINE Stelle in
//  `_switchTurnInner`, nach den Zugende-Hooks: Zugende-Trigger der Karte laufen also noch) LÖSCHT sie („delete the Creature from this Hero": `onCardLeaveZone`,
//  Geloescht-Stapel des Kartenbesitzers) — auch wenn der Held inzwischen gefallen ist; er bleibt dann als besiegter Held zurück.
// ═══════════════════════════════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { hasCardType, isArtifactCreature, isSummonablePileCreature, baseCardName } = require('./_hooks');

const ZONE = 'heroOverlay';

/**
 * Die SICHT der Kartenskripte auf ihre Überlagerung: dieselbe Instanz, nur mit `zone === 'support'`. Skripte prüfen oft `ctx.card.zone !== 'support'` als „die Karte liegt noch am Brett"
 * (z. B. nach einer Animationspause) — für die eigene Überlagerung muss das stimmen, während fremde Schleifen über `cardInstances` sie (Zone `heroOverlay`) nicht sehen. Schreibzugriffe
 * gehen an die echte Instanz; die Sicht ist je Instanz gespeichert (stabile Identität). Gebaut in `engine._createContext` (`ctx.card`).
 */
function skriptSicht(inst) {
  if (!inst || !inst.counters?._heldKreatur) return inst;
  if (inst._skriptSicht) return inst._skriptSicht;
  const sicht = new Proxy(inst, { get: (ziel, k) => (k === 'zone' ? 'support' : Reflect.get(ziel, k, ziel)) });
  Object.defineProperty(inst, '_skriptSicht', { value: sicht, enumerable: false, configurable: true, writable: true });
  return sicht;
}

/** Ist diese Instanz die auf einem Helden liegende Kreatur („Held als Kreatur")? */
function istUeberlagerung(inst) {
  return !!inst?.counters?._heldKreatur;
}

/** HP-Spiegel der Überlagerung (Leser, die `counters.currentHp/maxHp` lesen, sehen die Werte des Wirts; die Quelle der Wahrheit bleibt der Held). */
function spiegeln(engine, inst) {
  const m = inst?.counters?._heldKreatur;
  const hero = m ? engine.gs.players[m.seite]?.heroes?.[m.heroIdx] : null;
  if (!hero) return;
  inst.counters.maxHp = hero.maxHp || hero.hp;
  inst.counters.currentHp = hero.hp;
}

/** Die Überlagerungs-Instanz auf Held `heroIdx` der Brettseite `seite` (oder null). */
function ueberlagerung(engine, seite, heroIdx) {
  const hero = engine.gs.players[seite]?.heroes?.[heroIdx];
  const hk = hero?.heldKreatur;
  if (!hk) return null;
  return engine.cardInstances.find(c => c.id === hk.instId && istUeberlagerung(c)) || null;
}

/** Trägt dieser Held (Objekt) gerade eine Kreatur? */
function istHeldKreatur(hero) {
  return !!hero?.heldKreatur;
}

/** Wirt-Held und Brettseite zu einer Überlagerungs-Instanz. */
function wirtVon(engine, inst) {
  const m = inst?.counters?._heldKreatur;
  if (!m) return null;
  const hero = engine.gs.players[m.seite]?.heroes?.[m.heroIdx] || null;
  return { hero, seite: m.seite, heroIdx: m.heroIdx };
}

/** Das Ergebnis für `getActiveHeroEffects` & Co.: darf diese Überlagerung gerade ihren aktiven Effekt anbieten? (Gleiche Prüfungen wie bei Support-Kreaturen.) */
function aktivierbareEintraege(engine, playerIdx) {
  const out = [];
  const gs = engine.gs;
  const ps = gs.players[playerIdx];
  if (!ps || gs.activePlayer !== playerIdx) return out;
  const phase = gs.currentPhase;
  const isMain = phase === 2 || phase === 4 || !!gs.skillTest;
  const isAction = phase === 3;
  if (!isMain && !isAction) return out;
  for (let seite = 0; seite < (gs.players || []).length; seite++) {
    const sps = gs.players[seite];
    for (let hi = 0; hi < (sps?.heroes || []).length; hi++) {
      const hero = sps.heroes[hi];
      if (!hero?.heldKreatur) continue;
      if (!(hero.hp > 0) || hero.heldKreatur._tot) continue;      // als Kreatur besiegt: kein aktiver Effekt mehr (die Karte liegt nur bis zum Zugende)
      const inst = ueberlagerung(engine, seite, hi);
      if (!inst) continue;
      if (engine.kontrolleurVon(inst) !== playerIdx) continue;
      if (engine.isCreatureEffectSuppressed(inst)) continue;
      const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
      if (!script?.creatureEffect) continue;
      if (engine.oncePerGameEffectUsed(playerIdx, script, inst.name)) continue;
      const isActionCost = !!script.creatureActionCost;
      if (isActionCost) {
        if (engine.areActionsBlocked(playerIdx)) continue;
        if (!isAction && !engine.hasAdditionalActionForCategory(playerIdx, 'ability_activation')) continue;
      } else if (!isMain) continue;
      const exhausted = gs.hoptUsed?.[`creature-effect:${inst.id}`] === gs.turn;
      let canActivate = !exhausted && !(inst.counters?._effectLockedTurn === gs.turn);
      if (canActivate) canActivate = engine.creatureEffectScriptAllows(inst);
      out.push({
        owner: seite, heroIdx: hi, zoneSlot: -1, cardName: inst.name, canActivate, exhausted,
        instId: inst.id, actionCost: isActionCost, heldKreatur: true,
        ...(seite !== playerIdx ? { charmedOwner: seite } : {}),      // übernommener Gegnerheld: Brettseite des Helden (wie die übrigen Einträge)
      });
    }
  }
  return out;
}

/**
 * Warum kann `name` NICHT auf Held `seite`/`heroIdx` gelegt werden? (null = geht.) Dieselben Riegel wie beim Platzieren (`actionPlaceCreature`):
 * Artifact Creatures, „only via its own effect", Beschwörungssperre, „You can only play/control 1", das `canSummon` der Karte selbst.
 */
function ablehnungsgrund(engine, pi, seite, heroIdx, name) {
  const ps = engine.gs.players[pi];
  const cd = engine._getCardDB()[name];
  if (!ps || !cd || !hasCardType(cd, 'Creature')) return 'no_creature';
  if (isArtifactCreature(cd)) return 'artifact_creature';
  const script = loadCardEffect(name);
  if (script?.summonOnlyViaOwnEffect) return 'own_effect_only';
  if (ps.summonLocked) return 'summon_locked';
  if (engine._eintrittsLimitErreicht(name, pi)) return 'play_limit';
  if (engine.nurEinerSchonKontrolliert(pi, name)) return 'only_control_1';
  if (!engine.isCreatureSummonable(name, seite, heroIdx, { beschwoerer: pi })) return 'cannot_summon';
  return null;
}

/**
 * Magic-Arts-Stufe (oder eine andere Schule) des Wirts — 0 bei harter Negation der Abilities. Abilities in SUPPORT Zonen (Xal, Xalibur, geerbter Xal-Effekt) zählen mit:
 * sie gelten „as if Ability Zones" (`heroSchoolLevel` kennt nur die echten Zonen; ohne diesen Zusatz zählte Magic Arts in einer Support Zone für „lower than this Hero's
 * Magic Arts level" nicht).
 */
function schulStufe(engine, school, seite, heroIdx) {
  if (engine.heroAbilityLevelsBlanked(seite, heroIdx)) return 0;
  const ps = engine.gs.players[seite];
  return engine.countAbilitiesForSchool(school, [...(ps?.abilityZones?.[heroIdx] || []), ...engine.heroSupportAbilityStacks(seite, heroIdx)]);
}

/**
 * Alle Karten, die JETZT auf den Helden gelegt werden dürften: Kreaturen aus Hand (wirksame Handstufe) und Deck (aufgedruckte Stufe) mit Stufe < `maxExklusiv`.
 * @returns {Array<{ name: string, pile: 'hand'|'deck', handIdx?: number, level: number }>}
 */
function kandidaten(engine, pi, seite, heroIdx, maxExklusiv) {
  const ps = engine.gs.players[pi];
  const hero = engine.gs.players[seite]?.heroes?.[heroIdx];
  const out = [];
  if (!ps || !hero?.name || hero.hp <= 0 || hero.heldKreatur || !(maxExklusiv > 0)) return out;
  const db = engine._getCardDB();
  const gesehenHand = new Set();
  (ps.hand || []).forEach((name, handIdx) => {
    if (gesehenHand.has(name)) return;
    const cd = db[name];
    if (!cd || !hasCardType(cd, 'Creature')) return;
    const lv = Number(engine.effectiveCardLevel(cd, pi, { handIdx }));
    if (!Number.isFinite(lv) || !(lv < maxExklusiv)) return;
    if (ablehnungsgrund(engine, pi, seite, heroIdx, name)) return;
    gesehenHand.add(name);
    out.push({ name, pile: 'hand', handIdx, level: lv });
  });
  const gesehenDeck = new Set();
  for (const name of (ps.mainDeck || [])) {
    if (gesehenDeck.has(name)) continue;
    const cd = db[name];
    if (!cd || !isSummonablePileCreature(cd, name)) continue;
    if (loadCardEffect(name)?.summonOnlyFromHand) continue;
    const lv = Number(cd.level);
    if (!Number.isFinite(lv) || !(lv < maxExklusiv)) continue;
    if (ablehnungsgrund(engine, pi, seite, heroIdx, name)) continue;
    gesehenDeck.add(name);
    out.push({ name, pile: 'deck', level: lv });
  }
  return out;
}

/** Die Überlagerungs-Instanz anlegen und am Helden vermerken (ohne Einsatz-Hook, ohne Zähler, ohne Flug). */
function erzeugen(engine, pi, seite, heroIdx, name, turn) {
  const hero = engine.gs.players[seite]?.heroes?.[heroIdx];
  const inst = engine._trackCard(name, pi, ZONE, heroIdx, -1);
  inst.controller = pi;
  inst.heroOwner = seite;
  inst.turnPlayed = turn;
  inst.counters = inst.counters || {};
  inst.counters._heldKreatur = { seite, heroIdx };
  inst.counters._hasHaste = true;
  hero.heldKreatur = { instId: inst.id, name, turn };
  // ★ MAX HP: solange die Kreatur aufliegt, sind die maximalen HP des Helden die der Kreatur (aufgedruckte HP); die AKTUELLEN HP bleiben unangetastet (liegen sie über dem neuen
  // Maximum, ist das ein Overheal wie bei Nao: Heilung bringt dann 0, Schaden zehrt es ab). Die Differenz wird gemerkt und am Ende ADDITIV zurückgenommen (`maxHpZurueck`), damit
  // Änderungen der max HP währenddessen (Arnold +40, Toughness …) erhalten bleiben.
  const kreaturMax = Number(engine.getEffectiveCardData(inst)?.hp);
  if (Number.isFinite(kreaturMax) && kreaturMax > 0) {
    const vorher = hero.maxHp || hero.hp;
    hero.heldKreatur.maxHpDelta = kreaturMax - vorher;
    hero.heldKreatur.hpBeiAnlage = hero.hp;
    hero.maxHp = kreaturMax;
    engine.log('hero_creature_max_hp', { hero: hero.name, creature: name, from: vorher, to: kreaturMax });
  }
  // HP-Anzeige für Leser, die `counters.currentHp` lesen: Spiegel der Heldenwerte (Schaden wird ohnehin auf den Helden gebucht).
  inst.counters.maxHp = hero.maxHp || hero.hp;
  inst.counters.currentHp = hero.hp;
  return inst;
}

/**
 * Die max HP des Helden zurückgeben, wenn die Kreatur geht: die beim Auflegen gemerkte Differenz wird abgezogen (nie unter 1). Aktuelle HP, die nur wegen des erhöhten Maximums
 * über dem alten lagen (Heilung bis zur Kreatur-Obergrenze), verfallen auf den Stand beim Auflegen — ein vorübergehendes Maximum schenkt keine dauerhaften HP. Gefallene Helden
 * (0 HP) behalten ihre HP.
 */
function maxHpZurueck(engine, hero) {
  const hk = hero?.heldKreatur;
  if (!hk || hk.maxHpDelta === undefined) return;
  const jetzt = hero.maxHp || hero.hp;
  const neu = Math.max(1, jetzt - hk.maxHpDelta);
  hero.maxHp = neu;
  if (hero.hp > 0) {
    const grenze = Math.max(neu, hk.hpBeiAnlage || 0);
    if (hero.hp > grenze) hero.hp = grenze;
  }
  delete hk.maxHpDelta;
  engine.log('hero_creature_max_hp', { hero: hero.name, creature: hk.name, from: jetzt, to: neu, zurueck: true });
}

/**
 * Puzzle-Start (Editor-Feld „Creature on this Hero"): die Kreatur liegt schon auf dem Helden, ohne dass sie je ausgespielt wurde — kein Einsatz-Hook, kein Beschwörungszähler,
 * kein Eintritts-Limit, kein Flug. Sie gehört dem Spieler der Brettseite (der Held ist nicht übernommen) und darf sofort ihren aktiven Effekt nutzen; am Zugende wird sie gelöscht.
 * @returns {object|null} die Überlagerung oder null (Karte unbekannt / keine Kreatur / Held fehlt oder gefallen / schon belegt)
 */
function anlegenOhneEinsatz(engine, seite, heroIdx, name) {
  const gs = engine.gs;
  const hero = gs.players[seite]?.heroes?.[heroIdx];
  const cd = engine._getCardDB()[name];
  if (!hero?.name || !(hero.hp > 0) || !cd || !hasCardType(cd, 'Creature') || isArtifactCreature(cd)) return null;
  if (hero.heldKreatur && hero.heldKreatur.instId) return null;
  return erzeugen(engine, seite, seite, heroIdx, name, 0);
}

/**
 * Die Karte `name` aus `pile` ('hand' | 'deck') auf den Helden legen. Zählt als Platzierung (= Beschwörung im Sinne der Zähler): Flug zur Heldenzone, Einsatz-Hook
 * (`onPlay`, „When you summon this Creature"), Beschwörungszähler, Eintritts-Limit. Die Karte darf sofort ihren aktiven Effekt benutzen („Haste": der Held selbst
 * war nicht beschwörungsmüde).
 * @returns {Promise<object|null>} die Überlagerung oder null
 */
async function platzieren(engine, pi, seite, heroIdx, name, pile, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const hero = gs.players[seite]?.heroes?.[heroIdx];
  if (!ps || !hero?.name || hero.hp <= 0 || hero.heldKreatur) return null;
  if (ablehnungsgrund(engine, pi, seite, heroIdx, name)) return null;
  const taken = await engine.takeFromPile(pi, pile, name, { source: opts.source, shuffle: pile === 'deck' });
  if (!taken) return null;
  engine._pileFlight(pi, taken.name, pile, 'hero', {
    toHeroIdx: heroIdx, ...(seite !== pi ? { toOwner: seite } : {}), ...(pile === 'hand' ? { fromHandIdx: taken.idx } : {}),
  });
  const inst = erzeugen(engine, pi, seite, heroIdx, taken.name, gs.turn || 0);
  engine._stempelEintrittsLimit(taken.name, pi);
  engine.zaehleBeschwoerung(pi);
  engine.log('hero_creature_placed', { player: ps.username, hero: hero.name, creature: taken.name, from: pile });
  engine.sync();
  // Einsatz-Hook der Kreatur selbst („When you play/summon this Creature") — wie jede Platzierung (`actionPlaceCreature`).
  await engine.runHooks('onPlay', {
    _onlyCard: inst, playedCard: skriptSicht(inst), cardName: taken.name, zone: 'support', heroIdx, zoneSlot: -1,
    _isPlacement: true, _summonedFromPile: pile, _skipReactionCheck: true,
  });
  engine.sync();
  return inst;
}

/**
 * Die Karte vom Helden nehmen und LÖSCHEN („delete the Creature from this Hero"). `onCardLeaveZone` läuft vorher (fromZone 'support' wie bei jeder Kreatur: Sperren,
 * Aufträge der Karte räumen sich ab), dann der Geloescht-Stapel des Kartenbesitzers.
 */
async function entfernen(engine, seite, heroIdx, opts = {}) {
  const gs = engine.gs;
  const hero = gs.players[seite]?.heroes?.[heroIdx];
  if (!hero?.heldKreatur) return false;
  const inst = ueberlagerung(engine, seite, heroIdx);
  const name = hero.heldKreatur.name;
  const besitzer = inst ? (inst.originalOwner ?? inst.owner) : seite;
  if (inst) {
    await engine.runHooks('onCardLeaveZone', {
      _onlyCard: inst, leavingCard: inst, fromZone: 'support', toZone: 'deleted', fromOwner: seite, fromHeroIdx: heroIdx, fromZoneSlot: -1, _skipReactionCheck: true,
    });
  }
  if (inst) engine._untrackCard(inst.id);
  maxHpZurueck(engine, hero);
  delete hero.heldKreatur;
  engine._broadcastEvent('play_zone_animation', { type: 'hero_creature_off', owner: seite, heroIdx, zoneSlot: -1, duration: 900 });
  const bps = gs.players[besitzer];
  if (bps) {
    (bps.deletedPile = bps.deletedPile || []).push(name);
    engine._pileFlight(besitzer, name, 'hero', 'deleted', { fromHeroIdx: heroIdx, ...(seite !== besitzer ? { fromOwner: seite } : {}) });
  }
  engine.log('hero_creature_deleted', { hero: hero.name, creature: name, reason: opts.grund || 'turn_end' });
  engine.sync();
  return true;
}

/** EINE Stelle am Zugende: jede Überlagerung wird gelöscht (auch bei gefallenem Wirt). Läuft NACH den Zugende-Hooks. */
async function zugendeAufraeumen(engine) {
  const gs = engine.gs;
  // Verwaiste Überlagerungen (der Wirt wurde ersetzt/entfernt und trägt die Marke nicht mehr): ohne Aufräumen bliebe die Karte als Geisterkreatur liegen.
  for (const inst of engine.cardInstances.filter(istUeberlagerung)) {
    const m = inst.counters._heldKreatur;
    const wirt = gs.players[m.seite]?.heroes?.[m.heroIdx];
    if (wirt?.heldKreatur?.instId === inst.id) continue;
    try {
      await engine.runHooks('onCardLeaveZone', { _onlyCard: inst, leavingCard: inst, fromZone: 'support', toZone: 'deleted', fromOwner: m.seite, fromHeroIdx: m.heroIdx, fromZoneSlot: -1, _skipReactionCheck: true });
    } catch (err) { console.error('[HeldKreatur] Waise:', err && err.message); }
    engine._untrackCard(inst.id);
    const besitzer = gs.players[inst.originalOwner ?? inst.owner];
    if (besitzer) (besitzer.deletedPile = besitzer.deletedPile || []).push(inst.name);
    engine.log('hero_creature_deleted', { hero: wirt?.name || '?', creature: inst.name, reason: 'orphan' });
  }
  for (let seite = 0; seite < (gs.players || []).length; seite++) {
    const heroes = gs.players[seite]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      if (heroes[hi]?.heldKreatur) {
        try { await entfernen(engine, seite, hi, { grund: 'turn_end' }); }
        catch (err) { console.error('[HeldKreatur] Zugende-Aufräumen:', err && err.message); }
      }
    }
  }
}

/**
 * Der Held ist gefallen, während eine Kreatur auf ihm liegt: Er gilt auch als Kreatur besiegt. `onCreatureDeath` feuert für die Überlagerung; die Karte bleibt
 * bis zum Zugende liegen (kein Zonenwechsel). Je Auflegen nur einmal.
 */
async function heldStirbt(engine, hero, hookCtx = {}) {
  const hk = hero?.heldKreatur;
  if (!hk || hk._tot) return;
  const inst = engine.cardInstances.find(c => c.id === hk.instId && istUeberlagerung(c));
  if (!inst) return;
  hk._tot = true;
  const w = wirtVon(engine, inst);
  const death = {
    name: inst.name, owner: inst.owner, originalOwner: inst.originalOwner, controller: inst.controller ?? inst.owner,
    seite: w?.seite ?? inst.heroOwner, heroIdx: inst.heroIdx, zoneSlot: -1, instId: inst.id,
    level: engine.kreaturLevelJetzt(inst), ziel: 'deleted', ablageBesitzer: inst.originalOwner ?? inst.owner, heldKreatur: true,
  };
  engine.log('hero_creature_defeated', { hero: hero.name, creature: inst.name });
  await engine.runHooks('onCreatureDeath', {
    creature: death, source: hookCtx.source || null, ...(hookCtx.type !== undefined ? { type: hookCtx.type } : {}), _skipReactionCheck: true,
  });
}

/**
 * Eine zerstörende oder bewegende Handlung trifft die Überlagerung (`actionMoveCard`): Ziel Ablage/Gelöscht ⇒ der HELD wird besiegt (die Karte bleibt liegen);
 * jedes andere Ziel läuft ins Leere.
 */
async function bewegungAbfangen(engine, inst, toZone, opts = {}) {
  const w = wirtVon(engine, inst);
  if (!w?.hero) return false;
  if (toZone === 'discard' || toZone === 'deleted') {
    if (w.hero.hp > 0) {
      const src = opts.source || (opts.sourceName ? { name: opts.sourceName, owner: opts.sourceOwner } : null);
      await engine.actionDefeatHero(src, w.hero, { type: 'creature', reason: opts.sourceName || opts.source?.name, ...(opts.unaufhaltsam ? { unaufhaltsam: true } : {}) });
    }
    return true;
  }
  engine.log('hero_creature_move_fizzle', { creature: inst.name, to: String(toZone) });
  return false;
}

/**
 * Karten, deren Wahl (über die zentralen Ziel-Sammler `promptDamageTarget` / `promptMultiTarget`) eine gewählte Kreatur aus ihrer Zone WEGBEWEGT — auf die Hand, ins Deck oder
 * unter fremde Kontrolle in eine andere Zone. Die aufliegende Kreatur des Helden kann nirgendwohin bewegt werden: solche Wahlen bieten den Helden gar nicht erst an (er soll
 * nicht wählbar sein und dann ins Leere laufen). Neue Karten dieser Art tragen sich hier ein oder setzen `movesTarget: true` im Wahl-Config. Karten, die ihre Kreaturenliste selbst
 * über die Support Zones bauen (Capture Net, Kidnapping, Dark Gear, Diplomacy, Tengu Windstorm …), bieten die aufliegende Kreatur ohnehin nie an.
 */
const WEGBEWEGENDE_WAHL = new Set(['Capture', 'Missing People', 'Racket Arrow']);

/** Darf die aufliegende Kreatur in dieser Wahl überhaupt angeboten werden? (false bei Wahlen, die das Ziel wegbewegen) */
function alsKreaturWaehlbar(engine, config, quellName) {
  if (config && config.movesTarget) return false;
  const quellen = [quellName, engine?._currentEffectSource?.cardName];
  for (const q of quellen) if (q && WEGBEWEGENDE_WAHL.has(baseCardName(q))) return false;
  return true;
}

/**
 * Zielwahlen, die eine Karte über ihre EIGENE Liste baut (nicht über die zentralen Sammler `promptDamageTarget` / `promptMultiTarget`), bieten die aufliegende Kreatur nicht an: ein
 * Eintrag mit der Überlagerung als `cardInstance`, den `zielEintraege` nicht selbst erzeugt hat (`alsKreatur`), fliegt hier heraus (in place). Grund: viele solcher Listen laufen
 * über `cardInstances` (Zone support) und gehören Karten, die ihr Ziel WEGBEWEGEN (Hand, Deck, andere Zone, Kontrolle) — die Kreatur kann aber nirgendwohin. Aufgerufen aus
 * `engine.promptEffectTarget` (alle Effekt-Wahlen) und `normalizeValidTargets` (server.js, Zielwahl-Karten mit `getValidTargets`).
 */
function entferneFremdeUeberlagerungen(liste) {
  if (!Array.isArray(liste)) return liste;
  for (let i = liste.length - 1; i >= 0; i--) {
    const t = liste[i];
    const inst = t?.cardInstance || t?._cardInstance;
    if (inst?.counters?._heldKreatur && !t.alsKreatur) liste.splice(i, 1);
  }
  return liste;
}

/**
 * Ziel-Einträge der Überlagerungen für eine Wahl, die NUR Kreaturen zulässt (Aufruf aus dem Ziel-Sammler der Engine). `seiteFilter(inst)` entscheidet nach der
 * Kontrolle der Überlagerung („my"/„enemy"/„any"). Wahlen, die das Ziel wegbewegen (`alsKreaturWaehlbar`), erhalten gar keinen Eintrag.
 */
function zielEintraege(engine, brettSeite, seiteFilter, config, quellName) {
  const out = [];
  if (!alsKreaturWaehlbar(engine, config, quellName)) return out;
  const ps = engine.gs.players[brettSeite];
  if (!ps) return out;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0 || !hero.heldKreatur) continue;
    const inst = ueberlagerung(engine, brettSeite, hi);
    if (!inst) continue;
    if (typeof seiteFilter === 'function' && !seiteFilter(inst)) continue;
    spiegeln(engine, inst);
    out.push({ id: `hero-${brettSeite}-${hi}`, type: 'hero', owner: brettSeite, heroIdx: hi, cardName: hero.name, alsKreatur: true, cardInstance: inst });
  }
  return out;
}

module.exports = {
  ZONE, skriptSicht, istUeberlagerung, spiegeln, ueberlagerung, istHeldKreatur, wirtVon, aktivierbareEintraege, ablehnungsgrund, schulStufe, kandidaten,
  platzieren, anlegenOhneEinsatz, entfernen, maxHpZurueck, zugendeAufraeumen, heldStirbt, bewegungAbfangen, zielEintraege, alsKreaturWaehlbar, WEGBEWEGENDE_WAHL, entferneFremdeUeberlagerungen,
};
