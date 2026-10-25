// ═══════════════════════════════════════════
//  CARD EFFECT: "YOU'RE ALIVE?!"
//  Attack (Normal, Fighting Lv1)
//
//  „Choose a level 1/2/3 or lower Creature from your discard pile that was defeated before the beginning of your last turn and place it into one of the user's free Support Zones.
//   If that was the only copy of that Creature in your discard pile, this counts as an additional Action."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────────
//  • Stufe 1/2/3 = Fighting-Stufe des Nutzers (1–3, wie Capture / Rewrite History); verglichen wird das WIRKSAME Level der Karte aus der Ablage (`effectiveCardLevel`). Karten ohne Level
//    (Artifact-Kreaturen) und Token sind keine Ziele.
//  • „Defeated before the beginning of your last turn": die Karte wurde BESIEGT (nicht abgeworfen/gemillt) in einem Zug VOR meinem vorigen eigenen Zug (`ps._rhVorigerZug`, gestempelt in
//    `startTurn`). Der Engine-Hub führt dazu `ps._besiegtLog` (jeder Kreaturentod, gleich wer ihn verursacht hat) und die Ablage stempelt jeden Eintrag mit dem Zug seines Eintreffens
//    (`_ablageStamps`); `engine.besiegteInAblage(pi)` paart beides. Ein Tod im vorigen eigenen Zug, im Gegnerzug danach oder im laufenden Zug zählt NICHT; im allerersten eigenen Zug
//    gibt es nichts zu wählen (außer Puzzle-Vorgaben, die schon vor der Verfolgung in der Ablage lagen).
//  • „Place": PLATZIEREN aus der Ablage (`summonFromDiscard` Modus `place` — keine Stufen-/Aktionsprüfung der Kreatur, aber die Sperren des Platzierens: Summon-Lock, „only control 1",
//    Gigantisaur-Riegel …). Ziel: eine FREIE Support Zone des NUTZERS (nur seine Zonen; bei Alice-Teilung auch die Zone einer gleichnamigen Kreatur). Mehrere freie Zonen: der Spieler wählt.
//    Ohne freie Zone ist der Nutzer nicht tauglich.
//
//  ── ZUSATZAKTION ──────────────────────────────────────────────────────
//  „If that was the only copy of that Creature in your discard pile, this counts as an additional Action." Die Entscheidung hängt am gewählten ZIEL (Anzahl gleichnamiger Karten in der
//  Ablage, die Wahl fällt erst im Zuge der Karte). Deshalb `inherentAction` als FUNKTION je Held: wahr, solange der Held mindestens ein gültiges Ziel hat, das die EINZIGE Kopie ist —
//  „diese Version" der Attack (die als Zusatzaktion). Daraus folgt:
//    • Main Phase (und Action Phase nach der Hauptaktion): nur mit einem solchen Helden spielbar, und gewählt werden dürfen NUR einzige Kopien (sonst wäre es keine Zusatzaktion).
//    • Action Phase mit freier Hauptaktion und einem einzigen Ziel verfügbar: die Karte läuft zunächst gratis; wählt der Spieler eine Karte mit weiteren Kopien in der Ablage, bezahlt er die
//      Aktion nachträglich (`gs._pendingActionBurn` wie Gather Intel / `consumeRealActionFor`).
//    • Ohne einzige Kopie bleibt die Karte spielbar und kostet eine normale Aktion (wie jede Attack).
//
//  ── Bild und Klang ────────────────────────────────────────────────────
//  Die Kreatur fliegt als Pixelart-Karte (Flugstil `zickzack`, `play_pile_transfer`) aus der Ablage, pendelt dreimal quer zur Flugrichtung hin und her (ganze Pixel im Bildtakt, kein
//  Drehen/Skalieren) und setzt genau in der Zielzone auf; Klang (Raunen, Wind, „Zurück ins Leben") im Client.
//
//  ── CPU ─────────────────────────────────────────────────────────────
//  Die allgemeine Galerie-Wahl der CPU nimmt die wertvollste Karte; als Zusatzaktion läuft die Karte über die inhärente Schiene der CPU (Main Phase).
// ═══════════════════════════════════════════

const { isSummonablePileCreature, hasCardType, hasNumericCreatureLevel } = require('./_hooks');

const CARD_NAME = "YOU'RE ALIVE?!";
const SCHOOL = 'Fighting';
const MAX_STUFE = 3;
const FLUG_MS = 1500;          // Länge des Zickzack-Flugs (deckt sich mit `ZICKZACK_FLUG_MS` im Client)

/** Fighting-Stufe des Nutzers auf seiner Brettseite, 1–3. */
function maxLevelFuer(engine, hs, heroIdx) {
  const stufe = engine.heroSchoolLevel(SCHOOL, hs, heroIdx);   // harte Negierung -> Stufe 0
  return Math.max(1, Math.min(stufe, MAX_STUFE));
}

/** Freie Support Zones DES Helden für diese Karte (Alice-Teilung: geteilte zuerst): [{ heroIdx, slotIdx, label, shared? }]. */
function freieZonen(engine, pi, hs, heroIdx, name) {
  return engine.beschwoerZonenFuer(pi, name, { seite: hs, heroIdx, nurBasis: true, namedHeroesOnly: true })
    .map(z => ({ heroIdx, slotIdx: z.slotIdx, label: z.label, ...(z.shared ? { shared: true, stackDepth: z.stackDepth } : {}) }));
}

/**
 * Die gültigen Ziele des Nutzers: je Name EIN Eintrag { name, level, kopien, einzige, index } — `index` = eine berechtigte (vor dem Stichtag besiegte) Kopie in der Ablage.
 * `kopien` zählt ALLE gleichnamigen Karten der Ablage (auch die nicht berechtigten): „the only copy of that Creature in your discard pile".
 */
function ziele(engine, pi, hs, heroIdx, maxLv) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps || maxLv <= 0) return [];
  const seit = ps._rhVorigerZug ?? 0;                          // Beginn des vorigen eigenen Zuges
  const db = engine._getCardDB();
  const out = new Map();
  for (const e of engine.besiegteInAblage(pi)) {
    if (!(e.turn < seit)) continue;                            // nicht vor meinem vorigen Zug besiegt
    if (out.has(e.name)) continue;                             // je Name ein Eintrag (die erste berechtigte Kopie)
    const cd = db[e.name];
    if (!cd || !hasCardType(cd, 'Creature') || hasCardType(cd, 'Token') || cd.subtype === 'Token') continue;
    if (!isSummonablePileCreature(cd, e.name) || !hasNumericCreatureLevel(cd)) continue;
    if (!engine.darfAusAblageAufsFeld(e.name)) continue;
    const level = engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' });
    if (level > maxLv) continue;
    if (freieZonen(engine, pi, hs, heroIdx, e.name).length === 0) continue;
    const kopien = (ps.discardPile || []).filter(n => n === e.name).length;
    out.set(e.name, { name: e.name, level, kopien, einzige: kopien === 1, index: e.index });
  }
  return [...out.values()];
}

/** Ziele für einen Helden (Pi = Spieler, heroIdx auf seiner Brettseite). */
function zieleFuerHeld(engine, pi, heroIdx) {
  const hs = engine.heldSeiteFuer(pi, heroIdx);
  const hero = engine.gs.players[hs]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return [];
  return ziele(engine, pi, hs, heroIdx, maxLevelFuer(engine, hs, heroIdx));
}

/** Die Aktion nachträglich bezahlen (Gather-Intel-Muster): Action Phase mit freier Hauptaktion → Buchung nach der Auflösung, sonst Bonus-/Geber-Aktion. */
function aktionBezahlen(engine, pi, heroIdx) {
  const gs = engine.gs;
  if ((gs.currentPhase || 0) === 3 && !engine.mainActionSpent(pi, heroIdx)) {
    gs._pendingActionBurn = { pi, heroIdx };
    return true;
  }
  return engine.consumeRealActionFor(pi, heroIdx, CARD_NAME);
}

module.exports = {
  cpuMeta: { scalesWithSchool: SCHOOL },

  // „Only copy → additional Action" — die Version der Attack, die als Zusatzaktion zählt, existiert nur mit einer einzigen Kopie als Ziel (je Held ausgewertet).
  inherentAction(gs, pi, heroIdx, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    return zieleFuerHeld(eng, pi, heroIdx).some(z => z.einzige);
  },

  /** Grau, solange kein eigener Held ein Ziel samt freier Zone hat. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return false;
    const heroes = gs.players[pi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) if (zieleFuerHeld(engine, pi, hi).length > 0) return true;
    return false;
  },

  /** Je Nutzer: freie Zone in SEINEN Support Zones und ein Ziel in seiner Fighting-Stufe. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return false;
    return zieleFuerHeld(engine, pi, heroIdx).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hs = ctx.cardHeroOwner ?? pi;                       // Brettseite des Nutzers (geliehener Held)
      const ps = gs.players[pi];
      const userHero = ctx.attachedHero || gs.players[hs]?.heroes?.[heroIdx];
      if (!ps || !userHero?.name || userHero.hp <= 0) { gs._spellCancelled = true; return; }

      const maxLv = maxLevelFuer(engine, hs, heroIdx);
      const gratis = !!gs._spellWasInherent;                    // die Engine behandelt diesen Zug als Zusatzaktion
      // Gratis-Zug ohne bezahlbare Aktion (Main Phase, Hauptaktion verbraucht): nur einzige Kopien — sonst wäre es keine Zusatzaktion. Mit freier Hauptaktion darf jedes Ziel gewählt werden;
      // eine Karte mit weiteren Kopien kostet dann die Aktion (siehe unten).
      const kannBezahlen = gratis && engine.hasSpendableActionFor(pi, heroIdx, CARD_NAME);
      let liste = ziele(engine, pi, hs, heroIdx, maxLv);
      if (gratis && !kannBezahlen) liste = liste.filter(z => z.einzige);
      if (liste.length === 0) { gs._spellCancelled = true; return; }

      // ── Wahl: eine Kreatur aus der Ablage (je Name einmal) ──
      const namen = liste.map(z => ({ name: z.name, source: 'discard' })).sort((a, b) => a.name.localeCompare(b.name));
      const pick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: namen,
        title: CARD_NAME,
        description: `Choose a Lv${maxLv} or lower Creature that was defeated before the beginning of your last turn and place it into one of ${userHero.name}'s free Support Zones.`
          + (gratis && !kannBezahlen ? ' (Only a Creature that is the only copy of its name in your discard pile.)' : ''),
        confirmLabel: '✨ YOU\'RE ALIVE?!',
        confirmClass: 'btn-info',
        cancellable: true,
      });
      if (!pick || pick.cancelled || !pick.cardName) { gs._spellCancelled = true; return; }
      const wahl = liste.find(z => z.name === pick.cardName);
      if (!wahl) { gs._spellCancelled = true; return; }

      // ── Platz: eine freie Zone DES NUTZERS ──
      const frei = freieZonen(engine, pi, hs, heroIdx, wahl.name);
      if (frei.length === 0) { gs._spellCancelled = true; return; }
      let zone = frei[0];
      if (frei.length > 1) {
        const gewaehlt = await ctx.promptZonePick(frei, {
          title: CARD_NAME,
          description: `Place ${wahl.name} into one of ${userHero.name}'s free Support Zones.`,
          cancellable: true,
          heroShortcut: false,
        });
        if (!gewaehlt) { gs._spellCancelled = true; return; }
        zone = frei.find(z => z.heroIdx === gewaehlt.heroIdx && z.slotIdx === gewaehlt.slotIdx) || frei[0];
      }

      // Ab hier gibt es kein Zurück. Eine Karte mit weiteren Kopien ist keine Zusatzaktion: bezahlen (der Zug lief nur wegen einer anderen, einzigen Kopie gratis).
      const einzige = wahl.einzige;
      if (gratis && !einzige) aktionBezahlen(engine, pi, heroIdx);

      // Die Karte, die tatsächlich geht: eine berechtigte (vor dem Stichtag besiegte) Kopie — nach der Wahl neu bestimmt, das Brett kann sich während der Abfragen geändert haben.
      const jetzt = ziele(engine, pi, hs, heroIdx, maxLv).find(z => z.name === wahl.name);
      if (!jetzt) { engine.log('youre_alive_fizzle', { player: ps.username, creature: wahl.name }); engine.sync(); return; }

      const res = await engine.summonFromDiscard(pi, pi, jetzt.index, zone.heroIdx, zone.slotIdx, {
        mode: 'place', source: CARD_NAME,
        ...(hs !== pi ? { heldSeite: hs } : {}),
        placeOpts: { flugStil: 'zickzack', flugMs: FLUG_MS },
      });
      engine.log('youre_alive', {
        player: ps.username, creature: wahl.name, hero: userHero.name, zone: zone.slotIdx, onlyCopy: einzige, ok: !!res?.inst,
      });
      engine.sync();
    },
  },

  _test: { ziele, zieleFuerHeld, FLUG_MS },
};
