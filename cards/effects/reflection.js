'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Reflection"  (Welle 6b)
//  Spell (Surprise, Magic Arts Lv1)
//
//  „Activate this Surprise when the user would be affected by a negative status effect. Choose a target your opponent controls. That target is affected by that effect instead.
//   If you have at least 1 "Shield of Wisdom" in your discard pile, this card's level becomes 0."
//
//  ── AUSLÖSER ────────────────────────────────────────────────────────────
//  Das Status-Fenster der Engine (`surpriseStatusTrigger`, Muster Cactus Creature): „the user" = der Held, in dessen Surprise Zone die Karte liegt — nur ER löst sie aus, nicht seine
//  Kreaturen (`statusInfo.targetCreature` fehlt) und nicht ein anderer Held. Nur NEGATIVE Status. Die Karte wird nur angeboten, wenn es mindestens ein Ziel des Gegners gibt, das den
//  Status bekommen kann (sonst gäbe es nichts umzulenken).
//
//  ── WOHIN? „a target your opponent controls" ────────────────────────────
//  Helden, die ein GEGNER kontrolliert (Kontrolle statt Brettseite: ein übernommener Held zählt für den Übernehmer, ein abgegebener eigener nicht), und Kreaturen unter Gegnerkontrolle
//  (aufgedeckt, als Kreatur wählbar, nicht immun gegen den Status). Wer den Status schon trägt, ist kein Ziel — außer Gift mit mehr Stapeln. Mehrere Gegner (3+ Spieler): alle Ziele aller
//  Gegner. Die Wahl trifft der Kontrolleur der Surprise und ist Pflicht (die Aktivierung war die Entscheidung).
//
//  ── „AFFECTED BY THAT EFFECT INSTEAD" ───────────────────────────────────
//  Die Engine wendet den ursprünglichen Status samt Dauer/Stapeln/Verursacher auf das neue Ziel an (`addHeroStatus`/`applyCreatureStatus`, `_fromSurpriseRedirect`): ALLE normalen Schutzwege
//  des neuen Ziels gelten weiter (Immunität, Johanna, Light Ball …), das Ziel wird nicht „getroffen" im Sinne eines zweiten Fensters. Der Nutzer bekommt den Status NICHT — auch wenn das
//  neue Ziel ihn dank Schutz nicht bekommt (Umleitung, nicht Verdopplung). Wie Cactus Creature bleibt die Umleitung unter Tearing Mountain wirksam.
//
//  ── STUFE 0 ─────────────────────────────────────────────────────────────
//  `surpriseLevelZero` (Engine-Vertrag seit Bounce Trap): liegt mindestens eine „Shield of Wisdom" in der Ablage des Surprise-Besitzers (Kontrolleur, „you"), verlangt die Engine für diese
//  Aktivierung keine Stufe — der Held muss die Surprise nur sonst aktivieren dürfen. Geprüft wird beim Auslösen, nicht beim Legen.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `reflection_mirror` (Pixelart, ANIM_REGISTRY, Ursprung = Nutzer, Ziel = neues Ziel): ein Spiegel erscheint vor dem Nutzer, dunkle Wirbel werden hineingezogen, der
//  Spiegel blitzt und wirft einen Strahl mit Scherben auf das neue Ziel. Klänge in ZONE_ANIM_SFX; Log `reflection`.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS } = require('./_hooks');

const CARD_NAME = 'Reflection';
const SHIELD = 'Shield of Wisdom';
const ANIM_MS = 1150;        // Länge von `reflection_mirror` im Client
const HIT_MS = 780;          // bis der Strahl eingeschlagen ist — dann landet der Status

/** Gift trägt Stapel: ein Ziel mit Gift ist nur dann ein Ziel, wenn der neue Status MEHR Stapel hätte. */
function heldKannEmpfangen(hero, sName, newStacks) {
  if (!hero.statuses?.[sName]) return true;
  return sName === 'poisoned' && newStacks > (hero.statuses.poisoned?.stacks || 1);
}
function kreaturKannEmpfangen(engine, inst, sName, newStacks) {
  if (inst.counters?.[sName]) return sName === 'poisoned' && newStacks > (inst.counters.poisonStacks || 1);
  return engine.canTargetForStatus(inst, sName);
}

/** Alle Ziele, die der Kontrolleur `pi` für die Umleitung wählen darf (Helden und Kreaturen seiner Gegner). */
function moeglichkeiten(engine, pi, statusInfo) {
  const sName = statusInfo.statusName;
  const sOpts = statusInfo.opts || {};
  const newStacks = sOpts.addStacks || sOpts.stacks || 1;
  const out = [];
  for (const oi of engine.opponentsOf(pi)) {
    for (const t of engine.getControlledHeroTargets(oi)) {
      const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!hero?.name || hero.hp <= 0) continue;
      if (t.owner === statusInfo.targetOwner && t.heroIdx === statusInfo.targetHeroIdx) continue;   // der Nutzer selbst ist nie sein eigenes Ziel
      if (!heldKannEmpfangen(hero, sName, newStacks)) continue;
      out.push(t);
    }
    for (const t of engine.getCreatureTargets(oi)) {
      const inst = t.cardInstance;
      if (!inst || inst.faceDown || inst.zone !== 'support') continue;
      if (!kreaturKannEmpfangen(engine, inst, sName, newStacks)) continue;
      out.push(t);
    }
  }
  return out;
}

module.exports = {
  // ★★ v1181 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT, läuft ihr Effekt-Rumpf nie — die Engine spielt dann dieses Bild.
  spellVisual: { impact: { type: 'reflection_mirror' }, impactMs: 420 },

  isSurprise: true,
  surpriseStatusTrigger: true,

  /** Der Nutzer (Held der Surprise Zone) würde einen negativen Status bekommen, und es gibt ein Gegnerziel, das ihn bekommen kann. */
  surpriseTrigger(gs, ownerIdx, heroIdx, statusInfo, engine, seite = ownerIdx) {
    if (!statusInfo || statusInfo.targetCreature) return false;              // „the user" ist ein Held
    if (statusInfo.targetOwner !== seite || statusInfo.targetHeroIdx !== heroIdx) return false;
    if (!STATUS_EFFECTS[statusInfo.statusName]?.negative) return false;
    return moeglichkeiten(engine, ownerIdx, statusInfo).length > 0;
  },

  /** Stufe 0, solange mindestens eine „Shield of Wisdom" in der Ablage des Surprise-Besitzers liegt. */
  surpriseLevelZero(gs, ownerIdx) {
    return (gs.players[ownerIdx]?.discardPile || []).includes(SHIELD);
  },

  /** CPU: annehmen, wann immer es geht (es kostet nichts); als neues Ziel der Held mit den meisten HP, sonst die Kreatur mit den meisten HP. */
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm' && promptData.title === CARD_NAME) return { confirmed: true };
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = promptData || {};
    if (!Array.isArray(validTargets) || config?.title !== CARD_NAME) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    const wert = (t) => t.type === 'hero'
      ? 10000 + (engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.hp || 0)
      : ((t.cardInstance || t._cardInstance)?.counters?.currentHp || 0);
    return [frei.slice().sort((a, b) => wert(b) - wert(a))[0].id];
  },

  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const statusName = sourceInfo.statusName;
    const statusLabel = STATUS_EFFECTS[statusName]?.label || statusName;
    const ziele = moeglichkeiten(engine, pi, sourceInfo);
    if (ziele.length === 0) return null;

    let ziel = ziele[0];
    if (ziele.length > 1) {
      const ids = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME, source: CARD_NAME,
        description: `Choose a target your opponent controls. It is ${statusLabel} instead.`,
        confirmLabel: '🪞 Reflect!', confirmClass: 'btn-success',
        cancellable: false, allowNonCreatureEquips: true, maxTotal: 1,   // pflichtwahl: die Aktivierung der Surprise war die Entscheidung
      });
      const id = Array.isArray(ids) ? ids[0] : ids;
      ziel = ziele.find(t => t.id === id);
      if (!ziel) return null;                       // keine Wahl möglich (alle gesperrt): der Status trifft den Nutzer wie gewohnt
    }

    // Der Strahl: vom Nutzer (Spiegel) zum neuen Ziel. Der Status landet, wenn er eingeschlagen ist (die Engine wendet ihn nach der Rückgabe an).
    engine._broadcastEvent('play_zone_animation', {
      type: 'reflection_mirror', zoneType: 'board', owner: sourceInfo.targetOwner, heroIdx: -1, zoneSlot: -1, duration: ANIM_MS,
      targets: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx }],
      originOwner: sourceInfo.targetOwner, originHeroIdx: sourceInfo.targetHeroIdx, originZoneSlot: -1,
    });
    await engine._delay(HIT_MS);
    engine.log('reflection', {
      player: engine.gs.players[pi]?.username, status: statusName,
      from: engine.gs.players[sourceInfo.targetOwner]?.heroes?.[sourceInfo.targetHeroIdx]?.name, to: ziel.cardName,
    });
    engine.sync();
    return { redirect: ziel };
  },
};
