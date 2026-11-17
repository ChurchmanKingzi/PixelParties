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
//  ── ANHÄNGSEL-STATUS (Curse, Berserk, Polymorph, Shrink) ─────────────────
//  ★ Spielgestalter-Entscheidung 17.11.2026: „Reflection soll die Attachment-Karte zum neuen Ziel bewegen und in dessen Zone legen. Ein Ziel ohne freie Zonen ist kein legitimes Ziel!
//  Ohne legitime Ziele ist Reflection nicht aktivierbar." Kommt der Status von einem Anhängsel-Spell (`attachmentStatus` am Skript, die Karte liegt gerade am Nutzer), geht NICHT nur das Flag
//  hinüber: die Karte zieht in eine freie Support Zone des neuen Ziels um (EIN Umhängeweg `engine.anhaengselUmziehen` → `actionTransferAttachment`, wie bei Tea) und legt Status und
//  Wirkung dort an (Vertrag `attachmentMovedToHost`: Fluch-ATK-Sperre, Polymorph-Bonus …). Ziele sind dann nur Helden (Kreaturen tragen keine Anhängsel) mit freier Zone, die den Status
//  bekommen können — und, falls die Karte es verlangt (`attachmentHostAllowed`, The Master's Orders: nur Helden des Gegners des Anhängers), ein erlaubter Wirt. Ohne so ein Ziel
//  wird Reflection gegen diesen Anhängsel-Spell gar nicht angeboten. Wirft man die Karte später ab, gilt die Besitzer-Stapel-Regel wie immer (`originalOwner`).
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
const { loadCardEffect } = require('./_loader');

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

/**
 * Kommt der Status von einem Anhängsel-Spell (Curse, Berserk, Polymorph, Shrink, The Master's Orders: `attachmentStatus` = dieser Status), der gerade am Nutzer angelegt wird? Dann die Karteninstanz,
 * die als Quelle (`opts.source`) genannt ist und am Nutzer liegt (die zuletzt gelegte Kopie) — sonst null.
 */
function anhaengselQuelle(engine, statusInfo) {
  const src = statusInfo?.opts?.source;
  const name = typeof src === 'string' ? src : (src && typeof src === 'object' ? src.name : null);
  if (!name) return null;
  const sc = loadCardEffect(name);
  if (!sc || sc.attachmentStatus !== statusInfo.statusName) return null;
  const kopien = engine.cardInstances.filter(c =>
    c.zone === 'support' && c.name === name && !c.faceDown
    && engine.physicalSide(c) === statusInfo.targetOwner && c.heroIdx === statusInfo.targetHeroIdx);
  return kopien.length > 0 ? kopien[kopien.length - 1] : null;
}

/** Darf die Anhängsel-Karte an diesen Helden? (Karten-Vertrag `attachmentHostAllowed(engine, inst, hostOwner, hostHeroIdx)`; ohne Vertrag: jeder Held.) */
function wirtErlaubt(engine, anh, owner, heroIdx) {
  const sc = loadCardEffect(anh.name);
  if (typeof sc?.attachmentHostAllowed !== 'function') return true;
  try { return !!sc.attachmentHostAllowed(engine, anh, owner, heroIdx); } catch { return false; }
}

/**
 * Alle Ziele, die der Kontrolleur `pi` für die Umleitung wählen darf (Helden und Kreaturen seiner Gegner). Bei einem Anhängsel-Status nur Helden mit freier Support Zone (und erlaubtem Wirt);
 * `opts.mitGesperrten`: zusätzlich die Helden OHNE freie Zone, als `ineligible` markiert (ausgegraut in der Zielwahl) — sie zählen nie als Möglichkeit.
 */
function moeglichkeiten(engine, pi, statusInfo, opts = {}) {
  const sName = statusInfo.statusName;
  const sOpts = statusInfo.opts || {};
  const newStacks = sOpts.addStacks || sOpts.stacks || 1;
  const anh = anhaengselQuelle(engine, statusInfo);
  const out = [];
  for (const oi of engine.opponentsOf(pi)) {
    for (const t of engine.getControlledHeroTargets(oi)) {
      const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!hero?.name || hero.hp <= 0) continue;
      if (t.owner === statusInfo.targetOwner && t.heroIdx === statusInfo.targetHeroIdx) continue;   // der Nutzer selbst ist nie sein eigenes Ziel
      if (!heldKannEmpfangen(hero, sName, newStacks)) continue;
      if (anh) {
        if (!wirtErlaubt(engine, anh, t.owner, t.heroIdx)) continue;
        if (!engine.hatFreienSupportPlatz(t.owner, t.heroIdx)) {   // ein Ziel ohne freie Zone ist kein legitimes Ziel (die Karte hätte keinen Platz)
          if (opts.mitGesperrten) out.push({ ...t, ineligible: true });
          continue;
        }
      }
      out.push(t);
    }
    if (anh) continue;   // Kreaturen tragen keine Anhängsel
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
  // Blinded (Spielgestalter-Entscheidung 16.11.2026): Zielwahl-Karte mit Pflichtwahl „a target your opponent controls“ → unter Blinded nicht aktivierbar (`engine.blindedAttackSpellGesperrt`: nur Gegnerziele).
  requiresTarget: true,

  // ★★ v1181 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT, läuft ihr Effekt-Rumpf nie — die Engine spielt dann dieses Bild.
  spellVisual: { impact: { type: 'reflection_mirror' }, impactMs: 420 },

  isSurprise: true,
  surpriseStatusTrigger: true,

  /** Der Nutzer (Held der Surprise Zone) würde einen negativen Status bekommen, und es gibt ein Gegnerziel, das ihn bekommen kann. */
  surpriseTrigger(gs, ownerIdx, heroIdx, statusInfo, engine, seite = ownerIdx) {
    if (!statusInfo || statusInfo.targetCreature) return false;              // „the user" ist ein Held
    if (statusInfo.targetOwner !== seite || statusInfo.targetHeroIdx !== heroIdx) return false;
    if (!STATUS_EFFECTS[statusInfo.statusName]?.negative) return false;
    return moeglichkeiten(engine, ownerIdx, statusInfo).length > 0;   // bei einem Anhängsel-Status: nur mit einem Helden, der die Karte aufnehmen kann (sonst nicht aktivierbar)
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

    const anh = anhaengselQuelle(engine, sourceInfo);   // Anhängsel-Spell: die Karte zieht mit um
    let ziel = ziele[0];
    if (ziele.length > 1) {
      const ids = await engine.promptEffectTarget(pi, anh ? moeglichkeiten(engine, pi, sourceInfo, { mitGesperrten: true }) : ziele, {
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
    if (anh && ziel.type === 'hero') {
      // Spielgestalter-Entscheidung 17.11.2026: die Karte selbst wandert in eine freie Zone des neuen Ziels (Status und Wirkung legt `attachmentMovedToHost` dort an; am Nutzer ist nichts mehr).
      const ok = await engine.anhaengselUmziehen(anh, ziel.owner, ziel.heroIdx, { anleger: pi, sourceName: CARD_NAME });
      if (!ok) { engine.sync(); return null; }   // kein Platz mehr (Zustand hat sich geändert): der Status trifft den Nutzer wie gewohnt
      const neu = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (neu?.statuses?.[statusName]) {
        if (!neu.statuses[statusName]._fromAttachment) neu.statuses[statusName]._fromAttachment = anh.name;   // der Status am neuen Ziel gehört dieser Karte (Heilen wirft sie ab)
      } else if (typeof loadCardEffect(anh.name)?.attachmentMovedToHost !== 'function') {
        await engine.addHeroStatus(ziel.owner, ziel.heroIdx, statusName, { ...(sourceInfo.opts || {}), _fromSurpriseRedirect: true, _fromAttachment: anh.name });
      }
      engine.log('reflection_attachment', { card: anh.name, to: ziel.cardName });
      engine.sync();
      // Kein nacktes Flag: die Engine legt weder am Nutzer noch am neuen Ziel noch einen Status an (`type: 'attachment'` kennt keinen Zweig in `addHeroStatus`).
      return { redirect: { type: 'attachment', owner: ziel.owner, heroIdx: ziel.heroIdx, cardName: ziel.cardName } };
    }
    engine.sync();
    return { redirect: ziel };
  },
};
