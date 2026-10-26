// ═══════════════════════════════════════════
//  CARD EFFECT: "Cool Rescuer Monia"
//  Hero (400 HP, 40 ATK, Charme + Fighting)
//
//  "Whenever 1 or more Creatures either player controls would be
//   affected by a card or effect, you may discard 1 card to negate any
//   effects that card or effect has on all Creatures."
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
//  ★ Als Ruling (Al 26.10., „wörtlich nehmen"): „… negate any effects that card or effect has on ALL Creatures" — EINE abgeworfene Karte negiert die Wirkung der
//  auslösenden Karte/des Effekts auf ALLE Kreaturen (beide Seiten), nicht nur auf eine Seite. Die Seitenwahl (`save-0` / `save-1`) entfällt: ein Angebot (`save-all`),
//  ein angenommenes Angebot schützt alle Seiten (`alleSeitenSchuetzen` → `gs._moniaAngebote` je Seite) für den Rest dieser Karte/dieses Effekts.
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
//  Neu im Angebot: die ausloesende Karte steht auch bei Nicht-Schaden links im Panel (`triggerCardName`), die Beschreibung nennt Karte und Wirkung,
//  und ein ABGELEHNTES Einzelfenster gilt nur fuer die Seite der Kreatur (ein Flaecheneffekt fragt hoechstens einmal je Seite).
//
//  CPU (`cpuResponse`): nimmt das Angebot nur an, wenn die eigenen
//  Kreaturen vom GEGNER bedroht sind (nie fuer die Kreaturen des Gegners,
//  nie gegen den eigenen Effekt, nie gegen Heilung) und der Wert der
//  bedrohten Kreaturen die Kosten der schwaechsten Handkarte klar
//  uebersteigt — sonst wuerde sie ohne Zugsperre in jedem Fenster Karten
//  wegwerfen.
// ═══════════════════════════════════════════

const { JETPACK_NAME, hasEquipped, checkMoniaAscension, quellName, angenommenesAngebot, angebotAbgelehnt, angebotMerken, angeboteBeenden } = require('./_monia-shared');
const CARD_NAME = 'Cool Rescuer Monia';
const SAVE_ALL = 'save-all';   // Als Ruling (Al 26.10.): EINE Option — die abgeworfene Karte negiert die Wirkung auf ALLE Kreaturen (beide Seiten)

/**
 * Als Ruling (Al 26.10.): „… negate any effects that card or effect has on ALL Creatures" wörtlich — ein angenommenes Angebot schützt ALLE Kreaturen aller Seiten vor
 * dieser Karte/diesem Effekt (nicht nur eine Seite): für jede Seite wird ein angenommenes Angebot gebucht (`moniaSchildBlockt` liest sie je Seite).
 */
function alleSeitenSchuetzen(engine, gs, key, pi) {
  for (let seite = 0; seite < engine.playerCount(); seite++) angebotMerken(gs, key, pi, seite);
}

/**
 * CPU-Angaben fuer den Prompt: wer bedroht welche Kreaturen womit. `liste` = [{ inst, amount, nichtSchaden }].
 * Nur Zahlen/Namen — der Prompt geht auch an den Client.
 */
function cpuInfo(engine, pi, liste, quelleOwner, effektTyp) {
  const schutz = {};
  const cardDB = engine._getCardDB();
  for (const { inst, amount, nichtSchaden } of liste) {
    const seite = inst.controller ?? inst.owner;
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name] || {};
    const lvl = (() => { try { return engine.kreaturLevelJetzt?.(inst); } catch { return undefined; } })();
    (schutz[seite] = schutz[seite] || []).push({
      name: inst.name,
      hp: inst.counters?.currentHp ?? cd.hp ?? 0,
      level: Number.isFinite(lvl) ? lvl : (cd.level || 0),
      amount: amount || 0,
      nichtSchaden: !!nichtSchaden,
    });
  }
  return { pi, quelleOwner: Number.isInteger(quelleOwner) ? quelleOwner : -1, effektTyp: effektTyp || null, schutz };
}

module.exports = {
  heroEffect: true,
  activeIn: ['hero'],

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

  // Gerrymander redirect — früher wählte der Gegner im Zwei-Seiten-Fenster „save 0's vs save 1's"; seit dem Ruling (Al 26.10.) gibt es nur noch EINE Option
  // (`save-all`: die abgeworfene Karte negiert die Wirkung auf ALLE Kreaturen) — die Weiche greift erst ab 2 Optionen und wird hier nur noch der Vollständigkeit halber bedient.
  cpuGerrymanderResponse(_engine, _gerryOwnerPi /*, promptData */) {
    return { optionId: 'save-all' };
  },

  /**
   * CPU-Entscheidung zum Angebot „Cool Rescue!" (`promptData._moniaInfo`, siehe `cpuInfo`). Ohne Zugsperre wuerde die generische CPU-Wahl
   * („letzte Option") in JEDEM Fenster eine Karte opfern. Hier: annehmen NUR wenn
   *   · die EIGENEN Kreaturen bedroht sind (`schutz[eigener Sitz]`) — die abgeworfene Karte negiert die Wirkung auf ALLE Kreaturen (Ruling Al 26.10.), also auch
   *     auf die des Gegners: deren Wert wird vom Wert der eigenen abgezogen („Nettowert"),
   *   · der Effekt nicht von der eigenen Seite kommt (kein Selbstschutz gegen den eigenen Plan) und keine Heilung ist,
   *   · der Nettowert die Kosten der schwaechsten Handkarte klar uebersteigt.
   * Wert einer Kreatur: 20 + 15 × Level + min(40, HP/10); voll bei toedlichem Schaden, Zerstoeren oder Kontrollverlust (`control`), ×0,8 Bewegen/Bounce (`move`), ×0,6 Status/Buff/Werte/Sonstiges, sonst anteilig am Schaden (×0,7).
   * Kosten: Handwert der schwaechsten Karte (`engine._cpuEstimateHandValue`, sonst 20) + 10; bei nur 1 Handkarte muss der Nettowert hoch sein (≥ 80).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'optionPicker' || !promptData._moniaInfo) return undefined;
    const info = promptData._moniaInfo, pi = info.pi;
    if (!(promptData.options || []).some(o => o.id === SAVE_ALL)) return null;
    if (info.quelleOwner === pi) return null;                                    // eigener Effekt
    if (!(info.quelleOwner >= 0)) return null;                                   // W71b: Verursacher unbekannt (kein Besitzer) — nie eine Karte dafuer opfern
    if (info.effektTyp === 'heal') return null;                                  // Heilung muss man nicht verhindern
    const eigene = info.schutz?.[pi] || [];
    if (!eigene.length) return null;                                             // nie nur die Kreaturen des Gegners retten
    const hand = engine.gs.players[pi]?.hand || [];
    if (!hand.length) return null;
    const nsGewicht = (info.effektTyp === 'destroy' || info.effektTyp === 'control') ? 1 : (info.effektTyp === 'move' ? 0.8 : 0.6);   // Zerstoeren/Kontrollverlust trifft am haertesten, Bewegen/Bounce weniger, Status/Buff/Werte noch weniger (W71b)
    const wertVon = (liste) => {
      let w = 0;
      for (const c of liste) {
        const voll = 20 + 15 * (c.level || 0) + Math.min(40, Math.round((c.hp || 0) / 10));
        const anteil = c.nichtSchaden ? nsGewicht : (c.hp > 0 && c.amount >= c.hp ? 1 : Math.min(1, (c.amount || 0) / Math.max(1, c.hp || 1)) * 0.7);
        w += voll * anteil;
      }
      return w;
    };
    let fremd = 0;
    for (const [seite, liste] of Object.entries(info.schutz || {})) if (Number(seite) !== pi) fremd += wertVon(liste);
    const wert = wertVon(eigene) - fremd;
    let guenstigste = 20;
    if (typeof engine._cpuEstimateHandValue === 'function') {
      try { guenstigste = Math.min(...hand.map(n => engine._cpuEstimateHandValue(pi, n))); } catch { guenstigste = 20; }
      if (!Number.isFinite(guenstigste)) guenstigste = 20;
    }
    const kosten = guenstigste + 10;
    if (hand.length === 1 && wert < 80) return null;
    return wert >= kosten * 1.25 ? { optionId: SAVE_ALL } : null;
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
      // „Your opponent cannot react to this Attack" / „ignores any effect that would … prevent the target from being defeated" (Midnight Assault, Surefire Shot):
      // Monias Rettung ist so ein Schutz — sie wird gar nicht erst angeboten (sonst zahlt der Spieler eine Handkarte für eine wirkungslose Rettung).
      if (engine._reaktionGesperrt(pi)) return;
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
      // die Eintraege der geschuetzten Seite fallen weg. Gleiches gilt fuer Angebote anderer Kontrolleure derselben Aufloesung.
      for (const e of entries) {
        if (e.cancelled || e.isStatusDamage || e.canBeNegated === false || !e.inst) continue;
        if (engine.moniaSchildBlockt(e.inst, e.source, e.inst.controller ?? e.inst.owner)) e.cancelled = true;
      }
      // Pro Karte/Effekt nur EIN Angebot: angenommen (egal von wem) oder von mir abgelehnt → keine neue Frage.
      if (angenommenesAngebot(gs, key)) return;

      // Must have 1+ cards in controller's hand
      const ps = gs.players[pi];
      if (!ps || (ps.hand || []).length === 0) return;

      // Find all entries that affect creatures (not cancelled, not status damage)
      const promptable = entries.filter(e => !e.cancelled && !e.isStatusDamage);
      if (promptable.length === 0) return;

      // Determine affected creature CONTROLLERS (gameplay-side, not
      // raw owner — so a cross-side-placed Creature on opp's board
      // counts under opp).
      const affectedOwners = new Set(promptable.map(e => e.inst.controller ?? e.inst.owner));
      // Abgelehnt (W58a): fuer diese Karte/diesen Effekt nicht noch einmal fragen — W71b: es sei denn, eine betroffene Seite wurde noch nicht abgelehnt (Einzelfenster einer Kreatur).
      if ([...affectedOwners].every(s => angebotAbgelehnt(gs, key, pi, s))) return;

      // Als Ruling (Al 26.10., „wörtlich nehmen"): EINE Option — die abgeworfene Karte negiert die Wirkung der auslösenden Karte/des Effekts auf ALLE Kreaturen (beide
      // Seiten), nicht nur auf eine; die frühere Seitenwahl (`save-0` / `save-1`) entfällt. Auch wenn dieser Stapel nur eine Seite trifft, gilt die Negation für alle
      // weiteren Treffer derselben Karte auf jeder Seite (`alleSeitenSchuetzen`).
      const singleCreature = promptable.length === 1;
      const options = [{
        id: SAVE_ALL,
        label: `🛡️ ${singleCreature ? `Protect ${promptable[0].inst.name}` : 'Save all Creatures'} (discard 1)`,
      }];

      const srcEntry = promptable.find(e => e.source) || promptable[0];
      const quelleOwner = srcEntry ? (srcEntry.sourceOwner ?? srcEntry.source?.owner ?? srcEntry.source?.controller) : undefined;

      // Show prompt to Monia's player
      const result = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: `${hero.name} — Cool Rescue!`,
        description: trigger
          ? `Creatures are in danger from ${trigger}! Discard 1 card to negate its effects on all Creatures.`
          : 'Creatures are in danger! Discard 1 card to negate the effects on all Creatures.',
        triggerCardName: trigger || undefined,
        options,
        cancellable: true,
        // Gerrymander redirects only with 2+ options — seit dem Ruling (Al 26.10.) gibt es hier nur noch die eine Option `save-all`.
        gerrymanderEligible: true,
        cpuDispatch: CARD_NAME,   // W58a: die CPU fragt `cpuResponse` dieser Karte (Titel traegt den Heldennamen/Zusatz)
        _moniaInfo: cpuInfo(engine, pi, promptable.map(e => ({ inst: e.inst, amount: e.amount })), quelleOwner, 'damage'),
      });

      // Abgelehnt: fuer diese Karte/diesen Effekt nicht noch einmal fragen (mehrere Stapel, Folgetreffer).
      if (!result || !result.optionId || result.cancelled) { angebotMerken(gs, key, pi, null); return; }

      if (result.optionId !== SAVE_ALL) { angebotMerken(gs, key, pi, null); return; }

      // Angenommen: ALLE Seiten sind vor dieser Karte/diesem Effekt geschützt (Ruling Al 26.10.); die Marke spiegelt die erste betroffene Seite.
      const protectOwner = [...affectedOwners][0];
      alleSeitenSchuetzen(engine, gs, key, pi);

      // Set shield active for subsequent batches / status checks of this resolution
      gs._moniaShieldActive = protectOwner;
      gs._moniaShieldSource = trigger ? { name: trigger } : null;   // W16f (H01-08): der Schild gehört zu dieser Karte/diesem Effekt

      // Cancel ALL negatable entries of this batch (beide Seiten).
      // Unnegatable damage (Acid Vial, Ida) still goes through — Monia "wastes" the effect.
      const matchesProtect = (e) => e.canBeNegated !== false;
      for (const e of promptable) {
        if (matchesProtect(e)) e.cancelled = true;
      }

      engine.log('monia_protect', {
        player: ps.username, hero: hero.name,
        protectedOwner: [...affectedOwners].map(o => gs.players[o]?.username).join(' & '),
        creaturesProtected: promptable.filter(matchesProtect).map(e => e.inst.name),
      });

      // ── Animation: Monia rams into each protected creature ──
      // `targetOwner` uses physical side so the ram lands on the slot
      // the player sees (cross-side-placed Creatures live on the
      // controller's board).
      const protectedCreatures = promptable.filter(matchesProtect);
      for (const e of protectedCreatures) {
        const physSide = e.inst.stolenBy != null
          ? e.inst.owner
          : (e.inst.controller ?? e.inst.owner);
        engine._broadcastEvent('play_ram_animation', {
          sourceOwner: ctx.cardOriginalOwner, sourceHeroIdx: heroIdx,
          targetOwner: physSide, targetHeroIdx: e.inst.heroIdx,
          targetZoneSlot: e.inst.zoneSlot,
          cardName: hero.name, duration: 600,
          trailType: 'fire_stars',
        });
        await engine._delay(250);
      }
      await engine._delay(400);

      // ── Discard 1 card (player chooses) ──
      if (ps.hand.length > 0) {
        await engine.actionPromptForceDiscard(pi, 1, { costFor: 'Cool Rescuer Monia', costKind: 'protect',   /* ★ v1041 Lernkanal */ title: `${hero.name} — Discard 1`, source: hero.name, selfInflicted: true });
      }
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
      if (engine._reaktionGesperrt(pi)) return;   // „cannot react" / „prevent the target from being defeated" (Midnight Assault, Surefire Shot): kein Angebot, s. oben
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

      // Steht fuer DIESE Karte/diesen Effekt schon ein Schild (angenommenes Angebot, Kreatur davor), gilt er ohne neue Frage.
      if (engine.moniaSchildBlockt(creature, ctx.source, creatureSide)) { ctx.cancelled = true; return; }
      // Pro Karte/Effekt nur EIN Angebot: angenommen (auch fuer die andere Seite) oder von mir abgelehnt → keine neue Frage.
      if (angenommenesAngebot(gs, key)) return;
      if (angebotAbgelehnt(gs, key, pi, creatureSide)) return;   // W71b: abgelehnt gilt fuer diese Seite (ein Effekt kann nacheinander beide Seiten treffen)

      const ps = gs.players[pi];
      if (!ps || (ps.hand || []).length === 0) return;

      const creatureName = creature.name || 'Creature';
      const ownerLabel = creatureSide === pi ? 'your' : (gs.players[creatureSide]?.username || 'Player') + "'s";

      // Als Ruling (Al 26.10.): auch hier negiert die abgeworfene Karte die Wirkung auf ALLE Kreaturen (beide Seiten) — nicht nur auf diese eine.
      const options = [
        { id: SAVE_ALL, label: `🛡️ Protect ${creatureName} (discard 1)` },
      ];

      const quelleOwner = ctx.source && typeof ctx.source === 'object' ? (ctx.source.owner ?? ctx.source.controller) : undefined;
      // W71b: die ausloesende Karte steht links im Panel („Triggered by"), der Text nennt sie und die Wirkung.
      const ausloeser = key || null;
      const wirkung = { destroy: 'destroy', heal: 'heal', status: 'afflict', move: 'move', control: 'take control of', buff: 'change', stats: 'change the stats of' }[ctx.effectType] || 'affect';
      const result = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: `${hero.name} — Cool Rescue!`,
        description: `${ownerLabel.charAt(0).toUpperCase() + ownerLabel.slice(1)} ${creatureName} is in danger${ausloeser ? ` — ${ausloeser} would ${wirkung} it` : ''}! Discard 1 card to negate its effects on all Creatures.`,
        triggerCardName: ausloeser || undefined,
        options,
        cancellable: true,
        cpuDispatch: CARD_NAME,
        _moniaInfo: cpuInfo(engine, pi, [{ inst: creature, amount: 0, nichtSchaden: true }], quelleOwner, ctx.effectType),
      });

      if (!result || !result.optionId || result.cancelled) { angebotMerken(gs, key, pi, null, creatureSide); return; }

      if (result.optionId !== SAVE_ALL) { angebotMerken(gs, key, pi, null, creatureSide); return; }

      alleSeitenSchuetzen(engine, gs, key, pi);   // Ruling Al 26.10.: alle Kreaturen aller Seiten vor dieser Karte/diesem Effekt
      gs._moniaShieldActive = creatureSide;
      {   // W16f (H01-08): Quelle des geschützten Effekts merken (Schild gilt nur für sie)
        const qn = quellName(ctx.source);
        gs._moniaShieldSource = qn ? { name: qn } : null;
      }
      ctx.cancelled = true;

      engine.log('monia_protect', {
        player: ps.username, hero: hero.name,
        protectedCreature: creatureName, effectType: ctx.effectType,
      });

      // Animation: Monia rams into creature. `targetOwner` is the
      // PHYSICAL side (where the creature actually renders) so a
      // cross-side-placed Creature gets the ram on opp's slot.
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardOriginalOwner, sourceHeroIdx: heroIdx,
        targetOwner: creatureSide, targetHeroIdx: creature.heroIdx,
        targetZoneSlot: creature.zoneSlot,
        cardName: hero.name, duration: 600,
        trailType: 'fire_stars',
      });
      await engine._delay(500);

      // Discard 1 card (player chooses)
      if (ps.hand.length > 0) {
        await engine.actionPromptForceDiscard(pi, 1, { costFor: 'Cool Rescuer Monia', costKind: 'protect', title: `${hero.name} — Discard 1`, source: hero.name, selfInflicted: true });
      }
    },

    /**
     * After spell resolves: clear the shield-active flag and the offers of this resolution.
     */
    afterSpellResolved: async (ctx) => {
      angeboteBeenden(ctx._engine.gs);
    },
  },
};
