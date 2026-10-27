// ═══════════════════════════════════════════
//  CARD EFFECT: "Cool Rescuer Monia"
//  Hero (400 HP, 40 ATK, Charme + Fighting)
//
//  "Whenever 1 or more Creatures either player controls would be
//   affected by a card or effect, you may discard 2 cards to negate any
//   effects that card or effect has on all Creatures."
//
//  ★ W77a (Al, 26.10.2026): zwei Entscheidungen.
//   A) SCHUTZUMFANG: BEIDE SEITEN AUF EINMAL. Pro Karte/Effekt gibt es nur noch
//      EIN Angebot an Monias Kontrolleur (nicht je Seite): Annahme negiert ALLE
//      Wirkungen der Karte/des Effekts auf ALLE Kreaturen beider Spieler (auch auf
//      Kreaturen, die der Effekt erst spaeter trifft); Ablehnung gilt fuer den
//      ganzen Effekt (keine zweite Frage fuer die andere Seite). Das Angebot
//      oeffnet beim ersten betroffenen Kreaturen-Ereignis des Effekts. Nicht-
//      Kreaturen-Ziele (Helden, Karten, Gold ...) laufen unveraendert weiter.
//   B) BALANCING: Kosten 2 Handkarten (vorher 1). Angebot nur, wenn Monias
//      Kontrolleur mindestens 2 taugliche Handkarten hat (die aufloesende Karte
//      zaehlt nie als Material). Gewaehlt wird NACH der Annahme (abbrechbarer
//      `handPick` mit Bestaetigen, EIN Batzen; Abbruch = Angebot abgelehnt, nichts
//      bezahlt), abgeworfen one by one. Boris darf den Abwurf ignorieren — die
//      Negation gilt dann trotzdem (Kosten uebersprungen negiert den Effekt nicht).
//   Bausteine in `_monia-shared.js` (`kostenWaehlen`/`kostenZahlen`, Buchfuehrung).
//
//  ★ W80a (Al, 26.10.2026): ZWEITWURF UND MEHRFACHTREFFER GEHOEREN ZUM SELBEN EFFEKT. Der Zweitwurf der Zusatzziel-Helden (Bartas, Grisgar, Andras: "you may choose a second target for
//   the Spell to hit afterwards") ist derselbe Spell, der erneut schlaegt: ein beim Hauptwurf ANGENOMMENES Angebot negiert auch den Zweitwurf auf Kreaturen (keine neue Frage, keine zweite
//   Zahlung; Helden/Nicht-Kreaturen werden weiter getroffen), ein ABGELEHNTES gilt auch fuer ihn (keine erneute Frage). Traf der Hauptwurf nur einen Helden, kommt das (erste) Angebot erst beim
//   Zweitziel. Mehrfachtreffer ueber mehrere Schadensstapel (Future Tech Barrage, Kirin Firebreath) waren schon derselbe Effekt (W77a). Technisch: Monias `afterSpellResolved` raeumt die Angebote
//   ab, kann dabei aber VOR dem Zusatzziel-Held laufen (Reihenfolge der Zuhoerer) — es legt den Stand fuer den Zweitwurf beiseite (`angeboteBeenden(gs, { fuerZweitwurf })`), der Zweitwurf holt
//   ihn zurueck (`zweitwurfFortsetzen`, `_second-target-shared.js`). CPU: die Bilanz rechnet mit absehbaren weiteren Treffern (Mehrfachtreffer: Schaden × erwartete Schlagzahl, Zweitwurf: voraussichtliches
//   Zweitziel anteilig, `_kreaturen-bilanz.js` `mitMehrfachtreffer`/`zweitwurfEintrag`).
//
//  ★ W83a (Al, 27./28.10.2026): (1) haben BEIDE Spieler eine Monia, wird ZUERST der Gegner des Zugspielers gefragt, dann der Zugspieler (`hookGegnerZuerst`, Engine `runHooks`); nimmt der Erste
//   an, entfaellt die zweite Frage. (2) CPU: dieselbe Bilanz, aber ohne bereits geschuetzte Kreaturen (sicherer Schutz), Ueberlebende ×0,7, weich Geschuetzte ×0,5 (`cpuInfo`, `ohne: [Monia]`).
//   (3) Ein zweiter CAST (Saya, Idej Kunagi, Chaos Magic, Timeless King Zi, Love Shot) ist ein EIGENER Effekt mit eigenem Angebot (`neuerGuss`); der Zweitwurf von Bartas/Grisgar/Andras bleibt
//   derselbe Effekt. Siehe CARD_API „Welle 83 / W83a".
//
//  ★ W58a (Al, 22.10.2026): die Einmal-pro-Zug-Klausel ist gestrichen
//  („Whenever" statt „Once per turn, when"). JEDE Karte / JEDER Effekt,
//  der mindestens eine Kreatur betreffen wuerde, oeffnet das Angebot
//  erneut; jede Annahme kostet erneut 1 Karte. Pro Karte/Effekt aber
//  nur EIN Angebot je Kontrolleur — nicht mehrfach, weil der Effekt
//  mehrere Kreaturen trifft oder in mehreren Schadensstapeln ablaeuft
//  (Buchfuehrung `gs._moniaAngebote`, siehe `_monia-shared.js`; sie
//  endet mit der Aufloesung, die naechste Aktion fragt wieder).
//  Die alte Sperre (`monia-protect` ueber `_hero-hopt-shared`) entfaellt.
//
//  Hooks into beforeCreatureDamageBatch (Schaden) und
//  beforeCreatureAffected (Zerstoeren, Status, Bewegen, Heilen,
//  Kontrolle).
//
//  ★ W71b (Al, 25.10.2026): „Sie sollte auf JEDEN Effekt reagieren koennen, der eine oder mehrere Creatures betreffen wuerde." Das Fenster
//  `beforeCreatureAffected` oeffnet jetzt JEDES Primitiv, das den Zustand einer Kreatur aendert — zentral ueber `engine.kreaturBetroffen(inst, art,
//  quelle, opts)` (Effektarten: destroy · heal · status · move [Verschieben, Bounce, Tausch] · control [Kontrollwechsel] · buff · counter · stats
//  [HP/Max-HP]): Bounce (`returnSupportCreatureToHand`: Racket Arrow, Deepsea Encounter …), Uebernahmen (`actionTransferCreature`: Dark Gear,
//  Diplomacy, Capture …; `actionStealCreatureGefragt`: Cute Conversion, Deepsea Succubus …), Buffs/Debuffs (`actionAddCreatureBuff`/`RemoveCreatureBuff`),
//  Status entfernen (`cleanseCreatureStatusesGefragt`: Beer, Juice …), Verschieben (Guard Change, Slippery Ice/Skates, Ushabti, Missing People, Mass
//  Routing), HP-/Marken-Schreiber einzelner Karten (Life Serum, Phoenix Bombardment, Voodoo Curse, Thicket …). Kein Fenster: Opfer/Tribut als Kosten,
//  Selbst-Effekte, reines Anvisieren, natuerliches Auslaufen, dauerhafte Auren (CARD_API „Welle 71 / W71b").
//  Neu im Angebot: die ausloesende Karte steht auch bei Nicht-Schaden links im Panel (`triggerCardName`), die Beschreibung nennt Karte und Wirkung.
//  (W77a: ein ABGELEHNTES Angebot gilt fuer den ganzen Effekt, nicht mehr je Seite.)
//
//  ★ W78a (Al, 26.10.2026): CPU-Bilanz ueber die GESAMTE Wirkung des Effekts + Rammstoss nur zu Kreaturen, die der Schutz wirklich betrifft.
//   · CPU (`cpuResponse`): entscheidet EINMAL je Effekt anhand der ERWARTETEN Gesamtbilanz auf alle Kreaturen beider Seiten (gemeinsame Rechnung
//     `engine.kreaturenBilanz`, `_kreaturen-bilanz.js`): Gewinn = Wert dessen, was EIGENEN Kreaturen schaden wuerde (bzw. gegnerischen nuetzen wuerde),
//     Verlust = Wert dessen, was GEGNERISCHEN Kreaturen schaden wuerde (bzw. eigenen nuetzen wuerde — Heilung/positive Buffs auf Eigene werden NICHT negiert,
//     auf Gegnerische ja). Schadensstapel: die komplette Zielliste. Einzelfenster: `engine.absehbareKreaturen` (angekuendigte Liste `kreaturenVorab`,
//     schon gewaehlte Ziele `engine._gewaehlteZiele`, Flaechen-Eigenschaft/Kartentext der Quelle). Auch wenn eine gegnerische Kreatur zuerst kommt oder
//     mit-geschuetzt wuerde, kann die Annahme sich lohnen — wenn der Gewinn Verlust UND Kosten (2 Handkarten) klar uebersteigt. Unveraendert abgelehnt:
//     eigener Effekt, unbekannter Verursacher, keine EIGENE Kreatur wirklich bedroht, weniger als 2 taugliche Handkarten. Die Kartenwahl (`handPick`)
//     trifft die CPU ueber den Abwurf-Bewerter.
//   · ANIMATION: der Rammstoss (`play_ram_animation`) laeuft nur zu Kreaturen, die der Schutz WIRKLICH bewahrt, d.h. denen der Effekt etwas ANGETAN haette
//     (Schadensstapel: alle negierten Eintraege mit Schaden > 0, je Kreatur einmal; Einzelfenster: die ausloesende Kreatur plus ausdruecklich angekuendigte/
//     gewaehlte). Kein Rammstoss: nicht negierbarer Schaden, Schaden 0, Heilung/positive Buffs/Statusentfernung (der Schutz nimmt der Kreatur dort etwas),
//     Kreaturen, die nur der Kartentext vermuten laesst.
// ═══════════════════════════════════════════

const { JETPACK_NAME, hasEquipped, checkMoniaAscension, quellName, angenommenesAngebot, angebotAbgelehnt, angebotMerken, angeboteBeenden,
  KOSTEN, ALLE_SEITEN, kostenPlaetze, kostenZahlbar, kostenWaehlen, kostenZahlen } = require('./_monia-shared');
const KB = require('./_kreaturen-bilanz');
const CARD_NAME = 'Cool Rescuer Monia';

/**
 * CPU-Angaben fuer den Prompt (W78a): die erwartete Gesamtbilanz des Effekts auf ALLE Kreaturen beider Seiten aus Sicht von Monias Kontrolleur `pi`
 * (`engine.kreaturenBilanz`, gemeinsame Rechnung). `liste` = [{ inst, art, amount?, sourceOwner?, detail?, statusName?, sicher?, canBeNegated? }].
 * Nur Zahlen/Namen — der Prompt geht auch an den Client.
 */
function cpuInfo(engine, pi, liste, quelleOwner, effektTyp, key) {
  let rechnung = { bilanz: 0, geschuetzt: 0, verloren: 0, eigeneBedroht: 0, posten: [] };
  // Gerechnet wird nur fuer die CPU (auch im Rollout): ein Mensch entscheidet selbst und der Prompt geht an seinen Client.
  const fuerCpu = (typeof engine.isCpuPlayer === 'function' && engine.isCpuPlayer(pi)) || engine._inMctsSim || engine._fastMode;
  // ★ W83a (Al 27.10.2026): dieselbe gemeinsame Rechnung wie alle AoE-Bewerter — Kreaturen, die zum Zeitpunkt der Entscheidung ohnehin geschuetzt sind (sicherer Schutz: Immunitaet,
  // Erstrunden-Schutz …), zaehlen weder als Gewinn noch als Verlust; Ueberlebende eines Schadens mit 0,7 × Anteil an der Rest-HP. Monias EIGENE Entscheidung rechnet nicht mit Monia
  // (`ohne`): weder die eigene noch die des Gegners (die CPU spekuliert nicht auf dessen Zahlung).
  if (fuerCpu) {
    try { rechnung = engine.kreaturenBilanz(pi, liste, { schutz: { quelle: key || undefined, ohne: [CARD_NAME] } }) || rechnung; } catch { /* ohne Rechnung lehnt die CPU ab */ }
  }
  // ★ W83a: Reihenfolge der Fragen (Engine: `hookGegnerZuerst`) — wer NICHT am Zug ist, wird zuerst gefragt. Hat der ZUERST Gefragte abgelehnt, steht das hier fuer den Zweiten (`vorentscheidung`);
  // hat er angenommen, wird der Zweite gar nicht mehr gefragt. Die CPU rechnet trotzdem nur nach der Bilanzregel (kein Spekulieren auf die Entscheidung des anderen).
  const gs = engine.gs;
  const davor = (gs?._moniaAngebote || []).find(a => a.key === (key || '') && a.pi !== pi);
  return {
    pi, quelleOwner: Number.isInteger(quelleOwner) ? quelleOwner : -1, effektTyp: effektTyp || null,
    zugspieler: gs?.activePlayer, zuerstGefragt: pi !== gs?.activePlayer, vorentscheidung: davor ? (davor.seite == null ? 'abgelehnt' : 'angenommen') : null,
    bilanz: Math.round(rechnung.bilanz * 10) / 10, geschuetzt: Math.round(rechnung.geschuetzt * 10) / 10, verloren: Math.round(rechnung.verloren * 10) / 10,
    eigeneBedroht: rechnung.eigeneBedroht, posten: rechnung.posten,
  };
}

/** Besitzer der Quelle eines Kreaturen-Ereignisses (Zahl) oder undefined (unbekannt). */
function quelleBesitzer(src, fallbackZahl) {
  if (src && typeof src === 'object') {
    const o = src.owner ?? src.controller;
    if (typeof o === 'number') return o;
  }
  return typeof fallbackZahl === 'number' ? fallbackZahl : undefined;
}

module.exports = {
  heroEffect: true,
  activeIn: ['hero'],

  // ★ W83a (Al 27.10.2026): haben BEIDE Spieler eine Monia, fragt die Engine (`runHooks`) IMMER ZUERST den Gegner des Zugspielers (wer NICHT am Zug ist), dann erst den Zugspieler.
  // Nimmt der Zuerst-Gefragte an, entfaellt die zweite Frage (`angenommenesAngebot`); lehnt er ab, wird die zweite Monia gefragt. Vorher: Zugspieler zuerst (Standardreihenfolge der Zuhoerer).
  hookGegnerZuerst: { beforeCreatureAffected: true, beforeCreatureDamageBatch: true },

  // ── Aufstieg (v668) zu „Monia Bot, the Foretold Rescuer of Coolness"
  // mit Cool Tech Jetpack. Bedingung in `_monia-shared.js`; Bereit-
  // schaft sync-getrieben (Dajan-Muster), weil das Jetpack praktisch
  // nur ueber Cool Repair liegen bleibt.
  ascensionItems: [JETPACK_NAME],
  cheatAscensionBlocked: true,
  ascensionNeedsCard(cardName, _cardData, engine, pi, hi) {
    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero || hero.name !== 'Cool Rescuer Monia' || hero.ascensionReady) return false;
    return cardName === JETPACK_NAME && !hasEquipped(engine, pi, hi, JETPACK_NAME);
  },
  ascensionProgress(engine, pi, hi) {
    return hasEquipped(engine, pi, hi, JETPACK_NAME) ? 1 : 0;
  },
  refreshAscensionReadiness(engine, pi, hi) {
    checkMoniaAscension(engine, pi, hi, null);
  },

  // (W77a: das Angebot hat nur noch EINE Option — „beide Seiten auf einmal" —, die Seitenwahl `save-0`/`save-1` und damit die Gerrymander-Umlenkung
  // dieser Wahl entfallen. Der Gerrymander-Schalter der Prompts steht aus: eine einzelne Option wird nie umgelenkt.)

  /**
   * CPU-Entscheidung zum Angebot „Cool Rescue!" (`promptData._moniaInfo`, siehe `cpuInfo`) und zur Kartenwahl der Kosten (`handPick` mit `moniaKostenWahl`).
   * Ohne Zugsperre wuerde die generische CPU-Wahl („letzte Option") in JEDEM Fenster Karten opfern. Hier: annehmen NUR wenn
   *   · der Effekt vom GEGNER kommt (kein Selbstschutz gegen den eigenen Plan, Verursacher bekannt),
   *   · der Effekt mindestens EINE EIGENE Kreatur wirklich bedroht (Schaden/Zerstoeren/Kontrollverlust/Bounce/Debuff — Heilung und positive Buffs auf Eigene sind keine Bedrohung),
   *   · die erwartete GESAMTBILANZ stimmt (W78a, ein Angebot schuetzt BEIDE Seiten): Gewinn = Wert dessen, was Eigenen schaden bzw. Gegnerischen nuetzen wuerde, MINUS
   *     Verlust = Wert dessen, was Gegnerischen schaden bzw. Eigenen nuetzen wuerde, uebersteigt die Kosten klar. Liste: Schadensstapel = alle Eintraege; Einzelfenster = die erste Kreatur
   *     plus `engine.absehbareKreaturen` (angekuendigte Liste, gewaehlte Ziele, Flaechen-Eigenschaft/Kartentext; Vermutungen aus dem Text zaehlen anteilig),
   *   · die Hand die Kosten traegt (mindestens 2 taugliche Handkarten).
   * Wert/Wirkung je Kreatur: siehe `_kreaturen-bilanz.js` (Level, HP, Rest-HP, Schaden relativ zur Rest-HP [toedlich = voll], Buffs, Faehigkeiten, Stapel; Zerstoeren/Kontrollverlust voll, Bewegen/Bounce 0,8, Status/Buff/Werte 0,6).
   * Kosten: Handwert der zwei schwaechsten Karten (`engine._cpuEstimateHandValue`, sonst je 20) + 10 (Faktor 1,25); bleibt genau die Kostenmenge in der Hand, muss die Bilanz hoch sein (≥ 80).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;

    // Kartenwahl der Kosten: die entbehrlichsten Karten (Abwurf-Bewerter wie Cute Hydra), genau `minSelect`.
    if (promptData?.type === 'handPick' && promptData.moniaKostenWahl) {
      const cpuIdx = promptData.controllerIdx ?? engine._cpuPlayerIdx;
      const ps = engine.gs.players[cpuIdx];
      const eligible = (promptData.eligibleIndices || []).filter(i => ps?.hand?.[i] != null);
      const want = promptData.minSelect ?? KOSTEN;
      if (!ps || eligible.length < want) return { selectedCards: [] };
      const rest = eligible.slice();
      const out = [];
      while (out.length < want && rest.length > 0) {
        const r = engine._getCpuGenericResponse(
          { type: 'forceDiscard', title: CARD_NAME, eligibleIndices: rest.slice(), controllerIdx: cpuIdx }, cpuIdx);
        const idx = r && Number.isInteger(r.handIndex) && rest.includes(r.handIndex) ? r.handIndex : rest[0];
        out.push({ handIndex: idx, cardName: ps.hand[idx] });
        rest.splice(rest.indexOf(idx), 1);
      }
      return { selectedCards: out };
    }

    if (promptData?.type !== 'optionPicker' || !promptData._moniaInfo) return undefined;
    const info = promptData._moniaInfo, pi = info.pi;
    if (info.quelleOwner === pi) return null;                                    // eigener Effekt
    if (!(info.quelleOwner >= 0)) return null;                                   // W71b: Verursacher unbekannt (kein Besitzer) — nie Karten dafuer opfern
    if (!(info.eigeneBedroht > 0)) return null;                                  // W78a: keine EIGENE Kreatur wirklich bedroht (Heilung/Buff auf Eigene, nur Gegnerische betroffen) — nie nur den Gegner retten
    const plaetze = kostenPlaetze(engine, pi);
    if (plaetze.length < KOSTEN) return null;
    const bilanz = info.bilanz;                                                  // W78a: Gewinn (Eigene bewahrt, Gegnerischem Nutzen genommen) minus Verlust (Gegnerische mitgeschuetzt, Eigenem Nutzen genommen)
    const hand = engine.gs.players[pi]?.hand || [];
    let werte = plaetze.map(() => 20);
    if (typeof engine._cpuEstimateHandValue === 'function') {
      try { werte = plaetze.map(i => engine._cpuEstimateHandValue(pi, hand[i])); } catch { werte = plaetze.map(() => 20); }
      werte = werte.map(w => (Number.isFinite(w) ? w : 20));
    }
    const kosten = werte.sort((a, b) => a - b).slice(0, KOSTEN).reduce((a, b) => a + b, 0) + 10;
    if (plaetze.length <= KOSTEN && bilanz < 80) return null;                    // die letzte Hand nur fuer einen klar wertvollen Schutz
    return bilanz >= kosten * 1.25 ? { optionId: 'save-all' } : null;
  },

  /**
   * CPU-Vorabpruefung (W82b, Vertrag `cpuSchuetzt(engine, traeger, ziel, e) → boolean`, gelesen von `engine.kreaturGeschuetztVor`): wuerde diese Monia die Wirkung `e` auf `ziel` voraussichtlich
   * negieren? Ja, wenn sie lebt und nicht gefroren/betaeubt/negiert ist, ihr Kontrolleur NICHT der Wirker ist (die CPU schuetzt nie gegen den eigenen Effekt), die Wirkung negierbar ist und
   * ihr Kontrolleur die 2 Handkarten zahlen kann. Monia schuetzt ALLE Kreaturen beider Seiten (ein Angebot je Effekt), also gilt dies fuer jedes `ziel`. Nur Hand-ANZAHL, keine Kartennamen.
   */
  cpuSchuetzt(engine, traeger, _ziel, e) {
    const { hero, owner, heroIdx } = traeger || {};
    if (!hero?.name || hero.hp <= 0 || hero.name !== CARD_NAME) return false;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return false;
    if (!engine.gs.heroFlags?.[`${owner}-${heroIdx}`]?.moniaProtection) return false;
    if (e?.canBeNegated === false) return false;
    const ktrl = engine.kontrolleurVonHeld(owner, heroIdx);
    if (ktrl === e?.quelleOwner) return false;
    return kostenZahlbar(engine, ktrl);
  },

  hooks: {
    onGameStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const heroIdx = ctx.cardHeroIdx;
      const flagKey = `${ctx.cardOriginalOwner}-${heroIdx}`;
      if (!gs.heroFlags) gs.heroFlags = {};
      if (!gs.heroFlags[flagKey]) gs.heroFlags[flagKey] = {};
      gs.heroFlags[flagKey].moniaProtection = true;
    },

    onTurnStart: async (ctx) => {
      // Clear stale shield flag + offers (afterSpellResolved never fires for non-spells; the engine ends the resolution at onAnyActionResolved).
      // (W58a: es gibt keine Einmal-pro-Zug-Sperre mehr — nichts zurueckzusetzen ausser der Aufloesung.)
      angeboteBeenden(ctx._engine.gs);
    },

    /**
     * Before creature damage batch: intercept and offer protection.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const entries = ctx.entries;
      if (!entries || entries.length === 0) return;

      const pi = ctx.cardOwner; // Effective controller (auto-resolved for charmed heroes)
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[ctx.cardOriginalOwner]?.heroes?.[heroIdx];
      // Tot = kein Schutz — AUSSER Monia ist im laufenden Flaechenschlag
      // gefallen: ihr Tod ist nur vorgemerkt, die Negation gehoert noch
      // zur Schadensberechnung dieses Schlags (Todes-Aufschub 28.9.).
      if (!hero?.name || (hero.hp <= 0 && !engine.heldTodAufgeschoben(hero))) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const flagKey = `${ctx.cardOriginalOwner}-${heroIdx}`;
      const flags = gs.heroFlags?.[flagKey];
      if (!flags?.moniaProtection) return;

      // v1443 (Als Befund 26.9.): WORAUF reagiert Monia? Die ausloesende
      // Karte steht links im Panel (`triggerCardName`), rechts bleibt
      // Monia selbst (automatisches `showCard`). Quelle: `runHooks` haelt
      // sie VOR der Zuhoerer-Runde fest; sonst die Schadensquelle.
      const trigger = ctx.ausloeserName || (() => {
        for (const e of entries) {
          const n = quellName(e.source);
          if (n) return n;
        }
        return null;
      })();
      const key = trigger || '';

      // Steht fuer DIESE Karte/diesen Effekt schon ein Schild (angenommenes Angebot, ein frueherer Stapel desselben Effekts), gilt er ohne neue Frage:
      // die Eintraege ALLER Kreaturen (W77a: beide Seiten) fallen weg. Gleiches gilt fuer Angebote anderer Kontrolleure derselben Aufloesung.
      for (const e of entries) {
        if (e.cancelled || e.isStatusDamage || e.canBeNegated === false || !e.inst) continue;
        if (engine.moniaSchildBlockt(e.inst, e.source, e.inst.controller ?? e.inst.owner)) e.cancelled = true;
      }
      // Pro Karte/Effekt nur EIN Angebot: angenommen (egal von wem) oder von mir abgelehnt (W77a: fuer den ganzen Effekt, beide Seiten) → keine neue Frage.
      if (angenommenesAngebot(gs, key)) return;
      if (angebotAbgelehnt(gs, key, pi)) return;

      // Must have the cost in controller's hand (W77a: 2 Karten; die aufloesende Karte zaehlt nie als Material)
      const ps = gs.players[pi];
      if (!ps || !kostenZahlbar(engine, pi)) return;

      // Find all entries that affect creatures (not cancelled, not status damage)
      const promptable = entries.filter(e => !e.cancelled && !e.isStatusDamage);
      if (promptable.length === 0) return;

      // Build prompt options (no "Cancel" — the panel has its own cancel button). W77a: EINE Option — beide Seiten auf einmal.
      const options = [
        { id: 'save-all', label: `🛡️ Protect all Creatures (discard ${KOSTEN})` },
      ];

      const srcEntry = promptable.find(e => e.source) || promptable[0];
      const quelleOwner = srcEntry ? (srcEntry.sourceOwner ?? srcEntry.source?.owner ?? srcEntry.source?.controller) : undefined;

      // Show prompt to Monia's player
      const result = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: `${hero.name} — Cool Rescue!`,
        description: trigger
          ? `Creatures are in danger from ${trigger}! Discard ${KOSTEN} cards to protect ALL Creatures.`
          : `Creatures are in danger! Discard ${KOSTEN} cards to protect ALL Creatures.`,
        triggerCardName: trigger || undefined,
        options,
        cancellable: true,
        cpuDispatch: CARD_NAME,   // W58a: die CPU fragt `cpuResponse` dieser Karte (Titel traegt den Heldennamen/Zusatz)
        costFor: CARD_NAME, costKind: 'protect',   // Kosten-Abwurf-Lernkanal (v1041): die Annahme IST die Kostenentscheidung; die CPU antwortet ueber `cpuResponse`
        // W78a: die komplette Zielliste des Stapels (beide Seiten), Wirkung = Schaden je Eintrag (nicht negierbarer Schaden zaehlt nicht: Monia schuetzt dort nichts)
        // W80a: dazu die erwarteten WEITEREN Treffer desselben Effekts — Mehrfachtreffer (Schaden × erwartete Schlagzahl) und der Zweitwurf der Zusatzziel-Helden (genau 1 Ziel + Bartas/Grisgar/Andras beim Wirker).
        _moniaInfo: cpuInfo(engine, pi, KB.mitMehrfachtreffer(engine,
          promptable.map(e => ({ inst: e.inst, amount: e.amount, sourceOwner: quelleOwner, canBeNegated: e.canBeNegated, type: e.type })),
          { quelle: trigger || '', quelleOwner, heroOwner: srcEntry?.source?.heroOwner ?? srcEntry?.source?.owner, heroIdx: srcEntry?.source?.heroIdx }), quelleOwner, 'damage', key),
      });

      // Abgelehnt: fuer diese Karte/diesen Effekt nicht noch einmal fragen (mehrere Stapel, Folgetreffer, andere Seite).
      if (!result || !result.optionId || result.cancelled || result.optionId !== 'save-all') { angebotMerken(gs, key, pi, false); return; }

      // W77a: die Kosten werden NACH der Annahme gewaehlt (abbrechbar: Abbruch = abgelehnt, nichts bezahlt).
      const gewaehlt = await kostenWaehlen(engine, pi, hero.name, CARD_NAME);
      if (!gewaehlt) { angebotMerken(gs, key, pi, false); return; }

      angebotMerken(gs, key, pi, true);

      // Set shield active for subsequent batches / status checks of this resolution (alle Kreaturen beider Seiten)
      gs._moniaShieldActive = ALLE_SEITEN;
      gs._moniaShieldSource = trigger ? { name: trigger } : null;   // W16f (H01-08): der Schild gehört zu dieser Karte/diesem Effekt

      // Cancel ONLY negatable entries — all Creatures, both sides (W77a).
      // Unnegatable damage (Acid Vial, Ida) still goes through — Monia "wastes" the effect.
      for (const e of promptable) {
        if (e.canBeNegated !== false) {
          e.cancelled = true;
        }
      }

      engine.log('monia_protect', {
        player: ps.username, hero: hero.name,
        protectedOwner: 'all',
        creaturesProtected: promptable.filter(e => e.cancelled).map(e => e.inst.name),
      });

      // ── Animation: Monia rams into each creature she actually protects (W78a, Al 26.10.: "Monia muss nicht zu Creatures dashen, die sie nicht schützt") ──
      // Das sind genau die Eintraege, die jetzt negiert sind UND denen der Schaden WIRKLICH etwas getan haette (Betrag > 0 nach Buff-Faktor); nicht
      // negierbarer Schaden (laeuft trotzdem), Betrag 0 und tote/verdeckte Kreaturen bekommen keinen Rammstoss. Je Kreatur einmal — nicht je Eintrag.
      // `targetOwner` uses physical side so the ram lands on the slot the player sees (cross-side-placed Creatures live on the controller's board).
      const gerammt = new Set();
      const geschuetzte = promptable.filter(e => e.cancelled && e.canBeNegated !== false && e.inst && e.inst.zone === 'support' && !e.inst.faceDown
        && KB.schuetzt(engine, e.inst, { art: 'damage', amount: e.amount, sourceOwner: quelleOwner }));
      for (const e of geschuetzte) {
        if (gerammt.has(e.inst.id)) continue;
        gerammt.add(e.inst.id);
        const physSide = engine.physicalSide(e.inst);
        engine._broadcastEvent('play_ram_animation', {
          sourceOwner: ctx.cardOriginalOwner, sourceHeroIdx: heroIdx,
          targetOwner: physSide, targetHeroIdx: e.inst.heroIdx,
          targetZoneSlot: e.inst.zoneSlot,
          cardName: hero.name, duration: 600,
          trailType: 'fire_stars',
        });
        await engine._delay(250);
      }
      if (gerammt.size) await engine._delay(400);

      // ── Discard 2 cards (W77a): als EIN Batzen gewaehlt, one by one abgeworfen; Boris darf ignorieren (die Negation gilt trotzdem) ──
      await kostenZahlen(engine, pi, gewaehlt, CARD_NAME);
    },

    /**
     * Generic creature protection for non-damage effects (destroy, heal, move, status).
     */
    beforeCreatureAffected: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const creature = ctx.creature;
      if (!creature) return;

      // Als Ruling (Demo vs Cute Commando): Monia reagiert NICHT auf
      // Effekte, mit denen eine Kreatur sich SELBST betrifft/tötet.
      // Repro: Cute Cats On-Summon-Selbst-Destroy (Mill-Motor) löste
      // den Schutz aus — Monia bezahlte eine Handkarte, um den EIGENEN
      // Effekt ihrer Seite zu blockieren. Der Selbst-Fall ist exakt
      // erkennbar: die Quelle des Effekts ist dieselbe Karten-Instanz
      // wie die betroffene Kreatur (ctx.destroyCard(inst) übergibt die
      // Instanz als source).
      if (ctx.source && (ctx.source === creature
        || (ctx.source.id != null && ctx.source.id === creature.id))) return;

      // Als Ruling (1.8., aus der eigenen Demo-Aufnahme): Monia darf
      // OPFER nicht beschützen. Ein Tribut ist eine Kosten-Zahlung des
      // eigenen Besitzers, kein fremder Zugriff — sonst ließe sich der
      // Nutzen einstreichen und der Preis zurückhalten. Im Mitschnitt
      // bot Monia an, das gerade als Tribut gewählte Greatmaw Remora zu
      // retten, NACHDEM der Sacrificial Dagger seinen Schaden schon
      // ausgeteilt hatte. Dieselbe Familie wie der Selbst-Kill-Guard
      // darüber: Monia schützt vor dem Gegner, nicht vor dem eigenen
      // Deckplan. `isSacrifice` setzt die Engine beim Bezahlen einer
      // sacrificeSpec (generischer Vertrag, gilt für jede Opfer-Karte).
      if (ctx.isSacrifice) return;

      const pi = ctx.cardOwner; // Effective controller (auto-resolved for charmed heroes)
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[ctx.cardOriginalOwner]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const flagKey = `${ctx.cardOriginalOwner}-${heroIdx}`;
      const flags = gs.heroFlags?.[flagKey];
      if (!flags?.moniaProtection) return;

      // Side attribution uses CONTROLLER — a cross-side-placed
      // Creature counts under the side that currently controls it.
      const creatureSide = creature.controller ?? creature.owner;

      // Karte/Effekt (Name wie im Schadenshook: Quelle des Effekts, sonst die laufende Wirkung)
      const key = quellName(ctx.source) || engine._effectSourceName() || '';

      // Steht fuer DIESE Karte/diesen Effekt schon ein Schild (angenommenes Angebot, Kreatur davor — W77a: egal welche Seite), gilt er ohne neue Frage.
      if (engine.moniaSchildBlockt(creature, ctx.source, creatureSide)) { ctx.cancelled = true; return; }
      // Pro Karte/Effekt nur EIN Angebot: angenommen (auch von einem anderen Kontrolleur) oder von mir abgelehnt (W77a: fuer den ganzen Effekt, beide Seiten) → keine neue Frage.
      if (angenommenesAngebot(gs, key)) return;
      if (angebotAbgelehnt(gs, key, pi)) return;

      const ps = gs.players[pi];
      if (!ps || !kostenZahlbar(engine, pi)) return;   // W77a: 2 taugliche Handkarten

      const creatureName = creature.name || 'Creature';
      const ownerLabel = creatureSide === pi ? 'your' : (gs.players[creatureSide]?.username || 'Player') + "'s";

      const options = [
        { id: 'save-all', label: `🛡️ Protect all Creatures (discard ${KOSTEN})` },
      ];

      const quelleOwner = quelleBesitzer(ctx.source, ctx.sourceOwner);
      // W78a: ERWARTETE Gesamtliste des Effekts (nicht nur die erste Kreatur): angekuendigte Liste (`kreaturenVorab`), schon gewaehlte Ziele, Flaechen-Eigenschaft/Kartentext der Quelle.
      const erwartet = engine.absehbareKreaturen({
        erste: creature, art: ctx.effectType, detail: ctx.detail, statusName: ctx.statusName,
        quelle: key, quelleOwner, vorab: ctx.vorab,
        heroOwner: ctx.source && typeof ctx.source === 'object' ? (ctx.source.heroOwner ?? ctx.source.owner) : undefined,   // W80a: Wirker-Held (Zweitwurf-Erwartung)
        heroIdx: ctx.source && typeof ctx.source === 'object' ? ctx.source.heroIdx : undefined,
      });
      // W71b: die ausloesende Karte steht links im Panel („Triggered by"), der Text nennt sie und die Wirkung.
      const ausloeser = key || null;
      const wirkung = { destroy: 'destroy', heal: 'heal', status: 'afflict', move: 'move', control: 'take control of', buff: 'change', stats: 'change the stats of' }[ctx.effectType] || 'affect';
      const result = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: `${hero.name} — Cool Rescue!`,
        description: `${ownerLabel.charAt(0).toUpperCase() + ownerLabel.slice(1)} ${creatureName} is in danger${ausloeser ? ` — ${ausloeser} would ${wirkung} it` : ''}! Discard ${KOSTEN} cards to protect ALL Creatures.`,
        triggerCardName: ausloeser || undefined,
        options,
        cancellable: true,
        cpuDispatch: CARD_NAME,
        costFor: CARD_NAME, costKind: 'protect',   // Kosten-Abwurf-Lernkanal (v1041), siehe oben
        _moniaInfo: cpuInfo(engine, pi, erwartet, quelleOwner, ctx.effectType, key),
      });

      // Abgelehnt: gilt fuer den ganzen Effekt (W77a) — keine zweite Frage fuer eine andere Kreatur / die andere Seite.
      if (!result || !result.optionId || result.cancelled || result.optionId !== 'save-all') { angebotMerken(gs, key, pi, false); return; }

      // W77a: die Kosten werden NACH der Annahme gewaehlt (abbrechbar: Abbruch = abgelehnt, nichts bezahlt).
      const gewaehlt = await kostenWaehlen(engine, pi, hero.name, CARD_NAME);
      if (!gewaehlt) { angebotMerken(gs, key, pi, false); return; }

      angebotMerken(gs, key, pi, true);
      gs._moniaShieldActive = ALLE_SEITEN;
      {   // W16f (H01-08): Quelle des geschützten Effekts merken (Schild gilt nur für sie)
        const qn = quellName(ctx.source);
        gs._moniaShieldSource = qn ? { name: qn } : null;
      }
      ctx.cancelled = true;

      engine.log('monia_protect', {
        player: ps.username, hero: hero.name,
        protectedCreature: creatureName, effectType: ctx.effectType, protectedOwner: 'all',
      });

      // Animation (W78a: nur zu Kreaturen, die der Schutz WIRKLICH bewahrt): die ausloesende Kreatur — sofern der Effekt ihr wirklich etwas taete (Heilung bei vollen HP,
      // Statusentfernung ohne Status … greifen nicht) — plus die ausdruecklich angekuendigten/gewaehlten Kreaturen dieses Effekts (`sicher` = 1). Vermutungen aus dem Kartentext
      // bekommen KEINEN Rammstoss (sie werden still negiert, wenn der Effekt sie wirklich trifft). `targetOwner` is the PHYSICAL side (where the creature actually renders)
      // so a cross-side-placed Creature gets the ram on opp's slot.
      const rammen = erwartet.filter(x => x.sicher >= 1 && x.inst.zone === 'support' && !x.inst.faceDown && KB.schuetzt(engine, x.inst, x));
      for (const x of rammen) {
        engine._broadcastEvent('play_ram_animation', {
          sourceOwner: ctx.cardOriginalOwner, sourceHeroIdx: heroIdx,
          targetOwner: engine.physicalSide(x.inst), targetHeroIdx: x.inst.heroIdx,
          targetZoneSlot: x.inst.zoneSlot,
          cardName: hero.name, duration: 600,
          trailType: 'fire_stars',
        });
        await engine._delay(rammen.length > 1 ? 250 : 500);
      }
      if (rammen.length > 1) await engine._delay(400);

      // Discard 2 cards (W77a): als EIN Batzen gewaehlt, one by one abgeworfen; Boris darf ignorieren (die Negation gilt trotzdem)
      await kostenZahlen(engine, pi, gewaehlt, CARD_NAME);
    },

    /**
     * After spell resolves: clear the shield-active flag and the offers of this resolution.
     */
    afterSpellResolved: async (ctx) => {
      // W80a: ein Zweitwurf (Bartas & Co.) folgt noch in dieser Runde der Zuhoerer und ist derselbe Effekt — der Stand wird fuer ihn beiseitegelegt (`zweitwurfFortsetzen`).
      angeboteBeenden(ctx._engine.gs, { fuerZweitwurf: !ctx.isSecondCast });
    },
  },
};
