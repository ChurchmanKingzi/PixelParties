'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Secret Spell Book"
//  Artifact (Normal, Kosten 2)
//
//  „Take permanent control of all cards on the board that are originally owned by you. You may place any Creatures, Spells and Artifacts affected by this effect
//   into the Support Zones of any Heroes you control. If you activate this card while your opponent controls no cards originally owned by you, draw 1 card instead."
//
//  ── VORGABE 11.10. ──────────────────────────────────────────────────────
//  Kosten jetzt 2 (vorher 3), Datenänderung in `data/cards.json`, dazu der Ziehsatz. Wichtig: „Spell Book zählt JEDE Art Karte. Ist z. B. ein Equipment in einer
//  gegnerischen Support Zone, kann auch dieses von Spell Book geholt werden! Die Ziel-Heroes müssen eligible sein (Frozen Heroes können keine Equips erhalten, tote
//  Heroes weder Equips noch Attachments, und manche Karten haben besondere Restriktionen)."
//
//  ── WELCHE KARTEN? („originally owned by you" / „controls") ──────────────
//  „Betroffen" ist jede Karte auf dem Brett, die ursprünglich MIR gehört (`originalOwner ?? owner === pi`, das Feld, das jede Übernahme unverändert lässt — dieselbe
//  Messlatte wie Liberation, Memory Blast) und die jemand ANDERES kontrolliert (`controller ?? owner !== pi`; das gilt auch für eine nur vorübergehend gestohlene Karte,
//  `stolenBy`). Karten, die ich schon kontrolliere — auch eine eigene Kreatur auf der Gegenseite, die ich über einen geliehenen Helden beschworen habe —, sind nicht betroffen.
//  Erfasst werden alle Karten in Support Zones (Kreaturen aller Arten, Ausrüstung, Anhängsel/Spells, sonstige Artefakte), Areas und **HELDEN** (Korrektur 11.10.: „Heroes
//  sollten inbegriffen sein! Es gibt (Paraseed Control) Wege, Heroes permanent zu stehlen"). Nicht erfasst (gibt es dort nicht): Ability- und Surprise-Zonen-Karten. Karten, deren
//  Kontrolle sich nicht ändern lässt (Cardinal Beasts, „Control of this Creature cannot change", Omni-Immunität), sind keine Betroffenen.
//  „Your opponent controls no cards …" = es gibt keine Betroffenen (Karten ODER Helden).
//
//  ── HELDEN ──────────────────────────────────────────────────────────────
//  Ein Held steht immer in der Spalte seines urspruenglichen Besitzers — „originally owned by you" = er steht in MEINER Spalte. Betroffen ist er, wenn ihn jemand anderes kontrolliert:
//  dauerhaft (`permaControlBy`, Paraseed Control), durch Charme-Marken (`charmedBy`, Charme 3, Golden Apple, Little Lyta, Styx) oder durch `controlledBy` (FTCD, Controlled Attack) — auch ein
//  KO-Held. Die Kontrolle geht dauerhaft zurück: `engine.actionReturnHeroControl` löscht ALLE Kontrollmarken samt Support-Zonen-Sperre; der Held ist danach ein gewöhnlicher eigener Held
//  (kein Umsetzen, keine Platzfrage). Helden werden ZUERST zurückgeholt, damit sie bei den Platzfragen der Karten schon als „Helden, die du kontrollierst" zählen. Ein Held, den ICH
//  kontrolliere (auch in der Gegnerspalte), ist nicht betroffen.
//
//  ── ÜBERNAHME UND PLATZ ─────────────────────────────────────────────────
//  Kontrollwechsel auf die EIGENE Seite ist immer Pflicht („take permanent control of all"); das Umsetzen ist optional („you may place"):
//    • Kreatur (Creature-Typ): Zielzonen = alle FREIEN Support Zones aller Helden, die ich kontrolliere (auch Insel-Zonen, auch KO-Helden — wie Liberation/Dark Gear).
//      Umsetzen über `actionTransferCreature` (Tor-Schutz, Kontrollwechsel, Flug, Hooks, Seitenwechsel auf die Brettseite des Helden, `controller` = ich).
//    • Ausrüstung (Artifact, in der Zone als Equip gezählt): nur eigene Helden, die `heroCanBeEquipped` (LEBEND und NICHT Frozen, kein gesperrter Charme-Held), mit freier
//      Basis-Zone und erfüllter Kartenbeschränkung `canEquipToHero` (Crusader's-Familie: nur Cecilia, …) — `istAusruestTraeger`, derselbe Weg wie beim Spielen aus der Hand.
//    • Anhängsel/Spell/sonstige Support-Karte: nur LEBENDE eigene Helden (Frozen ist erlaubt) mit freier Basis-Zone und erfüllter Kartenbeschränkung.
//      Ausrüstung und Anhängsel wandern über `actionTransferAttachment` (Leave-/Enter-Hooks, Bonus vom alten Träger weg, Wirkung auf den neuen).
//    • Ein Platz wird je Karte abgefragt (`zonePick`); Abbruch = die Karte BLEIBT liegen, wird aber kontrolliert (`markiereSeitenfremd`: sie steht weiter bei ihrem alten
//      Träger, handelt aber für mich — wie eine über einen geliehenen Helden beschworene Kreatur). Gibt es keinen tauglichen Platz, entfällt die Frage.
//    • Karten, die schon auf MEINER Seite liegen (vorübergehend gestohlen: `stolenBy`), bekommen die Kontrolle dauerhaft zurück, ohne Platzfrage.
//    • Areas: wandern in meine Area Zone, wenn dort Platz ist (`areaLimitFor`); sonst bleiben sie liegen.
//
//  ── ERSATZEFFEKT ────────────────────────────────────────────────────────
//  Gibt es beim Aktivieren keine betroffene Karte, zieht der Spieler 1 Karte (`actionDrawCards`) — statt der Übernahme.
//
//  ── Boris-Sperre ────────────────────────────────────────────────────────
//  „Your opponent cannot activate effects that would take control of any targets you control": mit betroffenen Karten sperrt ein wirksamer Boris des Gegners die Karte
//  (`canActivate`, `resolve`). Ohne betroffene Karten bleibt sie spielbar (Ersatzeffekt: Ziehen) — darum NICHT die Skript-Flagge `takesControlOfTargets`, die die Karte
//  in `validateActionPlay` immer sperren würde, sondern dieselbe Prüfung (`isBorisBlocked`) mit einem Flaggen-Objekt, nur bei Bedarf.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `spellbook_pages` (Pixelart, ANIM_REGISTRY, Brett-Animation): von jeder betroffenen Karte flattern Buchseiten (weisse Blätter mit Zeilen, violett-goldene
//  Funken) zum Wirker; ohne Betroffene blättert sich über dem Deck ein Buch auf (Ziehen). Klänge in ZONE_ANIM_SFX; Log `secret_spell_book`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { istAusruestTraeger, freieBasisZonen } = require('./_equip-shared');

const CARD_NAME = 'Secret Spell Book';
const SEITEN_MS = 1100;          // Länge der Animation (deckt sich mit `spellbook_pages` im Client)
const FLUG_MS = 560;             // bis die ersten Seiten angekommen sind (+ 100 ms Einbau-Versatz des Clients)

/** Sperrt ein wirksamer Boris des Gegners die Übernahme? („cannot activate effects that would take control of any targets you control") */
function borisSperrt(engine, pi) {
  return engine.isBorisBlocked({ takesControlOfTargets: true }, pi);
}

/** Art der Karte für die Platzregeln. */
function artVon(engine, inst) {
  if (inst.zone === 'area') return 'area';
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (cd && hasCardType(cd, 'Creature')) return 'creature';
  if (engine.isEquipInZone(inst.name, inst) && cd && hasCardType(cd, 'Artifact')) return 'equip';
  return 'attach';
}

/** Ist `inst` von der Übernahme betroffen? */
function istBetroffen(engine, pi, inst) {
  if (!inst || (inst.zone !== 'support' && inst.zone !== 'area')) return false;
  if ((inst.originalOwner ?? inst.owner) !== pi) return false;
  if ((inst.controller ?? inst.owner) === pi) return false;
  if (engine.isOmniImmune(inst) || engine.controlIsLocked(inst)) return false;
  return true;
}

/** Helden in MEINER Spalte, die jemand anderes kontrolliert (dauerhaft, Charme-Marken oder `controlledBy`) — auch KO-Helden. */
function betroffeneHelden(engine, pi) {
  const out = [];
  const heroes = engine.gs.players[pi]?.heroes || [];
  for (let hi = 0; hi < heroes.length; hi++) {
    const hero = heroes[hi];
    if (!hero?.name) continue;
    const fremd = engine.heroSideOf(pi, hero) !== pi || (hero.controlledBy != null && hero.controlledBy !== pi);
    if (fremd) out.push({ heroIdx: hi, hero });
  }
  return out;
}

/** Alle betroffenen Karten, in fester Reihenfolge (Brettseite, Held, Zone). */
function betroffene(engine, pi) {
  const out = (engine.cardInstances || []).filter(i => istBetroffen(engine, pi, i));
  out.sort((a, b) => (engine.physicalSide(a) - engine.physicalSide(b)) || (a.heroIdx - b.heroIdx) || (a.zoneSlot - b.zoneSlot));
  return out;
}

/** Freie Zonen für Kreaturen: alle Helden, die `pi` kontrolliert (inkl. geliehener, KO-Helden, Insel-Zonen). */
function zonenFuerKreatur(engine, pi, inst) {
  const gs = engine.gs;
  const out = [];
  for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(pi)) {
    const slots = gs.players[physOwner]?.supportZones?.[heroIdx] || [];
    const anzahl = Math.max(3, slots.length);
    if (engine.isSupportZoneLocked(physOwner, heroIdx, { cardName: inst.name, via: 'move' })) continue;
    for (let si = 0; si < anzahl; si++) {
      if (engine.supportSlotBelegt(physOwner, heroIdx, si)) continue;
      out.push({ owner: physOwner, heroIdx, slotIdx: si, label: `${hero.hp <= 0 ? hero.name + ' (KO)' : hero.name} — ${si >= 3 ? 'Island ' + (si - 2) : 'Slot ' + (si + 1)}` });
    }
  }
  return out;
}

/** Freie Basis-Zonen für Ausrüstung bzw. Anhängsel: nur eigene Helden der eigenen Seite, mit den Regeln der Kartenart. */
function zonenFuerAnhang(engine, pi, inst, art) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;                                  // tote Helden: weder Equips noch Attachments
    if (engine.heroSideOf(pi, hero) !== pi) continue;                           // abgegebene Helden zählen nicht
    if (art === 'equip') {
      if (!istAusruestTraeger(engine, pi, hi, inst.name, pi, engine.ausruestOpts(inst).kartenBesitzer ?? pi)) continue;             // lebend, nicht Frozen, Basis-Zone frei, Kartenbeschränkung (W14b Q153: Besitzer der liegenden Karte)
    } else if (!engine.canEquipCardToHero(inst.name, pi, hi, engine.ausruestOpts(inst))) continue;         // Kartenbeschränkung gilt auch für Anhängsel
    if (engine.isSupportZoneLocked(pi, hi, { cardName: inst.name, via: 'move' })) continue;
    for (const si of freieBasisZonen(ps, hi, engine, pi)) {
      out.push({ owner: pi, heroIdx: hi, slotIdx: si, label: `${hero.name} — Slot ${si + 1}` });
    }
  }
  return out;
}

function zonenFuer(engine, pi, inst, art) {
  return art === 'creature' ? zonenFuerKreatur(engine, pi, inst) : zonenFuerAnhang(engine, pi, inst, art);
}

/** Kontrolle OHNE Umsetzen: die Karte bleibt liegen, handelt aber für `pi`. */
function kontrolleInPlace(engine, pi, inst) {
  if (inst.stolenBy != null) { delete inst.stolenBy; delete inst.stolenFromOwner; }       // vorübergehender Diebstahl wird dauerhaft
  if (inst.owner === pi) { inst.controller = pi; return; }                                // liegt schon bei mir
  engine.markiereSeitenfremd(inst, pi);
}

/** Ein Platz je Karte wählen; `null` = liegen lassen. */
async function waehlePlatz(engine, pi, inst, zonen) {
  if (zonen.length === 0) return null;
  const res = await engine.promptGeneric(pi, {
    type: 'zonePick', zones: zonen, title: CARD_NAME, heroShortcut: false,
    description: `Place ${inst.name} into a free Support Zone of a Hero you control — or leave it where it is (you keep control).`,
    previewCardName: inst.name, cancellable: true,
  });
  if (!res || res.cancelled || typeof res.heroIdx !== 'number') return null;
  return zonen.find(z => z.heroIdx === res.heroIdx && z.slotIdx === res.slotIdx && (res.owner == null || z.owner === res.owner)) || null;
}

/** Eine betroffene Karte übernehmen (und ggf. umsetzen). */
async function uebernimm(engine, pi, inst, ergebnis) {
  const name = inst.name;
  if (!istBetroffen(engine, pi, inst)) return;                                  // während der Abfragen kann sich das Brett geändert haben
  if (inst.zone === 'area') {
    if (!engine.gs.areaZones) engine.gs.areaZones = [];
    if (!engine.gs.areaZones[pi]) engine.gs.areaZones[pi] = [];
    const meine = engine.gs.areaZones[pi];
    if (meine.length < engine.areaLimitFor(pi)) {
      const von = inst.owner;
      const arr = engine.gs.areaZones?.[von] || [];
      const i = arr.indexOf(name);
      if (i >= 0) arr.splice(i, 1);
      inst.owner = pi; inst.controller = pi;
      engine.gs.areaZones[pi].push(name);
      engine.log('area_taken', { player: engine.gs.players[pi]?.username, area: name, from: engine.gs.players[von]?.username, by: CARD_NAME });
      ergebnis.uebernommen.push(name);
      engine.sync();
    }
    return;
  }
  const art = artVon(engine, inst);
  const auswahl = inst.owner === pi ? null : await waehlePlatz(engine, pi, inst, zonenFuer(engine, pi, inst, art));
  if (!istBetroffen(engine, pi, inst)) return;
  if (auswahl) {
    let ok = false;
    // frisch prüfen: zwischen Abfrage und Umzug kann der Platz weg sein
    if (art === 'creature') {
      if (!engine.supportSlotBelegt(auswahl.owner, auswahl.heroIdx, auswahl.slotIdx)) {
        const r = await engine.actionTransferCreature(inst, auswahl.owner, auswahl.heroIdx, auswahl.slotIdx, { sourceName: CARD_NAME, sourceOwner: pi, controller: pi });
        ok = !!r?.success;
      }
    } else if (!engine.supportSlotBelegt(auswahl.owner, auswahl.heroIdx, auswahl.slotIdx)) {
      const r = await engine.actionTransferAttachment(inst, auswahl.owner, auswahl.heroIdx, auswahl.slotIdx, { sourceName: CARD_NAME });
      ok = !!r?.success;
    }
    if (ok) { ergebnis.uebernommen.push(name); ergebnis.umgesetzt.push(name); return; }
  }
  kontrolleInPlace(engine, pi, inst);
  engine.log('control_in_place', { player: engine.gs.players[pi]?.username, card: name, by: CARD_NAME });
  ergebnis.uebernommen.push(name);
}

module.exports = {
  isTargetingArtifact: false,
  // BEWUSST `false`: der Lader erkennt die Karte wegen des Ziehsatzes als „nur Hand-Zuwachs" und sperrte sie unter einer Hand-Sperre ganz. Die Übernahme ist aber der
  // Haupteffekt und geht auch dann; nur der Ersatzeffekt „draw 1" fizzelt still an der Hand-Sperre (`actionDrawCards`). Eine eigene Angabe schlägt die Erkennung.
  blockedByHandLock: false,
  // BEWUSST ohne `takesControlOfTargets: true`: die Flagge sperrt die Karte in `validateActionPlay` IMMER, wenn der Gegner einen wirksamen Boris hat — hier soll nur die
  // ÜBERNAHME gesperrt sein, der Ersatzeffekt „draw 1 card" ist keine Übernahme (siehe `boris()`).

  /** Immer spielbar (ohne Betroffene zieht sie); nur eine Boris-Sperre macht die Übernahme unmöglich. */
  canActivate(gs, pi, engine) {
    if (!engine) return true;
    if (betroffene(engine, pi).length === 0 && betroffeneHelden(engine, pi).length === 0) return true;
    return !borisSperrt(engine, pi);
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    const ziele = betroffene(engine, pi);
    const helden = betroffeneHelden(engine, pi);
    if ((ziele.length > 0 || helden.length > 0) && borisSperrt(engine, pi)) return { cancelled: true };

    // Ursprung der Animation: der erste lebende eigene Held (Artefakte haben keinen Nutzer).
    const heroIdx = (ps.heroes || []).findIndex(h => h?.name && h.hp > 0);

    // ── Ersatzeffekt: keine betroffene Karte → 1 Karte ziehen ──
    if (ziele.length === 0 && helden.length === 0) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'spellbook_pages', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: SEITEN_MS,
        targets: [{ owner: pi, deck: true }], originOwner: pi, originDeck: true,
      });
      await engine._delay(FLUG_MS);
      await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
      engine.log('secret_spell_book', { player: ps.username, taken: [], heroes: [], placed: [], drew: 1 });
      engine.sync();
      return { ok: true };
    }

    // ── Übernahme: Seiten flattern von jeder betroffenen Karte zum Wirker ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'spellbook_pages', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: SEITEN_MS,
      targets: [
        ...helden.map(h => ({ owner: pi, heroIdx: h.heroIdx, zoneSlot: -1, cardName: h.hero.name })),
        ...ziele.map(i => (i.zone === 'area'
          ? { owner: i.owner, heroIdx: -1, zoneType: 'area', cardName: i.name }
          : { owner: engine.physicalSide(i), heroIdx: i.heroIdx, zoneSlot: i.zoneSlot, cardName: i.name })),
      ],
      ...(heroIdx >= 0 ? { originOwner: pi, originHeroIdx: heroIdx, originZoneSlot: -1 } : { originOwner: pi, originDeck: true }),
    });
    await engine._delay(FLUG_MS);

    const ergebnis = { uebernommen: [], umgesetzt: [], helden: [] };
    // Helden zuerst: wer wieder mir gehört, zählt bei den Platzfragen der Karten als „Held, den ich kontrolliere".
    for (const h of helden) {
      if (await engine.actionReturnHeroControl(pi, h.heroIdx, { sourceName: CARD_NAME })) ergebnis.helden.push(h.hero.name);
    }
    for (const inst of ziele) await uebernimm(engine, pi, inst, ergebnis);
    engine.log('secret_spell_book', { player: ps.username, taken: ergebnis.uebernommen, heroes: ergebnis.helden, placed: ergebnis.umgesetzt, drew: 0 });
    engine.sync();
    return { ok: true };
  },

  /** CPU: setzt jede Karte in die erste angebotene Zone (Kreaturen/Ausrüstung gehören aufs eigene Feld). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME || promptData.type !== 'zonePick') return undefined;
    const z = (promptData.zones || [])[0];
    return z ? { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
  },
};
