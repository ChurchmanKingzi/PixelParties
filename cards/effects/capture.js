// ═══════════════════════════════════════════
//  CARD EFFECT: "Capture"
//  Attack (Fighting Lv1, Normal)
//
//  „Choose a level 1/2/3 or lower Creature your opponent controls and take
//   permanent control of it. Place it in one of the user's free Support
//   Zones. If the user is equipped with "Truth-Seeing Eye", this counts as
//   an additional Action."
//
//  ── STUFE 1/2/3 ─────────────────────────────────────────────────────────
//  Die Stufengrenze ist die Fighting-Stufe des Nutzers (1–3, wie bei Forceful Revival / Rewrite History); verglichen wird das
//  WIRKSAME Level der Kreatur aus Sicht ihres Kontrolleurs (`effectiveCardLevel`). Kreaturen ohne Level (Artifact-Kreaturen)
//  sind keine Ziele.
//
//  ── ANGRIFF OHNE SCHADEN ────────────────────────────────────────────────
//  Eine Attack, die eine Kreatur WÄHLT (kein Schaden): `ctx.promptDamageTarget` mit `dealsDamage: false` liefert die
//  kanonische Zielwahl — Schutz („cannot be chosen": Thicket, Great Wall of Deri …), Umleitungs- und Reaktionsfenster, und das
//  Truth-Seeing Eye (der Nutzer wählt trotz Schutz, seine Attack ist nicht umlenkbar). Die `condition` prüft nur, was NICHT
//  „Wählbarkeit" ist: Stufe, Level vorhanden, Kontrolle wechselbar (kein Cardinal Beast, kein „control cannot change").
//
//  ── PLATZ ───────────────────────────────────────────────────────────────
//  „One of the USER's free Support Zones": nur die freien Zonen des ausführenden Helden (nicht die anderer Helden — anders als
//  Diplomacy). Eine freie Zone: automatisch; mehrere: der Spieler wählt (`promptZonePick`). Ist keine frei, ist der Nutzer
//  nicht tauglich (`canPlayWithHero`). Für einen geliehenen Helden (Love Shot, Charme) liegt die Zone auf dessen Brettseite,
//  der neue Kontrolleur ist der Spieler (`opts.controller` von `actionTransferCreature`).
//
//  ── ZUSATZAKTION MIT TRUTH-SEEING EYE ───────────────────────────────────
//  „If the user is equipped with Truth-Seeing Eye, this counts as an additional Action" → `inherentAction` als FUNKTION, je Held
//  ausgewertet (Standard — siehe CARD_API „Conditional inherent additional Actions"):
//    • Main Phase: spielbar NUR von einem tauglichen Helden MIT Auge (nur für ihn ist die Aktion gratis).
//    • Action Phase: jeder taugliche Held darf sie nutzen; einer OHNE Auge verbraucht die Aktion, einer MIT Auge nicht.
//  Die Auge-Frage stellt dieselbe Engine-Auslegung wie die Zielwahl (`_sourceHasTruthSeeingEye`): lebendes, aufgedecktes,
//  nicht negiertes „Truth-Seeing Eye" in den Support Zones DIESES Helden.
//
//  ── KONTROLLE ───────────────────────────────────────────────────────────
//  `actionTransferCreature` ist der EINE Weg aller Übernahmen (Tor-Schutz „Defending the Gate", Cardinal-Immunität, „control
//  cannot change", Flug, `onCardEnterZone`, `onTakeControl` für Reaktionen wie Very Special Prisoner). Der Text negiert die
//  Kreatur NICHT (anders als Dark Gear / Diplomacy). `takesControlOfTargets` ist die Boris-Sperre: solange der Gegner einen
//  wirksamen Boris hat, ist die Karte gar nicht spielbar.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Der Held rennt die Kreatur an (`play_ram_animation`), ein rotes „!" springt über ihr auf und ein Lasso schnürt sich um die
//  Karte zu (`capture_lasso`, Pixelart in ANIM_REGISTRY; Klang in ZONE_ANIM_SFX), dann fliegt die Kreatur in die Zone des Nutzers
//  (Flug der Engine).
// ═══════════════════════════════════════════

const { hasCardType, hasNumericCreatureLevel } = require('./_hooks');

const CARD_NAME = 'Capture';
const SCHOOL = 'Fighting';
const MAX_STUFE = 3;
const LASSO_MS = 1000;       // Länge der Animation (deckt sich mit `capture_lasso` im Client)

/** Fighting-Stufe des Nutzers auf seiner Brettseite, 1–3. */
function maxLevelFuer(engine, hs, heroIdx) {
  const zonen = engine.gs.players[hs]?.abilityZones?.[heroIdx] || [];
  const stufe = engine.countAbilitiesForSchool(SCHOOL, zonen);
  return Math.max(1, Math.min(stufe, MAX_STUFE));
}

/** Freie Support Zones DES Helden: [{ heroIdx, slotIdx, label }]. */
function freieZonen(gs, hs, heroIdx) {
  const hero = gs.players[hs]?.heroes?.[heroIdx];
  const out = [];
  for (let si = 0; si < 3; si++) {
    const slot = gs.players[hs]?.supportZones?.[heroIdx]?.[si];
    if (Array.isArray(slot) && slot.length === 0) {
      out.push({ heroIdx, slotIdx: si, label: `${hero?.name || 'Hero'} — Slot ${si + 1}` });
    }
  }
  return out;
}

/** Trägt der Held ein wirksames Truth-Seeing Eye? (dieselbe Auslegung wie die Zielwahl) */
function heldHatAuge(engine, hs, heroIdx) {
  return !!engine._sourceHasTruthSeeingEye({ name: CARD_NAME, controller: hs, heroIdx });
}

/**
 * Ist `inst` ein Ziel für `pi` bei Stufengrenze `maxLv`?
 * `mitSchutz`: auch die „kann nicht gewählt werden"-Schutzarten prüfen (Gating ohne Auge). Die Zielwahl selbst prüft die nicht —
 * dort filtert die Engine, und das Auge hebt sie auf.
 */
function istZiel(engine, pi, inst, maxLv, mitSchutz) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  const ktrl = inst.controller ?? inst.owner;
  if (ktrl === pi || !engine.opponentsOf(pi).includes(ktrl)) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || !hasCardType(cd, 'Creature') || !engine.isChoosableAsCreature(inst, cd)) return false;
  if (!hasNumericCreatureLevel(cd)) return false;                       // Artifact-Kreaturen haben kein Level
  if (engine.effectiveCardLevel(cd, ktrl, { heroIdx: inst.heroIdx, inst }) > maxLv) return false;
  // Kontrolle nicht wechselbar: Cardinal Beasts, „Control of this Creature cannot change", control_immune
  if (engine.isOmniImmune(inst) || engine.controlIsLocked(inst) || engine.isCreatureImmune(inst, 'control_immune')) return false;
  if (mitSchutz) {
    if (inst.counters?.untargetable_all || engine.isCreatureImmune(inst, 'targeting_immune')) return false;
    if (typeof engine._isSideNondamageShielded === 'function' && engine._isSideNondamageShielded(ktrl)) return false;
  }
  return true;
}

function ziele(engine, pi, maxLv, mitSchutz) {
  return engine.cardInstances.filter(c => istZiel(engine, pi, c, maxLv, mitSchutz));
}

/** Kann dieser Held die Karte jetzt sinnvoll wirken? (freie Zone + mindestens ein Ziel in seiner Stufe) */
function heldTauglich(engine, pi, heroIdx) {
  const gs = engine.gs;
  const hs = engine.heldSeiteFuer(pi, heroIdx);
  const hero = gs.players[hs]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (freieZonen(gs, hs, heroIdx).length === 0) return false;
  const mitSchutz = !heldHatAuge(engine, hs, heroIdx);
  return ziele(engine, pi, maxLevelFuer(engine, hs, heroIdx), mitSchutz).length > 0;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // Boris-Sperre (Klausel 2): übernimmt die Kontrolle über ein gegnerisches Ziel.
  takesControlOfTargets: true,

  cpuMeta: { scalesWithSchool: SCHOOL },

  // „If the user is equipped with Truth-Seeing Eye, this counts as an additional Action" — je Held.
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return heldHatAuge(engine, engine.heldSeiteFuer(pi, heroIdx), heroIdx);
  },

  /** Grau, solange kein eigener Held (freie Zone + Ziel) die Karte wirken könnte. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return false;
    const heroes = gs.players[pi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) if (heldTauglich(engine, pi, hi)) return true;
    return false;
  },

  /** Je Nutzer: freie Zone in SEINEN Support Zones und ein Ziel in seiner Fighting-Stufe. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return false;
    return heldTauglich(engine, pi, heroIdx);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hs = ctx.cardHeroOwner ?? pi;                      // Brettseite des Nutzers (geliehener Held)
      const ps = gs.players[pi];
      const userHero = ctx.attachedHero || gs.players[hs]?.heroes?.[heroIdx];
      if (!ps || !userHero?.name || userHero.hp <= 0) { gs._spellCancelled = true; return; }

      const maxLv = maxLevelFuer(engine, hs, heroIdx);
      if (freieZonen(gs, hs, heroIdx).length === 0) { gs._spellCancelled = true; return; }

      // ── Ziel: eine Kreatur eines Gegners, Stufe ≤ Fighting-Stufe ──
      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['creature'],
        damageType: 'attack',
        baseDamage: 0,
        dealsDamage: false,
        title: CARD_NAME,
        description: `Choose a Lv${maxLv} or lower Creature your opponent controls and take permanent control of it.`,
        confirmLabel: '🪢 Capture!',
        confirmClass: 'btn-warning',
        cancellable: true,
        dimUnmetCondition: true,           // zu hohe Stufe / nicht übernehmbar: ausgegraut statt weg
        condition: (t) => istZiel(engine, pi, t.cardInstance, maxLv, false),
      });
      if (!target) { gs._spellCancelled = true; return; }

      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        && engine.physicalSide(c) === target.owner);
      if (!inst || !istZiel(engine, pi, inst, maxLv, false)) { gs._spellCancelled = true; return; }

      // ── Platz: eine freie Zone DES NUTZERS ──
      const frei = freieZonen(gs, hs, heroIdx);
      if (frei.length === 0) { gs._spellCancelled = true; return; }
      let zone = frei[0];
      if (frei.length > 1) {
        const gewaehlt = await ctx.promptZonePick(frei, {
          title: CARD_NAME,
          description: `Place ${inst.name} into one of ${userHero.name}'s free Support Zones.`,
          cancellable: true,
          heroShortcut: false,
        });
        if (!gewaehlt) { gs._spellCancelled = true; return; }
        zone = frei.find(z => z.heroIdx === gewaehlt.heroIdx && z.slotIdx === gewaehlt.slotIdx) || frei[0];
      }

      // ── Auftritt: Held rennt an, rotes „!" und Lasso, dann fliegt die Kreatur herüber ──
      const tSeite = engine.physicalSide(inst);
      const tHero = inst.heroIdx, tSlot = inst.zoneSlot;
      const name = inst.name;
      const vorher = inst.controller ?? inst.owner;
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: hs, sourceHeroIdx: heroIdx,
        targetOwner: tSeite, targetHeroIdx: tHero, targetZoneSlot: tSlot,
        cardName: userHero.name, duration: 700,
      });
      await engine._delay(200);
      engine._broadcastEvent('play_zone_animation', {
        type: 'capture_lasso', owner: tSeite, heroIdx: tHero, zoneSlot: tSlot, duration: LASSO_MS,
      });
      await engine._delay(LASSO_MS * 0.62);

      // Während der Animation kann eine Kette die Lage geändert haben.
      if (inst.zone !== 'support' || (inst.controller ?? inst.owner) !== vorher
          || ((gs.players[hs]?.supportZones?.[zone.heroIdx]?.[zone.slotIdx]) || []).length > 0) {
        engine.log('capture_fizzle', { player: ps.username, creature: name });
        engine.sync();
        return;
      }

      const res = await engine.actionTransferCreature(inst, hs, zone.heroIdx, zone.slotIdx, {
        sourceName: CARD_NAME, sourceOwner: pi, controller: pi,
      });
      if (!res?.success) {
        engine.log('capture_fizzle', { player: ps.username, creature: name });
        engine.sync();
        return;
      }

      engine.log('capture_control', {
        player: ps.username, creature: name, hero: userHero.name,
        from: gs.players[vorher]?.username,
      });
      engine.sync();
    },
  },
};
