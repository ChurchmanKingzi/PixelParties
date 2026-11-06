'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Fake Legendary Sword"  (W77c)
//  Artifact (Normal, Cost 0)    — Subtype seit 25.10. „Normal" (vorher Reaction)
//
//  „Choose an Artifact equipped to a Hero and send it to the discard pile. If it was equipped to your own Hero, permanently increase that Hero's Attack stat by 40."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • Gewöhnliches, aktiv gespieltes Ziel-Artefakt (Vertrag `isTargetingArtifact` / `getValidTargets` / `resolve`, Muster Arcane Lamp). Ziel: ein ausgerüstetes Artefakt BEIDER Seiten
//    (Ziel-Typ `equip`, offen, Equipment — `engine.isEquipInZone`; unbewegliche Karten und Cardinal Beasts nicht). Teilen mehrere Artefakte einen Platz (Darion), fragt die Engine selbst einmal „welches Equip?" (`_disambiguateStackedTargets`).
//    Ohne ausgerüstetes Artefakt irgendwo ist die Karte grau (`canActivate`).
//  • „send it to the discard pile": `actionDestroyCard` mit `skipPileTransfer` — der Standardflug zum Stapel entfällt, die Karte zersplittert statt zu fliegen (s. u.). Sie landet im Ablagestapel
//    ihres BESITZERS. Steht sie unter Schutz (Board-Wächter, Immunität …), bleibt sie liegen — dann gibt es auch keinen Bonus.
//  • „equipped to your own Hero": der Held gehört dem Spieler — nach KONTROLLE (`heroSideOf`: ein übernommener Held zählt für den Übernehmer). Dann bekommt dieser Held dauerhaft +40 ATK
//    (`engine.actionPermAtk`, überlebt Formwechsel). An einem gegnerischen Helden gibt es keinen Bonus.
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_card_throw` im Modus `shatter` (Client, Pixelart): das Kartenbild reißt, zerspringt in ~48 scharfkantige Splitter, die in ganzen 2-px-Schritten davonfliegen und verschwinden
//  (keine Drehung, kein Alpha). Klang `ev_card_shatter`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Fake Legendary Sword';
const BONUS = 40;
const SHATTER_MS = 1100;     // Länge der Splitter-Animation im Client (läuft PARALLEL weiter, die Karte selbst fliegt schon in die Ablage)
const MONTAGE_MS = 140;
const NACH_MS = 120;         // kurzer Nachlauf, dann geht die Karte weiter

/** Alle ausgerüsteten, zerstörbaren Artefakte (beide Seiten). */
function ausruestung(engine) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.immovable || inst.counters?._cardinalImmune) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    if (!engine.isEquipInZone(inst.name, inst)) continue;
    out.push(inst);
  }
  return out;
}

/** Gehört der Held, an dem `inst` liegt, dem Spieler `pi` (nach Kontrolle)? */
function eigenerHeld(engine, inst, pi) {
  const seite = engine.physicalSide(inst);
  const hero = engine.gs.players[seite]?.heroes?.[inst.heroIdx];
  return !!hero?.name && engine.heroSideOf(seite, hero) === pi;
}

module.exports = {
  isTargetingArtifact: true,
  blockedByHandLock: true,

  canActivate(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    return !eng || ausruestung(eng).length > 0;
  },

  getValidTargets(gs, pi, engine) {
    if (!engine) return [];
    const proPlatz = new Map();
    for (const inst of ausruestung(engine)) {
      const k = `${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`;
      if (!proPlatz.has(k)) proPlatz.set(k, []);
      proPlatz.get(k).push(inst);
    }
    return [...proPlatz.values()].map(insts => {
      const inst = insts[insts.length - 1];
      const z = {
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
      };
      return z;
    });
  },

  targetingConfig: {
    description: 'Choose an Artifact equipped to a Hero. It is sent to the discard pile; on your own Hero, that Hero permanently gains +40 Attack.',
    confirmLabel: '🗡️ Shatter!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { equip: 1 },
  },
  validateSelection(selectedIds) { return Array.isArray(selectedIds) && selectedIds.length === 1; },

  /** CPU: nur mit gegnerischer Ausrüstung im Spiel (eigene opfert sie nicht — der Bonus ist klein). */
  cpuShouldPlay(engine, pi) {
    return ausruestung(engine).some(inst => !eigenerHeld(engine, inst, pi));
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };
    const ziel = (validTargets || this.getValidTargets(engine.gs, pi, engine)).find(t => t.id === selectedIds[0]);
    if (!ziel) return { cancelled: true };
    const gs = engine.gs;
    // Darion: liegen mehrere Equips auf dem Platz, hat die Engine schon gefragt („welches Equip?", `_disambiguateStackedTargets`) und die gewählte Karte in `ziel.cardInstance` eingetragen —
    // eine zweite Rückfrage gibt es hier nicht.
    const inst = engine.cardInstances.find(c => c.id === ziel.cardInstance?.id);
    if (!inst || inst.zone !== 'support') return { cancelled: true };

    const seite = engine.physicalSide(inst), heroIdx = inst.heroIdx, slot = inst.zoneSlot, name = inst.name;
    const eigen = eigenerHeld(engine, inst, pi);
    const hero = gs.players[seite]?.heroes?.[heroIdx];
    const heroSeite = hero ? engine.heroSideOf(seite, hero) : pi;
    const ablageBesitzer = inst.originalOwner ?? inst.owner;
    const quelle = { name: CARD_NAME, owner: pi, controller: pi, cardType: 'Artifact' };

    engine._broadcastEvent('play_card_throw', {
      mode: 'shatter', cardName: name, fromOwner: seite, fromHeroIdx: heroIdx, fromSlot: slot,
      discardOwner: ablageBesitzer, suppressDiscard: true, duration: SHATTER_MS,
    });
    await engine._delay(MONTAGE_MS);
    await engine.actionDestroyCard(quelle, inst, { sourceOwner: pi, sourceName: CARD_NAME, skipPileTransfer: true });
    const weg = inst.zone !== 'support';
    engine.sync();
    await engine._delay(NACH_MS);

    if (weg && eigen && hero?.name && hero.hp > 0) engine.actionPermAtk(hero, seite, heroIdx, BONUS, CARD_NAME);
    engine.log('fake_legendary_sword', { player: gs.players[pi]?.username, artifact: name, host: hero?.name || null, own: eigen, sent: weg });
    engine.sync();
    return true;
  },
};
