'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Betrayal"
//  Spell (Magic Arts Lv1, Normal)
//
//  „Choose a level 1/2/3 or lower Creature your opponent controls and take permanent control of it. Place it into one of the
//   user's free Support Zones.
//   You must pay your opponent 5 Gold to use this Spell. This counts as an additional Action."
//
//  Schwester von „Capture" (Attack, gleiches Muster) und „Diplomacy"/„Dark Gear" (Gold-Kosten) — die Unterschiede entscheiden den Bau:
//
//  ── STUFE 1/2/3 ─────────────────────────────────────────────────────────
//  Die Stufengrenze ist die Magic-Arts-Stufe des Nutzers (1–3, `effectiveSchoolLevelForCaster`: „as if"-Stufen zählen, negierte Abilities = 0 → Mindestgrenze 1,
//  denn die Karte ist selbst Lv1). Verglichen wird das WIRKSAME Level der Kreatur aus Sicht ihres Kontrolleurs (`effectiveCardLevel`: Buffs, Lethe-Stempel …). Kreaturen
//  ohne Level (Artifact-Kreaturen) sind keine Ziele.
//
//  ── ZIELWAHL ────────────────────────────────────────────────────────────
//  Kanonische Spell-Zielwahl (`ctx.promptDamageTarget` mit `dealsDamage: false`, wie Memory Wipe / Capture): Schutz („cannot be chosen": Thicket, Great Wall of Deri, Cloud …),
//  Umleitungs-, Surprise- und Reaktionsfenster, Truth-Seeing Eye des Nutzers. `condition` prüft nur, was keine Wählbarkeit ist: Stufe, Level vorhanden, Kontrolle wechselbar
//  (kein Cardinal Beast, kein „control cannot change", kein `control_immune`, „You can only control 1 …" des Wirkers). Zu hohe Stufe: ausgegraut statt weg.
//
//  ── PLATZ ───────────────────────────────────────────────────────────────
//  „One of the USER's free Support Zones": nur die freien Zonen des ausführenden Helden (wie Capture, nicht wie Diplomacy). Eine freie Zone: automatisch; mehrere: Zonenwahl
//  (abbrechbar). Alice-Teilung (W63a): auch die Zone einer GLEICHNAMIGEN Kreatur zählt, geteilte Zonen zuerst. „A Hero can only have 1 Gigantisaur": Zonen, die das verletzen,
//  fallen für die Kreatur weg (sonst wäre das Gold weg und die Übernahme scheiterte). Ist keine Zone frei, ist der Held kein Nutzer (`canPlayWithHero`).
//  Geliehener Held (Love Shot, Charme): die Zone liegt auf dessen Brettseite, der neue Kontrolleur ist der Spieler (`opts.controller`).
//
//  ── KOSTEN: 5 GOLD AN DEN GEGNER ────────────────────────────────────────
//  „You must pay your opponent 5 Gold to use this Spell" = Aktivierungskosten (Kosten-Vertrag W66b, Als Regel 23.10.: „Kosten generell erst, wenn committed ist"):
//   • unspielbar (grau), solange der Spieler keine 5 Gold zahlen kann (`canAffordGold`: Debt-O-Tron-Kredit zählt, Gold-Sperre `goldLocked` sperrt die Karte);
//   • bezahlt wird im `onTargetChosen`-Haken der Zielwahl — NACH der letzten abbrechbaren Wahl (Ziel, Zone), VOR den Reaktionsfenstern auf das Ziel
//     (Muster Infected Greatmaw): ein Abbruch von Ziel oder Zone lässt Gold, Hand und Brett exakt wie vorher; ab dem Commit ist das Gold weg, auch wenn die Karte danach in
//     der Zielwahl negiert wird (Invisibility Cloak, Storm Ring …) oder die Übernahme scheitert (Defending the Gate, Cardinal Beast, Schutzfenster der Kreatur, Resistance …);
//     (Auch eine Umleitung der Zielwahl auf eine Kreatur, die der Text nicht erlaubt [zu hohe Stufe, Cardinal …], lässt die Übernahme entfallen — gezahlt ist gezahlt: Log `betrayal_fizzle`.)
//   • wird die Karte schon in der Kette (vor `onPlay`) negiert, ist nie gezahlt worden;
//   • der EMPFÄNGER ist der bisherige KONTROLLEUR der Kreatur („your opponent": im Zweikampf der Gegner, bei 3–4 Sitzen der, dem die Kreatur gehört, nicht der Besitzer).
//     Er bekommt das Gold, wenn die letzte Münze landet (`actionGainGold`, also mit allen Gewinn-Hooks: Gold Trap des Wirkers, Gold-Sperre des Empfängers [Golden Arrow] — dann
//     kommt nichts an, der Zahler hat trotzdem bezahlt, wie bei Festive Werz). Gold-freies Spielen (`kostenlosSpielen`) zahlt und überweist nichts.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „This counts as an additional Action" → `inherentAction: true` (immer; Main Phase: spielbar, Action Phase: verbraucht die Aktion nicht).
//
//  ── KONTROLLE ───────────────────────────────────────────────────────────
//  `actionTransferCreature` ist der EINE Weg aller Übernahmen (Tor-Schutz, Cardinal-Immunität, „control cannot change", Flug, `onCardEnterZone`, `onTakeControl` für Very
//  Special Prisoner, Schutzfenster `beforeCreatureAffected` [Monia]). `originalOwner` bleibt der Gegner (die Karte geht später in dessen Ablage). Anders als bei Diplomacy,
//  Dark Gear und Aligning Goals wird die Kreatur NICHT negiert (Al: sie darf ihren aktiven Effekt DIREKT nutzen): Zähler, Anhängsel, Statuswerte wandern mit; die Sperre „in dieser
//  Runde beschworen" gibt es für übernommene Kreaturen nicht (sie wurde nicht beschworen). `takesControlOfTargets` = Boris-Sperre.
//
//  ── BILD UND KLANG ──────────────────────────────────────────────────────
//  `betrayal_coins` (Client, `onBetrayalCoins` in app-board.jsx, Pixelart): fünf Goldmünzen (das feste Münz-Sprite des Spielgestalters, `gold-muenze.png`, ganzzahlig 2×) fliegen im
//  Takt von der EIGENEN Gold-Anzeige in ganzen Pixeln im Bogen zur Ziel-Kreatur, kreisen dort kurz (harter Goldrahmen blinkt) und fliegen zur Gold-Anzeige des Empfängers
//  weiter. Verlässt die fünfte Münze die Kreatur (`LEAVE_MS`), fliegt diese (Engine-Flug `play_card_transfer`) in ihre neue Zone; die Münzen landen währenddessen. Klang:
//  `ZONE_ANIM_SFX.ev_betrayal_coins` (Münzklang je Abflug und Landung).
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU nimmt die wertvollste wählbare Kreatur (Stufe, HP, ATK); ob sie die Karte spielt, entscheiden ihre Bewertungen (Gold −5 / +5 beim Gegner gegen die Kreatur).
// ═══════════════════════════════════════════

const { hasCardType, hasNumericCreatureLevel } = require('./_hooks');

const CARD_NAME = 'Betrayal';
const SCHOOL = 'Magic Arts';
const MAX_STUFE = 3;
const GOLD_KOSTEN = 5;

// Takt des Münzflugs (deckt sich mit `onBetrayalCoins` im Client): 5 Münzen im Abstand STEP_MS; je Münze Hinflug LEG_MS, Aufenthalt an der Kreatur DWELL_MS, Weiterflug LEG_MS.
const COINS = 5;
const STEP_MS = 130;
const LEG_MS = 360;
const DWELL_MS = 100;
const LEAVE_MS = (COINS - 1) * STEP_MS + LEG_MS + DWELL_MS;      // die fünfte Münze verlässt die Kreatur
const LAND_MS = LEAVE_MS + LEG_MS;                               // die fünfte Münze landet beim Empfänger

/** Magic-Arts-Stufe des Nutzers (Brettseite `hs`), 1–3. */
function maxLevelFuer(engine, pi, hs, heroIdx) {
  const stufe = engine.effectiveSchoolLevelForCaster(SCHOOL, pi, heroIdx, hs);
  return Math.max(1, Math.min(stufe, MAX_STUFE));
}

/**
 * Freie Support Zones DES Helden (Brettseite `hs`): [{ heroIdx, slotIdx, label }].
 * Mit `inst` (die zu übernehmende Kreatur): W63a Alice-Teilung (auch die Zone einer GLEICHNAMIGEN Kreatur des Kontrolleurs `pi`, geteilte zuerst) und
 * der Gigantisaur-Riegel („A Hero can only have 1 Gigantisaur …": solche Zonen fallen für die Kreatur weg).
 */
function freieZonen(engine, hs, heroIdx, pi = null, inst = null) {
  const gs = engine.gs;
  let zonen;
  if (inst) {
    zonen = engine.beschwoerZonenFuer(pi, inst.name, { seite: hs, heroIdx, nurBasis: true, namedHeroesOnly: true })
      .map(z => ({ heroIdx, slotIdx: z.slotIdx, label: z.label, ...(z.shared ? { shared: true, stackDepth: z.stackDepth } : {}) }));
    if (engine.uebernahmeUnzulaessig(inst, pi, hs, heroIdx) === 'gigantisaur_per_hero') zonen = [];
    return zonen;
  }
  const hero = gs.players[hs]?.heroes?.[heroIdx];
  zonen = [];
  for (let si = 0; si < 3; si++) {
    const slot = gs.players[hs]?.supportZones?.[heroIdx]?.[si];
    if (Array.isArray(slot) && slot.length === 0) zonen.push({ heroIdx, slotIdx: si, label: `${hero?.name || 'Hero'} — Slot ${si + 1}` });
  }
  return zonen;
}

/**
 * Ist `inst` ein Ziel für `pi` bei Stufengrenze `maxLv`?
 * `mitSchutz`: auch die „kann nicht gewählt werden"-Schutzarten prüfen (Gating ohne Truth-Seeing Eye). Die Zielwahl selbst prüft die nicht — dort filtert die Engine.
 */
function istZiel(engine, pi, inst, maxLv, mitSchutz) {
  if (!inst || inst.zone !== 'support' || inst.faceDown || inst.counters?._heldKreatur) return false;   // Held als Kreatur (Hulijing) wechselt nie die Kontrolle
  const ktrl = engine.kontrolleurVon(inst);
  if (ktrl === pi || !engine.opponentsOf(pi).includes(ktrl)) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || !hasCardType(cd, 'Creature') || !engine.isChoosableAsCreature(inst, cd)) return false;
  if (!hasNumericCreatureLevel(cd)) return false;                       // Artifact-Kreaturen haben kein Level
  if (engine.effectiveCardLevel(cd, ktrl, { heroIdx: inst.heroIdx, inst }) > maxLv) return false;
  // Kontrolle nicht wechselbar: Cardinal Beasts, „Control of this Creature cannot change", control_immune, „You can only control 1 …" des Wirkers
  if (engine.isOmniImmune(inst, pi) || engine.controlIsLocked(inst) || engine.isCreatureImmune(inst, 'control_immune')) return false;
  if (engine.uebernahmeUnzulaessig(inst, pi) === 'only_control_1') return false;
  if (mitSchutz) {
    if (inst.counters?.untargetable_all || engine.isCreatureImmune(inst, 'targeting_immune')) return false;
    if (typeof engine._isSideNondamageShielded === 'function' && engine._isSideNondamageShielded(ktrl)) return false;
    if (inst.counters?.untargetable_by_opponent && inst.counters.untargetable_by_opponent_pi === pi) return false;   // Golden Wings & Co.
    if (typeof engine._boardGuardsCreatureChoice === 'function' && engine._boardGuardsCreatureChoice(inst, pi)) return false;   // Board of Kings
    if (engine.gs.firstTurnProtectedPlayer === ktrl) return false;       // Erste-Runden-Immunität des Gegners
  }
  return true;
}

function ziele(engine, pi, maxLv, mitSchutz) {
  return engine.cardInstances.filter(c => istZiel(engine, pi, c, maxLv, mitSchutz));
}

/** Trägt der Wirker ein Truth-Seeing Eye (oder einen gleichwertigen „kann jedes Ziel wählen"-Effekt)? Dann zählen die Schutzarten nicht. */
function ohneSchutz(engine, hs, heroIdx) {
  return !!engine._sourceIgnoresTargetingRestrictions({ name: CARD_NAME, controller: hs, heroIdx });
}

/** Kann dieser Held die Karte jetzt sinnvoll wirken? (Gold, freie Zone, mindestens ein Ziel in seiner Stufe) */
function heldTauglich(engine, pi, heroIdx) {
  const gs = engine.gs;
  const hs = engine.heldSeiteFuer(pi, heroIdx);
  const hero = gs.players[hs]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (!engine.canAffordGold(pi, GOLD_KOSTEN, CARD_NAME)) return false;
  const zs = ziele(engine, pi, maxLevelFuer(engine, pi, hs, heroIdx), !ohneSchutz(engine, hs, heroIdx));
  if (zs.length === 0) return false;
  // keine freie Zone für das Ziel (auch Alice-Teilung und Gigantisaur-Riegel je Ziel)
  return zs.some(t => freieZonen(engine, hs, heroIdx, pi, t).length > 0);
}

/** Grober Wert einer Kreatur für die CPU. */
function kreaturWert(engine, t) {
  const inst = t.cardInstance;
  const cd = (inst ? engine.getEffectiveCardData(inst) : null) || engine._getCardDB()[t.cardName] || {};
  return (cd.level || 0) * 2 + (cd.hp || 0) / 60 + (cd.atk || 0) / 40;
}

module.exports = {
  requiresTarget: true,
  // ^ Blinded-Sperre (cards/effects/_hooks.js).
  blockedByFirstTurnProtection: true,     // trifft nur die Gegnerseite (Erstrunden-Immunität)

  // Boris-Sperre (Klausel 2): übernimmt die Kontrolle über ein gegnerisches Ziel.
  takesControlOfTargets: true,

  // „This counts as an additional Action" — immer.
  inherentAction: true,

  cpuMeta: { scalesWithSchool: SCHOOL },

  /** Grau, solange kein eigener Held (Gold + freie Zone + Ziel) die Karte wirken könnte. */
  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    const heroes = gs.players[pi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) if (heldTauglich(eng, pi, hi)) return true;
    return false;
  },

  /** Je Nutzer: Gold, freie Zone in SEINEN Support Zones und ein Ziel in seiner Magic-Arts-Stufe. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    return heldTauglich(eng, pi, heroIdx);
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
      if (!engine.canAffordGold(pi, GOLD_KOSTEN, CARD_NAME)) { gs._spellCancelled = true; return; }

      const maxLv = maxLevelFuer(engine, pi, hs, heroIdx);
      const bezahlt = { ja: false };                          // Zustand der Zahlung (im Haken gesetzt, im finally abgerechnet)

      try {
        // ── Ziel (abbrechbar), dann Zone (abbrechbar), dann COMMIT + Zahlung — alles im Haken `onTargetChosen` ──
        const target = await ctx.promptDamageTarget({
          side: 'enemy',
          types: ['creature'],
          damageType: null,
          dealsDamage: false,
          title: CARD_NAME,
          description: `Choose a Lv${maxLv} or lower Creature your opponent controls and take permanent control of it. You pay ${GOLD_KOSTEN} Gold to its controller.`,
          confirmLabel: '🗡️ Betray!',
          confirmClass: 'btn-warning',
          cancellable: true,
          dimUnmetCondition: true,           // zu hohe Stufe / nicht übernehmbar: ausgegraut statt weg
          condition: (t) => istZiel(engine, pi, t.cardInstance, maxLv, false),
          onTargetChosen: async (gewaehlt) => {
            // Ein Neuwurf der Zielwahl (totes Ziel nach einer Reaktion) betritt den Haken erneut: die Zahlung ist schon geleistet.
            if (bezahlt.ja) return true;
            const inst = gewaehlt?.cardInstance;
            if (!inst || !istZiel(engine, pi, inst, maxLv, false)) return false;
            if (!engine.canAffordGold(pi, GOLD_KOSTEN, CARD_NAME)) return false;

            // Platz: eine freie Zone DES NUTZERS
            const frei = freieZonen(engine, hs, heroIdx, pi, inst);
            if (frei.length === 0) return false;
            let zone = frei[0];
            if (frei.length > 1) {
              const picked = await ctx.promptZonePick(frei, {
                title: CARD_NAME,
                description: `Place ${inst.name} into one of ${userHero.name}'s free Support Zones.`,
                cancellable: true,
                heroShortcut: false,
              });
              if (!picked) return false;
              zone = frei.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx) || frei[0];
            }

            // ── COMMIT: ab hier gibt es keinen Abbruch mehr — erst jetzt wird bezahlt (W66b) ──
            engine.commitAppearance();
            const empfaenger = engine.kontrolleurVon(inst);
            const seite = engine.physicalSide(inst);
            const gezahlt = await engine._payCardCost(pi, GOLD_KOSTEN, { cardName: CARD_NAME });
            bezahlt.ja = true;
            bezahlt.betrag = gezahlt;
            bezahlt.empfaenger = empfaenger;
            bezahlt.zone = zone;
            bezahlt.t0 = Date.now();
            engine.log('betrayal_pay', { player: ps.username, amount: gezahlt, to: gs.players[empfaenger]?.username, creature: inst.name });

            // Münzflug: eigene Gold-Anzeige → Kreatur → Gold-Anzeige des Empfängers. Die Zielwahl läuft weiter (Reaktionsfenster), sobald die fünfte Münze die Kreatur verlassen hat.
            if (gezahlt > 0) {
              engine._broadcastEvent('betrayal_coins', {
                fromPlayer: pi, toPlayer: empfaenger,
                targetOwner: seite, targetHeroIdx: inst.heroIdx, targetZoneSlot: inst.zoneSlot,
                coins: COINS, stepMs: STEP_MS, legMs: LEG_MS, dwellMs: DWELL_MS,
              });
              await engine._delay(LEAVE_MS);
            }
            return true;
          },
        });

        // Abbruch (nichts bezahlt) oder in der Zielwahl negiert (bezahlt, Kreatur bleibt): nichts zu übernehmen.
        if (!target) {
          if (bezahlt.ja) engine.log('betrayal_fizzle', { player: ps.username, reason: 'negated' });
          return;
        }

        // ── Übernahme: die lebende Instanz neu auflösen — eine Reaktion kann sie bewegt, übernommen oder entfernt haben ──
        const inst = target.cardInstance && engine.cardInstances.find(c => c.id === target.cardInstance.id && c.zone === 'support');
        if (!inst || engine.kontrolleurVon(inst) !== bezahlt.empfaenger) {
          engine.log('betrayal_fizzle', { player: ps.username, creature: target.cardName, reason: 'gone' });
          engine.sync();
          return;
        }
        const name = inst.name;
        // Eine Umleitung in der Zielwahl (Challenge, Anti-Magnet …) darf nicht auf eine Kreatur führen, die der Text nicht erlaubt (zu hohe Stufe, Cardinal …): Kosten sind bezahlt, die Übernahme entfällt.
        if (!istZiel(engine, pi, inst, maxLv, false)) { engine.log('betrayal_fizzle', { player: ps.username, creature: name, reason: 'illegal' }); engine.sync(); return; }

        // Platz noch frei? (sonst neu bestimmen; der Spieler hat sich schon festgelegt — Zonenwahl wiederholen wäre kein Abbruch mehr)
        let zone = bezahlt.zone;
        const noch = freieZonen(engine, hs, heroIdx, pi, inst);
        if (!noch.some(z => z.heroIdx === zone.heroIdx && z.slotIdx === zone.slotIdx)) {
          if (noch.length === 0) { engine.log('betrayal_fizzle', { player: ps.username, creature: name, reason: 'no_zone' }); engine.sync(); return; }
          zone = noch[0];
        }

        const vorher = engine.kontrolleurVon(inst);
        const res = await engine.actionTransferCreature(inst, hs, zone.heroIdx, zone.slotIdx, {
          sourceName: CARD_NAME, sourceOwner: pi, controller: pi,
        });
        if (!res?.success) {
          engine.log('betrayal_fizzle', { player: ps.username, creature: name, reason: 'blocked' });
          engine.sync();
          return;
        }
        // „Permanent" schlägt eine vorübergehende Übernahme (Aligning Goals, Cute Conversion …): deren Rückgabe am Zugende würde die Betrayal-Übernahme sonst wieder aufheben.
        if (inst.stolenBy != null) { delete inst.stolenBy; delete inst.stolenFromOwner; }
        engine.log('betrayal_control', {
          player: ps.username, creature: name, hero: userHero.name, from: gs.players[vorher]?.username,
        });
        engine.sync();
      } finally {
        // Die letzte Münze landet: erst jetzt bekommt der Empfänger das Gold (gleichgültig, ob die Übernahme gelang — gezahlt ist gezahlt).
        if (bezahlt.ja && bezahlt.betrag > 0) {
          const rest = LAND_MS - (Date.now() - bezahlt.t0);
          if (rest > 0) await engine._delay(rest);
          await engine.actionGainGold(bezahlt.empfaenger, bezahlt.betrag, { source: CARD_NAME });
          engine.sync();
        }
      }
    },
  },

  /** CPU: die wertvollste wählbare Kreatur nehmen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget' || promptData?.config?.title !== CARD_NAME) return undefined;
    const frei = (promptData.validTargets || []).filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    let best = frei[0], bestV = -Infinity;
    for (const t of frei) { const v = kreaturWert(engine, t); if (v > bestV) { bestV = v; best = t; } }
    return [best.id];
  },
};
