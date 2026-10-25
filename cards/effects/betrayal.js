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
//  (kein Cardinal Beast, kein „control cannot change", kein `control_immune`, „You can only control 1 …" des Wirkers). Zu hohe Stufe: ausgegraut statt weg. Die Wahl ist nach der Zahlung nicht abbrechbar. Die Wahl ist nach der Zahlung nicht abbrechbar.
//
//  ── PLATZ ───────────────────────────────────────────────────────────────
//  „One of the USER's free Support Zones": nur die freien Zonen des ausführenden Helden (wie Capture, nicht wie Diplomacy). Eine freie Zone: automatisch; mehrere: Zonenwahl
//  (nicht abbrechbar: schon bezahlt). Alice-Teilung (W63a): auch die Zone einer GLEICHNAMIGEN Kreatur zählt, geteilte Zonen zuerst. „A Hero can only have 1 Gigantisaur": Zonen, die das verletzen,
//  fallen für die Kreatur weg (sonst wäre das Gold weg und die Übernahme scheiterte). Ist keine Zone frei, ist der Held kein Nutzer (`canPlayWithHero`).
//  Geliehener Held (Love Shot, Charme): die Zone liegt auf dessen Brettseite, der neue Kontrolleur ist der Spieler (`opts.controller`).
//
//  ── KOSTEN: 5 GOLD AN DEN GEGNER (Al, 25.10.2026) ──────────────────────
//  „You must pay your opponent 5 Gold to use this Spell" = Kosten für das bloße EINSETZEN des Spells (Z7c, Vorbild Knife Throw): `payActivationCost` zahlt VOR dem Reaktionsfenster.
//   • Nicht zahlbar (`canAffordGold`: Debt-O-Tron-Kredit zählt, Gold-Sperre `goldLocked` sperrt) → `false`: Karte bleibt auf der Hand, nichts passiert; die Karte ist dann auch grau.
//   • Der Spell wird danach geblockt/negiert (Kette, Invisibility Cloak, Storm Ring …) → die 5 Gold bleiben beim Gegner. Die Zielwahl in `onPlay` ist nach der Zahlung NICHT mehr abbrechbar.
//   • EMPFÄNGER = „your opponent" = `engine.opponentOf(pi)` (genau ein Gegner, im Skill Test der Fokus-Gegner); Ziele sind nur Kreaturen, die DIESER Gegner kontrolliert — so
//     gilt „das Gold geht an den Kontrolleur der Kreatur" von selbst. Beide Buchungen (Zahler −5, Empfänger +5 über `actionGainGold`, also mit Gewinn-Hooks: Gold Trap,
//     Gold-Sperre des Empfängers [Golden Arrow → kommt nichts an]) geschehen bei der Zahlung, genau einmal. Gold-freies Spielen (`kostenlosSpielen`) zahlt nichts.
//   • ANZEIGE: der Zustand ist sofort gebucht, die Zahlen im Client halten aber den Stand vor der Zahlung (`betrayal_gold_hold`), bis die Animation sie zählt (Münzflug: je Abflug −1, je
//     Landung +1; Stehl-Animation: Zahler beim Abflug, Empfänger nach der Landung) und `betrayal_gold_release` (oder die 25-s-Sicherung des Clients) sie freigibt.
//   • AUSGANG → BILD (nichts wird doppelt gutgeschrieben):
//       – Spell geblockt/negiert (kein `onPlay`; oder in der Zielwahl negiert): Stehl-Animation DIREKT vom eigenen zum Gegner-Gold (`gold_steal_burst`, Richtung umgekehrt zu Deepsea
//         Pirate) — gespielt über `spellVisual` (die Engine ruft es bei jeder Negierung, die Bilder zeigt) und, wo die Engine keine Bilder spielt, am Ende von `onPlay`;
//       – Wirkung gelingt ODER die Übernahme scheitert nach der Zahlung (Umleitung auf eine unzulässige Kreatur, Defending the Gate, Monia, Cardinal …): die Münz-Animation über die Kreatur;
//         die Kreatur wechselt die Zone nur, wenn die Übernahme gelingt.
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
//  `ZONE_ANIM_SFX.ev_betrayal_coins` (Münzklang je Abflug und Landung). Geblockt/negiert: `gold_steal_burst` (Münzstrom, Klang `ev_gold_steal_burst`).
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
const STEHL_MS = 1100;                                           // Dauer des Münzstroms `gold_steal_burst` (Abflug bis Landung)

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
  if (ktrl === pi || ktrl !== engine.opponentOf(pi)) return false;      // nur Kreaturen DES Gegners („your opponent“), dem die 5 Gold gehören
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

// ── Zahlung und Bilder ──────────────────────────────────────────────────

/**
 * Zahlt die 5 Gold (Zahler −5, Gegner +5) und merkt den Vorgang in `gs._betrayalPay`. Liefert `false`, wenn nicht zahlbar. Eine Stelle für `payActivationCost` und den Fallback in `onPlay`.
 */
async function zahle(engine, pi) {
  const gs = engine.gs;
  if (!engine.canAffordGold(pi, GOLD_KOSTEN, CARD_NAME)) return false;
  const empf = engine.opponentOf(pi);
  // Die Anzeige hält den Stand VOR der Zahlung, bis eine Animation sie zählt (Client: `betrayal_gold_hold`); der Zustand ist sofort gebucht.
  engine._broadcastEvent('betrayal_gold_hold', { seats: { [pi]: gs.players[pi].gold || 0, [empf]: gs.players[empf]?.gold || 0 } });
  const gezahlt = await engine._payCardCost(pi, GOLD_KOSTEN, { cardName: CARD_NAME });
  if (gezahlt > 0) await engine.actionGainGold(empf, gezahlt, { source: CARD_NAME });
  engine.log('betrayal_pay', { player: gs.players[pi]?.username, amount: gezahlt, to: gs.players[empf]?.username });
  gs._betrayalPay = { pi, empf, betrag: gezahlt, turn: gs.turn, gezeigt: false };
  if (!(gezahlt > 0)) engine._broadcastEvent('betrayal_gold_release', {});
  engine.sync();
  return true;
}

/** Gibt die gehaltene Anzeige frei (alle Sitze oder die genannten). */
function gibFrei(engine, seats) {
  engine._broadcastEvent('betrayal_gold_release', seats ? { seats } : {});
}

/**
 * Stehl-Animation (Karte geblockt/negiert): Münzstrom direkt vom Zahler zum Gegner (`gold_steal_burst`, nur die Richtung ist umgekehrt zu Deepsea Pirate). Höchstens einmal je Zahlung —
 * `spellVisual` (Engine bei Negierung) und das Ende von `onPlay` rufen beide; die Zahl des Zahlers fällt beim Abflug, die des Empfängers nach der Landung. Bildet nur ab, bucht nichts.
 */
async function stehlAnimation(engine) {
  const p = engine.gs._betrayalPay;
  if (!p || p.gezeigt || p.turn !== engine.gs.turn) return;
  p.gezeigt = true;
  if (!(p.betrag > 0)) return;
  engine._broadcastEvent('gold_steal_burst', { fromPlayer: p.pi, toPlayer: p.empf, amount: p.betrag });
  gibFrei(engine, [p.pi]);
  await engine._delay(STEHL_MS);
  gibFrei(engine);
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

  // Entkoppelte Zauberbilder (v1179): wird der Spell geblockt/negiert, läuft `onPlay` nie — die Engine spielt dann das hier: die Stehl-Animation vom Zahler zum Gegner.
  spellVisual: async (engine) => { await stehlAnimation(engine); },

  // In der Kette negiert (kein `onPlay`, kein `spellVisual`): dieselbe Stehl-Animation; der Vorgang ist danach abgeschlossen. (Engine-Haken `routeNegatedInitialCard`, W78.)
  async onInitialNegated(engine) {
    await stehlAnimation(engine);
    delete engine.gs._betrayalPay;
  },

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

  /** ★ Z7c: die 5 Gold („to use this Spell") VOR dem Reaktionsfenster; `false` = nicht zahlbar → die Karte bleibt auf der Hand. */
  async payActivationCost(ctx) {
    if (!(await zahle(ctx._engine, ctx.cardOwner))) return false;
    if (ctx.card) ctx.card._kostenBezahlt = true;
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

      // ── Kosten: Normalweg — `payActivationCost` hat vor der Kette bezahlt; sonst (Sofort-Weg) jetzt ──
      if (ctx.card?._kostenBezahlt) delete ctx.card._kostenBezahlt;
      else if (!(await zahle(engine, pi))) { gs._spellCancelled = true; return; }
      const zahlung = gs._betrayalPay;

      try {
        const maxLv = maxLevelFuer(engine, pi, hs, heroIdx);

        // ── Ziel ──
        // pflichtwahl: die 5 Gold sind beim Einsetzen schon bezahlt (payActivationCost, Z7c, Al 25.10.) — ab dort gibt es keinen Abbruch mehr
        const target = await ctx.promptDamageTarget({
          side: 'enemy',
          types: ['creature'],
          damageType: null,
          dealsDamage: false,
          title: CARD_NAME,
          description: `Choose a Lv${maxLv} or lower Creature your opponent controls and take permanent control of it. You paid ${GOLD_KOSTEN} Gold to your opponent.`,
          confirmLabel: '🗡️ Betray!',
          confirmClass: 'btn-warning',
          cancellable: false,
          noSpellCancel: true,               // nie zurück auf die Hand: es ist bezahlt
          dimUnmetCondition: true,           // zu hohe Stufe / nicht übernehmbar: ausgegraut statt weg
          condition: (t) => istZiel(engine, pi, t.cardInstance, maxLv, false),
        });

        // Kein Ziel mehr / in der Zielwahl negiert: die Stehl-Animation (läuft nur, wenn `spellVisual` sie nicht schon gespielt hat).
        if (!target) {
          engine.log('betrayal_fizzle', { player: ps.username, reason: gs._spellNegatedByEffect ? 'negated' : 'no_target' });
          await stehlAnimation(engine);
          engine.sync();
          return;
        }
        const inst = target.cardInstance && engine.cardInstances.find(c => c.id === target.cardInstance.id && c.zone === 'support');
        const name = target.cardName;

        // ── Zone: eine freie Zone DES NUTZERS (nicht abbrechbar) ──
        let zone = null;
        if (inst && istZiel(engine, pi, inst, maxLv, false)) {
          const frei = freieZonen(engine, hs, heroIdx, pi, inst);
          zone = frei[0] || null;
          if (frei.length > 1) {
            const picked = await ctx.promptZonePick(frei, {
              title: CARD_NAME,
              description: `Place ${inst.name} into one of ${userHero.name}'s free Support Zones.`,
              cancellable: false,
              heroShortcut: false,
            });
            zone = (picked && frei.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx)) || frei[0];
          }
        }

        // ── Münz-Animation über der Kreatur: Gold-Anzeige → Kreatur → Gold-Anzeige des Gegners (läuft auch, wenn die Übernahme danach scheitert) ──
        zahlung.gezeigt = true;
        const seite = inst ? engine.physicalSide(inst) : target.owner;
        const t0 = Date.now();
        if (zahlung.betrag > 0) {
          engine._broadcastEvent('betrayal_coins', {
            fromPlayer: pi, toPlayer: zahlung.empf,
            targetOwner: seite, targetHeroIdx: inst ? inst.heroIdx : target.heroIdx, targetZoneSlot: inst ? inst.zoneSlot : target.slotIdx,
            coins: COINS, stepMs: STEP_MS, legMs: LEG_MS, dwellMs: DWELL_MS,
          });
          await engine._delay(LEAVE_MS);
        }

        // ── Übernahme: die lebende Instanz neu auflösen — eine Reaktion kann sie bewegt, übernommen oder entfernt haben ──
        const live = inst && engine.cardInstances.find(c => c.id === inst.id && c.zone === 'support');
        if (!live || engine.kontrolleurVon(live) !== zahlung.empf) { engine.log('betrayal_fizzle', { player: ps.username, creature: name, reason: 'gone' }); engine.sync(); return; }
        // Eine Umleitung der Zielwahl (Challenge, Anti-Magnet …) darf nicht auf eine Kreatur führen, die der Text nicht erlaubt (zu hohe Stufe, Cardinal …): Kosten sind bezahlt, die Übernahme entfällt.
        if (!zone || !istZiel(engine, pi, live, maxLv, false)) { engine.log('betrayal_fizzle', { player: ps.username, creature: name, reason: zone ? 'illegal' : 'no_zone' }); engine.sync(); return; }
        // Platz noch frei? (sonst neu bestimmen)
        const noch = freieZonen(engine, hs, heroIdx, pi, live);
        if (!noch.some(z => z.heroIdx === zone.heroIdx && z.slotIdx === zone.slotIdx)) {
          if (noch.length === 0) { engine.log('betrayal_fizzle', { player: ps.username, creature: name, reason: 'no_zone' }); engine.sync(); return; }
          zone = noch[0];
        }

        const vorher = engine.kontrolleurVon(live);
        const res = await engine.actionTransferCreature(live, hs, zone.heroIdx, zone.slotIdx, {
          sourceName: CARD_NAME, sourceOwner: pi, controller: pi,
        });
        if (!res?.success) {
          engine.log('betrayal_fizzle', { player: ps.username, creature: name, reason: 'blocked' });
          engine.sync();
          return;
        }
        // „Permanent" schlägt eine vorübergehende Übernahme (Aligning Goals, Cute Conversion …): deren Rückgabe am Zugende würde die Betrayal-Übernahme sonst wieder aufheben.
        if (live.stolenBy != null) { delete live.stolenBy; delete live.stolenFromOwner; }
        engine.log('betrayal_control', {
          player: ps.username, creature: name, hero: userHero.name, from: gs.players[vorher]?.username,
        });
        engine.sync();
        // Die Münzen landen währenddessen (der Flug der Kreatur dauert länger als `LEG_MS`); der Rest der Wartezeit, falls nicht.
        const rest = LAND_MS - (Date.now() - t0);
        if (rest > 0) await engine._delay(rest);
      } finally {
        // Anzeige freigeben (idempotent; der Client gibt nach dem Münzflug selbst frei).
        if (zahlung && zahlung.betrag > 0) gibFrei(engine);
        if (gs._betrayalPay === zahlung) delete gs._betrayalPay;
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
