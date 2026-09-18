// ═══════════════════════════════════════════
//  CARD EFFECT: „Tempeluna, the Convergence Fairy"
//  Ascended Hero · 550 HP · 80 ATK · PP MSHW
//
//  „You must play this Hero from your hand on top of a 'Luna, the
//   Flame Fairy' or 'Tempeste, the Weather Fairy' you control by
//   deleting the other one you control and all Abilities attached to
//   it. This Hero gains the effects of both 'Luna, the Flame Fairy'
//   and 'Tempeste, the Weather Fairy'. You may once per turn attach a
//   'Fairy' Hero from your hand to this Hero. This Hero gains the
//   effects of all 'Fairy' Heroes attached to it. This Hero can only
//   gain the same effect once."
//
//  Ascension Bonus: „Add 1 'Fairy' Hero from your deck to your hand"
//
//  ── ALS RULINGS (18.9.), BINDEND ──────────────────────────────────
//  ① Eine angelegte Fee BELEGT eine Support Zone. Ohne freie Zone
//     kann Tempeluna keine anlegen. Verlaesst die Fee ihre Zone,
//     verliert Tempeluna den zugehoerigen Effekt wieder — dasselbe
//     Muster wie bei „???, the Shapeshifter".
//  ② Sie erbt den KOMPLETTEN Effekt, ausdruecklich mit Nachteil.
//     Tempestes zweiter Satz („Damage this Hero takes cannot be
//     reduced or negated") gilt damit fuer Tempeluna selbst.
//  ③ „Fairy" Hero heisst NUR gedruckter `cardType: 'Hero'` — keine
//     Ascended Heroes. Ebenfalls wie beim Shapeshifter.
//
//  ── WARUM DAS NICHT MIT HOOKS ALLEIN GEHT ─────────────────────────
//  Lunas ganze Wirkung steckt in zwei VERTRAEGEN, nicht in Hooks:
//  `canBypassLevelReqForCard` und `firewallModifiers`. Tempestes
//  Nachteil ebenso (`heroDamageCannotBeReducedOrNegated`). Die Engine
//  schlaegt solche Vertraege ueber `loadCardEffect(hero.name)` direkt
//  am Helden nach — eine angelegte Karteninstanz sieht sie nie.
//  Deshalb die Registry in `_gained-effects-shared`: `heroScriptOf`
//  liefert das eigene Skript, ergaenzt um die Vertraege der
//  gewonnenen. Die 42 Abfragestellen in Engine und Server laufen seit
//  v1186 darueber.
//
//  Tempestes Schadensreduktion ist dagegen ein echter Hook — die
//  haengt an einer TRAEGERINSTANZ. Fuer die beiden Grundfeen gibt es
//  keine Karte mehr (eine ist ueberbaut, die andere geloescht), also
//  traegt eine unsichtbare Support-Instanz ohne Zonenplatz
//  (`zoneSlot: -1`, Hausform seit „Dangerous Knowledge" v981); fuer
//  angelegte Feen traegt ihre eigene Karte in der Support Zone.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { gainedNames } = require('./_gained-effects-shared');
// ★ v1187: Namensbezug, Bedingung und Bereitschaft liegen in EINEM
// Modul — Luna und Tempeste lesen dieselbe Auslegung (Bauform
// `_drago-shared` / `_monkee-shared`).
const {
  TEMPELUNA: CARD_NAME, LUNA, TEMPESTE, GRUNDFEEN,
  istFeenHeld, andereGrundfee, tempelunaBedingung,
} = require('./_fairy-shared');

/** Freie Support Zones dieses Helden. */
function freieZonen(ps, heroIdx) {
  const raus = [];
  const zonen = ps?.supportZones?.[heroIdx] || [];
  for (let s = 0; s < 3; s++) {
    if (((zonen[s]) || []).length === 0) raus.push(s);
  }
  return raus;
}

/**
 * Feen auf der Hand, deren Effekt sie noch NICHT hat.
 * „This Hero can only gain the same effect once" — eine zweite Luna
 * anzulegen brauchte eine Support Zone und braechte nichts, also
 * steht sie gar nicht erst zur Wahl.
 */
function anlegbareFeen(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!ps || !hero?.name) return [];
  const cardDB = engine._getCardDB();
  const schon = new Set([hero.name, ...gainedNames(hero)]);
  const gesehen = new Set();
  const raus = [];
  for (const name of (ps.hand || [])) {
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    if (schon.has(name)) continue;
    if (!istFeenHeld(cardDB[name])) continue;
    // ★ Galerie-Eintraege sind `{ name, source }` — NICHT `cardName`.
    // Die Antwort kommt als `{ cardName, source }` zurueck; die
    // Asymmetrie ist die Falle (siehe CARD_API).
    raus.push({ name, source: 'hand' });
  }
  return raus;
}

/** Die Instanz des Helden selbst (Zone `hero`). */
function heldeninstanz(engine, pi, heroIdx) {
  return engine.cardInstances.find(c =>
    c.owner === pi && c.zone === 'hero' && c.heroIdx === heroIdx) || null;
}

/**
 * Gewonnene Effekte, die einen AKTIVIERBAREN Heldeneffekt mitbringen
 * (heute: „Jenny, the Class Fairy"). Tempelunas eigener Effekt ist
 * das Anlegen — ohne diese Sammlung waere Jennys Effekt unerreichbar,
 * weil die Engine je Held nur EINEN `heroEffect` kennt.
 */
function gewonneneAktiveffekte(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  const raus = [];
  for (const name of gainedNames(hero)) {
    const sc = loadCardEffect(name);
    if (!sc?.heroEffect || typeof sc.onHeroEffect !== 'function') continue;
    raus.push({ name, script: sc });
  }
  return raus;
}

module.exports = {
  // ── AUFSTIEG ────────────────────────────────────────────────────
  // „on top of a 'Luna' or 'Tempeste' you control by deleting the
  // other one you control": beide muessen stehen. Geprueft wird VOR
  // dem Hand-Splice, ein abgelehnter Aufstieg frisst die Karte also
  // nicht.
  ascensionCondition(gs, pi, heroIdx) {
    return tempelunaBedingung(gs, pi, heroIdx);
  },

  // Der Preis: die zweite Fee samt ihrer Abilities loeschen.
  // `deleteHero` (v762) ist der kanonische Weg — er raeumt Ability
  // Zones und Support Zones und legt den Helden in den Geloescht-
  // Stapel; der Platz bleibt LEER (nicht wiederbelebbar), was „delete"
  // von „defeat" unterscheidet.
  async payAscensionCost(engine, pi, heroIdx) {
    // ★ Als Ruling 18.9.: die andere Fee darf TOT sein — sie wird
    // ohnehin geloescht. `deleteHero` fragt nur nach dem Namen.
    const andere = andereGrundfee(engine.gs, pi, heroIdx);
    if (andere < 0) return;

    // ═══ INSZENIERUNG (Als Vorgabe 18.9.) ══════════════════════════
    //
    // ★ ① DAS BILD WECHSELT ZUERST. Der Aufstieg zahlt den Preis, BEVOR
    // die Engine die Identitaet tauscht — optisch stand die alte Fee
    // also waehrend der ganzen Loeschsequenz noch da und wurde erst
    // hinterher ausgetauscht. `hero_form_preview` zieht allein die
    // ANZEIGE vor; der Spielstand wechselt weiterhin genau dann, wenn
    // die Engine ihn wechselt (der `sync()` danach loest das Bild
    // lautlos ab).
    engine._broadcastEvent('hero_form_preview', {
      owner: pi, heroIdx, cardName: CARD_NAME,
    });
    // Der Moment des Zusammenfallens — Klang ohne eigenes Bild, das
    // liefert gleich der Dampf (ZONE_ANIM_SFX `tempeluna_converge`).
    engine._broadcastEvent('play_zone_animation', {
      type: 'tempeluna_converge', owner: pi, heroIdx, zoneSlot: -1,
    });

    // ★ ② DAMPF von der brandneuen Tempeluna, ueber die ganze
    // Loeschsequenz. Flamme (Luna) trifft Wetter (Tempeste) — der
    // Dampf IST die Verschmelzung. Die Laufzeit deckt `deleteHero` ab:
    // gestaffelte Ability-Fluege (90 ms je Karte), 380 ms Nachlauf und
    // der Flug des Helden in den Geloescht-Stapel.
    const DAMPF_MS = 2400;
    engine._broadcastEvent('play_zone_animation', {
      type: 'tempeluna_steam', owner: pi, heroIdx, zoneSlot: -1,
      duration: DAMPF_MS,
    });
    // Kurzer Vorlauf, damit der Formwechsel wirklich VOR dem ersten
    // Loeschflug auf dem Schirm steht — nicht gleichzeitig mit ihm.
    await engine._delay(180);

    // ★ ③ Die ausgeloeschte Fee bekommt ihren eigenen Klang. Sie faellt
    // nicht, sie wird ausgeloescht — `hero_death` waere das falsche
    // Wort (ZONE_ANIM_SFX `tempeluna_erase`).
    engine._broadcastEvent('play_zone_animation', {
      type: 'tempeluna_erase', owner: pi, heroIdx: andere, zoneSlot: -1,
    });

    await engine.deleteHero(pi, andere, CARD_NAME);
  },

  /**
   * „This Hero gains the effects of both 'Luna' and 'Tempeste'."
   *
   * Synchron, weil `onAscendSetup` synchron ist — die Anfangsroutinen
   * der geerbten Skripte holt `finishGainedHeroEffects` gleich im
   * `onAscension`-Hook nach.
   *
   * ★ BEIDE, nicht „die, von der sie aufgestiegen ist": die eine ist
   * ueberbaut, die andere geloescht — trotzdem hat sie beide Effekte.
   * Genau das ist der Witz der Karte.
   */
  onAscendSetup(gs, pi, heroIdx, engine) {
    for (const fee of GRUNDFEEN) engine.grantHeroEffect(pi, heroIdx, fee);
  },

  // Ascension Bonus: „Add 1 'Fairy' Hero from your deck to your hand"
  async onAscensionBonus(engine, pi, heroIdx) {
    const ps = engine.gs.players[pi];
    if (!ps) return;
    const cardDB = engine._getCardDB();
    const gesehen = new Set();
    const kandidaten = [];
    for (const name of (ps.mainDeck || [])) {
      if (gesehen.has(name)) continue;
      gesehen.add(name);
      if (istFeenHeld(cardDB[name])) kandidaten.push({ name, source: 'deck' });
    }
    if (kandidaten.length === 0) {
      engine.log('tempeluna_bonus_empty', { player: ps.username });
      return;
    }
    const inst = heldeninstanz(engine, pi, heroIdx);
    const ctx = engine._createContext(inst || { name: CARD_NAME, owner: pi, heroIdx, counters: {} }, {});
    const auswahl = await ctx.promptCardGallery(kandidaten, {
      // Kennzeichnung als SUCHE — unter einer Such-Sperre (Cats of the
      // Pharaoh) geht der Dialog dann gar nicht erst auf, statt
      // folgenlos zu bleiben (Waechter `check-search-template`).
      searchToHand: true, searchPile: 'deck',
      title: CARD_NAME,
      source: CARD_NAME,          // stabiler Schluessel fuer den Lernkanal
      description: 'Ascension Bonus — add 1 "Fairy" Hero from your deck to your hand.',
      cancellable: false,
    });
    const gewaehlt = auswahl?.cardName || kandidaten[0].name;
    await engine.addFromPileToHand(pi, 'deck', gewaehlt, { source: CARD_NAME, reveal: true });
    engine.log('tempeluna_bonus', { player: ps.username, card: gewaehlt });
    engine.sync();
  },

  // ── LAUFENDER EFFEKT ────────────────────────────────────────────
  activeIn: ['hero'],

  // „You may once per turn attach a 'Fairy' Hero from your hand to
  // this Hero." KEIN `heroEffectActionCost` — der Text nennt keine
  // Aktion, also ein freier Main-Phase-Effekt (Shapeshifter-Muster).
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = engine.gs.players[pi];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    // Anlegen geht nur mit freier Zone UND passender Handkarte …
    const kannAnlegen = freieZonen(ps, heroIdx).length > 0
      && anlegbareFeen(engine, pi, heroIdx).length > 0;
    if (kannAnlegen) return true;
    // … aber das Menue steht auch offen, wenn nur ein GEWONNENER
    // Aktiveffekt uebrig ist (Jenny).
    return gewonneneAktiveffekte(engine, pi, heroIdx)
      .some(({ script }) => typeof script.canActivateHeroEffect !== 'function'
        || script.canActivateHeroEffect(ctx));
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    // ── Was steht zur Wahl? ────────────────────────────────────────
    // Tempelunas eigener Effekt plus jeder gewonnene Aktiveffekt. Die
    // Engine kennt je Held nur EINEN `heroEffect`; ohne dieses Menue
    // waere Jennys Effekt unter Tempeluna tot.
    const eigenerHopt = `hero-effect:tempeluna-attach:${pi}:${heroIdx}`;
    const eigenOffen = gs.hoptUsed?.[eigenerHopt] !== gs.turn
      && freieZonen(ps, heroIdx).length > 0
      && anlegbareFeen(engine, pi, heroIdx).length > 0;

    const fremde = gewonneneAktiveffekte(engine, pi, heroIdx).filter(({ name, script }) => {
      if (gs.hoptUsed?.[`hero-effect:gained:${name}:${pi}:${heroIdx}`] === gs.turn) return false;
      if (typeof script.canActivateHeroEffect === 'function') {
        try { return !!script.canActivateHeroEffect(ctx); } catch { return false; }
      }
      return true;
    });

    if (!eigenOffen && fremde.length === 0) return false;

    let wahl = eigenOffen ? 'attach' : fremde[0].name;
    if (eigenOffen && fremde.length > 0) {
      const optionen = [
        { id: 'attach', label: '🧚 Attach a "Fairy" Hero' },
        ...fremde.map(f => ({ id: f.name, label: `✨ ${f.name}` })),
        { id: 'cancel', label: 'Cancel' },
      ];
      const gewaehlt = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        source: CARD_NAME,
        description: 'Choose which effect to use.',
        options: optionen,
        cancellable: true,
        showCard: CARD_NAME,
      });
      const id = (typeof gewaehlt === 'string') ? gewaehlt : gewaehlt?.id;
      if (!id || id === 'cancel') return false;
      wahl = id;
    }

    // ── Gewonnener Aktiveffekt ─────────────────────────────────────
    if (wahl !== 'attach') {
      const treffer = fremde.find(f => f.name === wahl);
      if (!treffer) return false;
      const ergebnis = await treffer.script.onHeroEffect(ctx);
      if (ergebnis === false) return false;
      // Eigener HOPT-Schluessel je gewonnenem Effekt — sonst verbrauchte
      // Jennys Einsatz Tempelunas Anlegen (die Engine stempelt sonst
      // EINEN gemeinsamen Schluessel je Held).
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[`hero-effect:gained:${wahl}:${pi}:${heroIdx}`] = gs.turn;
      engine.sync();
      return false;   // eigener Schluessel gesetzt → Engine-Stempel unterdruecken
    }

    // ── Anlegen ────────────────────────────────────────────────────
    const kandidaten = anlegbareFeen(engine, pi, heroIdx);
    if (kandidaten.length === 0) return false;
    if (freieZonen(ps, heroIdx).length === 0) return false;

    const auswahl = await ctx.promptCardGallery(kandidaten, {
      title: CARD_NAME,
      source: CARD_NAME,
      description: 'Choose a "Fairy" Hero from your hand to attach. This Hero gains its effect.',
      cancellable: true,
    });
    if (!auswahl) return false;
    const feeName = auswahl.cardName;

    // Index frisch suchen — zwischen Galerie und hier kann sich die
    // Hand geaendert haben (Reaktionen, Kosten).
    const handIdx = ps.hand.indexOf(feeName);
    if (handIdx < 0) return false;
    const frei = freieZonen(ps, heroIdx);
    if (frei.length === 0) return false;
    const slot = frei[0];

    // ★★ SICHTBARER FLUG Hand → Support Zone, VOR dem Splice.
    //
    // ★ DIE ZIELFELDER HEISSEN `toHeroIdx` / `toSlotIdx` — nicht
    // `heroIdx` / `zoneSlot`. Der Flug-Handler loest Quelle und Ziel
    // ueber ZWEI getrennte Feldsaetze auf (`fromHeroIdx`/`fromSlotIdx`
    // gegen `toHeroIdx`/`toSlotIdx`) und steigt still aus, wenn eines
    // der beiden Elemente nicht gefunden wird: `if (!srcEl || !tgtEl)
    // return;`. Mit den falschen Namen fliegt also GAR NICHTS, ohne
    // Fehler und ohne Meldung (Als Befund 18.9.).
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: feeName, from: 'hand', to: 'support',
      fromHandIdx: handIdx, toHeroIdx: heroIdx, toSlotIdx: slot,
      sfx: 'placement',
    });
    ps.hand.splice(handIdx, 1);

    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    ps.supportZones[heroIdx][slot] = [feeName];
    const feeInst = engine._trackCard(feeName, pi, 'support', heroIdx, slot);
    feeInst.counters = feeInst.counters || {};
    // `treatAsEquip` macht die Karte fuer die ganze Engine zur
    // Ausruestung (zerstoerbar) UND laesst laut `CardInstance.isActiveIn`
    // ihre `activeIn: ['hero']`-Hooks aus der Support Zone feuern — mit
    // dem `heroIdx` des WIRTS. Genau das will der Kartentext.
    feeInst.counters.treatAsEquip = true;
    feeInst.counters._tempelunaAttached = true;

    // DIESE Instanz ist der Traeger des gewonnenen Effekts — keine
    // zusaetzliche unsichtbare (sonst liefen die Hooks doppelt).
    engine.grantHeroEffect(pi, heroIdx, feeName, { traeger: feeInst });
    await engine.finishGainedHeroEffects(pi, heroIdx);

    // ★★ v1192 (Als Vorgabe 18.9.): der Moment, in dem der Effekt
    // uebergeht — Dampf, Funken und Sterne, und zwar AUSSCHLIESSLICH
    // auf Tempeluna selbst (`zoneSlot: -1` = Heldenfeld). Die erste
    // Fassung setzte zusaetzlich ein Funkeln auf die angelegte Fee;
    // das war falsch herum: sie GIBT den Effekt, Tempeluna nimmt ihn
    // auf. Klang haengt an `tempeluna_infuse` in ZONE_ANIM_SFX.
    engine._broadcastEvent('play_zone_animation', {
      type: 'tempeluna_infuse', owner: pi, heroIdx, zoneSlot: -1,
      duration: 1100,
    });
    await engine._delay(520);

    await engine.runHooks('onCardEnterZone', {
      enteringCard: feeInst, toZone: 'support', toHeroIdx: heroIdx,
      _skipReactionCheck: true,
    });

    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[eigenerHopt] = gs.turn;
    engine.log('tempeluna_attach', {
      player: ps.username, fairy: feeName, slot,
    });
    engine.sync();
    return false;   // eigener HOPT-Schluessel gesetzt (siehe CARD_API)
  },

  hooks: {
    // Anfangsroutinen der beiden Grundfeen nachholen — `onAscendSetup`
    // ist synchron und kann das nicht.
    onAscension: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.playerIdx == null || ctx.heroIdx == null) return;
      if (ctx.newHeroName !== CARD_NAME) return;
      await engine.finishGainedHeroEffects(ctx.playerIdx, ctx.heroIdx);
    },

    // Puzzle-Modus: eine aufgestellte Tempeluna ist nie aufgestiegen —
    // ihre beiden Grundeffekte muss sie trotzdem haben. (Als Regel
    // 16.8.: der Puzzle Mode ist der Teststand.)
    onGameStart: (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      if (pi == null || heroIdx == null || heroIdx < 0) return;
      for (const fee of GRUNDFEEN) engine.grantHeroEffect(pi, heroIdx, fee);
    },

    // ★ Ruling ①: verlaesst eine angelegte Fee ihre Zone, ist ihr
    // Effekt weg. Der Hook feuert an Tempeluna selbst, `leavingCard`
    // ist die Fee.
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      const weg = ctx.leavingCard;
      if (!weg?.counters?._tempelunaAttached) return;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      if (weg.owner !== pi || weg.heroIdx !== heroIdx) return;
      await engine.revokeHeroEffect(pi, heroIdx, weg.name, 'attachmentLeft');
      engine.sync();
    },
  },

  // Die CPU beantwortet ihre eigenen Galerien und das Menue — sonst
  // bricht die Engine jeden abbrechbaren Prompt fuer sie ab (v828).
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic') return undefined;
    if (payload?.type === 'cardGallery') {
      const erste = payload.cards?.[0] || payload.options?.[0];
      return erste || undefined;
    }
    if (payload?.type === 'optionPicker') {
      const erste = (payload.options || []).find(o => o.id !== 'cancel');
      return erste ? erste.id : undefined;
    }
    return undefined;
  },
};
