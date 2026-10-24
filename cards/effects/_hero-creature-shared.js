'use strict';
// ═══════════════════════════════════════════════════════════════════
//  HELD ALS KREATUR — gemeinsame Infrastruktur („This Hero becomes that Creature … it is still treated as a Hero in addition to being treated as a Creature")
//  Erster Nutzer: Hulijing, the Foxdemon (24.10.2026). Wer künftig „Hero is treated as a Creature" baut, nutzt diesen Vertrag.
//
//  ── MODELL ──────────────────────────────────────────────────────────
//  Der Held bleibt ein Held (eigene HP, Abilities, Statuswerte, Heldeneffekt, Zonen). Zusätzlich LIEGT eine Kreaturenkarte „auf" ihm:
//    • Instanz in `zone: 'support'` (wie jede Kreatur — Skripte, die `ctx.card.zone !== 'support'` als „Karte liegt noch am Brett" prüfen, funktionieren so
//      unverändert), aber OHNE Zonenplatz: `zoneSlot` = -1, `heroIdx` = Wirt, `heroOwner` = Brettseite des Wirts, Marke `counters._heldKreatur = { seite, heroIdx }`
//      (`istUeberlagerung(inst)`). Ihr Platz steht in KEINEM `supportZones`-Array: alle Schleifen über die Zonen-Arrays (Brettdarstellung, Platz-Zähler, Zonen-
//      Aufräumen) sehen sie nicht; Schleifen über `cardInstances` („alle Kreaturen, die ich kontrolliere") sehen sie — „treated as a Creature". Die Hooks des
//      Skripts (Einsatz, Tod, Zugende, Passive, aktiver Effekt …) laufen mit `cardHeroIdx` = Wirt, `cardHeroOwner` = Brettseite, `card.zoneSlot` = -1
//      (Animationen fallen damit auf die Heldenzone zurück).
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
const { hasCardType, isArtifactCreature, isSummonablePileCreature } = require('./_hooks');

const ZONE = 'support';

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

/** Magic-Arts-Stufe (oder eine andere Schule) des Wirts — 0 bei harter Negation der Abilities. */
function schulStufe(engine, school, seite, heroIdx) {
  return engine.heroSchoolLevel(school, seite, heroIdx);
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
  const inst = engine._trackCard(taken.name, pi, ZONE, heroIdx, -1);
  inst.controller = pi;
  inst.heroOwner = seite;
  inst.turnPlayed = gs.turn || 0;
  inst.counters = inst.counters || {};
  inst.counters._heldKreatur = { seite, heroIdx };
  inst.counters._hasHaste = true;
  const cd = engine._getCardDB()[taken.name];
  // HP-Anzeige für Leser, die `counters.currentHp` lesen: Spiegel der Heldenwerte zum Zeitpunkt des Auflegens (Schaden wird ohnehin auf den Helden gebucht).
  inst.counters.maxHp = hero.maxHp || hero.hp;
  inst.counters.currentHp = hero.hp;
  void cd;
  hero.heldKreatur = { instId: inst.id, name: taken.name, turn: gs.turn || 0 };
  engine._stempelEintrittsLimit(taken.name, pi);
  engine.zaehleBeschwoerung(pi);
  engine.log('hero_creature_placed', { player: ps.username, hero: hero.name, creature: taken.name, from: pile });
  engine.sync();
  // Einsatz-Hook der Kreatur selbst („When you play/summon this Creature") — wie jede Platzierung (`actionPlaceCreature`).
  await engine.runHooks('onPlay', {
    _onlyCard: inst, playedCard: inst, cardName: taken.name, zone: 'support', heroIdx, zoneSlot: -1,
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
 * Ziel-Einträge der Überlagerungen für eine Wahl, die NUR Kreaturen zulässt (Aufruf aus dem Ziel-Sammler der Engine). `seiteFilter(inst)` entscheidet nach der
 * Kontrolle der Überlagerung („my"/„enemy"/„any").
 */
function zielEintraege(engine, brettSeite, seiteFilter) {
  const out = [];
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
  ZONE, istUeberlagerung, spiegeln, ueberlagerung, istHeldKreatur, wirtVon, aktivierbareEintraege, ablehnungsgrund, schulStufe, kandidaten,
  platzieren, entfernen, zugendeAufraeumen, heldStirbt, bewegungAbfangen, zielEintraege,
};
