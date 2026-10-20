// ═══════════════════════════════════════════
//  POTION: "Sword in a Bottle"
//
//  „Choose a Hero you control and a target your opponent controls.
//   Deal damage equal to your Hero's Attack stat to the opponent's
//   target. This is treated as an Attack. You can only play 1
//   'Sword in a Bottle' per turn."
//
//  ── ZWEI PICKS IN EINEM FENSTER ───────────────────────────────────
//  Der Trank-Picker hat EINE Zielliste. Beide Wahlen laufen deshalb
//  durch dasselbe Fenster: die eigenen Helden stehen als ANGREIFER
//  drin, die gegnerischen Ziele als OPFER. `validateSelection` verlangt
//  genau eines von jeder Seite — die Reihenfolge der Klicks ist egal.
//
//  Die Alternative (erst das Opfer im Trank-Fenster, dann den Helden in
//  einer zweiten Abfrage) waere zwei Fenster fuer eine Entscheidung und
//  wuerde den Kartentext auseinanderreissen.
//
//  ── „TREATED AS AN ATTACK" ────────────────────────────────────────
//  Schadenstyp `'attack'`. Damit feuert die Engine das Angriffsfenster
//  selbst (AUTO-FALLBACK in `actionDealDamage`), Super-Killing Knife
//  & Co. sehen einen echten Angriff, und Dark Ocean laesst den Schaden
//  zu Kreaturen durch — alles, was „gilt als Angriff" bedeuten soll.
//
//  ── EINMAL PRO ZUG ────────────────────────────────────────────────
//  Eigener HOPT-Schluessel am SPIELER (`sword-in-a-bottle:<pi>`), nicht
//  an der Instanz: „1 per turn" gilt fuer die Karte, nicht fuer die
//  einzelne Kopie. Geprueft in `canActivate` (grauer Trank), gestempelt
//  in `resolve` am Punkt ohne Rueckkehr.
// ═══════════════════════════════════════════

const { opponentOfGs } = require('./_opp');
const CARD_NAME = 'Sword in a Bottle';
const HOPT_KEY  = 'sword-in-a-bottle';

/** Steht die Einmal-pro-Zug-Sperre fuer diesen Spieler? */
function schonGespielt(gs, pi) {
  return gs?.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs?.turn;
}

// Kontrolle statt Seite (Styx 28.9.): „a Hero you control" / „a target
// your opponent controls" — wie `engine.heroSideOf` (charmedBy >
// permaControlBy > physischer Besitzer). Ziele bleiben physisch adressiert,
// die Seite steht zusaetzlich als `seite` daran.
function seiteVon(physOwner, hero) {
  if (!hero) return physOwner;
  if (hero.charmedBy != null) return hero.charmedBy;
  if (hero.permaControlBy != null) return hero.permaControlBy;
  return physOwner;
}
function seiteDesZiels(gs, t) {
  if (t?.seite != null) return t.seite;
  if (t?.type !== 'hero') return t?.owner;
  return seiteVon(t.owner, gs?.players?.[t.owner]?.heroes?.[t.heroIdx]);
}

/** Kontrollierte Helden, die zuschlagen koennen (lebend, mit Angriffswert).
 *  W32a (Al, 22.10.2026): mit `engine` + `nurAngriffsfaehig` nur Helden, die ANGREIFEN koennen (`heroKannAngreifen`: nicht Frozen/Stunned/Webbed/Negated/gesperrt). */
function angreifer(gs, pi, engine, nurAngriffsfaehig) {
  const out = [];
  for (let p = 0; p < (gs?.players || []).length; p++) {
    const helden = gs.players[p]?.heroes || [];
    for (let hi = 0; hi < helden.length; hi++) {
      const h = helden[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (seiteVon(p, h) !== pi) continue;
      if (nurAngriffsfaehig && engine && !engine.heroKannAngreifen(p, hi, pi)) continue;
      out.push({ physOwner: p, heroIdx: hi, hero: h });
    }
  }
  return out;
}

/**
 * Angriffswert des Helden. `hero.atk` IST der laufende Wert — Buffs und
 * Ausruestung schreiben direkt hinein (`hero.baseAtk` ist der gedruckte).
 * Denselben Wert liest `attack.js` und `ctx.executeAttack`; einen
 * Helfer der Engine dafuer gibt es nicht.
 */
/**
 * W29a (Al, 21.10.2026: Alliance und Dive Down schuetzen auch vor Effekten, die als Attack ZAEHLEN): Paarregel „Angreifer-Held ↔ Opfer" (Alliance) —
 * Angreifer und Opfer werden in EINEM Fenster gewaehlt, die flache Zielliste kennt das Paar nicht. Wahr, wenn dieser Angreifer dieses Opfer-Ziel nicht waehlen darf.
 */
function paarGesperrt(engine, pi, angreiferT, opferT, validTargets) {
  if (!engine || !angreiferT || !opferT || opferT.type !== 'hero') return false;
  const opfer = (validTargets || []).filter(t => t && seiteDesZiels(engine.gs, t) !== pi);
  try {
    return !!engine.heroBlocksTargeting(opferT.owner, opferT.heroIdx, {
      sourceData: engine._getCardDB()[CARD_NAME], cardName: CARD_NAME, damageType: 'attack', chooserIdx: pi,
      chooserHeroIdx: angreiferT.heroIdx, chooserHeroOwner: angreiferT.owner, allTargets: opfer,
      // W32a (Al, 22.10.2026): Quellstufe = Fighting-Level DES gewaehlten Angreifer-Helden (Stealth/Jetpack lesen `info.treatedAsLevel`).
      source: { name: CARD_NAME, owner: pi, controller: pi, heroIdx: angreiferT.heroIdx, heroOwner: angreiferT.owner },
    });
  } catch { return false; }
}

function angriffswert(engine, pi, heroIdx) {
  const hero = engine?.gs?.players?.[pi]?.heroes?.[heroIdx];
  return hero?.atk || 0;
}

module.exports = {
  // W27a (Al, 21.10.2026): „treated as an Attack" — Leser der Quellstufe (Glass Wall, Test Flight, Escape Device, Stealth, Jetpack) fragen `_heldenEffektStufe`.
  // W32a (Al, 22.10.2026): „Sie nehmen trotzdem das Fighting-Level": die Quellstufe ist das FIGHTING-LEVEL des gewählten eigenen Helden (nicht mehr fix 0). Der gewählte
  // Held ist der ANGREIFER (Punkt 6): die Quelle trägt Brettseite + Index — Crimson Web hängt sich an ihn, Tharxian Horse trifft ihn. Kann er nicht angreifen (Frozen …), blockt der Trank.
  treatedAsAttack: { ability: 'Fighting' },
  // ★ PFLICHTFLAGGE (Als Befund 12.9.): `doUsePotion` steigt ohne sie
  //   STILL aus (`if (!script?.isPotion) return false;`). Die Karte war
  //   im Client als nutzbar hervorgehoben, der Klick lief ins Leere —
  //   kein Fehler, kein Log. Alle 29 anderen Potion-Skripte tragen sie.
  isPotion: true,

  canActivate(gs, playerIdx, engine) {
    if (schonGespielt(gs, playerIdx)) return false;
    if (angreifer(gs, playerIdx, engine, true).length === 0) return false;
    const gegner = opponentOfGs(gs, playerIdx);
    // Runde 1: der Gegner ist gegen alles immun — dann gibt es kein
    // legales Opfer und der Trank bleibt grau, statt ins Leere zu laufen.
    if (gs?.firstTurnProtectedPlayer === gegner) return false;
    const ops = gs?.players?.[gegner];
    if (!ops) return false;
    const heldLebt = angreifer(gs, gegner).length > 0;   // Kontrolle statt Seite
    const kreaturDa = (ops.supportZones || []).some(zone =>
      (zone || []).some(slot => Array.isArray(slot) && slot.length > 0));
    return heldLebt || kreaturDa;
  },

  getValidTargets(gs, playerIdx, engine) {
    if (!engine) return [];
    const gegner = opponentOfGs(gs, playerIdx);
    const ziele = [];
    // Kontrolle statt Seite (Styx 28.9.): Helden beider Spalten, sortiert
    // nach Kontrolleur. KONTROLLIERTE Helden = die moeglichen Angreifer,
    // vom Gegner kontrollierte Helden und seine Kreaturen = die Opfer.
    const schutz = gs.firstTurnProtectedPlayer === gegner;
    for (let p = 0; p < (gs.players || []).length; p++) {
      for (const t of engine.getHeroTargets(p)) {
        const seite = engine.heroSideOf(p, gs.players[p]?.heroes?.[t.heroIdx]);
        if (seite === gegner && schutz) continue;
        if (seite === playerIdx && !engine.heroKannAngreifen(p, t.heroIdx, playerIdx)) continue;   // W32a: nur angriffsfaehige eigene Helden als Angreifer
        ziele.push({ ...t, seite });
      }
    }
    if (!schutz) {
      ziele.push(...engine.getCreatureTargets(gegner).map(t => ({ ...t, seite: gegner })));
    }
    return ziele;
  },

  targetingConfig(gs, playerIdx) {
    // Als Funktion statt als Objekt: der Schadenshinweis fuer die CPU
    // haengt am staerksten eigenen Helden und ist damit nicht konstant.
    const beste = angreifer(gs, playerIdx)
      .reduce((m, { hero: h }) => Math.max(m, h.atk || 0), 0);
    return {
      title: CARD_NAME,
      description: "Choose a Hero you control (the attacker) and a target your opponent controls. The target takes damage equal to that Hero's Attack.",
      confirmLabel: '🗡️ Strike!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 2,
      minRequired: 2,
      // ★ EINE JE SEITE (Als Befund 12.9.) ──────────────────────────
      // `maxTotal: 2` allein liess zwei EIGENE Ziele anklicken; der
      // Effekt scheiterte dann erst beim Bestaetigen. `uniqueBy:
      // 'owner'` ist die vorhandene Regel dafuer: zwei Ziele duerfen
      // sich im genannten Feld nicht gleichen, der zweite Klick auf
      // dieselbe Seite prallt im Picker ab. `validateSelection` bleibt
      // als serverseitiger Riegel bestehen.
      uniqueBy: 'seite',   // Kontrolle statt Seite (Styx 28.9.), vorher 'owner'
      // Schadenshinweis fuer den CPU-Zielbewerter (`inferDamage`) —
      // ohne ihn bewertet er jeden Treffer mit 0 und wuerfelt.
      baseDamage: beste,
      damageType: 'attack',
    };
  },

  /**
   * Genau ein eigener Held (Angreifer) und genau ein gegnerisches Ziel
   * (Opfer). Reihenfolge egal — der Spieler klickt, was er zuerst sieht.
   */
  validateSelection(selectedIds, validTargets, engine, pi) {
    if (!selectedIds || selectedIds.length !== 2) return false;
    const gewaehlt = selectedIds.map(id => validTargets.find(t => t.id === id)).filter(Boolean);
    if (gewaehlt.length !== 2) return false;
    const seite = (t) => t.seite ?? t.owner;          // Kontrolle statt Seite
    const seiten = new Set(gewaehlt.map(seite));
    if (seiten.size !== 2) return false;              // beide von derselben Seite
    // Der eigene Anteil muss ein HELD sein — eine eigene Kreatur kann
    // nicht zuschlagen.
    const eigenes = gewaehlt.find(t => validTargets.some(v => v.id === t.id) && t.type === 'hero'
      && gewaehlt.some(o => seite(o) !== seite(t)));
    if (!eigenes) return false;
    if (engine && typeof pi === 'number' && !engine.heroKannAngreifen(eigenes.owner, eigenes.heroIdx, pi)) return false;   // W32a: der Angreifer muss angreifen koennen
    // W29a: Paarregel (Alliance) – `engine`/`pi` liefert der Server (`doConfirmPotion`); ohne sie (alte Aufrufer) entfaellt die Pruefung.
    if (engine && typeof pi === 'number' && paarGesperrt(engine, pi, eigenes, gewaehlt.find(o => o !== eigenes), validTargets)) return false;
    return true;
  },

  // ★ KEINE Huellen-Animation (Als Befund 12.9.) ────────────────────
  // `doUsePotion` sendet `animationType` mit `destroyedIds:
  // selectedIds` — also auf ALLE gewaehlten Ziele. Bei dieser Karte ist
  // der ANGREIFER eines davon, der Schnitt erschien deshalb auf beiden
  // Helden. `'none'` schaltet die Huelle ab; `resolve` inszeniert
  // stattdessen selbst: Angreifer dasht ins Ziel, Schnitt NUR dort.
  animationType: 'none',

  /**
   * CPU: staerkster eigener Held als Angreifer, dazu das Ziel, das der
   * Schlag am ehesten umlegt (sonst der wertvollste Kopf).
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const quelle = payload?.config?.source || payload?.config?.title;
    if (quelle !== CARD_NAME) return undefined;
    const ziele = payload?.validTargets || [];
    const pi = typeof payload.playerIdx === 'number' ? payload.playerIdx : engine._cpuPlayerIdx;
    if (ziele.length === 0 || pi == null) return undefined;

    const gs = engine?.gs;
    const eigene = ziele.filter(t => seiteDesZiels(gs, t) === pi && t.type === 'hero');
    const fremde = ziele.filter(t => seiteDesZiels(gs, t) !== pi);
    if (eigene.length === 0 || fremde.length === 0) return undefined;

    let angreiferZiel = eigene[0], bestAtk = -1;
    for (const t of eigene) {
      const atk = angriffswert(engine, t.owner, t.heroIdx);
      if (atk > bestAtk) { bestAtk = atk; angreiferZiel = t; }
    }

    let opfer = fremde[0], bestwert = -Infinity;
    for (const t of fremde) {
      let hp = Infinity, wert = 0;
      if (t.type === 'hero') {
        const h = engine?.gs?.players?.[t.owner]?.heroes?.[t.heroIdx];
        hp = h?.hp ?? Infinity;
        wert = 500 + (h?.atk || 0);
      } else {
        const inst = t.cardInstance;
        hp = inst ? engine.creatureCurrentHp(inst) : Infinity;   // Z5: unversehrt = gedruckte HP
        wert = inst?.counters?.maxHp || 0;
      }
      // Ein toedlicher Schlag schlaegt jeden Wert.
      if (hp <= bestAtk) wert += 10000 - hp;
      if (wert > bestwert) { bestwert = wert; opfer = t; }
    }
    // W29a: gesperrtes Paar (Alliance) → das staerkste erlaubte Paar suchen (Angreifer-Held ↔ Opfer); gibt es keins, keine Antwort.
    if (paarGesperrt(engine, pi, angreiferZiel, opfer, ziele)) {
      let paar = null, best = -1;
      for (const a of eigene) for (const o of fremde) {
        if (o.ineligible || paarGesperrt(engine, pi, a, o, ziele)) continue;
        const atk = angriffswert(engine, a.owner, a.heroIdx);
        if (atk > best) { best = atk; paar = [a, o]; }
      }
      return paar ? [paar[0].id, paar[1].id] : undefined;
    }
    return [angreiferZiel.id, opfer.id];
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    const gs = engine.gs;
    if (!selectedIds || selectedIds.length !== 2) return;
    if (schonGespielt(gs, pi)) return;

    const gewaehlt = selectedIds.map(id => validTargets.find(t => t.id === id)).filter(Boolean);
    if (gewaehlt.length !== 2) return;
    // Kontrolle statt Seite (Styx 28.9.): `held.owner` ist die PHYSISCHE Spalte.
    const held = gewaehlt.find(t => seiteDesZiels(gs, t) === pi && t.type === 'hero');
    const opfer = gewaehlt.find(t => seiteDesZiels(gs, t) !== pi);
    if (!held || !opfer) return;

    // Nach der Abfrage neu pruefen — zwischen Anzeige und Antwort kann
    // der Angreifer gefallen sein (oder die Kontrolle gewechselt haben).
    const angreiferHeld = gs.players[held.owner]?.heroes?.[held.heroIdx];
    if (!angreiferHeld?.name || angreiferHeld.hp <= 0) return;
    if (seiteVon(held.owner, angreiferHeld) !== pi) return;
    if (!engine.heroKannAngreifen(held.owner, held.heroIdx, pi)) return { aborted: true };   // W32a: zwischen Wahl und Aufloesung eingefroren/betaeubt/gesperrt → blockiert, Karte bleibt auf der Hand (Konvention `aborted`)

    const schaden = angriffswert(engine, held.owner, held.heroIdx);
    if (!(schaden > 0)) return;

    // Punkt ohne Rueckkehr — jetzt die Einmal-pro-Zug-Sperre stempeln.
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;

    // `heroIdx` an der Quelle ist entscheidend: daran erkennen die
    // Angriffs-Zuhoerer, WELCHER Held zuschlaegt („treated as this
    // Hero hitting the target").
    const quelle = {
      name: CARD_NAME, owner: pi, controller: pi, heroIdx: held.heroIdx,
      heroOwner: held.owner,   // physische Spalte des Angreifers (wie bei bezauberten Helden)
    };

    // ── Reaktionsfenster nach der Wahl (W32a, Al 22.10.2026, Punkt 5: Schutzkarten gelten auch gegen Effekte, die als Attack zählen) ──
    // Der Trank-Zielweg (`doConfirmPotion`) öffnet sie nicht selbst. Wie `promptDamageTarget`: Umleitung (Challenge, Martyry, Anti-Magnet …), Surprise-Fenster eines
    // gewählten KREATURENZIELS (Heldenziele öffnen es im Schadenspfad), dann die Post-Target-Handreaktionen (Test Flight, Future Tech Escape Device, Invisibility Cloak …).
    let opferZ = opfer, negiert = false;
    {
      const liste = (validTargets || []).filter(t => t && seiteDesZiels(gs, t) !== pi);
      const red = await engine._checkTargetRedirect(opferZ.owner, opferZ, liste, { damageType: 'attack', title: CARD_NAME }, quelle);
      if (red?._redirectNegated || red?._dropTargetIds) negiert = true;
      else if (red) opferZ = red;
      if (!negiert && opferZ.type !== 'hero' && opferZ.cardInstance) {
        const sr = await engine._checkSurpriseWindow([opferZ], quelle, { damageType: 'attack' });
        if (sr?.effectNegated) negiert = true;
      }
      if (!negiert) {
        const pt = await engine._checkPostTargetHandReactions([opferZ], quelle, { damageType: 'attack', dealsDamage: true });
        if (pt?.effectNegated) { await engine.negationsBilder(quelle, [opferZ], pt); negiert = true; }
        else if (pt?.newTargets?.length) opferZ = pt.newTargets[0];
      }
    }
    if (negiert || (opferZ.type === 'hero' && !(gs.players[opferZ.owner]?.heroes?.[opferZ.heroIdx]?.hp > 0))) {
      engine.log('sword_in_a_bottle', { player: gs.players[pi]?.username, attacker: angreiferHeld.name, target: opferZ.cardName, negated: true });
      engine.sync();
      return;
    }

    // ── Inszenierung: Dash, dann Schnitt (Muster von Phoenix Tackle) ──
    // Der Angreifer fliegt sichtbar ins Ziel und zurueck — so ist ohne
    // Textzeile klar, WER zuschlaegt. Der Schnitt kommt erst im Moment
    // des Aufpralls, und nur auf dem Ziel.
    const zielSlot = opferZ.type === 'hero' ? -1 : opferZ.slotIdx;
    engine._broadcastEvent('play_ram_animation', {
      sourceOwner: held.owner, sourceHeroIdx: held.heroIdx,
      targetOwner: opferZ.owner, targetHeroIdx: opferZ.heroIdx,
      targetZoneSlot: zielSlot,
      cardName: angreiferHeld.name, duration: 1000,
    });
    // Der Held erreicht das Ziel bei rund 12 % der Laufzeit.
    await engine._delay(150);

    engine._broadcastEvent('play_zone_animation', {
      type: 'quick_slash', owner: opferZ.owner,
      heroIdx: opferZ.heroIdx, zoneSlot: zielSlot,
    });
    await engine._delay(180);

    // W32a (Al, 22.10.2026): der Schlag zählt als Attack des gewählten Helden — Attack-Reaktionen (Magic Topaz, Arrows …) über die virtuelle Attack-Kette.
    await engine.alsAttackKette({ name: CARD_NAME, pi, heroIdx: held.heroIdx, heroOwner: held.owner, resolve: async () => {
    if (opferZ.type === 'hero') {
      const ziel = gs.players[opferZ.owner]?.heroes?.[opferZ.heroIdx];
      if (ziel?.name && ziel.hp > 0) {
        await engine.actionDealDamage(quelle, ziel, schaden, 'attack');
      }
    } else {
      const inst = opferZ.cardInstance
        || engine.findCards({ controller: opferZ.owner, zone: 'support', heroIdx: opferZ.heroIdx })
             .find(c => c.zoneSlot === opferZ.slotIdx);
      if (inst) {
        await engine.actionDealCreatureDamage(quelle, inst, schaden, 'attack', { sourceOwner: pi });
      }
    }
    return true;
    } });

    engine.log('sword_in_a_bottle', {
      player: gs.players[pi]?.username,
      attacker: angreiferHeld.name,
      target: opferZ.cardName,
      damage: schaden,
    });
    engine.sync();
  },
};
