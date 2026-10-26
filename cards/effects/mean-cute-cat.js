// ═══════════════════════════════════════════
//  CARD EFFECT: "Mean Cute Cat"
//  Creature (Normal, Lv1, 50 HP, Summoning Magic — Cute archetype)
//
//  "When you discard this card through an effect, you may immediately
//   summon it as an additional Action. Once per turn, when a target you
//   control would take damage, you may redirect that damage to a level 3
//   or higher Creature you control. If that Creature is defeated by that
//   damage, you may use this effect an additional time on the same turn."
//
//  ── ① ABWURF-BESCHWOERUNG (Vorlage: Cute Familiar) ──
//  `onDiscard` an der Instanz in der Ablage. „Through an effect" =
//  Konvention des Bestands (Glass of Marbles, Cute Spider, Cute Bunny):
//  jeder Abwurf VON DER HAND, den eine Karte verursacht (Effekt UND
//  Abwurfkosten einer Karte, auch ein Zwangsabwurf durch den Gegner);
//  NICHT der Regel-Abwurf des Handlimits am Zugende (`ctx._handLimitRegel`)
//  und nicht Mill/Deck (kein Abwurf). Nur die soeben abgeworfene Kopie
//  (`discardedInstId`) feuert, nicht eine, die schon vorher in der Ablage lag.
//  „You may" = Ja/Nein. Beschwoerung wie jede „as an additional Action":
//  Held der Kontrolle, lebendig/handlungsfaehig, Stufe/Schule (Summoning
//  Magic Lv 1), freie Support Zone, keine Aktionssperre
//  (`eligibleSummonZones`, geteilt mit den Monkees); gibt es keinen
//  tauglichen Platz, entfaellt der Effekt ohne Frage. Abwerfender =
//  Beschwoerer: eine gestohlene Karte (Thieving Strike …) wird aus der
//  Ablage ihres Besitzers beschworen, aber fuer den Abwerfenden.
//  Standard-Beschwoerungsflug Ablage → Zone.
//
//  ── ② UMLEITUNG ──
//  Hooks `beforeDamage` (Held), `beforeTrueDamage` (Held, „cannot be
//  reduced or negated"-Schaden) und `beforeCreatureDamageBatch`
//  (Kreaturen) — derselbe Weg wie Prophecy of Tempeste / Bubbles.
//  • „a target you control": Helden und Kreaturen, die der Kontrolleur der
//    Katze kontrolliert (Kontrolle, nicht Brettseite). Je Schadenseintrag
//    einzeln: ein Flaechenschlag auf drei eigene Ziele fragt bis zu dreimal,
//    solange Einsaetze uebrig sind.
//  • „would take damage": vor der Anwendung (Hook-Zeitpunkt); der Betrag ist
//    der projizierte Betrag der Hook-Runde. Immuner Kreatur-Eintrag
//    (`_immuneCreature`) und abgebrochene Eintraege loesen nichts aus. Ziel-
//    seitige Regeln (Schilde, Multiplikatoren, Gate Shield, Immunitaeten)
//    gelten danach am NEUEN Ziel.
//  • Ziel: eine offene Kreatur mit AKTUELLEM Level >= 3 (`kreaturLevelJetzt`),
//    die der Kontrolleur kontrolliert, lebt und nicht das Ziel selbst ist.
//    Die Katze (Lv 1) ist nie Ziel. Mehrere Kandidaten → Zielwahl (Abbruch =
//    keine Umleitung, nichts verbraucht); einer → direkt.
//  • Der VOLLE Betrag geht an die Kreatur (kein Deckel); „cannot be reduced /
//    negated" des Ursprungs bleibt erhalten. Schaden, der laut Quellskript
//    nicht umgeleitet werden darf (`cannotBeRedirected`, Acid Vial), loest nichts aus.
//    Umgeleiteter Schaden traegt `_meanCatRedirected` und wird von KEINER
//    Mean Cute Cat nochmal umgeleitet (keine Ketten).
//  • „Once per turn": je Exemplar (`counters._catTurn` / `_catLeft`).
//    Ablehnen („No") oder Zielwahl-Abbruch verbraucht nichts.
//  • „If that Creature is defeated by that damage, you may use this effect
//    an additional time": hat der umgeleitete Schaden die Kreatur besiegt
//    (`_deathResolved` nach dem Durchgang), wird dem Exemplar ein weiterer
//    Einsatz in DIESEM Zug gutgeschrieben. Ausgelegt als Kette: besiegt auch der
//    Zusatz-Einsatz seine Kreatur, gibt es wieder einen weiteren (Auslegung,
//    der Text schraenkt es nicht ein; so auch bei „use this effect again" des
//    Skeleton Reaper). Ein Ueberleben der Kreatur gibt nichts.
//  • Animation `mean_cat_bats` (Pixelart): drei schwarze Fledermaeuse mit
//    roten Augen fliegen von der Katze zum Ziel, fangen den Schaden ab und
//    tragen ihn zur Umleitungs-Kreatur.
//
//  ── CPU ──
//  `cpuResponse`: Beschwoerung immer ja; Umleitung nur mit Sinn (ein Kandidat
//  ueberlebt den Treffer UND der Ursprung ist ein Held mit Treffer >= 50 bzw.
//  tödlich, bzw. eine Kreatur, die sonst stirbt / >= 60 % ihrer HP verliert;
//  ohne ueberlebenden Kandidaten nur, um einen Heldentod zu verhindern).
//  Die Kandidatenwahl nimmt den Ueberlebenden mit den meisten HP.
// ═══════════════════════════════════════════

const { eligibleSummonZones } = require('./_summon-eligibility');
const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const { ausgegrauteRestkarten } = require('./_target-dim-shared');
const CARD_NAME = 'Mean Cute Cat';
const MIN_LEVEL = 3;
const REDIRECT_MARK = '_meanCatRedirected';
const ANIM_TYPE = 'mean_cat_bats';
const ANIM_MS = 1500;       // Laenge von `mean_cat_bats` im Client (ENDE)
const IMPACT_MS = 1020;     // Einschlag bei der Kreatur (Client: Ende des Fluges) — dann faellt der Schaden

// ─── EINSAETZE JE EXEMPLAR ───────────────────

/** Verbleibende Einsaetze dieses Exemplars im laufenden Zug (1 + gutgeschriebene Zusatz-Einsaetze − verbrauchte). */
function einsaetzeUebrig(inst, gs) {
  const c = inst.counters || (inst.counters = {});
  if (c._catTurn !== gs.turn) return 1;
  return c._catLeft ?? 0;
}
function einsatzBuchen(inst, gs, delta) {
  const c = inst.counters || (inst.counters = {});
  const jetzt = einsaetzeUebrig(inst, gs);
  c._catTurn = gs.turn;
  c._catLeft = Math.max(0, jetzt + delta);
}

// ─── ZIELE ───────────────────────────────────

/** Gehoert dieser Schaden zu etwas, das nicht umgeleitet werden darf (Acid Vial & Co.)? */
function nichtUmleitbar(source, extra) {
  if (extra) return true;
  if (!source) return false;
  if (source[REDIRECT_MARK]) return true;      // eigene Umleitung: nie zweimal
  if (source.cannotBeRedirected) return true;
  if (source.name) {
    try { if (loadCardEffect(source.name)?.cannotBeRedirected) return true; } catch { /* unbekannte Quelle: normal */ }
  }
  return false;
}

/** Offene Kreaturen mit Level >= 3, die `pi` kontrolliert (ohne `ausser`, lebend, nicht gerade im Sterben). */
function kandidaten(engine, pi, ausser) {
  const db = engine._getCardDB();
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst === ausser) continue;
    if (inst._deathResolved) continue;
    if (!((inst.counters?.currentHp ?? 1) > 0)) continue;
    const cd = engine.getEffectiveCardData(inst) || db[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (engine.kreaturLevelJetzt(inst) < MIN_LEVEL) continue;
    out.push(inst);
  }
  return out;
}

function hpVon(inst) {
  const c = inst.counters || {};
  return c.currentHp ?? c.maxHp ?? 0;
}

/** Bildschirmanker eines Schadensziels fuer die Animation. */
function ankerHeld(engine, hero) {
  const seite = engine._findHeroOwner(hero);
  return { owner: seite, heroIdx: (engine.gs.players[seite]?.heroes || []).indexOf(hero), zoneSlot: -1 };
}
function ankerKreatur(engine, inst) {
  return { owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot };
}

// ─── ANGEBOT (Ja/Nein + Zielwahl) ────────────

/**
 * Fragt den Spieler und gibt die gewaehlte Umleitungs-Kreatur zurueck (oder null = keine Umleitung).
 * Verbraucht noch nichts — das tut der Aufrufer nach dem Ja.
 * `info`: { amount, srcName, fromName, fromHp, fromIsHero, ausser }
 */
async function angebot(engine, pi, catInst, info) {
  const liste = kandidaten(engine, pi, info.ausser);
  if (liste.length === 0) return null;

  const stirbt = info.amount >= info.fromHp;
  const meta = {
    amount: info.amount, fromHp: info.fromHp, fromIsHero: !!info.fromIsHero, fromLethal: stirbt,
    survives: liste.some(k => hpVon(k) > info.amount), n: liste.length, pi,
  };
  const einziger = liste.length === 1 ? liste[0] : null;
  const bestaetigt = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: CARD_NAME,
    message: `${info.fromName} is about to take ${info.amount} damage from ${info.srcName}. Redirect that damage to `
      + (einziger ? `${einziger.name} (${hpVon(einziger)} HP)?` : 'a level 3 or higher Creature you control?'),
    ...(info.fromIsHero ? {} : { showCardLeft: info.fromName }),
    showCard: CARD_NAME,
    warning: einziger && hpVon(einziger) <= info.amount ? `${einziger.name} will be defeated!` : undefined,
    confirmLabel: '🦇 Redirect!',
    cancelLabel: 'No',
    cancellable: true,
    gerrymanderEligible: true,   // „you may" — echtes Opt-in
    catKind: 'redirect',
    catMeta: meta,
  });
  if (!bestaetigt || bestaetigt.cancelled || bestaetigt.confirmed === false) return null;

  if (einziger) return einziger;

  const ziele = liste.map(k => ({
    id: `equip-${engine.physicalSide(k)}-${k.heroIdx}-${k.zoneSlot}`,
    type: 'equip',
    owner: engine.physicalSide(k), heroIdx: k.heroIdx, slotIdx: k.zoneSlot,
    cardName: k.name, cardInstance: k,
  }));
  // Al 26.10.: Ziel-Picker graut alles Nicht-Wählbare aus (nur die tauglichen Lv-3+-Kreaturen leuchten; Helden und alle übrigen Karten sind grau).
  const wahl = await engine.promptEffectTarget(pi, [...ziele, ...ausgegrauteRestkarten(engine, ziele)], {
    title: CARD_NAME, source: CARD_NAME,
    description: `Choose the level 3 or higher Creature that takes the ${info.amount} damage.`,
    confirmLabel: '🦇 Redirect!',
    cancellable: true,
    greenSelect: true,
    selectCount: 1, minSelect: 1,
    catAmount: info.amount,
  });
  const id = Array.isArray(wahl) ? wahl[0] : wahl;
  if (!id) return null;                                  // Abbruch: nichts verbraucht
  const gewaehlt = ziele.find(t => t.id === id)?.cardInstance;
  if (!gewaehlt || !kandidaten(engine, pi, info.ausser).includes(gewaehlt)) return null;
  return gewaehlt;
}

// ─── AUSFUEHRUNG ─────────────────────────────

/**
 * Bild, Schaden an die Kreatur, Gutschrift bei Tod. Der Einsatz ist vorher gebucht.
 * `von` = Anker des urspruenglichen Ziels, `fluss` = Eigenschaften des Ursprungs
 * ({ pierce, cannotBeReduced, isStatusDamage, animType, sourceOwner }).
 */
async function umleiten(engine, pi, catInst, ziel, von, info, fluss) {
  const gs = engine.gs;
  const catAnker = ankerKreatur(engine, catInst);
  engine._broadcastEvent('play_zone_animation', {
    type: ANIM_TYPE, zoneType: 'board', owner: catAnker.owner, heroIdx: -1, zoneSlot: -1, duration: ANIM_MS,
    originOwner: catAnker.owner, originHeroIdx: catAnker.heroIdx, originZoneSlot: catAnker.zoneSlot,
    targets: [von, ankerKreatur(engine, ziel)],
  });
  await engine._delay(IMPACT_MS);

  const entry = {
    inst: ziel,
    amount: info.amount,
    type: info.type || 'other',
    source: { ...(info.source || {}), [REDIRECT_MARK]: true },
    sourceOwner: fluss.sourceOwner ?? -1,
    canBeNegated: !fluss.pierce,
    cannotBeReduced: !!fluss.cannotBeReduced || !!fluss.pierce,
    isStatusDamage: !!fluss.isStatusDamage,
    animType: fluss.animType || null,
    cannotBeIncreased: false, kettenFolge: false, vollOut: null,
    [REDIRECT_MARK]: true,
  };
  await engine.processCreatureDamageBatch([entry]);

  // „defeated by that damage": der Durchgang stempelt `_deathResolved`, sobald die HP auf 0 fallen
  // (auch wenn der Tod in einer Flaechenklammer erst spaeter abgewickelt wird).
  const besiegt = ziel._deathResolved === true;
  if (besiegt) einsatzBuchen(catInst, gs, +1);

  engine.log('mean_cute_cat_redirect', {
    player: gs.players[pi]?.username, from: info.fromName, to: ziel.name, amount: info.amount,
    damageType: info.type || 'other', defeated: besiegt,
  });
  engine.sync();
  return besiegt;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER: wird die Karte NEGIERT, laeuft ihr Effekt-Rumpf nie.
  spellVisual: { impact: { type: 'red_cut' }, impactMs: 260 },

  // 'support' — Umleitung; 'discard' — Abwurf-Beschwoerung (die Instanz muss in der Ablage lauschen).
  activeIn: ['support', 'discard'],

  // ── CPU ────────────────────────────────────
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm') {
      if (payload.catKind === 'summon') return { confirmed: true };
      const m = payload.catMeta;
      if (!m) return { confirmed: true };
      if (!(m.amount > 0)) return { confirmed: false };
      if (m.survives) {
        const lohnt = m.fromIsHero
          ? (m.fromLethal || m.amount >= 50)
          : (m.fromLethal || m.amount >= 0.6 * m.fromHp);
        return { confirmed: !!lohnt };
      }
      // Keine Kreatur uebersteht den Treffer: nur, um einen Heldentod zu verhindern.
      return { confirmed: !!(m.fromIsHero && m.fromLethal) };
    }
    if (kind === 'generic' && payload?.type === 'zonePick') {      // Beschwoerungsplatz (nach dem Ja): der erste taugliche
      const z = (payload.zones || [])[0];
      if (!z) return undefined;
      return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, ...(z.owner != null ? { owner: z.owner } : {}) };
    }
    if (kind === 'effectTarget') {
      const gueltig = payload?.validTargets || [];
      if (gueltig.length === 0) return [];
      const betrag = payload?.config?.catAmount || 0;
      const rang = (t) => {
        const hp = t.cardInstance ? hpVon(t.cardInstance) : 0;
        return (hp > betrag ? 100000 : 0) + hp;       // Ueberlebende zuerst, dann die meisten HP
      };
      const bester = [...gueltig].sort((a, b) => rang(b) - rang(a))[0];
      return [bester.id];
    }
    return undefined;
  },

  hooks: {
    // ═══ ① Abwurf durch einen Effekt → sofort beschwoeren ═══
    onDiscard: async (ctx) => {
      if (!ctx._fromHand) return;
      if (ctx._handLimitRegel) return;                       // Regel-Abwurf des Handlimits ist kein Karteneffekt
      if (ctx.discardedCardName !== CARD_NAME) return;
      if (ctx.card?.zone !== 'discard') return;
      if (ctx.discardedInstId != null && ctx.discardedInstId !== ctx.card.id) return;   // nur die soeben abgeworfene Kopie

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.playerIdx;                              // wer abwirft, beschwoert
      const ps = gs.players[pi];
      if (!ps) return;
      const pileOwner = engine.kartenBesitzerVon(ctx.card);
      if (!(gs.players[pileOwner]?.discardPile || []).includes(CARD_NAME)) return;   // z. B. von Wildur umgeleitet
      if (!engine.darfAusAblageAufsFeld(CARD_NAME)) return;

      const zonen = eligibleSummonZones(engine, pi, CARD_NAME, { nachKontrolle: true });
      if (zonen.length === 0) return;                        // kein tauglicher Beschwoerer/Platz: entfaellt

      const bestaetigt = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Immediately summon ${CARD_NAME} as an additional Action?`,
        showCard: CARD_NAME,
        confirmLabel: '🦇 Summon!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,                           // „you may" — echtes Opt-in
        catKind: 'summon',
      });
      if (!bestaetigt || bestaetigt.cancelled || bestaetigt.confirmed === false) return;

      // Zwischen Frage und Antwort kann sich das Brett geaendert haben.
      const jetzt = eligibleSummonZones(engine, pi, CARD_NAME, { nachKontrolle: true });
      if (jetzt.length === 0) return;
      let ziel = jetzt[0];
      if (jetzt.length > 1) {
        const wahl = await ctx.promptZonePick(jetzt, {
          title: CARD_NAME,
          description: `Choose where to summon ${CARD_NAME}.`,
          cancellable: true,
        });
        if (!wahl || wahl.cancelled) return;
        ziel = jetzt.find(z => z.owner === (wahl.owner ?? pi) && z.heroIdx === wahl.heroIdx && z.slotIdx === (wahl.slotIdx ?? wahl.zoneSlot))
          || jetzt.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === (wahl.slotIdx ?? wahl.zoneSlot)) || null;
        if (!ziel) return;
      }

      // Ablage → Feld ueber die EINE Stelle der Engine (Standard-Beschwoerungsflug); die wartende Listener-Instanz raeumt auf.
      const alt = ctx.card;
      const res = await engine.summonFromDiscard(pi, pileOwner, CARD_NAME, ziel.heroIdx, ziel.slotIdx, {
        source: CARD_NAME,
        summonOpts: { alsZusatzaktion: true },               // „as an additional Action" ist eine Aktion
        ...(ziel.owner != null && ziel.owner !== pi ? { heldSeite: ziel.owner } : {}),
      });
      if (alt && alt.zone === 'discard') engine._untrackCard(alt.id);
      if (!res) return;
      engine.log('mean_cute_cat_discard_summon', { player: ps.username, heroIdx: ziel.heroIdx });
      engine.sync();
    },

    // ═══ ② Umleitung: Heldenschaden ═══
    beforeDamage: async (ctx) => umleitungHeld(ctx, false),
    // ═══ ② Umleitung: „cannot be reduced or negated"-Schaden an einen Helden (Engine: `beforeTrueDamage`) ═══
    beforeTrueDamage: async (ctx) => umleitungHeld(ctx, true),

    // ═══ ② Umleitung: Kreaturenschaden (Stapel) ═══
    beforeCreatureDamageBatch: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const cat = ctx.card;
      const pi = cat.controller ?? cat.owner;
      if (!gs.players[pi]) return;

      for (const e of (ctx.entries || [])) {
        if (einsaetzeUebrig(cat, gs) <= 0) break;
        if (!e || e.cancelled || e._immuneCreature || !e.inst) continue;
        if (e.inst.zone !== 'support' || e.inst._deathResolved) continue;
        if ((e.inst.controller ?? e.inst.owner) !== pi) continue;            // „a target you control"
        if (!(e.amount > 0)) continue;
        if (nichtUmleitbar(e.source, e[REDIRECT_MARK] || e.cannotBeRedirected)) continue;
        if (!((e.inst.counters?.currentHp ?? 0) > 0)) continue;

        const betrag = e.amount;
        const ziel = await angebot(engine, pi, cat, {
          amount: betrag, srcName: e.source?.name || 'an effect', fromName: e.inst.name,
          fromHp: hpVon(e.inst), fromIsHero: false, ausser: e.inst,
        });
        if (!ziel) continue;

        einsatzBuchen(cat, gs, -1);
        await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: e.source });
        e.cancelled = true;
        await umleiten(engine, pi, cat, ziel, ankerKreatur(engine, e.inst),
          { amount: betrag, type: e.type, source: e.source, fromName: e.inst.name },
          { pierce: e.canBeNegated === false, cannotBeReduced: e.cannotBeReduced, isStatusDamage: e.isStatusDamage,
            animType: e.animType, sourceOwner: e.sourceOwner });
      }
    },
  },
};

/** Heldenschaden (normal und „true"): gleiche Pruefung, gleicher Ablauf. */
async function umleitungHeld(ctx, istTrue) {
  if (ctx.cardZone !== 'support') return;
  if (ctx.cancelled) return;
  const engine = ctx._engine;
  const gs = engine.gs;
  const cat = ctx.card;
  const pi = cat.controller ?? cat.owner;
  if (!gs.players[pi]) return;

  const hero = ctx.target;
  if (!hero || hero.hp === undefined || !(hero.hp > 0)) return;
  const betrag = ctx.amount;
  if (!(betrag > 0)) return;
  const seite = engine._findHeroOwner(hero);
  if (seite < 0 || engine.heroSideOf(seite, hero) !== pi) return;            // „a target you control"
  if (nichtUmleitbar(ctx.source, ctx.cannotBeRedirected)) return;
  if (einsaetzeUebrig(cat, gs) <= 0) return;

  const ziel = await angebot(engine, pi, cat, {
    amount: betrag, srcName: ctx.source?.name || 'an effect', fromName: hero.name || 'Your Hero',
    fromHp: hero.hp, fromIsHero: true, ausser: null,
  });
  if (!ziel) return;

  einsatzBuchen(cat, gs, -1);
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: ctx.source });
  // Der Treffer am Helden entfaellt. `_umgeleitet`: die Engine soll das Abbrechen als UMLEITUNG werten und es nicht
  // wie eine Negierung bei „cannot be negated"-Schaden zuruecknehmen (sonst nimmt auch der Held den Treffer).
  ctx.cancelled = true;
  ctx.setFlag('_umgeleitet', true);
  const pierce = istTrue || !!ctx.trueDamage || !!ctx.cannotBeNegated;
  await umleiten(engine, pi, cat, ziel, ankerHeld(engine, hero),
    { amount: betrag, type: ctx.type, source: ctx.source, fromName: hero.name || 'Your Hero' },
    { pierce, cannotBeReduced: pierce || !!ctx.cannotBeReduced, isStatusDamage: ['burn', 'poison', 'status'].includes(ctx.type) || ctx.source?.name === 'Burn' || ctx.source?.name === 'Poison',
      animType: null, sourceOwner: ctx.source?.owner ?? ctx.source?.controller ?? -1 });
}
