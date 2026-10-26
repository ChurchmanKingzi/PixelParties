'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Backstab"
//  Attack (Normal, Fighting Lv0)
//
//  „Perform this Attack with a Hero your opponent controls. Choose another target your
//   opponent controls and deal damage equal to the Hero's Attack stat to it."
//
//  ── KEIN EIGENER HELD (Al, 26.10.): „kein eigener Hero performed diese Attack" ──
//  Die Karte hat KEINEN Wirker-Helden: sie wird per Klick auf die Handkarte gespielt, ohne Heldenwahl (`playsWithoutHero: true`; Client: `herolessHandCards`, Server: `doPlaySpell`).
//  Sie zählt als Attack des SPIELERS (seine Aktion, `attacksPlayedThisTurn`, Reaktionsfenster des Gegners auf die gespielte Karte), ist aber an keine Schule/Stufe (Lv0), keinen Status
//  und keine Aktion eines eigenen Helden gebunden, und kein eigener Held tritt als Wirker/Quelle auf (Karteninstanz, Kette, Zähler und Hooks tragen `heroIdx -1`). Technisch braucht das
//  Aktionssystem einen Platz für die Buchung der Aktion: `engine.herolosPlatzhalter` nimmt den ersten eigenen Helden, der die Karte nach den normalen Regeln spielen dürfte, NUR dafür
//  (`heroesActedThisTurn`/Zusatzaktions-Geber). Er wird nie gefragt und zählt nirgends als Nutzer — ist KEIN eigener Held handlungsfähig (alle gefroren/besiegt …), ist die Karte nicht spielbar.
//  Der AUSFÜHRENDE ist ein Held des GEGNERS (der „Nutzer" der Attack): seine AKTUELLE Attack-Stat (`hero.atk`, Buffs/Debuffs/Ausrüstung inklusive) bestimmt den Schaden. Er braucht keine
//  Aktion und keine Fähigkeit; er liefert Angriffswert, Position (Richtung des Stichs) und die Quelle der Attack-Hooks.
//
//  ── EIN PICKER, ZWEI KLICKS (Al) ───────────────────────────────────────
//  `engine.promptGeordneteWahl` (die nummerierte Mehrfachwahl von `chainTargetPick`, hier mit eigener Liste je Klick): Klick 1 = der angreifende Gegnerheld, Klick 2 = das ZIEL; Beschreibung
//  „Choose the attacking Hero, then the target.", Rückgängig und Abbrechen (Karte zurück auf die Hand, Regel 23.9). Ausgegraut (nicht klickbar) sind: Helden, die nicht angreifen können (Frozen,
//  Stunned, Webbed, Bound, harte Negierung, Blendung, Attack-Sperren des Gegners: `engine.heroKannAngreifen`), geschützte Ziele (Butterfly Cloud/Invisibility/Stealth …, Taunt, Board of Kings …),
//  der Angreifer selbst als Ziel („another"), eigene und von mir übernommene Ziele. Klick-1-Kandidaten brauchen mindestens ein anderes Ziel; hat der Gegner nur EINEN Helden und keine
//  Kreatur, ist die Karte nicht spielbar (`spellPlayCondition`).
//  Kandidaten: Angreifer = lebende Helden, die der Gegner KONTROLLIERT (Kontrolle statt Spalte: ein von ihm übernommener eigener Held zählt, ein von mir übernommener nicht); Ziel = Held ODER
//  Kreatur, die der Gegner kontrolliert (Ausrüstung/Abilities sind keine Ziele). Attack-Stat 0 ist zulässig (0 Schaden).
//
//  ── FENSTER NACH DER WAHL (wie bisher) ────────────────────────────────
//  Beide Wahlen gelten weiter als „chosen": ZUERST der Angreifer (`_zielwahlAbschliessen` mit der Karte als Quelle: Umleiter wie Challenge, Surprises, Post-Target-Reaktionen), DANN das Ziel
//  (`ctx.promptDamageTarget` mit `_vorgewaehlt` und dem Ausführenden als Quelle = `attackerSourceOverride`: Umleiter, Surprises, Escape Device & Co., Taunt, Alliance, das Auge des
//  Angreifers). Wird der Angreifer umgeleitet und ist das gewählte Ziel dann derselbe Held, oder ist das Ziel mit DIESEM Angreifer als Quelle nicht mehr wählbar (Alliance, Auge …), fragt die
//  Karte das Ziel noch einmal einzeln.
//
//  ── ③ SCHADEN, QUELLE, ZÄHLUNG ──────────────────────────────────────────
//  Schadenstyp `attack`: Reduktionen, Schilde, Immunitäten, Stoneskin & Co. des Ziels greifen wie bei jeder Attack. Betrag = aktuelle Attack-Stat des Ausführenden beim AUFLÖSEN. Quelle des
//  Treffers: `{ name: 'Backstab', owner: Spieler, controller: Spieler, heroIdx/heroOwner: der Ausführende, usesHeroAtk }` — „der Angreifer" für Booby Trap/Frost Rune/Attack-Hooks ist der
//  Gegnerheld, der VERURSACHER (Kill-/„defeated by"-Zählung) der Spieler. Pfeile/Magic Topaz des Spielers passen nicht (kein eigener Held performed: die Kette trägt `heroIdx -1`).
//  Fällt der Ausführende zwischen Wahl und Treffer (gefroren, betäubt, besiegt), greift er nicht mehr an: die Karte ist verbraucht, es passiert nichts.
//
//  ── ERSTE RUNDE ─────────────────────────────────────────────────────────
//  `blockedByFirstTurnProtection`: der Stich trifft nur den Gegner; in Runde 1 (Erst-Runden-Immunität) unspielbar.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `backstab_stab` (Pixelart, ANIM_REGISTRY, Brett-Animation `ppSalve`): ein Pixel-Schwert steht aus Richtung des ausführenden Helden vor dem Ziel, holt kurz
//  aus und sticht in ganzen Pixeln hinein; Kreuzfunkel, Funken und rote Spritzer. Klänge: ZONE_ANIM_SFX. Der Schaden fällt beim Einschlag (`STICH_WARTE_MS`).
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  `cpuResponse` beantwortet den ganzen Picker auf einmal: Angreifer = Gegnerheld mit der höchsten ATK (bei Gleichstand die meisten HP), Ziel = der Pilot (`_getCpuTargetResponse`, bester Treffer)
//  unter den Zielen ohne den Angreifer. Rollout/Schnellmodus: `promptGeneric` beantwortet den Picker über denselben `cpuResponse`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Backstab';
const ANIM_MS = 900;           // Länge von `backstab_stab` im Client (ENDE)
const STICH_WARTE_MS = 440;    // bis zum Einschlag (330 ms im Bild + 100 ms Einbau-Versatz des Clients), dann fällt der Schaden

/** Lebende Helden, die `oppIdx` kontrolliert und die als Ausführende angreifen können (Zielobjekte `hero-<Spalte>-<Index>`), noch OHNE Zielschutz. */
function ausfuehrende(engine, oppIdx) {
  const out = [];
  for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(oppIdx)) {
    if (!hero?.name || hero.hp <= 0) continue;
    if (!engine.heroKannAngreifen(physOwner, heroIdx, oppIdx, { name: CARD_NAME })) continue;
    out.push({ id: `hero-${physOwner}-${heroIdx}`, type: 'hero', owner: physOwner, heroIdx, cardName: hero.name });
  }
  return out;
}

/**
 * Zielschutz (Butterfly Cloud/`untargetable`, Invisibility/`invisible`, Stealth & Co. über `blocksTargeting`) für die Wahl des Angreifers: er ist ein „chosen" Held des Gegners. Die
 * Schutzrechnung läuft über die Menge der Helden, die der Effekt wählen KANN (W41a: sind alle geschützt, bricht der Schutz zusammen). Ohne Wirker-Helden gibt es kein Auge des Spielers.
 */
function ohneZielschutz(engine, pi, liste) {
  const geschuetzt = new Set();
  for (const id of engine._untargetableHeroIds(liste, pi)) geschuetzt.add(id);
  const quelle = engine._getCardDB()[CARD_NAME];
  for (const t of liste) {
    if (geschuetzt.has(t.id)) continue;
    if (engine.heroBlocksTargeting(t.owner, t.heroIdx, { sourceData: quelle, cardName: CARD_NAME, chooserIdx: pi, chooserHeroIdx: -1, allTargets: liste })) geschuetzt.add(t.id);
  }
  return liste.filter(t => !geschuetzt.has(t.id));
}

/** Alle Ziele (Helden und Kreaturen), die `oppIdx` kontrolliert — für die Spielbarkeitsprüfung („another target"). */
function gegnerZiele(engine, oppIdx) {
  const helden = engine.heroesControlledBy(oppIdx)
    .filter(({ hero }) => hero?.name && hero.hp > 0)
    .map(({ physOwner, heroIdx, hero }) => ({ id: `hero-${physOwner}-${heroIdx}`, type: 'hero', owner: physOwner, heroIdx, cardName: hero.name }));
  let kreaturen = [];
  try { kreaturen = engine.getCreatureTargets(oppIdx).filter(t => !t.cardInstance?.faceDown); } catch { kreaturen = []; }
  return helden.concat(kreaturen);
}

module.exports = {
  // ★ Bilder eines NEGIERTEN Stichs (Zielschutz-Reaktion nach der Wahl): die Quelle ist der ausführende Held (`heroOwner`/`heroIdx`), die Ziele die gewählten. Nur Bilder, kein Zustand.
  spellVisual: async (engine, info) => {
    const z = (info.targets || []).filter(Boolean)[0];
    const seite = info.heroOwner ?? info.owner;
    if (!z || !Number.isInteger(info.heroIdx) || info.heroIdx < 0 || !Number.isInteger(seite)) return;
    if (info.schonGezeigt?.zone?.has('backstab_stab')) return;
    engine._broadcastEvent('play_zone_animation', {
      type: 'backstab_stab', zoneType: 'board', owner: z.owner, heroIdx: -1, zoneSlot: -1, duration: ANIM_MS,
      targets: [{ owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.type === 'hero' ? -1 : (z.slotIdx ?? -1) }],
      originOwner: seite, originHeroIdx: info.heroIdx, originZoneSlot: -1,
    });
    await engine._delay(STICH_WARTE_MS);
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // Kein Wirker-Held: ohne Heldenwahl spielbar (Client `herolessHandCards`; Server `doPlaySpell` bucht die Aktion über `engine.herolosPlatzhalter`, nach außen `heroIdx -1`).
  playsWithoutHero: true,

  // Der Stich trifft nur Ziele des Gegners (Schaden): in Runde 1 (Erst-Runden-Immunität) wäre er wirkungslos → unspielbar (Welle 12 B-06).
  blockedByFirstTurnProtection: true,

  /** „Perform this Attack with a Hero your opponent controls … another target your opponent controls": ohne ausführenden Helden UND zweites Ziel unspielbar. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return false;
    try {
      const oppIdx = engine.opponentOf(pi);
      if (!ausfuehrende(engine, oppIdx).length) return false;
      return gegnerZiele(engine, oppIdx).length >= 2;   // der Ausführende zählt als eines, „another" braucht ein zweites
    } catch { return false; }
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = engine.opponentOf(pi);

      // ── Kandidatenlisten für den EINEN Picker ───────────────────────────
      const gegnerKontrolliert = (t, eng) => {
        if (t.type === 'hero') {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          return !!h && eng.heroSideOf(t.owner, h) === oppIdx;
        }
        return (t.cardInstance ? eng.kontrolleurVon(t.cardInstance) : t.owner) === oppIdx;
      };
      const maxAtk = Math.max(0, ...engine.heroesControlledBy(oppIdx).map(({ hero }) => hero?.hp > 0 ? (hero.atk || 0) : 0));
      // Zielliste: fertig gefiltert (Zielschutz, Taunt, Board of Kings, Great Wall …), noch ohne den Angreifer (der hängt vom ersten Klick ab).
      const zielWahl = await ctx.promptDamageTarget({
        side: 'any', types: ['hero', 'creature'], damageType: 'attack', baseDamage: maxAtk,
        title: CARD_NAME, condition: (t, eng) => gegnerKontrolliert(t, eng), _nurListe: true,
      });
      const zielListe = ((zielWahl && zielWahl.liste) || []).filter(t => !t.ineligible);
      const nichtDerselbe = (a, b) => a.id !== b.id;
      const angreiferListe = ohneZielschutz(engine, pi, ausfuehrende(engine, oppIdx))
        .filter(a => zielListe.some(t => nichtDerselbe(a, t)));   // Klick 1 braucht ein anderes Ziel für Klick 2
      if (angreiferListe.length === 0 || zielListe.length === 0) { gs._spellCancelled = true; return; }

      // ── EIN Picker: Klick 1 = der angreifende Gegnerheld, Klick 2 = das Ziel ──
      const wahl = await engine.promptGeordneteWahl(pi, [
        { targets: angreiferListe, label: 'Click the attacking Hero.', role: 'Attacker' },
        { targets: zielListe, label: 'Click the target.', role: 'Target' },
      ], {
        title: CARD_NAME, source: CARD_NAME,
        description: 'Choose the attacking Hero, then the target.',
        confirmLabel: '⚔️ Stab!',
        previewCardName: CARD_NAME,
        cancellable: true,
      });
      if (!wahl) { gs._spellCancelled = true; return; }   // Abbruch: Karte zurück auf die Hand
      const [angreiferZiel, zielVorab] = wahl;

      // ── Fenster der Heldenwahl („chosen"): Umleiter, Surprises, Post-Target-Reaktionen mit der Karte als Quelle ──
      const heldIds = await engine._zielwahlAbschliessen(pi, angreiferListe, {
        title: CARD_NAME, source: CARD_NAME, chooserHeroIdx: -1, maxTotal: 1, minRequired: 1, cancellable: true,
      }, [angreiferZiel.id]);
      const ausZiel = (Array.isArray(heldIds) ? heldIds : []).map(id => angreiferListe.find(t => t.id === id)).find(Boolean);
      if (!ausZiel) { gs._spellCancelled = true; return; }   // negiert/abgewehrt (die Reaktion setzt ihre eigenen Flaggen) oder leer
      const held = gs.players[ausZiel.owner]?.heroes?.[ausZiel.heroIdx];
      if (!held?.name || held.hp <= 0) { gs._spellCancelled = true; return; }

      // Quelle des Treffers: der gegnerische Held als Angreifer (Platz/Spalte), der Spieler der Karte als Verursacher.
      const attackSource = {
        name: CARD_NAME, owner: pi, heroIdx: ausZiel.heroIdx, controller: pi, heroOwner: ausZiel.owner, usesHeroAtk: true,
      };

      // ── Fenster der Zielwahl mit dem AUSFÜHRENDEN als Quelle ─────────────
      const istAusfuehrender = (t) => t.type === 'hero' && t.owner === ausZiel.owner && t.heroIdx === ausZiel.heroIdx;
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: Math.max(0, held.atk || 0),
        attackerSourceOverride: attackSource,
        _vorgewaehlt: zielVorab.id,   // schon gewählt: ab hier nur noch die Fenster; ist es nicht mehr wählbar, fragt die Engine normal
        title: CARD_NAME,
        description: `${held.name} stabs a target of your choice — another target your opponent controls.`,
        confirmLabel: '⚔️ Stab!',
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t, eng) => !istAusfuehrender(t) && gegnerKontrolliert(t, eng),
      });
      if (!target) { gs._spellCancelled = true; return; }   // Abbruch/negiert: Karte zurück auf die Hand bzw. verbraucht (Flaggen der Reaktion)

      // ── Zwischen Wahl und Treffer: kann der Ausführende noch angreifen? ──
      const heldJetzt = gs.players[ausZiel.owner]?.heroes?.[ausZiel.heroIdx];
      if (!heldJetzt?.name || heldJetzt.hp <= 0
          || !engine.heroKannAngreifen(ausZiel.owner, ausZiel.heroIdx, oppIdx, { name: CARD_NAME })) {
        engine.log('backstab_blocked', { player: gs.players[pi]?.username, hero: held.name });
        engine.sync();
        return;
      }

      // ── Der Stich ───────────────────────────────────────────────────────
      // Betrag: AKTUELLE Attack-Stat beim Auflösen (nach den Fenstern der Wahl neu gelesen).
      const atk = Math.max(0, heldJetzt.atk || 0);
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, atk);

      const zielSlot = target.type === 'hero' ? -1 : (target.slotIdx ?? -1);
      engine._broadcastEvent('play_zone_animation', {
        type: 'backstab_stab', zoneType: 'board', owner: target.owner, heroIdx: -1, zoneSlot: -1, duration: ANIM_MS,
        targets: [{ owner: target.owner, heroIdx: target.heroIdx, zoneSlot: zielSlot }],
        originOwner: ausZiel.owner, originHeroIdx: ausZiel.heroIdx, originZoneSlot: -1,
      });
      await engine._delay(STICH_WARTE_MS);

      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) await engine.actionDealDamage(attackSource, tgtHero, finalDmg, 'attack');
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst && inst.zone === 'support') {
          await engine.actionDealCreatureDamage(attackSource, inst, finalDmg, 'attack', { sourceOwner: pi, canBeNegated: true });
        }
      }

      engine.log('backstab', {
        player: gs.players[pi]?.username, hero: held.name, target: target.cardName, atk, damage: finalDmg,
      });
      await engine._delay(Math.max(0, ANIM_MS - STICH_WARTE_MS - 100));   // der Nachlauf des Bildes (Funken, Zurückziehen), bevor der nächste Schritt kommt
      engine.sync();
    },
  },

  /**
   * CPU: beantwortet den ganzen Picker auf einmal. Angreifer = Gegnerheld mit der höchsten Attack-Stat (bei Gleichstand die meisten HP — er bleibt als Ziel eher stehen); das Ziel wählt der
   * allgemeine Pilot (`_getCpuTargetResponse`: alle Ziele gehören dem Gegner, er sucht den besten Treffer) unter den Zielen ohne den Angreifer.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || payload?.type !== 'chainTargetPick' || payload.title !== CARD_NAME || !Array.isArray(payload.steps) || payload.steps.length !== 2) return undefined;
    const alle = payload.targets || [];
    const byId = (id) => alle.find(t => t.id === id);
    const held = (t) => engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    const angreifer = (payload.steps[0].ids || []).map(byId).filter(Boolean);
    if (angreifer.length === 0) return { cancelled: true };
    angreifer.sort((a, b) => ((held(b)?.atk || 0) - (held(a)?.atk || 0)) || ((held(b)?.hp || 0) - (held(a)?.hp || 0)));
    const ziele = (payload.steps[1].ids || []).map(byId).filter(Boolean);
    // dem Angreifer mit dem besten Treffer: der erste, für den es ein anderes Ziel gibt
    for (const a of angreifer) {
      const frei = ziele.filter(t => t.id !== a.id);
      if (frei.length === 0) continue;
      let wahl = null;
      try {
        const r = engine._getCpuTargetResponse(frei, {
          title: `${CARD_NAME} target`, damageType: 'attack', baseDamage: Math.max(0, held(a)?.atk || 0), cancellable: false, maxTotal: 1, minRequired: 1,
        }, payload._fuer);
        if (Array.isArray(r) && r.length) wahl = frei.find(t => t.id === r[0]) || null;
      } catch { wahl = null; }
      return { selectedTargets: [a, wahl || frei[0]] };
    }
    return { cancelled: true };
  },
};
