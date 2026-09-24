'use strict';
// ═══════════════════════════════════════════════════════════════════
//  GETEILT: VERWAHRTE ABILITIES — „vorübergehend gelöscht" (v1349)
//
//  Anlass „Madame Guillotine, the Great Equalizer": Abilities werden
//  gelöscht, dürfen den Deleted Pile nicht verlassen und kehren am Ende
//  des Zuges in ihre ursprünglichen Zonen zurück. Das ist keine
//  Eigenschaft der Heldin, sondern ein ZUSTAND des Spiels — er muss
//  auch weiterlaufen, wenn Madame im selben Zug fällt. Deshalb liegt er
//  hier, im Spielstand (`gs._verwahrteAbilities`), und die Engine fragt
//  ihn an den Stellen, an denen die Regeln greifen.
//
//  ALS VORGABEN (24.9.):
//   • Eine Zone, deren LETZTE Ability entfernt wurde, ist „versiegelt":
//     rot durchgekreuzt, sie kann nicht belegt werden — sie ist ja
//     eigentlich noch voll.
//   • NICHT pauschal gesperrt: auf eine Zone mit ausstehender Rückkehr
//     darf dieselbe Ability weiter gestapelt werden, solange der Stapel
//     INKLUSIVE der zurückkehrenden Kopien 3 nicht überschreitet. Und
//     dieselbe Ability eröffnet keinen zweiten Stapel — eine neue Kopie
//     gehört auf den (verwahrten) Stapel.
//   • ALLE Abilities zählen, auch die in Support Zones (Xal, Xalibur,
//     Cloak of Edge). Sie kehren in genau diese Support Zone zurück,
//     „als wäre das eine Ability Zone".
//   • Die Rückkehr ist nicht aufzuhalten — AUSSER die zugehörige
//     Hero-Zone ist leer (kein Held mehr). Ein TOTER Held ist ein Held.
//     Sie läuft Kopie für Kopie, mit sichtbarem Flug aus dem Deleted
//     Pile, mit kurzem Abstand.
//
//  EIN EINTRAG = EINE KOPIE:
//    { id, seite, heroIdx, zoneKind: 'ability'|'support', slotIdx,
//      name, stapelBesitzer, quelle }
//  `seite` ist die Brettseite der Zone, `stapelBesitzer` der Spieler,
//  in dessen Deleted Pile die Kopie liegt (Besitzer der Karte).
// ═══════════════════════════════════════════════════════════════════
const { ZONES } = require('./_hooks');

const FLUG_LANDUNG_MS = 560;     // Deleted Pile → Zone, dann erscheint sie
const RUECKKEHR_TAKT_MS = 90;    // Abstand zwischen zwei Abflügen (v1352: vorher 780 ms je Kopie)

function liste(gs) {
  if (!gs) return [];
  if (!Array.isArray(gs._verwahrteAbilities)) gs._verwahrteAbilities = [];
  return gs._verwahrteAbilities;
}

function _passt(e, seite, heroIdx, zoneKind, slotIdx) {
  return e.seite === seite && e.heroIdx === heroIdx
    && e.zoneKind === zoneKind && e.slotIdx === slotIdx;
}

/**
 * ★★ v1380 (Als Befund): IST DIE ZIELZONE JETZT GERADE LEGAL FUER
 * ABILITIES? Ability Zones immer. Eine SUPPORT Zone nur, solange ihr Held
 * Abilities dort aufnehmen kann — der Held selbst (Xal) oder eine Karte in
 * seinen Support Zones (Xalibur) mit `abilitiesInSupportZones`. Wurde
 * Xalibur entfernt, waehrend Madame die Ability verwahrte, ist die Zone
 * keine Ability-Zone mehr: der Eintrag ruht (keine Versiegelung, keine
 * Anzeige, keine Rueckkehr), und wird er bis Zugende nicht wieder legal,
 * bleibt die Karte im Deleted Pile.
 * Bewusst nur ueber den Spielstand (Namen), damit alle Aufrufer ohne
 * Engine-Referenz dieselbe Antwort bekommen.
 */
function zoneLegal(gs, e) {
  if (!e || e.zoneKind !== 'support') return true;
  const ps = gs?.players?.[e.seite];
  const hero = ps?.heroes?.[e.heroIdx];
  if (!hero?.name) return false;
  const { loadCardEffect } = require('./_loader');
  // Karten, deren EIGENER Platz die Support Zone ist und die nur als
  // Ability ZAEHLEN (Cloak of Edge, ein Equip): immer legal.
  const eigen = loadCardEffect(e.name);
  if (eigen?.countsAsAbilityInZone || eigen?.isEquip) return true;
  if (loadCardEffect(hero.name)?.abilitiesInSupportZones) return true;
  for (const slot of (ps.supportZones?.[e.heroIdx] || [])) {
    for (const n of (slot || [])) {
      if (n && loadCardEffect(n)?.abilitiesInSupportZones) return true;
    }
  }
  return false;
}

/** Ausstehende Kopien EINER Zone: `{ anzahl, name }` (name null, wenn keine). */
function ausstehend(gs, seite, heroIdx, zoneKind, slotIdx) {
  let anzahl = 0, name = null, basis = null;
  for (const e of (gs?._verwahrteAbilities || [])) {
    if (!_passt(e, seite, heroIdx, zoneKind, slotIdx)) continue;
    if (!zoneLegal(gs, e)) continue;   // v1380: ruhender Eintrag
    anzahl++; name = e.name; basis = e.basis || e.name;
  }
  return { anzahl, name, basis };
}

function _slot(gs, seite, heroIdx, zoneKind, slotIdx) {
  const ps = gs?.players?.[seite];
  const zonen = zoneKind === 'support' ? ps?.supportZones : ps?.abilityZones;
  return (zonen?.[heroIdx] || [])[slotIdx] || [];
}

/** Versiegelt = ausstehende Rückkehr UND die Zone ist leer. */
function versiegelt(gs, seite, heroIdx, zoneKind, slotIdx) {
  if (!gs?._verwahrteAbilities?.length) return false;
  if (_slot(gs, seite, heroIdx, zoneKind, slotIdx).length > 0) return false;
  return ausstehend(gs, seite, heroIdx, zoneKind, slotIdx).anzahl > 0;
}

/**
 * Darf `cardName` als NEUE Kopie in diese Zone? Nur die Verwahrungs-
 * Regeln — die üblichen Regeln (Stapelname, Stufe < 3, freie Zone)
 * prüft der Aufrufer weiter selbst.
 *   • Zone ohne Verwahrung → keine Einwände.
 *   • Zone mit Verwahrung → nur dieselbe Ability, und gesamt ≤ 3.
 */
function nimmtAuf(gs, seite, heroIdx, zoneKind, slotIdx, cardName) {
  const { anzahl, name, basis } = ausstehend(gs, seite, heroIdx, zoneKind, slotIdx);
  if (anzahl === 0) return true;
  // Derselbe Stapel: die verwahrte Ability selbst oder die Ability, auf
  // der sie lag (Performance liegt auf einer anderen).
  if (cardName !== name && cardName !== basis) return false;
  const liegt = _slot(gs, seite, heroIdx, zoneKind, slotIdx).length;
  return liegt + anzahl + 1 <= 3;
}

/**
 * Hat der Held einen VERWAHRTEN Stapel dieser Ability (auch ganz leer)?
 * Dann gehört eine neue Kopie dorthin und nirgendwo sonst hin.
 * @returns {{zoneKind, slotIdx}|null}
 */
function verwahrterStapel(gs, seite, heroIdx, cardName) {
  for (const e of (gs?._verwahrteAbilities || [])) {
    if (e.seite === seite && e.heroIdx === heroIdx && e.name === cardName) {
      if (!zoneLegal(gs, e)) continue;   // v1380
      return { zoneKind: e.zoneKind, slotIdx: e.slotIdx };
    }
  }
  return null;
}

/** Wie viele Kopien von `name` sind in `stapelBesitzer`s Deleted Pile gebunden? */
function gebundenImGeloescht(gs, stapelBesitzer, name) {
  let n = 0;
  for (const e of (gs?._verwahrteAbilities || [])) {
    if (e.stapelBesitzer === stapelBesitzer && e.name === name) n++;
  }
  return n;
}

/**
 * Darf JETZT eine Kopie von `name` den Deleted Pile verlassen? Nur,
 * wenn danach noch so viele Kopien übrig bleiben, wie gebunden sind.
 */
function darfGeloeschtVerlassen(gs, stapelBesitzer, name) {
  const gebunden = gebundenImGeloescht(gs, stapelBesitzer, name);
  if (gebunden === 0) return true;
  const stapel = gs?.players?.[stapelBesitzer]?.deletedPile || [];
  let vorhanden = 0;
  for (const n of stapel) if (n === name) vorhanden++;
  return vorhanden - 1 >= gebunden;
}

/** Für den Client: je Seite die versiegelten und belegten Verwahr-Zonen. */
function zonenFuerAnzeige(gs, seite) {
  const out = [];
  const gesehen = new Set();
  for (const e of (gs?._verwahrteAbilities || [])) {
    if (e.seite !== seite) continue;
    if (!zoneLegal(gs, e)) continue;   // v1380: ruhende Zone nicht anzeigen
    const key = `${e.heroIdx}|${e.zoneKind}|${e.slotIdx}`;
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    const { anzahl, name, basis } = ausstehend(gs, seite, e.heroIdx, e.zoneKind, e.slotIdx);
    out.push({
      heroIdx: e.heroIdx, zoneKind: e.zoneKind, slotIdx: e.slotIdx, name, basis, anzahl,
      versiegelt: _slot(gs, seite, e.heroIdx, e.zoneKind, e.slotIdx).length === 0,
    });
  }
  return out;
}

/**
 * Eine Kopie VERWAHREN: oberste Kopie des Ziels in den Deleted Pile,
 * mit Flug, über `actionMoveCard` (Leave-Hook: Fighting nimmt seinen
 * Bonus zurück usw.). `eintrag` ist ein Element aus
 * `engine.getAbilityTargets`.
 * @returns {Promise<boolean>} true, wenn eine Kopie verwahrt wurde
 */
async function verwahren(engine, eintrag, { quelle, quelleBesitzer } = {}) {
  if (!engine || !eintrag) return false;
  const gs = engine.gs;
  const seite = eintrag.owner;
  const ps = gs.players[seite];
  if (!ps) return false;
  const zoneKind = eintrag.zoneKind === 'support' ? 'support' : 'ability';
  let inst = null;
  if (zoneKind === 'support') {
    inst = eintrag.cardInstance;
    // Echte Ability in einer Support Zone (Xal): oberste Kopie des Stapels.
    const slot = ps.supportZones?.[eintrag.heroIdx]?.[eintrag.slotIdx] || [];
    const oben = slot[slot.length - 1];
    if (oben) {
      inst = engine.cardInstances.find(c => c.zone === ZONES.SUPPORT && c.owner === seite
        && c.heroIdx === eintrag.heroIdx && c.zoneSlot === eintrag.slotIdx && c.name === oben) || inst;
    }
  } else {
    const slot = ps.abilityZones?.[eintrag.heroIdx]?.[eintrag.slotIdx] || [];
    const oben = slot[slot.length - 1];
    if (!oben) return false;
    inst = engine.cardInstances.find(c => c.zone === ZONES.ABILITY && c.owner === seite
      && c.heroIdx === eintrag.heroIdx && c.zoneSlot === eintrag.slotIdx && c.name === oben) || null;
  }
  if (!inst || inst.zone !== (zoneKind === 'support' ? ZONES.SUPPORT : ZONES.ABILITY)) return false;
  const name = inst.name;
  const stapelBesitzer = inst.originalOwner ?? inst.owner;
  // Der Stapel, aus dem die Kopie kommt, erkennbar an seiner UNTERSTEN
  // Karte. Bei Performance ist das nicht ihr eigener Name (sie liegt auf
  // einer anderen Ability) — ohne diese Angabe hielte die Rueckkehr die
  // eigene Zone fuer „fremd belegt".
  const quellZonen = zoneKind === 'support' ? ps.supportZones : ps.abilityZones;
  const basis = ((quellZonen?.[eintrag.heroIdx] || [])[eintrag.slotIdx] || [])[0] || name;
  const heroIdx = inst.heroIdx, slotIdx = inst.zoneSlot;

  // Flug VOR der Bewegung (Client braucht die Startzone noch).
  engine._broadcastEvent('play_pile_transfer', {
    owner: seite, cardName: name,
    from: zoneKind, to: 'deleted',
    fromHeroIdx: heroIdx, fromSlotIdx: slotIdx,
    ...(stapelBesitzer !== seite ? { fromOwner: seite, toOwner: stapelBesitzer } : {}),
  });
  await engine.actionMoveCard(inst, ZONES.DELETED, -1, -1, {
    ignoreGateShield: true, source: quelle, sourceName: quelle, sourceOwner: quelleBesitzer,
  });
  if (inst.zone !== ZONES.DELETED) return false;   // abgeprallt (unbeweglich o. ä.)

  liste(gs).push({
    id: `${gs.turn}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`,
    seite, heroIdx, zoneKind, slotIdx, name, basis, stapelBesitzer, quelle: quelle || null,
  });
  engine.sync();
  return true;
}

/**
 * RÜCKKEHR ALLER verwahrten Kopien — mit Flug, dicht gestaffelt: die
 * nächste Kopie hebt ab, während die vorige noch fliegt (Als Vorgabe
 * 24.9.: „deutlich kürzerer Delay"). Nicht aufzuhalten, außer die
 * Hero-Zone ist leer. Umgeht bewusst jede Anlegeregel (eine Ability je
 * Zug, Sperren, Tod): das ist kein Anlegen, sondern das Zurücklegen einer
 * Karte, die nie hätte fehlen dürfen.
 *
 * ALS RULING 24.9.: die Rückkehr zählt NICHT als „attached". Die Karte
 * bekommt ihren eigenen `onPlay` (`_onlyCard` — sie bringt Boni wie
 * Fighting/Toughness zurück), und `onCardEnterZone` läuft für
 * Neuberechnungen (Lizbeth) — beide mit `_verwahrungRueckkehr: true`.
 * Jeder „when an/this Ability is attached"-Auslöser prüft das Flag und
 * schweigt (Performance, Creativity, Kit, Orphy, Luck, Lizbeths
 * Creativity-Spiegel).
 */
async function alleZurueckgeben(engine) {
  const gs = engine?.gs;
  const eintraege = liste(gs).slice();
  if (eintraege.length === 0) return;
  gs._verwahrteAbilities = [];   // ab jetzt ist nichts mehr gebunden
  // Zeitplan: Abflug i·TAKT, Landung Abflug + FLUG_LANDUNG_MS.
  const plan = eintraege.map((e, i) => ({ e, ab: i * RUECKKEHR_TAKT_MS, an: i * RUECKKEHR_TAKT_MS + FLUG_LANDUNG_MS, slot: null }));
  const takte = [];
  for (const p of plan) { takte.push({ t: p.ab, art: 'ab', p }); takte.push({ t: p.an, art: 'an', p }); }
  takte.sort((x, y) => x.t - y.t || (x.art === 'an' ? -1 : 1));
  let jetzt = 0;
  for (const tk of takte) {
    if (tk.t > jetzt) { await engine._delay(tk.t - jetzt); jetzt = tk.t; }
    try {
      if (tk.art === 'ab') tk.p.slot = _abflug(engine, tk.p.e);
      else if (tk.p.slot != null) await _landung(engine, tk.p.e, tk.p.slot);
    } catch (err) { console.error('[Verwahrung] Rückkehr fehlgeschlagen:', tk.p.e.name, err.message); }
  }
  engine.sync();
}

/** Prüft, wählt die Zielzone und schickt den Flug. @returns {number|null} Zielplatz */
function _abflug(engine, e) {
  const gs = engine.gs;
  const ps = gs.players[e.seite];
  const hero = ps?.heroes?.[e.heroIdx];
  // Einzige Ausnahme: die Hero-Zone ist leer.
  if (!hero?.name) {
    engine.log('verwahrung_kehrt_nicht_zurueck', { card: e.name, reason: 'hero_zone_empty' });
    return null;
  }
  const stapel = gs.players[e.stapelBesitzer]?.deletedPile || [];
  if (stapel.lastIndexOf(e.name) < 0) return null;   // sollte nicht vorkommen (Sperre)
  // v1380: Zielzone nimmt JETZT keine Abilities mehr auf (Xalibur weg).
  if (!zoneLegal(gs, e)) {
    engine.log('verwahrung_kehrt_nicht_zurueck', { card: e.name, reason: 'zone_not_legal' });
    return null;
  }

  // Zielzone: die ursprüngliche. Liegt dort inzwischen eine ANDERE Karte
  // (Verschiebe-Effekt), der Stapel derselben Ability bzw. eine freie Zone.
  const zonen = e.zoneKind === 'support' ? ps.supportZones : ps.abilityZones;
  if (!zonen[e.heroIdx]) zonen[e.heroIdx] = [[], [], []];
  let slotIdx = e.slotIdx;
  const slot = zonen[e.heroIdx][slotIdx] || [];
  if (slot.length > 0 && slot[0] !== e.name && slot[0] !== (e.basis || e.name)) {
    const reihe = zonen[e.heroIdx];
    let alt = reihe.findIndex(s => (s || []).length > 0 && s[0] === e.name);
    if (alt < 0) alt = reihe.findIndex(s => (s || []).length === 0);
    if (alt < 0) {
      engine.log('verwahrung_kehrt_nicht_zurueck', { card: e.name, reason: 'zone_occupied' });
      return null;
    }
    slotIdx = alt;
  }
  engine._broadcastEvent('play_pile_transfer', {
    owner: e.seite, cardName: e.name,
    from: 'deleted', to: e.zoneKind,
    toHeroIdx: e.heroIdx, toSlotIdx: slotIdx,
    sfx: 'draw',   // v1351 (Als Vorgabe): derselbe Whoosh wie beim Ziehen
    ...(e.stapelBesitzer !== e.seite ? { fromOwner: e.stapelBesitzer, toOwner: e.seite } : {}),
  });
  return slotIdx;
}

/** Legt die Kopie in die Zone, sobald ihr Flug ankommt. */
async function _landung(engine, e, slotIdx) {
  const gs = engine.gs;
  const ps = gs.players[e.seite];
  const hero = ps?.heroes?.[e.heroIdx];
  if (!hero?.name) return;
  // Aus dem Deleted Pile über die Stapel-Schicht (löst auch die dort
  // getrackte Instanz). Die Freigabe ist nur Formsache — die Liste ist
  // zu diesem Zeitpunkt bereits geleert.
  if (!zoneLegal(gs, e)) {   // v1380: zwischen Abflug und Landung unzulaessig geworden
    engine.log('verwahrung_kehrt_nicht_zurueck', { card: e.name, reason: 'zone_not_legal' });
    return;
  }
  const genommen = engine.takeFromPileSync(e.stapelBesitzer, 'deleted', e.name, {
    last: true, _verwahrungFreigabe: true, source: e.quelle || 'Madame Guillotine',
  });
  if (!genommen) return;
  const zonen = e.zoneKind === 'support' ? ps.supportZones : ps.abilityZones;
  if (!zonen[e.heroIdx]) zonen[e.heroIdx] = [[], [], []];
  if (!zonen[e.heroIdx][slotIdx]) zonen[e.heroIdx][slotIdx] = [];
  zonen[e.heroIdx][slotIdx].push(e.name);
  const zoneTyp = e.zoneKind === 'support' ? ZONES.SUPPORT : ZONES.ABILITY;
  const inst = engine._trackCard(e.name, e.seite, zoneTyp, e.heroIdx, slotIdx);
  if (e.stapelBesitzer !== e.seite) inst.originalOwner = e.stapelBesitzer;
  engine.log('verwahrung_zurueck', { player: ps.username, card: e.name, hero: hero.name });
  engine.sync();
  await engine.runHooks('onPlay', {
    _onlyCard: inst, playedCard: inst, cardName: e.name,
    zone: e.zoneKind, heroIdx: e.heroIdx, zoneSlot: slotIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: true, _verwahrungRueckkehr: true,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: e.zoneKind, toHeroIdx: e.heroIdx,
    _skipReactionCheck: true, _verwahrungRueckkehr: true,
  });
}

module.exports = {
  zoneLegal,
  liste, ausstehend, versiegelt, nimmtAuf, verwahrterStapel,
  gebundenImGeloescht, darfGeloeschtVerlassen, zonenFuerAnzeige,
  verwahren, alleZurueckgeben,
};
