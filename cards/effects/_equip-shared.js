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

const { heroCanBeEquipped } = require('./_hooks');

/**
 * Freie Basis-Support-Zonen (0–2) dieses Helden.
 * ★★ v1349: mit `engine` + `pi` zaehlen versiegelte Plaetze (Madame
 * Guillotine) als belegt — `engine.supportSlotBelegt` ist die EINE Frage.
 */
function freieBasisZonen(ps, heroIdx, engine = null, pi = null) {
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
function istAusruestTraeger(engine, pi, heroIdx, cardName, seite = pi) {
  const ps = engine.gs.players[seite];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (seite !== pi) {
    if (!engine.darfFremdAusruesten?.(pi, seite, heroIdx)) return false;
  } else {
    if (!heroCanBeEquipped(hero)) return false;
    if (engine.heroSideOf && engine.heroSideOf(pi, hero) !== pi) return false;
  }
  if (freieBasisZonen(ps, heroIdx, engine, seite).length === 0) return false;
  return engine.canEquipCardToHero(cardName, seite, heroIdx);
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
function ausruestTraegerMitSeite(engine, pi, cardName) {
  const out = ausruestTraeger(engine, pi, cardName).map(hi => ({ seite: pi, heroIdx: hi }));
  for (const { physOwner, heroIdx } of (engine.fremdAusruestHelden?.(pi) || [])) {
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
    : ausruestTraegerMitSeite(engine, pi, cardName))
    .filter(h => !cfg.nurHelden || cfg.nurHelden.includes(h.heroIdx));
  if (helden.length === 0) return null;

  const ziele = [];
  for (const { seite, heroIdx: hi } of helden) {
    const sps = engine.gs.players[seite];
    for (const si of freieBasisZonen(sps, hi, engine, seite)) {
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
  const slot = ziel.type === 'equip' ? ziel.slotIdx : freieBasisZonen(engine.gs.players[ziel.owner], ziel.heroIdx, engine, ziel.owner)[0];
  if (slot == null) return null;
  return { heroIdx: ziel.heroIdx, slot, seite: ziel.owner };
}

/**
 * `cardName` aus `stapel` ('deck' | 'discard' | 'deleted') nehmen und in
 * die freie Zone `slot` von Held `heroIdx` legen. Liefert die neue
 * Instanz oder `null`, wenn nichts geschah (Zone inzwischen belegt,
 * Traeger nicht mehr legal, Karte weg, Stapel gesperrt).
 *
 * opts: `source` (Kartenname fuer Log/Sperren), `flug` (Standard an),
 *       `flugMs` (Wartezeit bis zur Landung, Standard 520 wie Riffel).
 */
async function ruesteAusStapelAus(engine, pi, stapel, cardName, heroIdx, slot, opts = {}) {
  const ps = engine.gs.players[pi];
  if (!ps) return null;
  // Als Vorgabe 29.9.: `opts.seite` = Brettseite eines uebernommenen Helden.
  // Die Karte liegt dort, gehoert aber `pi` (`originalOwner`).
  const seite = (opts.seite === 0 || opts.seite === 1) ? opts.seite : pi;
  const zps = engine.gs.players[seite];
  if (!istAusruestTraeger(engine, pi, heroIdx, cardName, seite)) return null;
  if (((zps.supportZones[heroIdx] || [])[slot] || []).length > 0) return null;

  const genommen = await engine.takeFromPile(ps, stapel, cardName, { source: opts.source });
  if (!genommen) return null;

  if (!zps.supportZones[heroIdx]) zps.supportZones[heroIdx] = [[], [], []];
  zps.supportZones[heroIdx][slot] = [cardName];
  const inst = engine._trackCard(cardName, seite, 'support', heroIdx, slot);
  if (seite !== pi) inst.originalOwner = pi;

  const flug = opts.flug !== false;
  if (flug) {
    // Sichtbarer Weg Stapel → Zone (Als Regel: jede Bewegung zwischen
    // Stapeln wird animiert). Der Client versteckt das Ziel waehrend
    // des Flugs.
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, toOwner: seite, cardName,
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
  });
  engine.sync();
  return inst;
}

module.exports = {
  freieBasisZonen,
  istAusruestTraeger,
  ausruestTraeger,
  ausruestTraegerMitSeite,
  waehleAusruestPlatz,
  ruesteAusStapelAus,
};
