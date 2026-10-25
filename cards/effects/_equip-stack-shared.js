'use strict';
// ═══════════════════════════════════════════════════════════════════
//  GETEILTE EQUIP-ZONE — gemeinsamer Baustein fuer „Darion, the Blood-Crazy Groundskeeper"
//
//  „All Artifacts equipped to this Hero share 1 Support Zone."  — ALLE Equips des Helden teilen sich EINE Zone, nicht optional: ab dem zweiten Equip wird der
//  Spieler gar nicht erst nach einer Zone gefragt.
//
//  ── Modell (wie Alices Stapel) ─────────────────────────────────────
//  `ps.supportZones[heroIdx][slot] = [equipA, equipB, …]` — ein Name je Karte, dazu EINE Instanz je Equip an demselben (heroIdx, zoneSlot).
//  Anders als bei Alice haben die Namen NICHT dieselbe Zeile: der Stapel haelt verschiedene Artefakte, es gibt keine Hoechstzahl.
//  Alles, was „die" Karte eines Platzes meint (`slot[0]`), sieht also nur das unterste Equip — die zentralen Aufzaehlungen (Ziele, Aktivierung,
//  Anzeige) arbeiten deshalb je INSTANZ (`equipsAt`).
//
//  ── Wann gilt es ────────────────────────────────────────────────────
//  `teilenAktiv`: der Held lebt und sein Effekt ist nicht stummgeschaltet (Frozen/Stunned/Negated). Ein bereits liegender Stapel bleibt liegen (die Karten
//  wandern nicht auseinander), aber neue Equips nehmen den Platz nur bei aktivem Effekt. Equips auf der Zone eines ANDEREN Helden sind nicht betroffen.
//  `stapelPlatz`: der Platz des Helden, in dem schon ein Equip liegt (erster Treffer). Gibt es keinen, waehlt der Spieler die Zone wie gewohnt — das
//  erste Equip eroeffnet den Stapel.
// ═══════════════════════════════════════════════════════════════════

const { istEquipKartenname } = require('./_equip-shared');
const { hasCardType } = require('./_hooks');

/**
 * Gehoert diese Instanz zum Equip-Stapel? Wie `engine.istEquipArtifact`, aber auch ein Equipment, das zusaetzlich als Kreatur zaehlt
 * (Tempeste Moana: cardType „Artifact/Creature", Subtyp bleibt „Equipment") — es liegt weiter im Stapel und ist eines seiner Equips.
 */
function istStapelEquip(engine, inst) {
  if (engine.istEquipArtifact(inst)) return true;
  if (!inst || inst.zone !== 'support' || inst.counters?._keinEquip || inst.counters?._gainedEffectOnly) return false;
  const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name];
  return !!cd && hasCardType(cd, 'Artifact') && (cd.subtype || '').toLowerCase() === 'equipment';
}

/** Teilt dieser Held seine Equips? (Held lebt, Skript-Flag `equipsShareZone`, Effekt nicht stumm) */
function teilenAktiv(engine, seite, heroIdx) {
  const hero = engine.gs?.players?.[seite]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  let sc = null;
  try { sc = engine.heroScript(seite, heroIdx); } catch { return false; }
  if (!sc?.equipsShareZone) return false;
  try { if (engine._isHeroEffectSilenced(seite, heroIdx)) return false; } catch { /* im Zweifel aktiv */ }
  return true;
}

/** Die Equip-Instanzen auf EINEM Platz (Brettseite `seite`), in Stapelreihenfolge (unterste zuerst). */
function equipsAt(engine, seite, heroIdx, slot) {
  const out = [];
  for (const inst of engine.cardInstances || []) {
    if (inst.zone !== 'support' || inst.heroIdx !== heroIdx || inst.zoneSlot !== slot) continue;
    if (inst.faceDown) continue;
    if (engine.physicalSide(inst) !== seite) continue;
    if (!istStapelEquip(engine, inst)) continue;
    out.push(inst);
  }
  return out;
}

/** Der Platz, in dem dieser Held schon Equips liegen hat (Basis-Zonen 0–2), sonst -1. */
function stapelPlatz(engine, seite, heroIdx) {
  for (let s = 0; s < 3; s++) {
    if (equipsAt(engine, seite, heroIdx, s).length > 0) return s;
  }
  return -1;
}

/**
 * Muss `cardName` (ein Equip) bei diesem Helden in den bestehenden Stapel? → der Platz, sonst -1.
 * Gilt NUR, wenn das Teilen aktiv ist, die Karte ein Equip ist und schon ein Stapelplatz existiert.
 */
function pflichtPlatzFuer(engine, seite, heroIdx, cardName) {
  if (!cardName || !teilenAktiv(engine, seite, heroIdx)) return -1;
  if (!istEquipKartenname(cardName)) return -1;
  return stapelPlatz(engine, seite, heroIdx);
}

/** Wie viele Equips liegen im Stapel dieses Helden? */
function stapelTiefe(engine, seite, heroIdx) {
  const s = stapelPlatz(engine, seite, heroIdx);
  return s < 0 ? 0 : equipsAt(engine, seite, heroIdx, s).length;
}

/**
 * Beschreibung einer Equip-Instanz fuer die Auswahl-Abfrage (`instancePick`) und fuer das Brett (`supportStacks`): Name, Kartentyp, Preis,
 * Counter/Status — keine HP (ein Equip hat keine).
 */
function beschreibe(engine, inst) {
  const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name];
  return {
    instId: inst.id,
    name: inst.name,
    cardType: cd?.cardType || 'Artifact',
    isEquip: true,
    cost: cd?.cost ?? null,
    hp: null, maxHp: null,
    counters: { ...(inst.counters || {}) },
    statuses: { ...(inst.statuses || {}) },
    summonedThisTurn: inst.turnPlayed === engine.gs.turn,
  };
}

/** Hat dieser Held einen Equip-Stapel, der WEITERE Equips aufnimmt? (Teilen aktiv + schon ein Equip liegt) — zaehlt wie eine freie Zone. */
function hatStapelPlatz(engine, seite, heroIdx) {
  return teilenAktiv(engine, seite, heroIdx) && stapelPlatz(engine, seite, heroIdx) >= 0;
}

/**
 * Die Plaetze, in die `cardName` bei diesem Helden gelegt werden kann: der Equip-Stapel (Pflicht, wenn vorhanden), sonst die freien Basis-Zonen
 * (versiegelte zaehlen als belegt). Fuer Skripte, die ihre Zonenliste selbst bauen.
 */
function freieEquipZonen(engine, seite, heroIdx, cardName) {
  const pflicht = pflichtPlatzFuer(engine, seite, heroIdx, cardName);
  if (pflicht >= 0) return [pflicht];
  const out = [];
  for (let s = 0; s < 3; s++) if (!engine.supportSlotBelegt(seite, heroIdx, s)) out.push(s);
  return out;
}

/**
 * ★ „Any number of Artifacts" in einem Equip-Stapel (Disarm …): ein Stapel ist in der Zielwahl EIN Platz; welche seiner Karten gemeint sind, fragt dieser Baustein nach —
 * Karte fuer Karte per `instancePick` (Bild-Galerie), ab der zweiten mit dem Knopf „Done". `mindestens` Karten muessen gewaehlt werden (dann ohne Knopf).
 * Gibt die gewaehlten Instanzen in Wahlreihenfolge zurueck. Eine Antwort ohne brauchbare Karte zaehlt als „Done" (bzw. nimmt bei Pflicht die oberste).
 */
async function waehleMehrere(engine, pi, insts, { title, description, mindestens = 1, hoechstens = Infinity, doneLabel = '✓ Done' } = {}) {
  const rest = [...insts];
  const gewaehlt = [];
  while (rest.length > 0 && gewaehlt.length < hoechstens) {
    const pflicht = gewaehlt.length < mindestens;
    const antwort = await engine.promptGeneric(pi, {
      type: 'instancePick',
      title: title || 'Equipped Artifacts',
      description: description || 'These Artifacts share one Support Zone — choose which one you mean.',
      instances: rest.map(i => beschreibe(engine, i)),
      ...(pflicht ? {} : { doneLabel }),
      cancellable: false,
    });
    const inst = antwort && antwort.instId ? rest.find(i => i.id === antwort.instId) : null;
    if (!inst) {
      if (pflicht) { gewaehlt.push(rest.pop()); continue; }
      break;
    }
    gewaehlt.push(inst);
    rest.splice(rest.indexOf(inst), 1);
  }
  return gewaehlt;
}

/**
 * ★ Skripte, die ihre Zielliste JE KARTE aufbauen (eine Zeile pro Instanz, eigene Filter wie `immovable`, `darfAn`, Preis …), liefern fuer einen Equip-Stapel mehrere Ziele mit DERSELBEN ID.
 * Die Engine fragt dann bei der Wahl nach „welches Equip?" (`_disambiguateStackedTargets`) und kennt die Filter des Skripts nicht — sie bot alle Karten des Platzes an.
 * Diese Funktion fasst Ziele mit gleicher ID zu EINEM zusammen (das erste) und vermerkt die vom Skript zugelassenen Karten in `_erlaubteInstanzen`; Einzelkarten bleiben unveraendert.
 */
function gruppiereZiele(ziele) {
  const proId = new Map();
  const out = [];
  for (const z of ziele) {
    const inst = z && z.type === 'equip' ? (z.cardInstance || z._cardInstance) : null;
    if (!inst) { out.push(z); continue; }
    const g = proId.get(z.id);
    if (!g) { proId.set(z.id, { ziel: z, ids: [inst.id] }); out.push(z); }
    else g.ids.push(inst.id);
  }
  for (const g of proId.values()) if (g.ids.length > 1) g.ziel._erlaubteInstanzen = g.ids;
  return out;
}

module.exports = { gruppiereZiele, waehleMehrere, teilenAktiv, equipsAt, stapelPlatz, pflichtPlatzFuer, stapelTiefe, beschreibe, hatStapelPlatz, freieEquipZonen };
