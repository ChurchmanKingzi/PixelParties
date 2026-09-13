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

const CARD_NAME = 'Sword in a Bottle';
const HOPT_KEY  = 'sword-in-a-bottle';

/** Steht die Einmal-pro-Zug-Sperre fuer diesen Spieler? */
function schonGespielt(gs, pi) {
  return gs?.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs?.turn;
}

/** Eigene Helden, die zuschlagen koennen (lebend, mit Angriffswert). */
function angreifer(gs, pi) {
  const out = [];
  const helden = gs?.players?.[pi]?.heroes || [];
  for (let hi = 0; hi < helden.length; hi++) {
    const h = helden[hi];
    if (!h?.name || h.hp <= 0) continue;
    out.push({ heroIdx: hi, hero: h });
  }
  return out;
}

/**
 * Angriffswert des Helden. `hero.atk` IST der laufende Wert — Buffs und
 * Ausruestung schreiben direkt hinein (`hero.baseAtk` ist der gedruckte).
 * Denselben Wert liest `attack.js` und `ctx.executeAttack`; einen
 * Helfer der Engine dafuer gibt es nicht.
 */
function angriffswert(engine, pi, heroIdx) {
  const hero = engine?.gs?.players?.[pi]?.heroes?.[heroIdx];
  return hero?.atk || 0;
}

module.exports = {
  // ★ PFLICHTFLAGGE (Als Befund 12.9.): `doUsePotion` steigt ohne sie
  //   STILL aus (`if (!script?.isPotion) return false;`). Die Karte war
  //   im Client als nutzbar hervorgehoben, der Klick lief ins Leere —
  //   kein Fehler, kein Log. Alle 29 anderen Potion-Skripte tragen sie.
  isPotion: true,

  canActivate(gs, playerIdx) {
    if (schonGespielt(gs, playerIdx)) return false;
    if (angreifer(gs, playerIdx).length === 0) return false;
    const gegner = playerIdx === 0 ? 1 : 0;
    // Runde 1: der Gegner ist gegen alles immun — dann gibt es kein
    // legales Opfer und der Trank bleibt grau, statt ins Leere zu laufen.
    if (gs?.firstTurnProtectedPlayer === gegner) return false;
    const ops = gs?.players?.[gegner];
    if (!ops) return false;
    const heldLebt = (ops.heroes || []).some(h => h?.name && h.hp > 0);
    const kreaturDa = (ops.supportZones || []).some(zone =>
      (zone || []).some(slot => Array.isArray(slot) && slot.length > 0));
    return heldLebt || kreaturDa;
  },

  getValidTargets(gs, playerIdx, engine) {
    if (!engine) return [];
    const gegner = playerIdx === 0 ? 1 : 0;
    const ziele = [];
    // EIGENE Helden = die moeglichen Angreifer.
    ziele.push(...engine.getHeroTargets(playerIdx));
    // GEGNERISCHE Helden und Kreaturen = die moeglichen Opfer.
    if (gs.firstTurnProtectedPlayer !== gegner) {
      ziele.push(...engine.getHeroTargets(gegner));
      ziele.push(...engine.getCreatureTargets(gegner));
    }
    return ziele;
  },

  targetingConfig(gs, playerIdx) {
    // Als Funktion statt als Objekt: der Schadenshinweis fuer die CPU
    // haengt am staerksten eigenen Helden und ist damit nicht konstant.
    const beste = (gs?.players?.[playerIdx]?.heroes || [])
      .filter(h => h?.name && h.hp > 0)
      .reduce((m, h) => Math.max(m, h.atk || 0), 0);
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
      uniqueBy: 'owner',
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
  validateSelection(selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length !== 2) return false;
    const gewaehlt = selectedIds.map(id => validTargets.find(t => t.id === id)).filter(Boolean);
    if (gewaehlt.length !== 2) return false;
    const seiten = new Set(gewaehlt.map(t => t.owner));
    if (seiten.size !== 2) return false;              // beide von derselben Seite
    // Der eigene Anteil muss ein HELD sein — eine eigene Kreatur kann
    // nicht zuschlagen.
    const eigenes = gewaehlt.find(t => validTargets.some(v => v.id === t.id) && t.type === 'hero'
      && gewaehlt.some(o => o.owner !== t.owner));
    return !!eigenes;
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

    const eigene = ziele.filter(t => t.owner === pi && t.type === 'hero');
    const fremde = ziele.filter(t => t.owner !== pi);
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
        hp = inst?.counters?.currentHp ?? Infinity;
        wert = inst?.counters?.maxHp || 0;
      }
      // Ein toedlicher Schlag schlaegt jeden Wert.
      if (hp <= bestAtk) wert += 10000 - hp;
      if (wert > bestwert) { bestwert = wert; opfer = t; }
    }
    return [angreiferZiel.id, opfer.id];
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    const gs = engine.gs;
    if (!selectedIds || selectedIds.length !== 2) return;
    if (schonGespielt(gs, pi)) return;

    const gewaehlt = selectedIds.map(id => validTargets.find(t => t.id === id)).filter(Boolean);
    if (gewaehlt.length !== 2) return;
    const held = gewaehlt.find(t => t.owner === pi && t.type === 'hero');
    const opfer = gewaehlt.find(t => t.owner !== pi);
    if (!held || !opfer) return;

    // Nach der Abfrage neu pruefen — zwischen Anzeige und Antwort kann
    // der Angreifer gefallen sein.
    const angreiferHeld = gs.players[pi]?.heroes?.[held.heroIdx];
    if (!angreiferHeld?.name || angreiferHeld.hp <= 0) return;

    const schaden = angriffswert(engine, pi, held.heroIdx);
    if (!(schaden > 0)) return;

    // Punkt ohne Rueckkehr — jetzt die Einmal-pro-Zug-Sperre stempeln.
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;

    // `heroIdx` an der Quelle ist entscheidend: daran erkennen die
    // Angriffs-Zuhoerer, WELCHER Held zuschlaegt („treated as this
    // Hero hitting the target").
    const quelle = {
      name: CARD_NAME, owner: pi, controller: pi, heroIdx: held.heroIdx,
    };

    // ── Inszenierung: Dash, dann Schnitt (Muster von Phoenix Tackle) ──
    // Der Angreifer fliegt sichtbar ins Ziel und zurueck — so ist ohne
    // Textzeile klar, WER zuschlaegt. Der Schnitt kommt erst im Moment
    // des Aufpralls, und nur auf dem Ziel.
    const zielSlot = opfer.type === 'hero' ? -1 : opfer.slotIdx;
    engine._broadcastEvent('play_ram_animation', {
      sourceOwner: pi, sourceHeroIdx: held.heroIdx,
      targetOwner: opfer.owner, targetHeroIdx: opfer.heroIdx,
      targetZoneSlot: zielSlot,
      cardName: angreiferHeld.name, duration: 1000,
    });
    // Der Held erreicht das Ziel bei rund 12 % der Laufzeit.
    await engine._delay(150);

    engine._broadcastEvent('play_zone_animation', {
      type: 'quick_slash', owner: opfer.owner,
      heroIdx: opfer.heroIdx, zoneSlot: zielSlot,
    });
    await engine._delay(180);

    if (opfer.type === 'hero') {
      const ziel = gs.players[opfer.owner]?.heroes?.[opfer.heroIdx];
      if (ziel?.name && ziel.hp > 0) {
        await engine.actionDealDamage(quelle, ziel, schaden, 'attack');
      }
    } else {
      const inst = opfer.cardInstance
        || engine.findCards({ controller: opfer.owner, zone: 'support', heroIdx: opfer.heroIdx })
             .find(c => c.zoneSlot === opfer.slotIdx);
      if (inst) {
        await engine.actionDealCreatureDamage(quelle, inst, schaden, 'attack', { sourceOwner: pi });
      }
    }

    engine.log('sword_in_a_bottle', {
      player: gs.players[pi]?.username,
      attacker: angreiferHeld.name,
      target: opfer.cardName,
      damage: schaden,
    });
    engine.sync();
  },
};
