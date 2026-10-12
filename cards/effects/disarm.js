'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Disarm"
//  Spell (Decay Magic + Magic Arts Lv1, Normal)
//
//  „Choose any number of Artifacts equipped to one Hero (at least 1) and delete them. This counts as an additional Action."
//
//  ── VORGABE 11.10. ──────────────────────────────────────────────────────
//  Bisher eine Fighting-Attack-Surprise („Activate this Surprise when the user is chosen by an Attack …"); jetzt ein gewöhnlicher Spell mit den Schulen
//  Decay Magic + Magic Arts (Stufenanforderung wie bei jedem Zwei-Schulen-Zauber: die Summe beider Schulen, hier mindestens 1) und neuem Effekt.
//  Die Kartendaten (`data/cards.json`): `cardType: "Spell"`, `subtype: "Normal"`.
//
//  ── ZIEL: EIN HELD, MINDESTENS EIN ARTEFAKT ─────────────────────────────
//  „One Hero" — BEIDE Seiten, auch der eigene Held und ein übernommener (die Brettseite entscheidet, nicht der Kontrolleur). Zuerst der Held (nur Helden mit
//  mindestens einem löschbaren Artefakt stehen zur Wahl; gibt es nur einen, entfällt die Frage), dann die Artefakte: mindestens 1, höchstens alle. Abbruch
//  an einer der beiden Stellen bringt die Karte zurück auf die Hand (`gs._spellCancelled`). Ohne ausgerüstetes Artefakt irgendwo ist die Karte grau
//  (`spellPlayCondition`).
//  „Artifacts equipped": Artefakt-Karten, die in der Support Zone als Ausrüstung zählen (`isEquipInZone`). Nicht gewählt werden können unbewegliche
//  Karten (`immovable`) und Cardinal Beasts.
//  AUSGEGRAUT (Als Vorgabe 12.10.): beide Fragen zeigen alles Übrige — Helden ohne löschbares Artefakt, Ausrüstung, Kreaturen — ausgegraut statt unangetastet
//  (`ausgegrauteRestkarten`, `_target-dim-shared.js`), sonst klickt man intuitiv zuerst auf die Equips.
//
//  ── LÖSCHEN, NICHT ABWERFEN ─────────────────────────────────────────────
//  „Delete" = `actionMoveCard(… 'deleted' …)`: die Karte geht in den Deleted Pile ihres URSPRÜNGLICHEN Besitzers (Gegenstück zu `sendBoardCardToDiscard`);
//  `onCardLeaveZone` läuft dabei wie bei jedem Abgang, ein Equip nimmt also seinen Bonus vom Helden. Was an einer Schutzklausel hängenbleibt (immovable,
//  Cardinal-Immunität), verlässt die Zone nicht und zählt nicht.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „This counts as an additional Action" ohne Bedingung: `inherentAction: true`.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `disarm_snap` (Pixelart, ANIM_REGISTRY, Brett-Animation mit allen gewählten Artefakten als Ziel): ein violett-grüner Ring zieht sich um
//  jedes Artefakt zusammen, schnappt zu, die Karte zerfällt in Pixelsplitter. Klänge in ZONE_ANIM_SFX; Log `disarm`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { ausgegrauteRestkarten } = require('./_target-dim-shared');

const CARD_NAME = 'Disarm';
const DAUER_MS = 1100;       // Länge der Animation (deckt sich mit `disarm_snap` im Client)
const SCHNAPP_MS = 520;      // der Ring schnappt bei ~420 ms zu (+100 ms Einbau-Versatz des Clients)
const NACH_MS = 380;         // Splitter noch ein Stück fliegen lassen, bevor der Zauber endet

/** Alle an diesem Helden ausgerüsteten, löschbaren Artefakte (Brettseite `seite`). */
function ausruestungAm(engine, seite, heroIdx) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support') continue;
    if (inst.owner !== seite || inst.heroIdx !== heroIdx) continue;
    if (inst.faceDown) continue;
    if (inst.counters?.immovable || inst.counters?._cardinalImmune) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    if (!engine.isEquipInZone(inst.name, inst)) continue;
    out.push(inst);
  }
  return out;
}

/** Alle Helden beider Seiten mit mindestens einem löschbaren Artefakt. */
function heldenMitAusruestung(engine) {
  const out = [];
  const gs = engine.gs;
  for (let seite = 0; seite < (gs.players || []).length; seite++) {
    const ps = gs.players[seite];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name) continue;
      const eq = ausruestungAm(engine, seite, hi);
      if (eq.length > 0) out.push({ seite, heroIdx: hi, hero, ausruestung: eq });
    }
  }
  return out;
}

function ausruestungsZiel(inst) {
  return {
    id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
    owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name,
    cardInstance: inst, _cardInstance: inst,
  };
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // „This counts as an additional Action" — immer.
  inherentAction: true,

  /** Grau, solange nirgends ein löschbares Artefakt ausgerüstet ist. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return heldenMitAusruestung(engine).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const heroSeite = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[heroSeite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      // ── 1. Der Held ──
      const helden = heldenMitAusruestung(engine);
      if (helden.length === 0) { gs._spellCancelled = true; return; }
      let wahl = helden[0];
      if (helden.length > 1) {
        const heldZiele = helden.map(h => ({
          id: `hero-${h.seite}-${h.heroIdx}`, type: 'hero', owner: h.seite, heroIdx: h.heroIdx, cardName: h.hero.name,
        }));
        // Alles andere (Ausrüstung, Kreaturen, Helden ohne löschbares Artefakt) steht AUSGEGRAUT in der Liste — sonst klickt man intuitiv erst auf die Equips.
        const ids = await engine.promptEffectTarget(pi, [...heldZiele, ...ausgegrauteRestkarten(engine, heldZiele)], {
          title: CARD_NAME, source: CARD_NAME,
          description: 'Choose a Hero. You then choose any number of Artifacts equipped to it to delete.',
          confirmLabel: '🗡️ This Hero!', confirmClass: 'btn-danger',
          maxTotal: 1, exclusiveTypes: true, maxPerType: { hero: 1 },
          cancellable: true,
        });
        const id = Array.isArray(ids) ? ids[0] : ids;
        const treffer = id && heldZiele.find(z => z.id === id);
        if (!treffer) { gs._spellCancelled = true; return; }
        wahl = helden.find(h => h.seite === treffer.owner && h.heroIdx === treffer.heroIdx);
        if (!wahl) { gs._spellCancelled = true; return; }
      }

      // ── 2. Die Artefakte (mindestens 1) ──
      const ausruestung = ausruestungAm(engine, wahl.seite, wahl.heroIdx);
      if (ausruestung.length === 0) { gs._spellCancelled = true; return; }
      const artZiele = ausruestung.map(ausruestungsZiel);
      const gewaehlt = await engine.promptEffectTarget(pi, [...artZiele, ...ausgegrauteRestkarten(engine, artZiele)], {
        title: CARD_NAME, source: CARD_NAME,
        description: `Choose any number of Artifacts equipped to ${wahl.hero.name} (at least 1) to delete.`,
        confirmLabel: '🗑️ Delete!', confirmClass: 'btn-danger',
        minRequired: 1, maxTotal: artZiele.length,
        exclusiveTypes: true, maxPerType: { equip: artZiele.length },
        alwaysConfirmable: false,
        cancellable: true,
      });
      const ids = Array.isArray(gewaehlt) ? gewaehlt : (gewaehlt ? [gewaehlt] : []);
      // Nach der Abfrage neu einsammeln — das Brett kann sich bewegt haben.
      const frisch = ausruestungAm(engine, wahl.seite, wahl.heroIdx).map(ausruestungsZiel);
      const treffer = ids.map(id => frisch.find(z => z.id === id)).filter(z => z?.cardInstance);
      if (treffer.length === 0) { gs._spellCancelled = true; return; }

      // ── Bild: Ring um jedes Artefakt, Zerfall ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'disarm_snap', zoneType: 'board', owner: wahl.seite, heroIdx: -1, zoneSlot: -1, duration: DAUER_MS,
        targets: treffer.map(z => ({ owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.slotIdx, cardName: z.cardName })),
        originOwner: heroSeite, originHeroIdx: heroIdx, originZoneSlot: -1,
      });
      await engine._delay(SCHNAPP_MS);

      // ── Löschen ──
      const quelle = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, heroOwner: heroSeite };
      const geloescht = [];
      for (const z of treffer) {
        const inst = z.cardInstance;
        if (inst.zone !== 'support') continue;
        const vorher = inst.zone;
        const seite = inst.owner;
        const ziel = inst.originalOwner ?? seite;
        engine._broadcastEvent('play_pile_transfer', {
          owner: seite, cardName: inst.name, from: 'support', to: 'deleted',
          fromHeroIdx: inst.heroIdx, fromSlotIdx: inst.zoneSlot,
          ...(ziel !== seite ? { fromOwner: seite, toOwner: ziel } : {}),
        });
        await engine.actionMoveCard(inst, 'deleted', -1, -1, { source: quelle, sourceName: CARD_NAME, sourceOwner: pi });
        if (vorher === 'support' && inst.zone !== 'support') geloescht.push(inst.name);
      }
      engine.log('disarm', {
        player: ps.username, hero: wahl.hero.name, cards: geloescht,
      });
      engine.sync();
      await engine._delay(NACH_MS);
    },
  },

  /** CPU: Gegnerische Ausrüstung zuerst (alle Artefakte des Helden mit der meisten), eigene nie. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = promptData || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    const fremd = (t) => engine.gs.players[t.owner] && t.owner !== playerIdx;
    // Heldenwahl: der Gegnerheld mit den meisten Artefakten.
    const helden = frei.filter(t => t.type === 'hero');
    if (helden.length > 0) {
      const anzahl = (t) => ausruestungAm(engine, t.owner, t.heroIdx).length;
      const feind = helden.filter(fremd).sort((a, b) => anzahl(b) - anzahl(a));
      return feind.length > 0 ? [feind[0].id] : [];   // nur eigene Helden zur Wahl: abbrechen
    }
    const equips = frei.filter(t => t.type === 'equip');
    if (equips.length === 0) return [];
    return equips.every(t => !fremd(t)) ? [] : equips.map(t => t.id);
  },
};
