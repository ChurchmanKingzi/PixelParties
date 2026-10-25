const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// ═══════════════════════════════════════════
//  GETEILT: AUSRUESTEN DURCH EINEN EFFEKT (v1268)
//
//  Karten, die eine Ausruestung nicht aus der Hand SPIELEN, sondern per
//  Effekt aus einem Stapel an einen Helden legen: Weapon Collecting
//  Wight (Ablage), Future Tech Gunslinger Riffel (Deck), Treasure
//  Hunter's Backpack (Deck). Bis v1267 trug jede ihre eigene Fassung —
//  und sie wichen voneinander ab:
//    • Riffel feuerte das `onPlay` der Ausruestung NICHT. Dort vergeben
//      Ausruestungen aber ihre Dauerwirkung (Blade of the Frostbringer:
//      der ATK-Bonus steht NUR in `onPlay`). Ueber Riffel angelegt, gab
//      es ihn nicht.
//    • Riffel oeffnete das Surprise-Fenster beim Ausruesten nicht
//      (`_skipReactionCheck`), Backpack und der Handweg schon.
//    • Backpack liess gecharmte Helden als Traeger zu, der Handweg nicht.
//
//  Diese Datei ist jetzt die EINZIGE Auslegungsstelle fuer:
//
//    1. WER ALS TRAEGER TAUGT — dieselben Regeln wie der Handweg
//       (`doPlayArtifact`, `getFreeSideEquipArtifacts`): lebendig, nicht
//       Frozen, nicht Charmed, mindestens eine freie Basis-Support-Zone,
//       und die kartenseitige Beschraenkung `canEquipToHero` (Crusader's
//       & Co., zentral in `engine.canEquipCardToHero`). Als Regel 19.8.:
//       eine Ausruestung ohne legalen Traeger ist keine legale Wahl.
//
//    2. DIE WAHL VON HELD ODER ZONE — ein Klick auf den Helden nimmt die
//       erste freie Zone, ein Klick auf eine Zone genau diese (Bauform
//       Backpack).
//
//    3. DAS ANLEGEN AUS EINEM STAPEL — ueber die Stapel-Schicht
//       (`takeFromPile`: Sperren wie Knight [B], Tracking, Log), Flug
//       vom Stapel in die Zone, danach `onPlay` (Dauerwirkung der
//       Ausruestung) und `onCardEnterZone` (Surprise-Fenster beim
//       Ausruesten, Beobachter wie Riffels Aufstiegsbereitschaft).
//       „without paying its Cost" ist der Normalfall: hier wird nie
//       etwas bezahlt.
// ═══════════════════════════════════════════

const { heroCanBeEquipped, hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const { getCardDB: _getCardDB } = require('./_card-db');

/**
 * Freie Basis-Support-Zonen (0–2) dieses Helden.
 * ★★ v1349: mit `engine` + `pi` zaehlen versiegelte Plaetze (Madame
 * Guillotine) als belegt — `engine.supportSlotBelegt` ist die EINE Frage.
 */
function freieBasisZonen(ps, heroIdx, engine = null, pi = null, cardName = null) {
  // Darion: ein Equip (`cardName`) gehoert bei einem Helden mit Equip-Stapel PFLICHT in diesen Stapel — er ist dann der einzige Platz.
  if (engine && pi != null && cardName) {
    const pflicht = engine.equipPflichtPlatz(pi, heroIdx, cardName);
    if (pflicht >= 0) return [pflicht];
  }
  const out = [];
  for (let z = 0; z < 3; z++) {
    if (engine && pi != null) {
      if (!engine.supportSlotBelegt(pi, heroIdx, z)) out.push(z);
    } else if (((ps?.supportZones?.[heroIdx] || [])[z] || []).length === 0) out.push(z);
  }
  return out;
}

/**
 * Taugt dieser Held als Traeger fuer `cardName`? `seite` = Brettseite des
 * Helden (Standard `pi`). Als Vorgabe 29.9.: ein uebernommener Held der
 * Gegenseite taugt, wenn `pi` ihn kontrolliert und die Uebernahme
 * `ausruesten` erlaubt (`engine.darfFremdAusruesten`); ein an den Gegner
 * abgegebener eigener Held nicht.
 */
function istAusruestTraeger(engine, pi, heroIdx, cardName, seite = pi, kartenBesitzer = pi) {
  const ps = engine.gs.players[seite];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (seite !== pi) {
    if (!engine.darfFremdAusruesten?.(pi, seite, heroIdx)) return false;
  } else {
    if (!heroCanBeEquipped(hero)) return false;
    if (engine.heroSideOf && engine.heroSideOf(pi, hero) !== pi) return false;
  }
  if (freieBasisZonen(ps, heroIdx, engine, seite, cardName).length === 0) return false;
  // W14b (Q153): `kartenBesitzer` = wem die Karte gehoert (Looting aus der Gegner-Ablage: der Gegner); `pi` kontrolliert den Traeger.
  // Gegnerseiten-Ausruestung (Control Device) nur an Helden, die der Kartenbesitzer NICHT kontrolliert.
  return engine.canEquipCardToHero(cardName, seite, heroIdx, { kartenBesitzer, kontrolleur: pi });
}

/** Alle eigenen Helden, die `cardName` tragen koennen. */
function ausruestTraeger(engine, pi, cardName) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (istAusruestTraeger(engine, pi, hi, cardName)) out.push(hi);
  }
  return out;
}

/** Als Vorgabe 29.9.: alle Traeger inkl. uebernommener Helden — [{ seite, heroIdx }]. */
function ausruestTraegerMitSeite(engine, pi, cardName, opts = {}) {
  const out = ausruestTraeger(engine, pi, cardName).map(hi => ({ seite: pi, heroIdx: hi }));
  for (const { physOwner, heroIdx } of (engine.fremdAusruestHelden?.(pi) || [])) {
    // W31a (Al, 22.10.2026): Form „one of your Heroes" (`opts.ausserImmun`, Weapon Collecting Wight): ein durch die Kontrolle ausdruecklich gegen eigene Karten immuner Held
    // (Charme Lv3, Golden Apple, Sixth Circle) ist kein Traeger. Die Form „a Hero you control" (Cool Repair, Backpack …) bleibt ohne die Option.
    if (opts.ausserImmun && engine.heroImmunGegenEigene?.(physOwner, heroIdx, pi)) continue;
    if (istAusruestTraeger(engine, pi, heroIdx, cardName, physOwner)) out.push({ seite: physOwner, heroIdx });
  }
  return out;
}

/**
 * Held oder Zone waehlen, an den `cardName` kommt. Liefert
 * `{ heroIdx, slot }` oder `null` (Abbruch / kein Traeger).
 * `nurHelden` schraenkt auf bestimmte Helden ein (Riffel: nur er selbst).
 */
async function waehleAusruestPlatz(engine, pi, cardName, cfg = {}) {
  const ps = engine.gs.players[pi];
  if (!ps) return null;
  // Als Vorgabe 29.9.: auch uebernommene Helden (Brettseite `seite`);
  // `nurHelden` meint eigene Helden.
  const helden = (cfg.nurHelden ? ausruestTraeger(engine, pi, cardName).map(hi => ({ seite: pi, heroIdx: hi }))
    : ausruestTraegerMitSeite(engine, pi, cardName, { ausserImmun: !!cfg.ausserImmun }))
    .filter(h => !cfg.nurHelden || cfg.nurHelden.includes(h.heroIdx));
  if (helden.length === 0) return null;

  const ziele = [];
  for (const { seite, heroIdx: hi } of helden) {
    const sps = engine.gs.players[seite];
    for (const si of freieBasisZonen(sps, hi, engine, seite, cardName)) {
      ziele.push({ id: `equip-${seite}-${hi}-${si}`, type: 'equip', owner: seite, heroIdx: hi, slotIdx: si, cardName: '' });
    }
    ziele.push({ id: `hero-${seite}-${hi}`, type: 'hero', owner: seite, heroIdx: hi, cardName: sps.heroes[hi].name });
  }

  const ids = await engine.promptEffectTarget(pi, ziele, {
    maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
    title: cfg.title || cardName,
    description: cfg.description || `Select a Hero or a Support Zone to equip ${cardName} to.`,
    confirmLabel: cfg.confirmLabel || '⚔️ Equip!',
    confirmClass: 'btn-info',
    cancellable: cfg.cancellable !== false,
    greenSelect: true,
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
  });
  if (!ids || ids.length === 0) return null;
  const ziel = ziele.find(t => t.id === ids[0]);
  if (!ziel) return null;
  const slot = ziel.type === 'equip' ? ziel.slotIdx : freieBasisZonen(engine.gs.players[ziel.owner], ziel.heroIdx, engine, ziel.owner, cardName)[0];
  if (slot == null) return null;
  return { heroIdx: ziel.heroIdx, slot, seite: ziel.owner };
}

/**
 * `cardName` aus `stapel` ('deck' | 'discard' | 'deleted' | 'hand') nehmen und in
 * die freie Zone `slot` von Held `heroIdx` legen. Liefert die neue
 * Instanz oder `null`, wenn nichts geschah (Zone inzwischen belegt,
 * Traeger nicht mehr legal, Karte weg, Stapel gesperrt).
 *
 * opts: `source` (Kartenname fuer Log/Sperren), `flug` (Standard an),
 *       `flugMs` (Wartezeit bis zur Landung, Standard 520 wie Riffel),
 *       `stapelBesitzer` (wessen Stapel; Standard `pi` — Looting nimmt auch aus der gegnerischen Ablage),
 *       `handIdx` (nur Stapel 'hand': der Handplatz der Karte; Mine! Mine! Mine!).
 */
async function ruesteAusStapelAus(engine, pi, stapel, cardName, heroIdx, slot, opts = {}) {
  const ps = engine.gs.players[pi];
  if (!ps) return null;
  // Als Vorgabe 29.9.: `opts.seite` = Brettseite eines uebernommenen Helden.
  // Die Karte liegt dort, gehoert aber `pi` (`originalOwner`).
  const seite = (isSeat(engine, opts.seite)) ? opts.seite : pi;
  const zps = engine.gs.players[seite];
  // 12.10. (Looting, „from either discard pile"): `opts.stapelBesitzer` = wessen Stapel die Karte hergibt (Standard: `pi`). Die Karte gehoert dem Deck, aus dem sie
  // stammt (`originalOwner`), und landet spaeter wieder in DESSEN Ablage.
  const stapelBesitzer = (isSeat(engine, opts.stapelBesitzer)) ? opts.stapelBesitzer : pi;
  if (!istAusruestTraeger(engine, pi, heroIdx, cardName, seite, stapelBesitzer)) return null;
  // ★ Darion: Pflicht-Platz im Equip-Stapel (statt eines freien Platzes); sonst muss die gewaehlte Zone frei sein.
  const _stapelPlatz = engine.equipPflichtPlatz(seite, heroIdx, cardName);
  if (_stapelPlatz >= 0) slot = _stapelPlatz;
  else if (((zps.supportZones[heroIdx] || [])[slot] || []).length > 0) return null;
  // ★ W15a (Al, R3 und Regel W14a Q5): Ausrüsten PER EFFEKT (Weapon Collecting Wight, Riffel, Looting …) ist ein Nicht-Schaden-Effekt auf den Träger — Resistance fängt ihn ab.
  // Vor jeder Kartenbewegung gefragt: bei `true` bleibt die Karte im Stapel (Rückgabe `null` = nicht ausgerüstet, wie bei jedem anderen Fehlschlag).
  // ★ W16a (Al, Frage 3: „Ja!"): ein von Resistance abgefangener Effekt verbraucht den Einmal-Einsatz (Riffel, Weapon Collecting Wight …) — der Aufrufer liest `opts.blockiert`
  // (gesetzt NUR bei der Resistance-Abwehr, nicht bei den übrigen Fehlschlägen = `null` ohne Marke) und meldet den Einsatz als gewirkt.
  if (await engine.heroNonDamageEffectBlocked(seite, heroIdx, 'equip', { sourceOwner: pi, source: opts.source })) { opts.blockiert = true; return null; }
  // 23.10. (Mine! Mine! Mine!): Stapel `'hand'` — die Karte kommt von einem Handplatz (`opts.handIdx`, sonst die erste Kopie). Die Handinstanz wird mit dem Platz
  // verabschiedet; die Herkunft (gestohlene Karte: der Gegner) wandert als `originalOwner` auf die Brettinstanz, damit Ablage/Löschen später beim Besitzer landen.
  const vonHand = stapel === 'hand';
  let handIdx = null, handInstVor = null, herkunft = null;
  if (vonHand) {
    const hand = engine.gs.players[stapelBesitzer].hand || [];
    handIdx = Number.isInteger(opts.handIdx) ? opts.handIdx : hand.indexOf(cardName);
    if (handIdx < 0 || hand[handIdx] !== cardName) return null;
    handInstVor = engine._findHandInstanceAt(stapelBesitzer, handIdx);
    herkunft = engine._handOriginAt(engine.gs.players[stapelBesitzer], handIdx)
      ?? (handInstVor && Number.isInteger(handInstVor.originalOwner) ? handInstVor.originalOwner : stapelBesitzer);
  }
  // Flug VOR der Zustandsänderung (Hand → Zone), damit der Client den Handplatz abfängt (Muster Kidnapping/Gold Trap).
  const flug = opts.flug !== false;
  if (flug && vonHand) {
    engine._broadcastEvent('play_pile_transfer', {
      owner: stapelBesitzer, toOwner: seite, cardName,
      from: 'hand', to: 'support', fromHandIdx: handIdx,
      toHeroIdx: heroIdx, toSlotIdx: slot,
    });
  }
  const genommen = await engine.takeFromPile(engine.gs.players[stapelBesitzer], stapel, vonHand ? handIdx : cardName,
    { source: opts.source, ...(stapelBesitzer !== pi ? { sourceOwner: pi } : {}) });
  if (!genommen) return null;
  if (handInstVor) engine._untrackCard(handInstVor.id);

  if (!zps.supportZones[heroIdx]) zps.supportZones[heroIdx] = [[], [], []];
  if (_stapelPlatz >= 0) zps.supportZones[heroIdx][slot].push(cardName);   // Darion: oben auf den Equip-Stapel
  else zps.supportZones[heroIdx][slot] = [cardName];
  const inst = engine._trackCard(cardName, seite, 'support', heroIdx, slot);
  if (vonHand) { if (herkunft != null && herkunft !== seite) inst.originalOwner = herkunft; }
  else if (stapelBesitzer !== seite) inst.originalOwner = stapelBesitzer;

  if (flug && !vonHand) {
    // Sichtbarer Weg Stapel → Zone (Als Regel: jede Bewegung zwischen
    // Stapeln wird animiert). Der Client versteckt das Ziel waehrend
    // des Flugs.
    engine._broadcastEvent('play_pile_transfer', {
      owner: stapelBesitzer, toOwner: seite, cardName,
      from: stapel, to: 'support',
      toHeroIdx: heroIdx, toSlotIdx: slot,
    });
  }
  engine.sync();
  if (flug) await engine._delay(opts.flugMs ?? 520);

  // Dauerwirkung der Ausruestung (ATK-Boni, Inselzonen, …).
  await engine.runHooks('onPlay', {
    _onlyCard: inst, playedCard: inst, cardName,
    zone: 'support', heroIdx, zoneSlot: slot,
  });
  // Eintritt: Surprise-Fenster beim Ausruesten + Beobachter.
  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
    _isEffectEquip: true,   // W16e (F03-21): Anlegen per EFFEKT (nicht aus der Hand) — Summoning Instructions: X = 1 ohne Frage
  });
  engine.sync();
  return inst;
}

// ═══════════════════════════════════════════════════════════════════════════
//  W50a · UMHAENGEN LIEGENDER AUSRUESTUNGEN — EIN Baustein fuer Slippery Fridge UND Inheritance Ceremony
//  (Al, 22.10.2026: „Der Equip-Artifact-Teil sollte bei Ceremony genauso funktionieren wie bei Fridge.")
//
//  Fridge: „… equip them to a different Hero the same player controls (without paying their Cost again)" — Quell- und Zielheld gehoeren demselben
//  Spieler (auch dem GEGNER). Ceremony: dieselbe Ausruestungs-Mechanik, aber nur zwischen zwei EIGENEN Helden (Nutzer -> Zielheld).
//  Gemeinsam ist hier: was ein Equip ist, wer Ziel sein darf, welche Zonen frei sind, und das Verschieben selbst (erst alle Abgaenge, dann alle
//  Ankuenfte; Leave-/Enter-/On-Play-Haken; Equip-Fenster fuer Afflicted Pests mit dem ANLEGER = der Spieler, der den Effekt ausfuehrt).
// ═══════════════════════════════════════════════════════════════════════════

/** Ist diese Karte (nach Namen) ein Equip im Sinne der Fridge? Karten-Subtyp Equipment, Helden (Initiation Ritual) oder Skript `isEquip`. */
function istEquipKartenname(cardName) {
  const cd = _getCardDB()[cardName];
  if (!cd) return false;
  if ((cd.subtype || '').toLowerCase() === 'equipment') return true;
  if (hasCardType(cd, 'Hero') || hasCardType(cd, 'Ascended Hero')) return true;
  let script = null;
  try { script = loadCardEffect(cardName); } catch { script = null; }
  return !!script?.isEquip;
}

/** Liegt `inst` als umhaengbares Equip in einer Support Zone? (nicht `counters.immovable`, kein Token, nicht Tempelunas Fee; `treatAsEquip` = als Equip angelegter Held, Initiation Ritual) */
function istUmhaengbaresEquip(engine, inst) {
  if (!inst || inst.zone !== 'support') return false;
  if (inst.counters?.immovable) return false;
  // W52a (Al, 22.10.2026): Tokens werden NIE umgehaengt („Generell sollten Tokens ausgenommen sein!"); Tempelunas angehaengte Fee ist kein Equip (`_keinEquip`).
  if (engine.isTokenCard(inst)) return false;
  if (inst.counters?._keinEquip) return false;
  if (inst.counters?.treatAsEquip) return true;
  const script = typeof inst.loadScript === 'function' ? inst.loadScript() : null;
  if (script?.isEquip) return true;
  const cd = _getCardDB()[inst.name];
  return !!(cd && (cd.subtype || '').toLowerCase() === 'equipment');
}

/**
 * W16e (F03-08): darf `inst` an Held `hi` (Brettseite `seite`)? Die Karte, die umgehaengt wird, zaehlt dabei nicht mit — Grenzen wie
 * "You can only have 1 X equipped to your Heroes" duerfen das Verschieben der einzigen Kopie nicht verbieten ("nur eine ANLEGE-Sperre").
 */
function darfAn(engine, inst, seite, hi) {
  const zone = inst.zone;
  inst.zone = '_umhaengen';
  try { return engine.canEquipCardToHero(inst.name, seite, hi, engine.ausruestOpts(inst)); }
  finally { inst.zone = zone; }
}

/**
 * Freie Basis-Zonen eines Zielhelden fuer das Umhaengen: leer UND nicht versiegelt (Madame Guillotine), dazu nicht durch eine Zonensperre (Puppets) gesperrt.
 * `wirdFrei(seite, hi, si)` = Platz, den ein ebenfalls gewaehltes Equip gleichzeitig raeumt (Tausch); `reserviert` = Set `seite:hi:si` bereits vergebener Ziele.
 */
function umhaengFreieZonen(engine, seite, hi, opts = {}) {
  const ps = engine.gs.players[seite];
  const out = [];
  // Darion: ein Equip kann nur in den Equip-Stapel des Zielhelden (Pflicht-Platz). Der Stapel nimmt MEHRERE Equips auf — dass ein anderes Equip desselben Zuges ihn schon
  // reserviert hat, schliesst ihn nicht aus. Hat der Zielheld noch keinen Stapel, aber ein Equip dieses Zuges hat schon einen Platz bei ihm reserviert, ist DAS der Stapel.
  const pflicht = opts.cardName ? engine.equipPflichtPlatz(seite, hi, opts.cardName) : -1;
  if (pflicht >= 0) return [pflicht];
  if (opts.cardName && opts.reserviert && istEquipKartenname(opts.cardName)
      && require('./_equip-stack-shared').teilenAktiv(engine, seite, hi)) {
    for (let si = 0; si < 3; si++) if (opts.reserviert.has(`${seite}:${hi}:${si}`)) return [si];
  }
  if (engine.isSupportZoneLocked?.(seite, hi, { cardName: opts.cardName, via: 'move', instId: opts.instId })) return out;
  for (let si = 0; si < 3; si++) {
    if (opts.reserviert && opts.reserviert.has(`${seite}:${hi}:${si}`)) continue;
    const roh = (((ps?.supportZones?.[hi] || [])[si]) || []).length === 0;
    const frei = roh ? !engine.supportSlotBelegt(seite, hi, si) : !!(opts.wirdFrei && opts.wirdFrei(seite, hi, si));
    if (frei) out.push(si);
  }
  return out;
}

/**
 * Legale Zielhelden fuer das Umhaengen von `inst`: ein ANDERER lebender Held DERSELBEN Brettseite, den derselbe Spieler kontrolliert wie den Quellhelden
 * („a different Hero the same player controls"), ausruestbar (`heroCanBeEquipped`: nicht eingefroren, Uebernahme erlaubt Ausruesten) und von den
 * Skript-Grenzen der Karte erlaubt (`darfAn`), mit mindestens einer freien Zone. -> [{ heroIdx, hero, freie: [slots] }]
 */
function umhaengZielHelden(engine, inst, opts = {}) {
  const seite = engine.physicalSide(inst);
  const ps = engine.gs.players[seite];
  const out = [];
  if (!ps) return out;
  const kontrolle = engine.kontrolleurVonHeld(seite, inst.heroIdx);
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (hi === inst.heroIdx) continue;
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (opts.nurKontrolleur != null && engine.kontrolleurVonHeld(seite, hi) !== opts.nurKontrolleur) continue;
    if (engine.kontrolleurVonHeld(seite, hi) !== kontrolle) continue;
    if (!heroCanBeEquipped(hero)) continue;
    if (!darfAn(engine, inst, seite, hi)) continue;
    const freie = umhaengFreieZonen(engine, seite, hi, { cardName: inst.name, instId: inst.id, wirdFrei: opts.wirdFrei, reserviert: opts.reserviert });
    if (freie.length === 0) continue;
    out.push({ heroIdx: hi, hero, freie });
  }
  return out;
}

/**
 * Das Verschieben selbst — ALLE gleichzeitig: erst alle Abgaenge (`onCardLeaveZone` nur fuer die bewegte Karte), dann alle Ankuenfte (`onCardEnterZone`,
 * `onPlay` fuer die Dauerwirkung am neuen Traeger). Nichts wird bezahlt. `plan` = [{ inst, owner (Brettseite), srcHeroIdx, srcSlot, destHeroIdx, destSlot }].
 * `anleger` = der Spieler, der den Effekt ausfuehrt: er ist „der, der ausruestet" fuer das Equip-Fenster (Afflicted Pests, Cybug LOCUST). Das Fenster
 * oeffnet fuer jede bewegte Karte; `opts.logType` = Logzeile je Karte.
 * W51b: Zustandslauscher (Taio, Toras, Aufstiegs-Bereitschaft …) sehen den Abgang ueber `onEquipLost` (je Karte direkt nach dem eigenen Leave, Karte noch am alten Platz;
 * schon gemeldete Mitbewegte stehen 'unterwegs', `zone` '_umhaengen') und die Ankunft ueber `onEquipGained` (`isMove`) — nicht ueber das rohe Enter/Leave (`_onlyCard`).
 */
async function fuehreUmhaengenAus(engine, plan, opts = {}) {
  const gs = engine.gs;
  const anleger = opts.anleger;
  // ★ Darion: alle Equips, die zu EINEM Helden mit geteilter Equip-Zone wandern, kommen in EINEN Platz — der Platz des liegenden Stapels, sonst der des ersten Equips dieses
  // Zuges bei ihm (egal, welche freien Plaetze der Aufrufer vergeben hat). Nur Equips teilen; Anhaengsel behalten ihren Platz.
  {
    const ES = require('./_equip-stack-shared');
    const gemeinsam = new Map();   // `${seite}:${held}` -> Platz des ersten Equips
    for (const m of plan) {
      if (!istEquipKartenname(m.inst.name) || !ES.teilenAktiv(engine, m.owner, m.destHeroIdx)) continue;
      const pflicht = engine.equipPflichtPlatz(m.owner, m.destHeroIdx, m.inst.name);
      const key = `${m.owner}:${m.destHeroIdx}`;
      if (pflicht >= 0) m.destSlot = pflicht;
      else if (gemeinsam.has(key)) m.destSlot = gemeinsam.get(key);
      else gemeinsam.set(key, m.destSlot);
    }
  }
  // Abgaenge. Equip-Skripte (Legendary Sword, Vampiric Sword, Hammers, Blades …) pruefen `fromOwner/fromHeroIdx/fromZoneSlot` — die volle Nutzlast ist Pflicht.
  for (const m of plan) {
    const { inst, owner: equipOwner, srcHeroIdx, srcSlot } = m;
    const ps = gs.players[equipOwner];
    await engine.runHooks('onCardLeaveZone', {
      _onlyCard: inst, card: inst, leavingCard: inst,
      fromZone: 'support', fromOwner: equipOwner, fromHeroIdx: srcHeroIdx, fromZoneSlot: srcSlot,
      toZone: 'support',   // reiner Zonenwechsel auf dem Brett (ohne `toZone` deuten Ablage-Zuhoerer es als Ablage, F03-07)
      _skipReactionCheck: true,
      _equipLostGemeldet: true,   // W52a: das Umhaengen meldet `onEquipLost` selbst (unten), der Verteiler in `runHooks` bleibt still
    });
    // W53a (Al: der ATK-Bonus liegt nur beim aktuellen Traeger): blieb eine gestempelte Buchung stehen (der Leave-Haken der Karte hat nicht abgezogen), wird sie jetzt am Stempel-Traeger
    // abgezogen. Dauerhafte Zuwaechse ohne Stempel (Cloak of Edge) bleiben am Helden; die Karte startet am neuen Traeger frisch.
    if (inst.counters._atkTraeger) engine.actionRevokeAtkAmTraeger(inst);
    if (inst.counters.atkGranted) inst.counters.atkGranted = 0;   // Neu-Vergabe am neuen Traeger startet frisch
    // W51b: der Abgang fuer ZUSTANDSLAUSCHER (Taio, Toras, Aufstiegs-Bereitschaft …): das echte Leave oben geht nur an die Karte selbst. `onEquipLost` geht an alle
    // (siehe `engine.fireEquipLost`); die Karte steht dabei noch am alten Platz (Leave-Semantik, Lauscher schliessen ihre Id beim Zaehlen aus).
    await engine.fireEquipLost(inst, {
      anleger, fromOwner: equipOwner, fromHeroIdx: srcHeroIdx, fromZoneSlot: srcSlot,
      toOwner: equipOwner, toHeroIdx: m.destHeroIdx, toZoneSlot: m.destSlot, source: opts.quelle || null,
      isMove: true, reason: 'moved',   // W52a
    });
    const srcArr = (ps.supportZones[srcHeroIdx] || [])[srcSlot] || [];
    engine.entferneNameAmPlatz(srcArr, inst);   // Darion: bei gleichnamigen Karten im Stapel der richtige Eintrag
    // Ab hier „unterwegs": bei mehreren gleichzeitig bewegten Karten sehen die Lauscher der NAECHSTEN Meldung die schon gemeldeten nicht mehr am alten Wirt
    // (wie nacheinander ausgefuehrte echte Abgaenge). Die Ankunft unten setzt `zone` wieder auf 'support' (Konvention '_umhaengen' wie bei `darfAn`).
    inst.zone = '_umhaengen';
  }
  // Fluege (alle zugleich gestartet).
  for (const m of plan) {
    engine._broadcastEvent('play_card_transfer', {
      sourceOwner: m.owner, sourceHeroIdx: m.srcHeroIdx, sourceZoneSlot: m.srcSlot,
      targetOwner: m.owner, targetHeroIdx: m.destHeroIdx, targetZoneSlot: m.destSlot,
      cardName: m.inst.name, duration: 600, particles: null,
    });
  }
  engine.sync();
  await engine._delay(500);
  // Ankuenfte: in die Zielzonen legen.
  for (const m of plan) {
    const { inst, owner: equipOwner, destHeroIdx, destSlot } = m;
    const ps = gs.players[equipOwner];
    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    if (!ps.supportZones[destHeroIdx][destSlot]) ps.supportZones[destHeroIdx][destSlot] = [];
    ps.supportZones[destHeroIdx][destSlot].push(inst.name);
    engine._stempleStapelNr(inst);   // Darion: oben auf dem Stapel
    inst.zone = 'support';
    inst.heroIdx = destHeroIdx;
    inst.zoneSlot = destSlot;
  }
  engine.sync();
  for (const m of plan) {
    const { inst, owner: equipOwner, srcHeroIdx, destHeroIdx, destSlot } = m;
    const ps = gs.players[equipOwner];
    // Eintritt nur fuer die bewegte Karte; `_equipAnleger` = wer ausruestet (Equip-Fenster), `_isMove`: kein frisches Spielen/Beschwoeren.
    await engine.runHooks('onCardEnterZone', {
      _onlyCard: inst, enteringCard: inst,
      toZone: 'support', toHeroIdx: destHeroIdx,
      _isMove: true, _equipAnleger: anleger, _fromOwner: equipOwner, _fromHeroIdx: srcHeroIdx, _equipQuelle: opts.quelle || null,   // W51a: Fenster `onEquipGained` (siehe `engine.fireEquipGained`)
    });
    // Dauerwirkung am neuen Traeger (ATK-Boni, Inselzonen …); `_isMove` laesst Einmal-Wirkungen beim Anlegen aus (Summoning Instructions).
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst,
      cardName: inst.name, zone: 'support',
      heroIdx: destHeroIdx, zoneSlot: destSlot,
      _isMove: true,
    });
    if (opts.logType) {
      engine.log(opts.logType, {
        card: inst.name,
        fromHero: ps.heroes[srcHeroIdx]?.name || '?',
        toHero: ps.heroes[destHeroIdx]?.name || '?',
        player: ps.username,
      });
    }
  }
  engine.sync();
}

module.exports = {
  freieBasisZonen,
  istEquipKartenname,
  istUmhaengbaresEquip,
  darfAn,
  umhaengFreieZonen,
  umhaengZielHelden,
  fuehreUmhaengenAus,
  istAusruestTraeger,
  ausruestTraeger,
  ausruestTraegerMitSeite,
  waehleAusruestPlatz,
  ruesteAusStapelAus,
};
