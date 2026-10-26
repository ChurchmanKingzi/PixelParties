'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Backstab"
//  Attack (Normal, Fighting Lv0)
//
//  „Perform this Attack with a Hero your opponent controls. Choose another target your
//   opponent controls and deal damage equal to the Hero's Attack stat to it."
//
//  ── KEIN EIGENER HELD (Al, 26.10.): „kein eigener Hero performed diese Attack" ──
//  AUF EINEN GEGNERHELDEN ZIEHEN (Al 26.10.): zieht man die Karte direkt auf den Gegnerhelden, der die Attack ausführen soll, ist er vorgewählt (`herolosAngreifer` → `gs._herolosVorAngreifer`;
//  die ziehbaren Helden liefert `herolosAusfuehrer` → Zustandsfeld `herolessAngreifer`), und der Picker fragt nur noch das Ziel (ein Schritt). Ist er nicht (mehr) wählbar, läuft der normale Zwei-Klick-Picker.
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
//  ★ ANGREIFER UND ZIEL GEHÖREN DEMSELBEN SPIELER (Al 26.10., Nr. 14): „your opponent" ist hier JEDER Gegner (`engine.opponentsOf`; Normalspiel: einer, Skill Test: alle anderen Sitze),
//  aber nach Klick 1 bietet der Picker nur noch ANDERE Ziele desselben Kontrolleurs an (`abhaengig`/`byPrev` in `promptGeordneteWahl`); die Serverprüfung lehnt gemischte Kombinationen ab
//  (= Abbruch). Spielbar nur, wenn EIN Gegner einen angriffsfähigen Helden UND ein weiteres Ziel hat. Nach einer Umleitung des Angreifers (Challenge …) gilt der Kontrolleur des NEUEN Angreifers.
//  Kandidaten: Angreifer = lebende Helden, die der Gegner KONTROLLIERT (Kontrolle statt Spalte: ein von ihm übernommener eigener Held zählt, ein von mir übernommener nicht); Ziel = Held ODER
//  Kreatur, die der Gegner kontrolliert (Ausrüstung/Abilities sind keine Ziele). Attack-Stat 0 ist zulässig (0 Schaden).
//
//  ── FENSTER NACH DER WAHL (wie bisher) ────────────────────────────────
//  Beide Wahlen gelten weiter als „chosen": ZUERST der Angreifer (`_zielwahlAbschliessen` mit der Karte als Quelle: Umleiter wie Challenge, Surprises, Post-Target-Reaktionen), DANN das Ziel
//  (`ctx.promptDamageTarget` mit `_vorgewaehlt` und dem Ausführenden als Quelle = `attackerSourceOverride`: Umleiter, Surprises, Escape Device & Co., Taunt, Alliance, das Auge des
//  Angreifers). Wird der Angreifer umgeleitet und ist das gewählte Ziel dann derselbe Held, oder ist das Ziel mit DIESEM Angreifer als Quelle nicht mehr wählbar (Alliance, Auge …), fragt die
//  Karte das Ziel noch einmal einzeln.
//
//  ── ★ DER ANGREIFER FÜHRT DIE ATTACK AUS (Al 26.10., Nr. 15: „Die Lücke schließen") ─────────────
//  Der Stich läuft in einer virtuellen Attack-Kette des schlagenden Gegnerhelden (`engine.alsAttackKette`, Muster Alluring Light: Besitzer der Kette = sein Kontrolleur, Held = der Angreifer):
//   • Reaktionen seines Kontrolleurs auf „a Hero you control performs an Attack" (Arrows, Magic Topaz, Bow of the Hunt Goddess, Arrow Slit …) werden IHM angeboten und wirken auf den Treffer;
//   • `afterSpellResolved` (als Attack, `_alsEffekt`) und `onEffectCountedAsArt` laufen an IHM: seine Ausrüstung/Fähigkeiten/Zähler (Blade of the Frostbringer, Heart-Shaped Bow, Legendary
//     Sword, Mirjam …), Held- und Spieler-Zähler seiner Seite; `onAttackDeclare`/Schadens-Hooks lasen den Angreifer schon immer über die Quelle;
//   • das Hand-Fenster „ein Held hat eine Attack ausgeführt" (Nasty Prank) bekommt den Angreifer als Ausführenden (`gs._herolosAusfuehrer`, gelesen von `doPlaySpell`);
//   • der Spieler der Karte hat KEINEN Wirker-Helden (`heroIdx -1`): seine eigenen Arrows/Topaz/Ausrüstung feuern nicht; für ihn zählt die Karte als gespielte Attack (Aktion, Zähler).
//  Wird die Kette des Angreifers abgewehrt (Negierer), ist der Stich zu sehen, trifft aber nicht; fizzelt sie (Angreifer nicht mehr handlungsfähig), passiert nichts.
//
//  ── ③ SCHADEN, QUELLE, ZÄHLUNG ──────────────────────────────────────────
//  Schadenstyp `attack`: Reduktionen, Schilde, Immunitäten, Stoneskin & Co. des Ziels greifen wie bei jeder Attack. Betrag = aktuelle Attack-Stat des Ausführenden beim AUFLÖSEN. Quelle des
//  Treffers: `{ name: 'Backstab', owner: Spieler, controller: Spieler, heroIdx/heroOwner: der Ausführende, usesHeroAtk }` — „der Angreifer" für Booby Trap/Frost Rune/Attack-Hooks ist der
//  Gegnerheld, der VERURSACHER (Kill-/„defeated by"-Zählung) der Spieler. Pfeile/Magic Topaz des Spielers passen nicht (kein eigener Held performed: die Karte trägt `heroIdx -1`).
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
//  `cpuResponse` beantwortet den ganzen Picker auf einmal: Angreifer = Gegnerheld mit der höchsten ATK unter allen Gegnern, die ein gültiges Ziel haben (bei Gleichstand die meisten HP), Ziel = der
//  Pilot (`_getCpuTargetResponse`, bester Treffer) unter den Zielen DESSELBEN Spielers ohne den Angreifer (`byPrev`). Rollout/Schnellmodus: `promptGeneric` beantwortet den Picker über denselben `cpuResponse`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Backstab';
const ANIM_MS = 900;           // Länge von `backstab_stab` im Client (ENDE)
const STICH_WARTE_MS = 440;    // bis zum Einschlag (330 ms im Bild + 100 ms Einbau-Versatz des Clients), dann fällt der Schaden

/** Kontrolleur eines Ziels (Held: Kontrolle statt Spalte, `heroSideOf`; Kreatur: `kontrolleurVon`). */
function kontrolleurVonZiel(engine, t) {
  if (t.type === 'hero') {
    const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    return h ? engine.heroSideOf(t.owner, h) : t.owner;
  }
  return t.cardInstance ? engine.kontrolleurVon(t.cardInstance) : t.owner;
}

/**
 * Lebende Helden der GEGNER von `pi`, die als Ausführende angreifen können (Zielobjekte `hero-<Spalte>-<Index>`, `kontr` = ihr Kontrolleur), noch OHNE Zielschutz.
 * Normalspiel: ein Gegner; Skill Test: alle anderen Sitze (Al: Angreifer und Ziel gehören immer demselben Spieler — das sichert die abhängige Zielliste im Picker).
 */
function ausfuehrende(engine, pi) {
  const out = [];
  for (const oppIdx of engine.opponentsOf(pi)) {
    for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(oppIdx)) {
      if (!hero?.name || hero.hp <= 0) continue;
      if (!engine.heroKannAngreifen(physOwner, heroIdx, oppIdx, { name: CARD_NAME })) continue;
      out.push({ id: `hero-${physOwner}-${heroIdx}`, type: 'hero', owner: physOwner, heroIdx, cardName: hero.name, kontr: oppIdx });
    }
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

/** Das Bild: ein Pixel-Schwert aus Richtung des Ausführenden sticht ins Ziel; wartet bis zum Einschlag (`STICH_WARTE_MS`). */
async function zeigeStich(engine, ausfuehrender, z) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'backstab_stab', zoneType: 'board', owner: z.owner, heroIdx: -1, zoneSlot: -1, duration: ANIM_MS,
    targets: [{ owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.type === 'hero' ? -1 : (z.slotIdx ?? -1) }],
    originOwner: ausfuehrender.owner, originHeroIdx: ausfuehrender.heroIdx, originZoneSlot: -1,
  });
  await engine._delay(STICH_WARTE_MS);
}

module.exports = {
  /** Gegnerhelden, auf die man die Karte ZIEHEN kann (sie führen den Stich aus): `[{ owner, heroIdx }]` — für die Ziehen-Hervorhebung des Clients (`herolessAngreifer`). */
  herolosAusfuehrer(engine, pi) {
    return ohneZielschutz(engine, pi, ausfuehrende(engine, pi)).map(a => ({ owner: a.owner, heroIdx: a.heroIdx }));
  },

  // ★ Bilder eines NEGIERTEN Stichs (Zielschutz-Reaktion nach der Wahl): die Quelle ist der ausführende Held (`heroOwner`/`heroIdx`), die Ziele die gewählten. Nur Bilder, kein Zustand.
  spellVisual: async (engine, info) => {
    const z = (info.targets || []).filter(Boolean)[0];
    const seite = info.heroOwner ?? info.owner;
    if (!z || !Number.isInteger(info.heroIdx) || info.heroIdx < 0 || !Number.isInteger(seite)) return;
    if (info.schonGezeigt?.zone?.has('backstab_stab')) return;
    await zeigeStich(engine, { owner: seite, heroIdx: info.heroIdx }, z);
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // Kein Wirker-Held: ohne Heldenwahl spielbar (Client `herolessHandCards`; Server `doPlaySpell` bucht die Aktion über `engine.herolosPlatzhalter`, nach außen `heroIdx -1`).
  playsWithoutHero: true,

  // Der Stich trifft nur Ziele des Gegners (Schaden): in Runde 1 (Erst-Runden-Immunität) wäre er wirkungslos → unspielbar (Welle 12 B-06).
  blockedByFirstTurnProtection: true,

  /** „Perform this Attack with a Hero your opponent controls … another target your opponent controls": ohne ausführenden Helden UND zweites Ziel bei DEMSELBEN Gegner unspielbar. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return false;
    try {
      // Es muss EINEN Gegner geben, der einen angriffsfähigen Helden UND ein weiteres Ziel hat (Angreifer und Ziel gehören demselben Spieler).
      const angreifer = ausfuehrende(engine, pi);
      return engine.opponentsOf(pi).some(opp => angreifer.some(a => a.kontr === opp) && gegnerZiele(engine, opp).length >= 2);   // der Ausführende zählt als eines, „another" braucht ein zweites
    } catch { return false; }
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      delete gs._herolosAusfuehrer;
      const gegnerSeiten = engine.opponentsOf(pi);

      // ── Kandidatenlisten für den EINEN Picker ───────────────────────────
      const ctrl = (t) => kontrolleurVonZiel(engine, t);
      const gegnerKontrolliert = (t, eng) => gegnerSeiten.includes(kontrolleurVonZiel(eng, t));
      const maxAtk = Math.max(0, ...gegnerSeiten.flatMap(o => engine.heroesControlledBy(o)).map(({ hero }) => hero?.hp > 0 ? (hero.atk || 0) : 0));
      // Zielliste: fertig gefiltert (Zielschutz, Taunt, Board of Kings, Great Wall …), noch ohne den Angreifer (der hängt vom ersten Klick ab).
      const zielWahl = await ctx.promptDamageTarget({
        side: 'any', types: ['hero', 'creature'], damageType: 'attack', baseDamage: maxAtk,
        title: CARD_NAME, condition: (t, eng) => gegnerKontrolliert(t, eng), _nurListe: true,
      });
      const zielListe = ((zielWahl && zielWahl.liste) || []).filter(t => !t.ineligible);
      // Ziel für den Angreifer `a`: ein ANDERES Ziel, das DERSELBE Spieler kontrolliert (Al 26.10.: Angreifer und Ziel gehören immer demselben Spieler).
      const zieleFuer = (a) => zielListe.filter(t => t.id !== a.id && ctrl(t) === (a.kontr ?? ctrl(a)));
      const angreiferListe = ohneZielschutz(engine, pi, ausfuehrende(engine, pi)).filter(a => zieleFuer(a).length > 0);   // Klick 1 braucht ein Ziel für Klick 2
      if (angreiferListe.length === 0 || zielListe.length === 0) { gs._spellCancelled = true; return; }

      // Auf einen Gegnerhelden gezogen (Al 26.10.): er ist der Angreifer, es bleibt die Wahl des Ziels. Ist er nicht (mehr) wählbar, läuft der normale Picker.
      const vor = gs._herolosVorAngreifer;
      delete gs._herolosVorAngreifer;
      const vorAngreifer = vor ? angreiferListe.find(a => a.owner === vor.owner && a.heroIdx === vor.heroIdx) : null;

      // ── EIN Picker: Klick 1 = der angreifende Gegnerheld, Klick 2 = das Ziel (nur Ziele desselben Spielers) ──
      const wahl = vorAngreifer
        ? await engine.promptGeordneteWahl(pi, [
          { targets: zieleFuer(vorAngreifer), label: 'Click the target.', role: 'Target' },
        ], {
          title: CARD_NAME, source: CARD_NAME,
          description: `${vorAngreifer.cardName} stabs — choose the target.`,
          vorgewaehlt: vorAngreifer,   // der Angreifer wird dunkelrot markiert
          confirmLabel: '⚔️ Stab!',
          previewCardName: CARD_NAME,
          cancellable: true,
        })
        : await engine.promptGeordneteWahl(pi, [
          { targets: angreiferListe, label: 'Click the attacking Hero.', role: 'Attacker' },
          { targets: zielListe, label: 'Click the target.', role: 'Target', abhaengig: zieleFuer },
        ], {
          title: CARD_NAME, source: CARD_NAME,
          description: 'Choose the attacking Hero, then the target.',
          confirmLabel: '⚔️ Stab!',
          previewCardName: CARD_NAME,
          cancellable: true,
        });
      if (!wahl) { gs._spellCancelled = true; return; }   // Abbruch: Karte zurück auf die Hand
      const [angreiferZiel, zielVorab] = vorAngreifer ? [vorAngreifer, wahl[0]] : wahl;

      // ── Fenster der Heldenwahl („chosen"): Umleiter, Surprises, Post-Target-Reaktionen mit der Karte als Quelle ──
      const heldIds = await engine._zielwahlAbschliessen(pi, angreiferListe, {
        title: CARD_NAME, source: CARD_NAME, chooserHeroIdx: -1, maxTotal: 1, minRequired: 1, cancellable: true,
      }, [angreiferZiel.id]);
      const ausZiel = (Array.isArray(heldIds) ? heldIds : []).map(id => angreiferListe.find(t => t.id === id)).find(Boolean);
      if (!ausZiel) { gs._spellCancelled = true; return; }   // negiert/abgewehrt (die Reaktion setzt ihre eigenen Flaggen) oder leer
      const held = gs.players[ausZiel.owner]?.heroes?.[ausZiel.heroIdx];
      if (!held?.name || held.hp <= 0) { gs._spellCancelled = true; return; }
      const kontr = ausZiel.kontr ?? engine.heroSideOf(ausZiel.owner, held);   // der Spieler, dem der Angreifer gehört (= wem auch das Ziel gehören muss)

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
        description: `${held.name} stabs a target of your choice — another target the same player controls.`,
        confirmLabel: '⚔️ Stab!',
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t, eng) => !istAusfuehrender(t) && gegnerKontrolliert(t, eng) && ctrl(t) === kontr,
      });
      if (!target) { gs._spellCancelled = true; return; }   // Abbruch/negiert: Karte zurück auf die Hand bzw. verbraucht (Flaggen der Reaktion)

      // ── Zwischen Wahl und Treffer: kann der Ausführende noch angreifen? ──
      const heldJetzt = gs.players[ausZiel.owner]?.heroes?.[ausZiel.heroIdx];
      if (!heldJetzt?.name || heldJetzt.hp <= 0
          || !engine.heroKannAngreifen(ausZiel.owner, ausZiel.heroIdx, kontr, { name: CARD_NAME })) {
        engine.log('backstab_blocked', { player: gs.players[pi]?.username, hero: held.name });
        engine.sync();
        return;
      }

      // ── Der Stich: eine Attack des ANGREIFENDEN Helden (Al 26.10.: „die Lücke schließen") ──
      // Wie Alluring Light: eine virtuelle Attack-Kette für den schlagenden Gegnerhelden (Besitzer der Kette = sein Kontrolleur, Held = Angreifer). Damit sehen seine Arrows/Magic Topaz/
      // Bow of the Hunt Goddess die Attack, und `afterSpellResolved`/`onEffectCountedAsArt` laufen an IHM (Ausrüstung, Fähigkeiten, Zähler des Helden) — nicht am Spieler der Karte, der keinen
      // Wirker-Helden hat (seine Pfeile passen nicht: die Karte trägt `heroIdx -1`).
      const stich = async () => {
        // Betrag: AKTUELLE Attack-Stat beim Auflösen (nach den Fenstern der Wahl neu gelesen).
        const atk = Math.max(0, (gs.players[ausZiel.owner]?.heroes?.[ausZiel.heroIdx]?.atk) || 0);
        const finalDmg = await engine._fireAttackDeclare(attackSource, target, atk);
        await zeigeStich(engine, ausZiel, target);
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
        return true;
      };
      const kette = await engine.alsAttackKette({
        name: CARD_NAME, pi: kontr, heroIdx: ausZiel.heroIdx, heroOwner: ausZiel.owner, ziele: [target], wirkName: held.name, resolve: stich,
      });
      if (kette && kette.negated) {
        // Die Kette des schlagenden Helden wurde abgewehrt (z. B. Magic Mirror, Negierer): der Stich ist zu sehen, trifft aber nicht.
        await zeigeStich(engine, ausZiel, target);
      } else if (kette && !kette.fizzled) {
        // Hand-Fenster „ein Held hat eine Attack ausgeführt" (Nasty Prank): Ausführender ist der Gegnerheld — `doPlaySpell` meldet es (die Karte selbst trägt keinen Helden).
        gs._herolosAusfuehrer = { controller: kontr, heroOwner: ausZiel.owner, heroIdx: ausZiel.heroIdx };
      }
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
    const schritt2 = payload.steps[1];
    // dem Angreifer mit der höchsten ATK: der erste, für den es ein gültiges Ziel gibt (`byPrev`: nur Ziele desselben Spielers, nicht der Angreifer selbst)
    for (const a of angreifer) {
      const ids2 = (schritt2.byPrev ? (schritt2.byPrev[a.id] || []) : (schritt2.ids || [])).filter(i => i !== a.id);
      const frei = ids2.map(byId).filter(Boolean);
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
