'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Animal Training"  (W82)
//  Attack (Normal, Lv1, Fighting)
//
//  „Choose a target and deal damage equal to the user's Attack stat to it. If this Attack would defeat a Creature your opponent controls, you may fully heal its HP instead and take
//   permanent control of it, placing it into one of the attacker's free Support Zones, but negate its effects for the rest of the turn."
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  ① Zielwahl: die kanonische Schadens-Zielwahl (`ctx.promptDamageTarget`: Truth-Seeing Eye, Taunt, Zielschutz, Umleiter, Surprises, Post-Target-Reaktionen) — jedes Ziel, Held oder
//     Creature, beide Seiten, nur nicht der Angreifer selbst (wie Hammer Throw/Tail Slap). Genau EIN Ziel (`neverMultiTarget`).
//  ② Schaden = die AKTUELLE Attack-Stat des Nutzers beim Auflösen (`usesHeroAtk`, Typ `attack`: Reduktionen, Schilde, Immunitäten & Co. greifen wie bei jeder Attack).
//  ③ „If this Attack would defeat a Creature your opponent controls … instead": ENGINE-VERTRAG `quelleErsetztNiederlage` (`_engine.js` → `_quelleErsetztNiederlage`, Gegenstück zu
//     `selfPreDefeat`). Die Engine ruft ihn im Schadens-Batch, wenn ein Attack-Treffer einer Heldenquelle eine Creature besiegen WÜRDE — NACH den Hand-Reaktionen des Kontrolleurs
//     (rettet er sie dort, gibt es nichts zu ersetzen) und nach jeder Betragsminderung (nur ein weiterhin tödlicher Treffer zählt, auch ein durch Reaktionen letal gewordener).
//     Die Karte fragt dann den Nutzer („you may": Ja/Nein, „No" = die Creature wird normal besiegt) und
//       1. lässt den Nutzer eine freie Support Zone des ANGREIFERS (des Helden, der die Attack ausführt) wählen — eine freie: automatisch, mehrere: `promptZonePick` (Alice-Teilung: auch die
//          Zone einer gleichnamigen Creature zählt, geteilte zuerst; Gigantisaur-/Mehrzonen-Riegel wie Betrayal). Keine freie Zone → keine Wahl, normaler Tod;
//       2. übernimmt sie DAUERHAFT über `actionTransferCreature` (der EINE Weg aller Übernahmen: Defending the Gate, Cardinal Beasts, „Control cannot change", `control_immune`,
//          „You can only control 1 X", Monia-Fenster `beforeCreatureAffected`, Flug, `onCardEnterZone`/`onTakeControl`). Scheitert die Übernahme, ist der Ersatz gescheitert: die
//          Creature wird normal besiegt (nichts ist vorher geschehen: erst Übernahme, dann Heilung);
//       3. heilt sie VOLL (Maximum der Creature, Heilweg wie Pythia: `actionHealCreature` auf das Maximum, danach auf das Maximum gesetzt — „instead" ersetzt den Tod, es bleibt nicht tot);
//       4. negiert ihre Effekte bis zum Ende dieses Zuges (`actionNegateCreature`, Muster Dark Gear/Diplomacy: unverhinderbar, `selfInflicted`, Ablauf zu Beginn des nächsten Zuges).
//     Es gibt keinen Tod: keine Todes-Trigger, kein „defeated by", kein Kadaver; Zähler, Anhängsel und Status der Creature wandern mit (wie bei Betrayal/Capture). `originalOwner`
//     bleibt der Gegner (ihre Karte geht später in dessen Ablage).
//  ── REIHENFOLGE (Al, 27.10.) ────────────────────────────────────────────
//  Der BESITZER der Creature rettet zuerst: Selbst-Ersatz (Pythia/Hydra `selfPreDefeat`), JEDES Reaktionsfenster der Hand, Extra Life, eine schon vorgemerkte Wiederbelebung (Bone Dog: `_reviveAfterDeath`)
//  gehen dem Ersatz vor; nur ein dann noch tödlicher Endbetrag (nach allen Minderungen) wird ersetzt. Gate und Monia wirken noch VOR dem Schaden: schützen sie die Creature, hat die Attack an ihr GAR KEINEN
//  Effekt (kein Schaden, kein Tod, keine Übernahme). Lehnt der Gegner ab, läuft die Übernahme ohne zweites Fenster durch (die Fenster fragen einmal je Wirkung). Cute Phoenix fragt erst nach dem Tod — ihre
//  Wiederbelebung kommt nicht zum Zug, weil die Creature nicht stirbt.
//  • Keine Ersatzwirkung bei: Helden als Ziel, eigenen/übernommenen Creatures des Nutzers, Cardinal Beasts & Co. (kein Kontrollwechsel möglich), Creatures, die nicht sterben (Schaden zu gering
//    oder verhindert), einem wirksamen gegnerischen Boris („cannot activate effects that would take control …": die Übernahme ist dann gesperrt, die Creature stirbt normal).
//  • Der Ersatz gilt nur für Attack-Schaden dieser Karte (der Vertrag prüft `type === 'attack'`, `usesHeroAtk`, Kartenname).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `animal_training_whip` (Pixelart, ANIM_REGISTRY, Brett-Animation `ppSalve`; Vorlage: das Kartenbild — die Dompteurin mit der Peitsche vor brennenden
//  Schatten-Tieren): eine Peitschenschnur holt hinter dem Angreifer aus, knallt in ganzen Pixeln zum Ziel und schlägt hart ein (Kreuzfunkel, Schlagstriche, Funken, Zielkarte
//  blitzt und zuckt), dann schnellt sie zurück. Bei der Übernahme `animal_training_tame` (Peitschenschlinge schließt sich um die Karte, Flammenfunken steigen auf), nachdem die Creature
//  in ihre neue Zone geflogen ist. Klänge: ZONE_ANIM_SFX. Der Schaden fällt beim Einschlag (`SCHLAG_WARTE_MS`).
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die Zielwahl macht der allgemeine Pilot (`_getCpuTargetResponse`); die Frage „you may" beantwortet `cpuResponse` mit Ja (eine Creature behalten, voll geheilt, schlägt jeden Tod);
//  die Zonenwahl nimmt die Standardantwort (erste freie Zone). In Rollouts läuft derselbe Weg (`promptGeneric` → `cpuResponse`).
//
//  ── Puzzle-Editor ───────────────────────────────────────────────────────
//  Kein Zähler, keine Marke und kein gemerktes Ziel: die Karte ist zustandslos (die Negierung der übernommenen Creature ist der normale „Negated"-Status des Puzzle-Editors).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Animal Training';
const ANIM_MS = 1000;          // Länge von `animal_training_whip` im Client (ENDE)
const SCHLAG_WARTE_MS = 430;   // bis zum Einschlag (330 ms im Bild + 100 ms Einbau-Versatz des Clients), dann fällt der Schaden
const TAME_MS = 760;           // Länge von `animal_training_tame`

/** Maximale HP einer Creature (Instanz-Maximum, sonst gedruckte HP). */
function maxHpVon(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  return inst.counters?.maxHp ?? cd?.hp ?? 0;
}

/**
 * Kann `pi` die Creature `inst` übernehmen? (Gegnerische, offene Creature, deren Kontrolle sich ändern darf; Zonen separat.)
 * Dieselben Sperren wie Betrayal/Capture: Cardinal Beasts, „Control of this Creature cannot change", `control_immune`, „You can only control 1 X" — dazu Boris.
 */
function uebernehmbar(engine, pi, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown || inst.counters?._heldKreatur) return false;   // Held als Kreatur (Hulijing) wechselt nie die Kontrolle
  const ktrl = engine.kontrolleurVon(inst);
  if (ktrl === pi || !engine.opponentsOf(pi).includes(ktrl)) return false;       // nur Creatures eines GEGNERS
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || !hasCardType(cd, 'Creature')) return false;
  if (engine.isOmniImmune(inst, pi) || engine.controlIsLocked(inst) || engine.isCreatureImmune(inst, 'control_immune')) return false;
  if (engine.uebernahmeUnzulaessig(inst, pi) === 'only_control_1') return false;
  if (engine.borisHidesOpponentSide(pi)) return false;                              // Boris: „cannot activate effects that would take control of any targets you control"
  return true;
}

/**
 * Freie Support Zones DES ANGREIFERS (Brettseite `hs`, Held `heroIdx`) für `inst`: [{ heroIdx, slotIdx, label }].
 * W63a Alice-Teilung (auch die Zone einer GLEICHNAMIGEN Creature des Kontrolleurs `pi`, geteilte zuerst); Gigantisaur-Riegel und Mehrzonen-Kreaturen wie bei Betrayal.
 */
function freieZonen(engine, pi, hs, heroIdx, inst) {
  let zonen = engine.beschwoerZonenFuer(pi, inst.name, { seite: hs, heroIdx, nurBasis: true, namedHeroesOnly: true })
    .map(z => ({ heroIdx, slotIdx: z.slotIdx, label: z.label, ...(z.shared ? { shared: true, stackDepth: z.stackDepth } : {}) }));
  if (engine.uebernahmeUnzulaessig(inst, pi, hs, heroIdx) === 'gigantisaur_per_hero') zonen = [];
  if (engine.mehrzonenPlatzFehlt(inst, pi, hs, heroIdx)) zonen = [];
  return zonen;
}

/** Bild der Peitsche: Ursprung = der Angreifer, Ziel = Held oder Creature. */
function zeigePeitsche(engine, hs, heroIdx, z, dauer = ANIM_MS) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'animal_training_whip', zoneType: 'board', owner: z.owner, heroIdx: -1, zoneSlot: -1, duration: dauer,
    targets: [{ owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.type === 'hero' ? -1 : (z.slotIdx ?? -1) }],
    originOwner: hs, originHeroIdx: heroIdx, originZoneSlot: -1,
  });
}

module.exports = {
  // ★ Als Ruling (Al 26.10., Flame Avalanche): die Karte richtet NUR Schaden an Zielen an (die Übernahme ersetzt nur den Tod) — unter der Schadenssperre (`ps.damageLocked`) unspielbar.
  blockedByDamageLock: true,

  // ★ Bilder eines NEGIERTEN Angriffs (Reaktion nach der Zielwahl): der Schlag ist zu sehen, trifft aber nicht. Nur Bilder, kein Zustand.
  spellVisual: async (engine, info) => {
    const z = (info.targets || []).filter(Boolean)[0];
    const seite = info.heroOwner ?? info.owner;
    if (!z || !Number.isInteger(info.heroIdx) || info.heroIdx < 0 || !Number.isInteger(seite)) return;
    if (info.schonGezeigt?.zone?.has('animal_training_whip')) return;
    zeigePeitsche(engine, seite, info.heroIdx, z);
    await engine._delay(ANIM_MS - 100);
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  neverMultiTarget: true,   // „Choose a target": genau EIN Ziel

  /**
   * ★ ENGINE-VERTRAG `quelleErsetztNiederlage` (siehe `_engine.js`): „If this Attack would defeat a Creature your opponent controls, you may fully heal its HP instead and take permanent
   * control of it, placing it into one of the attacker's free Support Zones, but negate its effects for the rest of the turn."
   * @returns {Promise<boolean>} true = ersetzt (die Creature lebt, voll geheilt, jetzt beim Nutzer, negiert); false = normaler Tod
   */
  async quelleErsetztNiederlage(engine, inst, source, amount, type, info = {}) {
    if (info?.isSacrifice) return false;
    const gs = engine.gs;
    const pi = source.controller ?? source.owner;
    const hs = source.heroOwner ?? pi;               // Brettseite des Angreifers (geliehener Held: Love Shot, Charme)
    // Clone-Kopie (`engine._klonSicht`): die Quelle trägt dann `heroIdx: -1` und die Spalte des Klons in `_klonSpalte` — „der Angreifer" ist der Klon, seine freien Zonen sind die der Spalte (des Helden, dessen Wurf er kopiert).
    const heroIdx = (source._klonQuelle && source._klonSpalte >= 0) ? source._klonSpalte : source.heroIdx;
    const ps = gs.players[pi];
    const hero = gs.players[hs]?.heroes?.[heroIdx];
    if (!ps || !hero?.name || !uebernehmbar(engine, pi, inst)) return false;

    // ── Platz: eine freie Zone des Angreifers; keine → keine Wahl (die Creature wird normal besiegt) ──
    const frei = freieZonen(engine, pi, hs, heroIdx, inst);
    if (frei.length === 0) return false;

    // ── „you may" ──
    const antwort = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `${inst.name} would be defeated! Fully heal it instead and take permanent control of it (its effects are negated for the rest of the turn)?`,
      showCard: CARD_NAME,
      showCardLeft: inst.name,
      confirmLabel: '🪢 Take control!',
      cancelLabel: 'No, defeat it',
      cancellable: true,
      gerrymanderEligible: true,
    });
    if (antwort?.confirmed !== true) return false;
    if (!uebernehmbar(engine, pi, inst) || inst.zone !== 'support') return false;   // während der Frage verändert (Reaktionen)

    // ── Zone wählen (nicht abbrechbar: die Frage ist beantwortet) ──
    let zone = frei[0];
    if (frei.length > 1) {
      const gewaehlt = await engine.promptGeneric(pi, {
        type: 'zonePick', zones: frei,
        title: CARD_NAME,
        description: `Place ${inst.name} into one of ${hero.name}'s free Support Zones.`,
        cancellable: false,
        heroShortcut: false,
        previewCardName: CARD_NAME,
        showCardLeft: inst.name,
      });
      zone = (gewaehlt && frei.find(z => z.heroIdx === gewaehlt.heroIdx && z.slotIdx === gewaehlt.slotIdx)) || frei[0];
    }
    // Platz noch frei? (eine Reaktion kann ihn belegt haben)
    const noch = freieZonen(engine, pi, hs, heroIdx, inst);
    if (!noch.some(z => z.heroIdx === zone.heroIdx && z.slotIdx === zone.slotIdx)) {
      if (noch.length === 0) return false;
      zone = noch[0];
    }

    // ── Übernahme (zuerst: scheitert sie, ist nichts geschehen und die Creature stirbt normal) ──
    const vorher = engine.kontrolleurVon(inst);
    const tSeite = engine.physicalSide(inst);
    const res = await engine.actionTransferCreature(inst, hs, zone.heroIdx, zone.slotIdx, {
      sourceName: CARD_NAME, sourceOwner: pi, controller: pi,
    });
    if (!res?.success) {
      engine.log('animal_training_fizzle', { player: ps.username, creature: inst.name, reason: 'blocked' });
      return false;
    }
    // „Permanent" schlägt eine vorübergehende Übernahme (Aligning Goals, Cute Conversion …): deren Rückgabe am Zugende würde sie sonst wieder aufheben.
    if (inst.stolenBy != null) { delete inst.stolenBy; delete inst.stolenFromOwner; }
    delete inst.counters._dyingThisBatch;           // sie stirbt nicht mehr: Todes-Zuhörer (Loyal Shepherd & Co.) dürfen sie wieder als lebend sehen

    // ── Volle Heilung ──
    const maxHp = maxHpVon(engine, inst);
    if (maxHp > 0) {
      await engine.actionHealCreature({ name: CARD_NAME, owner: pi, controller: pi }, inst, maxHp);
      if ((inst.counters.currentHp ?? 0) < maxHp) inst.counters.currentHp = maxHp;   // „instead": sie ist danach voll geheilt, auch wenn der Heilweg gesperrt war
    }

    // ── Negierung bis zum Ende dieses Zuges (Dark Gear/Diplomacy: unverhinderbar, eigene Kosten) ──
    await engine.actionNegateCreature(inst, CARD_NAME, {
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: engine.opponentOf(gs.activePlayer ?? pi),   // zu Beginn des nächsten Zuges = Ende dieses Zuges
      selfInflicted: true,
      unpreventable: true,
    });

    engine._broadcastEvent('play_zone_animation', {
      type: 'animal_training_tame', zoneType: 'board', owner: hs, heroIdx: zone.heroIdx, zoneSlot: zone.slotIdx, duration: TAME_MS,
      targets: [{ owner: hs, heroIdx: zone.heroIdx, zoneSlot: zone.slotIdx }],
      originOwner: hs, originHeroIdx: heroIdx, originZoneSlot: -1,
    });
    engine.log('animal_training_control', {
      player: ps.username, creature: inst.name, hero: hero.name, from: gs.players[vorher]?.username, side: tSeite, hp: inst.counters.currentHp,
    });
    engine.sync();
    await engine._delay(TAME_MS - 200);
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const seite = ctx.cardHeroOwner ?? pi;        // Brettseite des Angreifers (geliehener Held)
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[seite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) return;

      // ── ① Zielwahl: jedes Ziel außer dem Angreifer selbst ──
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: Math.max(0, hero.atk || 0),
        title: CARD_NAME,
        description: `Deal ${hero.atk || 0} ATK damage to a target. If it would defeat a Creature your opponent controls, you may fully heal it and take permanent control of it instead.`,
        confirmLabel: `⚔️ Crack the whip! (${hero.atk || 0})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        dimUnmetCondition: true,
        condition: (t) => !(t.type === 'hero' && t.owner === seite && t.heroIdx === heroIdx),
      });
      if (!target) { gs._spellCancelled = true; return; }

      // ── ② Schaden = aktuelle Attack-Stat beim Auflösen ──
      const atk = Math.max(0, hero.atk || 0);
      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, heroOwner: seite, usesHeroAtk: true };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, atk);

      zeigePeitsche(engine, seite, heroIdx, target);
      await engine._delay(SCHLAG_WARTE_MS);

      if (target.type === 'hero') {
        const th = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (th && th.hp > 0) await engine.actionDealDamage(attackSource, th, finalDmg, 'attack');
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        // ③ Tötet der Treffer die Creature, greift der Ersatz im Schadens-Batch (`quelleErsetztNiederlage`).
        if (inst && inst.zone === 'support') await engine.actionDealCreatureDamage(attackSource, inst, finalDmg, 'attack', { sourceOwner: pi, canBeNegated: true });
      }

      engine.log('animal_training', { player: ps.username, hero: hero.name, target: target.cardName, atk, damage: finalDmg });
      engine.sync();
      await engine._delay(Math.max(0, ANIM_MS - SCHLAG_WARTE_MS - 100));   // Nachlauf des Bildes (Rückschlag), bevor der nächste Schritt kommt
    },
  },

  /**
   * CPU: die Frage „you may" beantwortet sie mit Ja — eine Creature behalten, voll geheilt, schlägt jeden Tod. Die Zonenwahl (nicht abbrechbar) und die Zielwahl macht der allgemeine Pilot.
   */
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload.title === CARD_NAME) return { confirmed: true };
    // Zielwahl: „Übernahme wenn lohnend" — gibt es eine übernehmbare Gegner-Creature, die dieser Treffer (Grundschaden) tötet und für die irgendein eigener Held eine freie Zone hat, nimmt die CPU
    // die wertvollste davon (Stufe, HP, ATK); sonst die allgemeine Wahl des Piloten (`undefined`).
    if (kind === 'effectTarget' && payload?.config?.title === CARD_NAME) {
      const pi = payload.playerIdx;
      const atk = payload.config.baseDamage || 0;
      if (!Number.isInteger(pi) || atk <= 0) return undefined;
      const helden = engine.gs.players[pi]?.heroes || [];
      const wert = (inst) => { const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name] || {}; return (cd.level || 0) * 2 + maxHpVon(engine, inst) / 60 + (cd.atk || 0) / 40; };
      let beste = null, besterWert = -Infinity;
      for (const t of (payload.validTargets || [])) {
        const inst = t.cardInstance;
        if (t.ineligible || t.type !== 'equip' || !inst || !uebernehmbar(engine, pi, inst)) continue;
        if ((inst.counters?.currentHp ?? maxHpVon(engine, inst)) > atk) continue;                       // der Treffer tötet sie nicht: kein Ersatz
        if (!helden.some((h, hi) => h?.name && freieZonen(engine, pi, pi, hi, inst).length > 0)) continue;   // kein eigener Held mit freier Zone
        const w = wert(inst);
        if (w > besterWert) { besterWert = w; beste = t; }
      }
      return beste ? [beste.id] : undefined;
    }
    return undefined;
  },
};
