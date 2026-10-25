'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Mine! Mine! Mine!"
//  Attack (Normal, Fighting Lv0) — Umsetzung 23.10.
//
//  „Choose an Artifact equipped to a Hero your opponent controls and add it to your hand. If the user has at least Charme 1, this counts as an additional Action and you may
//   immediately equip the Artifact to the user without paying its Cost."
//
//  ── ZIELE ───────────────────────────────────────────────────────────────
//  Ausrüstungs-Artefakte (`isEquipInZone`, Kartentyp Artifact; keine Helden-Equips, keine Token, nichts `immovable`, keine Cardinal Beasts), die an einem Helden liegen, den
//  der GEGNER KONTROLLIERT (Kontrolle, nicht Brettseite: `kontrolleurVonHeld` — ein vom Gegner übernommener Held meiner Spalte zählt, ein von mir übernommener Gegnerheld nicht).
//  Zielwahl (`promptEffectTarget`, abbrechbar — dann bleibt die Karte auf der Hand); Schutz vor Auswahl (Untargetable, Stealth, Great Wall of Deri …) macht der Zielwähler selbst, das
//  Truth-Seeing Eye des Wirkers hebt die Auswahlsperren auf. Alles Übrige steht ausgegraut in der Liste (`ausgegrauteRestkarten`). Wird die Karte in der Zielwahl negiert, ist sie
//  verbraucht. Resistance des Trägerhelden fängt das Abnehmen ab (Nicht-Schadens-Effekt auf den Helden, `heroNonDamageEffectBlocked` 'unequip'): das Artefakt bleibt liegen, die Karte ist gewirkt.
//
//  ── „ADD IT TO YOUR HAND" ───────────────────────────────────────────────
//  `_sparkfly-shared.stealBoardCardToHand`: Hand-Sperre (`handZugangGesperrt`), Omni-Immunität, Defending the Gate, `onCardLeaveZone` (ein Equip nimmt seinen Bonus vom Träger), Flug
//  Zone → Hand. Das Artefakt BLEIBT Eigentum seines permanenten Besitzers (`originalOwner`): wird es später abgeworfen/zerstört/gelöscht, geht es in dessen Stapel.
//
//  ── CHARME 1+ ───────────────────────────────────────────────────────────
//  Der Nutzer ist der Held, der die Attack spielt. Hat er Charme (Stufe ≥ 1, `heroAbilityLevel`; nicht unter Ability-Negation, `heroAbilityLevelsBlanked`):
//   • „counts as an additional Action" → `inherentAction` als FUNKTION (Vertrag „Counts as an additional Action"): wird VOR dem Spielen gelesen, also zählt der Stand beim Ausspielen
//     (`cpuMeta.optionalInherent`: ohne Charme spielbar wie jede Attack, für eine normale Aktion).
//   • „you may immediately equip the Artifact to the user": NACH dem Nehmen, optional (Rückfrage, nicht abbrechbar = Nein), nur wenn der Nutzer das Artefakt tragen kann
//     (`istAusruestTraeger`: lebendig, nicht gefroren, freie Support Zone, Ausrüst-Grenzen der Karte). Ohne zahlen zu müssen (`ruesteAusStapelAus` Stapel 'hand'): `onPlay` der Ausrüstung
//     (Dauerwirkung) und `onCardEnterZone` laufen wie bei jedem Anlegen per Effekt. Mehrere freie Zonen → Zonenwahl. Lehnt der Spieler ab oder geht es nicht, bleibt das Artefakt auf der Hand.
// ═══════════════════════════════════════════

const { hasCardType, heroAbilityLevel } = require('./_hooks');
const { ausgegrauteRestkarten } = require('./_target-dim-shared');
const { stealBoardCardToHand } = require('./_sparkfly-shared');
const { istAusruestTraeger, freieBasisZonen, waehleAusruestPlatz, ruesteAusStapelAus } = require('./_equip-shared');

const CARD_NAME = 'Mine! Mine! Mine!';
const CHARME = 'Charme';
const FLUG_HALTEZEIT_MS = 750;   // nur VOR dem Anlegen per Charme: die Karte soll sichtbar auf der Hand ankommen (Flug 700 ms), bevor sie von dort zum Helden fliegt

/** Hat der Nutzer (Brettseite `seite`, Held `heroIdx`) Charme in mindestens Stufe 1? */
function hatCharme(engine, seite, heroIdx) {
  if (!Number.isInteger(heroIdx) || heroIdx < 0) return false;
  try {
    if (engine.heroAbilityLevelsBlanked?.(seite, heroIdx)) return false;
    return heroAbilityLevel(engine, seite, heroIdx, CHARME) >= 1;
  } catch { return false; }
}

/** Alle wegnehmbaren Ausrüstungs-Artefakte an Helden, die `oi` kontrolliert. */
function gegnerAusruestung(engine, oi) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown || inst._deathResolved) continue;
    if (inst.counters?.immovable || inst.counters?._cardinalImmune || inst.counters?._omniImmune) continue;
    if (engine.isTokenCard?.(inst)) continue;
    const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    if (!engine.isEquipInZone(inst.name, inst)) continue;
    const seite = engine.physicalSide(inst);
    const hero = engine.gs.players[seite]?.heroes?.[inst.heroIdx];
    if (!hero?.name) continue;
    if (engine.kontrolleurVonHeld(seite, inst.heroIdx) !== oi) continue;
    out.push(inst);
  }
  return out;
}

function ausruestungsZiel(engine, inst) {
  const seite = engine.physicalSide(inst);
  return {
    id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
    owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name,
    cardInstance: inst, _cardInstance: inst,
  };
}

/** Grober Wert eines Artefakts für die CPU (Kosten, dazu ein Aufschlag für Skriptwirkung). */
function artefaktWert(engine, inst) {
  const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name] || {};
  return (cd.cost || 0);
}

module.exports = {
  // „If the user has at least Charme 1, this counts as an additional Action": Funktion je Held, Stand beim Ausspielen.
  inherentAction(gs, pi, heroIdx, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    return hatCharme(eng, eng.heldSeiteFuer(pi, heroIdx), heroIdx);
  },

  requiresTarget: true,                    // wählt ein Ziel (Blinded-Sperre)
  blockedByHandLock: true,                 // einziger Nutzen = Karte auf die Hand (Hand-Sperre)
  blockedByFirstTurnProtection: true,      // trifft nur die Gegnerseite
  stealsOpponentCards: true,               // Boris: „cannot add any cards originally owned by you to their hand"

  cpuMeta: { optionalInherent: true },     // auch ohne Charme als normale Aktion spielbar

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    if (eng.handZugangGesperrt?.(pi)) return false;
    return gegnerAusruestung(eng, eng.opponentOf(pi)).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];
      if (!ps) return;
      if (engine.handZugangGesperrt?.(pi)) { gs._spellCancelled = true; return; }
      const heroIdx = ctx.cardHeroIdx;
      const heroSeite = ctx.cardHeroOwner ?? pi;

      const alle = gegnerAusruestung(engine, oi);
      if (alle.length === 0) { gs._spellCancelled = true; return; }

      // ── 1. Zielwahl ──
      const ziele = alle.map(i => ausruestungsZiel(engine, i));
      const mitAuge = engine._sourceIgnoresTargetingRestrictions?.(ctx.card);
      delete gs._zielNegiertDurchSchutz;
      const wahl = await engine.promptEffectTarget(pi, [...ziele, ...ausgegrauteRestkarten(engine, ziele)], {
        ...(mitAuge ? { ignoreUntargetable: true, _truthSeeingEye: true } : {}),
        chooserHeroIdx: heroIdx,
        title: CARD_NAME,
        description: 'Choose an Artifact equipped to a Hero your opponent controls. It is added to your hand.',
        confirmLabel: '🫳 Mine!',
        confirmClass: 'btn-info',
        maxSelect: 1, maxTotal: 1,
        exclusiveTypes: true, maxPerType: { equip: 1 },
        cancellable: true,
      });
      const id = Array.isArray(wahl) ? wahl[0] : wahl;
      const ziel = id ? ziele.find(t => t.id === id) : null;
      if (!ziel) {
        // In der Zielwahl negiert: gespielt und verbraucht. Sonst echter Abbruch → die Karte bleibt auf der Hand.
        if (gs._spellNegatedByEffect || gs._zielNegiertDurchSchutz) { delete gs._zielNegiertDurchSchutz; engine.sync(); return; }
        gs._spellCancelled = true;
        return;
      }
      delete gs._zielNegiertDurchSchutz;

      // Zwischen Wahl und Auflösung kann sich etwas geändert haben (Reaktionsfenster): die lebende Instanz neu auflösen.
      const inst = ziel.cardInstance && engine.cardInstances.find(c => c.id === ziel.cardInstance.id && c.zone === 'support');
      const seite = inst ? engine.physicalSide(inst) : null;
      if (!inst || engine.kontrolleurVonHeld(seite, inst.heroIdx) !== oi || engine.handZugangGesperrt?.(pi)) {
        engine.log('mine_fizzle', { player: ps.username, card: ziel.cardName });
        engine.sync();
        return;
      }
      const name = inst.name;
      const tragerHeld = gs.players[seite]?.heroes?.[inst.heroIdx];

      // Resistance des Trägers fängt das Abnehmen ab (Nicht-Schadens-Effekt auf den Helden).
      if (await engine.heroNonDamageEffectBlocked(seite, inst.heroIdx, 'unequip', { sourceOwner: pi, source: CARD_NAME })) {
        engine.log('mine_blocked', { player: ps.username, card: name, hero: tragerHeld?.name, reason: 'resistance' });
        engine.sync();
        return;
      }

      // ── 2. Aufs Brett schauen: noch dort? Dann auf die Hand ──
      const noch = engine.cardInstances.find(c => c.id === inst.id && c.zone === 'support');
      if (!noch) { engine.log('mine_fizzle', { player: ps.username, card: name }); engine.sync(); return; }
      const moved = await stealBoardCardToHand(engine, pi, noch, CARD_NAME);
      engine.log(moved ? 'mine_mine_mine' : 'mine_blocked', {
        player: ps.username, opponent: gs.players[oi]?.username, card: name, hero: tragerHeld?.name,
      });
      if (!moved) { engine.sync(); return; }
      // Ohne Anlegen kein Warten (24.10., Al): die fliegende Kopie räumt den Handplatz selbst frei, sobald sie landet (Client `onPileTransfer`). Nur vor dem Anlegen per Charme soll die Karte
      // erst sichtbar auf der Hand ankommen, bevor sie von dort zum Helden fliegt.
      if (hatCharme(engine, heroSeite, heroIdx)) await engine._delay(FLUG_HALTEZEIT_MS);

      // ── 3. Charme 1+: gleich beim Nutzer anlegen (optional, ohne Kosten) ──
      if (!hatCharme(engine, heroSeite, heroIdx)) return;
      const hand = ps.hand || [];
      const handIdx = hand.length - 1;
      if (handIdx < 0 || hand[handIdx] !== name) return;                       // die Karte liegt nicht (mehr) zuoberst — nichts anlegen
      const herkunft = engine._handOriginAt(ps, handIdx) ?? oi;
      if (!istAusruestTraeger(engine, pi, heroIdx, name, heroSeite, herkunft)) {
        engine.log('mine_equip_impossible', { player: ps.username, card: name });
        engine.sync();
        return;
      }
      const antwort = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: `Equip ${name} to ${gs.players[heroSeite]?.heroes?.[heroIdx]?.name || 'the user'} without paying its Cost?`,
        showCard: name,
        cancellable: false,
        options: [
          { id: 'equip', label: 'Equip it now' },
          { id: 'keep', label: 'Keep it in my hand' },
        ],
      });
      if (antwort?.optionId !== 'equip') { engine.sync(); return; }

      // Zone: genau eine frei → sie; sonst Wahl (nur eigene Helden; übernommene Helden nehmen die erste freie Zone).
      const sps = gs.players[heroSeite];
      const frei = freieBasisZonen(sps, heroIdx, engine, heroSeite, name);   // Darion: mit dem Kartennamen — der Equip-Stapel ist der einzige Platz (keine Zonenwahl, keine freie Zone noetig)
      if (frei.length === 0) { engine.sync(); return; }
      let slot = frei[0];
      if (frei.length > 1 && heroSeite === pi) {
        const platz = await waehleAusruestPlatz(engine, pi, name, { nurHelden: [heroIdx], cancellable: false, title: CARD_NAME });
        if (platz && platz.heroIdx === heroIdx && frei.includes(platz.slot)) slot = platz.slot;
      }
      // Die Hand kann sich in der Wahl bewegt haben: Platz erneut suchen (letzte Kopie dieses Namens).
      const jetzt = ps.hand.lastIndexOf(name);
      if (jetzt < 0) { engine.sync(); return; }
      const eqOpts = { source: CARD_NAME, handIdx: jetzt, ...(heroSeite !== pi ? { seite: heroSeite } : {}) };
      const eq = await ruesteAusStapelAus(engine, pi, 'hand', name, heroIdx, slot, eqOpts);
      engine.log(eq ? 'mine_equipped' : 'mine_equip_failed', { player: ps.username, card: name, hero: sps?.heroes?.[heroIdx]?.name });
      engine.sync();
    },
  },

  /** CPU: das wertvollste (teuerste) Artefakt nehmen und gleich anlegen (kostenlos — nie ein Grund, es auf der Hand zu lassen). */
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'optionPicker') return { optionId: 'equip' };
    if (kind !== 'effectTarget' || promptData?.config?.title !== CARD_NAME) return undefined;
    const frei = (promptData.validTargets || []).filter(t => !t.ineligible && t.type === 'equip');
    if (frei.length === 0) return [];
    let best = frei[0], bestV = -Infinity;
    for (const t of frei) { const v = t.cardInstance ? artefaktWert(engine, t.cardInstance) : 0; if (v > bestV) { bestV = v; best = t; } }
    return [best.id];
  },
};
