'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Treasure Theft"
//  Spell (Normal, Decay Magic Lv0), PP SOB
//
//  „Choose an Artifact equipped to a Hero your opponent controls and equip it to the user. If the user has at least Decay Magic 1, this counts as an additional Action."
//
//  ── ZIELE: AUSRÜSTUNG EINES GEGNERISCHEN HELDEN, DIE DER NUTZER TRAGEN KANN ─
//  • „Artifact equipped": Artefakt-Karte (Kartentyp Artifact), die in einer Support Zone als Ausrüstung liegt (`isEquipInZone`, Untertyp Equipment) — verdeckte Karten, Tokens, als Equip
//    angelegte Helden (Initiation Ritual), Tempelunas Fee, festgesetzte (`immovable`) Karten und Cardinal Beasts sind keine Ziele (derselbe Baustein wie Slippery Fridge / Disarm).
//  • „a Hero your opponent controls": der KONTROLLEUR des Trägers entscheidet (`kontrolleurVonHeld`) — auch ein vom Gegner übernommener eigener Held zählt, ein von mir übernommener
//    Gegnerheld nicht.
//  • „equip it to the user" — der Nutzer = der wirkende Held. Nur Ausrüstung, die er TRAGEN kann, ist ein legales Ziel: freie Basis-Support-Zone (versiegelte und gesperrte Zonen zählen nicht
//    frei), Held ausrüstbar (nicht eingefroren …), die kartenseitigen Grenzen (`canEquipToHero`: Crusader's-Artefakte nur an Cecilia, Idej-Artefakte, „höchstens eins je Held",
//    Race Boats …) über `darfAn`. Was der Nutzer nicht tragen kann, steht nicht zur Wahl; hat er keine freie Support Zone oder gibt es kein tragbares Ziel, kann dieser Held die Karte
//    nicht wirken (`canPlayWithHero`, die Karte ist für ihn grau; `spellPlayCondition` verlangt mindestens einen solchen Helden). Alles andere steht AUSGEGRAUT in der Zielliste
//    (`ausgegrauteRestkarten`).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Zielwahl (`promptEffectTarget`, abbrechbar — dann bleibt die Karte auf der Hand). Schutz vor Auswahl und die Fenster der Zielwahl macht der Zielwähler selbst.
//  2. Zone des Nutzers: eine freie Zone → ohne Frage; sonst Wahl (Zone oder Held anklicken; Pflichtwahl, nicht abbrechbar).
//  3. Umhängen über `engine.actionTransferAttachment` (Abgang beim alten Träger — Boni gehen zurück —, Flug, Ankunft beim Nutzer, Dauerwirkung neu, `onEquipLost`/`onEquipGained`,
//     Equip-Fenster der Surprises mit dem NUTZER als Ausrüstendem). „Equip it" heißt hier UMHÄNGEN: es wird nichts bezahlt (Kosten wie bei Slippery Fridge nicht erneut), Einmal-Wirkungen
//     beim Anlegen feuern nicht neu (`_isMove`). Die Karte gehört weiter ihrem Besitzer (`originalOwner`): wird sie später abgelegt/gelöscht, landet sie in DESSEN Ablage bzw. Deleted Pile.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „If the user has at least Decay Magic 1, this counts as an additional Action" → `inherentAction` als FUNKTION, je Held (`effectiveSchoolLevelForCaster`). Die Karte selbst ist Stufe 0:
//  ein Held ohne Decay Magic kann sie wirken, bekommt aber keine Zusatzaktion (sie kostet dann die Aktion; in der Main Phase ist sie für ihn nur mit Decay Magic 1 spielbar).
//
//  ── ANNAHMEN ────────────────────────────────────────────────────────────
//  „Your opponent" = jeder Gegner (`engine.opponentsOf(pi)`; im 1-gegen-1 der Gegner). Boris sperrt die Karte nicht (es wird eine Ausrüstung umgehängt, keine Kontrolle über ein Ziel
//  übernommen). Erste-Runden-Schutz des Gegners: unspielbar (`blockedByFirstTurnProtection`).
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU nimmt die Ausrüstung mit den höchsten Kosten; bei der Zonenwahl die erste freie.
// ═══════════════════════════════════════════

const { hasCardType, heroCanBeEquipped } = require('./_hooks');
const { istUmhaengbaresEquip, darfAn, umhaengFreieZonen } = require('./_equip-shared');
const { ausgegrauteRestkarten } = require('./_target-dim-shared');

const CARD_NAME = 'Treasure Theft';
const SCHULE = 'Decay Magic';

/** Ist `inst` ein legales Ziel für den Nutzer (Brettseite `hs`, Held `hi`) von `pi`? */
function istZiel(engine, pi, inst, hs, hi) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if (inst.counters?._cardinalImmune || inst.counters?.treatAsEquip) return false;
  if (!istUmhaengbaresEquip(engine, inst)) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || !hasCardType(cd, 'Artifact')) return false;
  if (!engine.isEquipInZone(inst.name, inst)) return false;
  const seite = engine.physicalSide(inst);
  const traeger = engine.gs.players[seite]?.heroes?.[inst.heroIdx];
  if (!traeger?.name || traeger.hp <= 0) return false;
  if (!engine.opponentsOf(pi).includes(engine.kontrolleurVonHeld(seite, inst.heroIdx))) return false;   // „a Hero your opponent controls"
  // Der Nutzer muss sie tragen können.
  const nutzer = engine.gs.players[hs]?.heroes?.[hi];
  if (!nutzer?.name || nutzer.hp <= 0 || !heroCanBeEquipped(nutzer)) return false;
  if (seite === hs && inst.heroIdx === hi) return false;
  if (umhaengFreieZonen(engine, hs, hi, { cardName: inst.name, instId: inst.id }).length === 0) return false;
  return darfAn(engine, inst, hs, hi);
}

function zielInstanzen(engine, pi, hs, hi) {
  return engine.cardInstances.filter(c => istZiel(engine, pi, c, hs, hi));
}

function zielObjekt(engine, inst) {
  const seite = engine.physicalSide(inst);
  return {
    id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
    owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name,
    cardInstance: inst, _cardInstance: inst,
  };
}

/** Kann dieser Held die Karte jetzt wirken? (freie Zone + mindestens eine tragbare gegnerische Ausrüstung) */
function heldTauglich(engine, pi, heroIdx) {
  const hs = engine.heldSeiteFuer(pi, heroIdx);
  return zielInstanzen(engine, pi, hs, heroIdx).length > 0;
}

/** Grober Wert einer Ausrüstung für die CPU (Kosten). */
function ausruestungWert(engine, t) {
  const cd = (t.cardInstance ? engine.getEffectiveCardData(t.cardInstance) : null) || engine._getCardDB()[t.cardName] || {};
  return (cd.cost || 0);
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  blockedByFirstTurnProtection: true,      // trifft nur die Gegnerseite

  // „If the user has at least Decay Magic 1, this counts as an additional Action" — je Held.
  inherentAction(gs, pi, heroIdx, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    let lvl = 0;
    try { lvl = eng.effectiveSchoolLevelForCaster(SCHULE, pi, heroIdx) || 0; } catch { lvl = 0; }
    return lvl >= 1;
  },

  /** Grau, solange keiner meiner Helden eine tragbare gegnerische Ausrüstung nehmen könnte. */
  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    const heroes = gs.players[pi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) if (heldTauglich(eng, pi, hi)) return true;
    return false;
  },

  /** Je Nutzer: freie Support Zone und eine Ausrüstung, die er tragen kann. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    return heldTauglich(eng, pi, heroIdx);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hs = ctx.cardHeroOwner ?? pi;            // Brettseite des Nutzers (übernommener Held: beim Gegner)
      const ps = gs.players[pi];
      const nutzer = ctx.attachedHero || gs.players[hs]?.heroes?.[heroIdx];
      if (!ps || !nutzer?.name || nutzer.hp <= 0) { gs._spellCancelled = true; return; }

      let insts = zielInstanzen(engine, pi, hs, heroIdx);
      if (insts.length === 0) { gs._spellCancelled = true; return; }

      // ── 1. Zielwahl ──
      const echte = require('./_equip-stack-shared').gruppiereZiele(insts.map(i => zielObjekt(engine, i)));   // Darion: ein Ziel je Stapelplatz, die Rueckfrage nennt nur die zulaessigen Karten
      const gewaehlt = await engine.promptEffectTarget(pi, [...echte, ...ausgegrauteRestkarten(engine, echte)], {
        title: CARD_NAME, source: CARD_NAME,
        description: `Choose an Artifact equipped to a Hero your opponent controls. ${nutzer.name} equips it.`,
        confirmLabel: '🪙 Steal!', confirmClass: 'btn-danger',
        maxTotal: 1, exclusiveTypes: true, maxPerType: { equip: 1 },
        cancellable: true,
      });
      const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
      // Nach der Abfrage neu einsammeln — das Brett kann sich bewegt haben (Reaktionsfenster der Zielwahl).
      insts = zielInstanzen(engine, pi, hs, heroIdx);
      const gewaehltesZiel = id && insts.map(i => zielObjekt(engine, i)).find(z => z.id === id);
      const inst = gewaehltesZiel ? engine.stapelWahlFuer(gewaehltesZiel) : null;   // Darion: die gewaehlte Karte des Stapels, nicht die erste mit dieser ID
      if (!inst) {
        // Von einer Reaktion in der Zielwahl negiert: der Zauber ist gespielt und verbraucht. Sonst echter Abbruch → die Karte bleibt auf der Hand.
        if (id || gs._spellNegatedByEffect || gs._zielNegiertDurchSchutz) { delete gs._zielNegiertDurchSchutz; engine.sync(); return; }
        gs._spellCancelled = true;
        return;
      }
      delete gs._zielNegiertDurchSchutz;
      const name = inst.name;
      const vonSeite = engine.physicalSide(inst);
      const vonHeld = gs.players[vonSeite]?.heroes?.[inst.heroIdx];

      // ── 2. Zone des Nutzers ──
      const frei = umhaengFreieZonen(engine, hs, heroIdx, { cardName: name, instId: inst.id });
      if (frei.length === 0) { engine.log('treasure_theft_fizzle', { player: ps.username }); engine.sync(); return; }
      let slot = frei[0];
      if (frei.length > 1) {
        const zonen = frei.map(si => ({ id: `equip-${hs}-${heroIdx}-${si}`, type: 'equip', owner: hs, heroIdx, slotIdx: si, cardName: '' }));
        zonen.push({ id: `hero-${hs}-${heroIdx}`, type: 'hero', owner: hs, heroIdx, cardName: nutzer.name });
        const zid = await engine.promptEffectTarget(pi, zonen, {
          maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
          title: `${CARD_NAME} — Equip ${name}`,
          description: `Select a Support Zone to equip ${name} to.`,
          confirmLabel: '🪙 Equip!',
          confirmClass: 'btn-info',
          cancellable: false,   // pflichtwahl: der Artifact ist schon gewählt — nur noch der Platz beim Nutzer, die erste freie Zone gilt bei Zeitablauf
          greenSelect: true,
          exclusiveTypes: false,
          maxPerType: { hero: 1, equip: 1 },
        });
        const z = Array.isArray(zid) ? zid[0] : zid;
        const treffer = z && zonen.find(t => t.id === z);
        if (treffer?.type === 'equip') slot = treffer.slotIdx;
      }

      // ── 3. Umhängen ──
      const noch = engine.cardInstances.find(c => c.id === inst.id && c.zone === 'support');
      if (!noch || !istZiel(engine, pi, noch, hs, heroIdx)) {
        engine.log('treasure_theft_fizzle', { player: ps.username });
        engine.sync();
        return;
      }
      const freiJetzt = umhaengFreieZonen(engine, hs, heroIdx, { cardName: name, instId: inst.id });
      if (!freiJetzt.includes(slot)) slot = freiJetzt[0];
      const ergebnis = await engine.actionTransferAttachment(noch, hs, heroIdx, slot, { sourceName: CARD_NAME, anleger: pi });
      engine.log(ergebnis?.success ? 'treasure_theft' : 'treasure_theft_blocked', {
        player: ps.username, card: name, fromHero: vonHeld?.name || '?', toHero: nutzer.name,
        opponent: gs.players[engine.kontrolleurVonHeld(vonSeite, inst.heroIdx)]?.username || null,
      });
      engine.sync();
    },
  },

  /** CPU: die teuerste Ausrüstung; bei der Zonenwahl die erste freie. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = promptData || {};
    const titel = config?.title || '';
    if ((titel !== CARD_NAME && !titel.startsWith(`${CARD_NAME} — `)) || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    if (titel !== CARD_NAME) return [frei[0].id];
    let best = frei[0], bestV = -Infinity;
    for (const t of frei) { const v = ausruestungWert(engine, t); if (v > bestV) { bestV = v; best = t; } }
    return [best.id];
  },
};
