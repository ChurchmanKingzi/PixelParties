'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Mind Control"
//  Spell (Attachment, Magic Arts Lv1) — Umsetzung 23.10.
//
//  „You can only use this Spell while 2 of your Heroes are defeated and your opponent permanently controls more than 1 undefeated Hero. Attach this card to 1 of your opponent's
//   Heroes. You gain permanent control of that Hero while this card is attached to it. This is treated as a negative status effect. If either player controls more than 2 Heroes,
//   immediately send this card to the discard pile."  — Vorbild für die Dauerkontrolle: Paraseed Control.
//
//  ── SPIELBEDINGUNG ──────────────────────────────────────────────────────
//  (a) Mindestens 2 der Helden, die der Spieler kontrolliert, sind besiegt (`heroesControlledBy`, hp ≤ 0). (b) Der Gegner kontrolliert DAUERHAFT mehr als 1 unbesiegten Helden
//  (`heroesControlledBy(gegner, { permanentOnly: true })`: eigene Helden ohne dauerhafte Fremdkontrolle plus dauerhaft übernommene; zeitweise Kontrolle [Charme, Love Shot …] zählt nicht
//  für den, der sie ausübt). Ohne beides ist die Karte ausgegraut (`spellPlayCondition`) und in `onPlay` ein zweites Mal geprüft.
//
//  ── WIRT ────────────────────────────────────────────────────────────────
//  „1 of your opponent's Heroes": ein lebender Held, den der GEGNER kontrolliert (Kontrolle statt Brettseite: ein vom Gegner übernommener Held meiner Spalte ist wählbar, ein von mir
//  übernommener Gegnerheld nicht) und der eine freie Support Zone hat. Wirtswahl und Treffer-Fenster (Surprises „chosen by a Spell", Hand-Reaktionen, Umlenker) über den geteilten Anlege-Vorgang
//  (`pickAttachmentHost` / `placeAttachment`: Anti Magic, Resistance und Effekt-Immunität fangen das Anlegen ab → die Karte geht in die Ablage).
//
//  ── STATUS UND KONTROLLE ────────────────────────────────────────────────
//  Die Karte legt den ECHTEN Status `mind_controlled` an (Registry `_hooks.js`, `attachmentStatus`; cleansable, negativ — „treated as a negative status effect"): Cure/Beer/Juice entfernen ihn,
//  dann fällt die Karte in die Ablage ihres Besitzers (`anhaengselStatusHooks`, `heilenWirftAb`). Mit dem Eintritt in die Support Zone übernimmt der Besitzer den Helden DAUERHAFT
//  (`actionTakeHeroPermanently`: Marken `permaControlBy`/`charmedBy`, Niederlagebedingung, Zielwahl, spielbare Karten, Ausrüstung — wie bei Paraseed Control); jeder Austritt der Karte (Ablage durch
//  Heilen, Zerstörung, Wegnehmen, Heldentod des Wirts, Obergrenze) gibt die Kontrolle zurück (`actionReturnHeroControl`; stand der Held vorher unter dauerhafter Kontrolle eines Dritten, geht sie an
//  diesen zurück). Umhängen an einen anderen Helden (Tea/Inheritance Ceremony) wandert die Kontrolle mit (`attachmentMovedToHost`, Eintritts-/Austritts-Hook). Resistance & Co. am Wirt
//  fangen die Kontroll-Übernahme selbst ab: die Karte verpufft dann (Ablage).
//
//  ── OBERGRENZE ──────────────────────────────────────────────────────────
//  „If either player controls more than 2 Heroes, immediately send this card to the discard pile." Gezählt werden die UNBESIEGTEN Helden, die ein Spieler kontrolliert (besiegte Helden zählen
//  nicht — sonst wäre die Karte nach der Spielbedingung [2 eigene Helden besiegt + ein Held] nie legal: 3 + 1 > 2). Geprüft nach jeder Wiederbelebung, jedem Kontrollwechsel, zu jedem Zugbeginn und nach
//  dem Anlegen; ist die Grenze überschritten, gehen ALLE Mind-Control-Karten auf dem Brett in die Ablage (Flug), die Kontrolle kehrt zurück.
//
//  ── PUZZLE ──────────────────────────────────────────────────────────────
//  Im Puzzle-Aufbau läuft kein `onPlay`: `puzzleAnheften` (Server, `createPuzzleGame`) legt die Kontrolle an — der Besitzer der Karte ist der Spieler der ANDEREN Seite des Wirts.
// ═══════════════════════════════════════════

const { attachmentHostsFor, pickAttachmentHost, placeAttachment, anhaengselStatusHooks } = require('./_attachment-shared');

const CARD_NAME = 'Mind Control';
const STATUS_NAME = 'mind_controlled';
const VERLUST_GRENZE = 2;

const statusHooks = anhaengselStatusHooks(CARD_NAME, STATUS_NAME, { heilenWirftAb: true });

function alleSitze(engine) {
  return Array.from({ length: engine.playerCount() }, (_, i) => i);
}

/** Die unbesiegten Helden, die `pi` gerade kontrolliert. */
function lebendeKontrollierte(engine, pi) {
  return engine.heroesControlledBy(pi).filter(h => h.hero?.name && h.hero.hp > 0);
}

/** Spielbedingung: 2 eigene Helden besiegt UND der Gegner kontrolliert dauerhaft mehr als 1 unbesiegten Helden. */
function bedingungErfuellt(engine, pi) {
  const oi = engine.opponentOf(pi);
  const besiegt = engine.heroesControlledBy(pi).filter(h => h.hero?.name && h.hero.hp <= 0).length;
  if (besiegt < 2) return false;
  const dauerhaft = engine.heroesControlledBy(oi, { permanentOnly: true }).filter(h => h.hero?.name && h.hero.hp > 0).length;
  return dauerhaft > 1;
}

/** Wirtswahl-Optionen: lebende Helden beider Spalten, die der Gegner kontrolliert. */
function wirtOpts(engine, pi) {
  const oi = engine.opponentOf(pi);
  return { sides: alleSitze(engine), heroFilter: (hero, hi, side) => engine.heroSideOf(side, hero) === oi };
}

/** Alle Mind-Control-Karten auf dem Brett (offen in einer Support Zone). */
function kopienAufDemBrett(engine) {
  return (engine.cardInstances || []).filter(c => c.name === CARD_NAME && c.zone === 'support' && !c.faceDown);
}

/**
 * Den Helden unter der Karte `inst` für den Besitzer der Karte (`originalOwner`) übernehmen. Merkt sich je Wirt, wer ihn vorher dauerhaft kontrolliert hat, damit der Austritt
 * die Kontrolle dorthin zurückgibt. Scheitert die Übernahme (Resistance …), geht die Karte in die Ablage.
 */
async function uebernehme(engine, inst) {
  const seite = inst.owner, hi = inst.heroIdx;
  const hero = engine.gs.players[seite]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return false;
  const kontrolleur = Number.isInteger(inst.originalOwner) ? inst.originalOwner : engine.opponentOf(seite);
  if (engine.heroSideOf(seite, hero) === kontrolleur) return false;          // gehört ihm schon (z. B. zweite Kopie): nichts zu übernehmen
  if (!inst.counters) inst.counters = {};
  const liste = inst.counters.mcZiele || (inst.counters.mcZiele = {});
  const schluessel = `${seite}:${hi}`;
  liste[schluessel] = { seite, heroIdx: hi, kontrolleur, vorher: Number.isInteger(hero.permaControlBy) ? hero.permaControlBy : null };
  const ok = await engine.actionTakeHeroPermanently(kontrolleur, seite, hi, { sourceName: CARD_NAME });
  if (!ok) {
    delete liste[schluessel];
    engine.log('mind_control_failed', { card: CARD_NAME, hero: hero.name });
    await engine.anhaengselAbraeumen(inst, { name: CARD_NAME });
    return false;
  }
  engine._broadcastEvent('play_zone_animation', { type: 'mind_control_hex', owner: seite, heroIdx: hi, zoneSlot: -1, duration: 1500 });
  engine.log('mind_control', {
    player: engine.gs.players[kontrolleur]?.username, hero: hero.name, from: engine.gs.players[seite]?.username,
  });
  engine.sync();
  return true;
}

/** Die Karte verlässt den Wirt (`seite`, `heroIdx`): Kontrolle zurück — an den früheren dauerhaften Kontrolleur, sonst an den Besitzer des Helden. */
async function gibZurueck(engine, inst, seite, heroIdx) {
  const liste = inst.counters?.mcZiele;
  const schluessel = `${seite}:${heroIdx}`;
  const z = liste && liste[schluessel];
  if (!z) return;
  delete liste[schluessel];
  const hero = engine.gs.players[seite]?.heroes?.[heroIdx];
  if (!hero?.name) return;
  if (hero.permaControlBy !== z.kontrolleur) return;                        // inzwischen anders vergeben (Secret Spell Book, anderer Effekt): nicht anfassen
  // Eine zweite Kopie derselben Kontrolleurs am selben Helden hält die Kontrolle weiter.
  const weitere = kopienAufDemBrett(engine).some(c => c !== inst && c.owner === seite && c.heroIdx === heroIdx
    && (Number.isInteger(c.originalOwner) ? c.originalOwner : engine.opponentOf(seite)) === z.kontrolleur);
  if (weitere) return;
  await engine.actionReturnHeroControl(seite, heroIdx, { sourceName: CARD_NAME });
  if (z.vorher != null && z.vorher !== z.kontrolleur) {
    await engine.actionTakeHeroPermanently(z.vorher, seite, heroIdx, { sourceName: CARD_NAME });
  }
  engine.sync();
}

/** „If either player controls more than 2 Heroes, immediately send this card to the discard pile." */
async function pruefeObergrenze(engine, ausser) {
  // `ausser`: die Karte, die gerade selbst geht (im Austritts-Hook liegt sie noch im Support) — sie nicht ein zweites Mal abräumen.
  const kopien = kopienAufDemBrett(engine).filter(c => c !== ausser && !c.counters?._mcAbraeumt);
  if (kopien.length === 0) return;
  let zuViele = false;
  for (const pi of alleSitze(engine)) if (lebendeKontrollierte(engine, pi).length > VERLUST_GRENZE) zuViele = true;
  if (!zuViele) return;
  for (const inst of kopien) {
    if (inst.zone !== 'support') continue;
    engine.log('mind_control_limit', { card: CARD_NAME });
    inst.counters = inst.counters || {};
    inst.counters._mcAbraeumt = true;
    try { await engine.anhaengselAbraeumen(inst, { name: CARD_NAME }); } finally { if (inst.counters) delete inst.counters._mcAbraeumt; }
  }
  engine.sync();
}

/** Grober Wert eines Helden für die CPU. */
function heldenWert(engine, seite, hi) {
  const h = engine.gs.players[seite]?.heroes?.[hi];
  if (!h?.name) return -Infinity;
  const abilities = (engine.gs.players[seite]?.abilityZones?.[hi] || []).reduce((n, z) => n + (z?.length || 0), 0);
  return (h.hp || 0) / 100 + (h.atk || 0) / 20 + abilities * 2;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER: wird die Karte NEGIERT, spielt die Engine dieses Bild.
  spellVisual: { impact: { type: 'mind_control_hex' }, impactMs: 260 },

  requiresTarget: true,                    // wählt ein Ziel (Blinded-Sperre)
  takesControlOfTargets: true,             // Boris & Co.: übernimmt fremde Ziele
  blockedByFirstTurnProtection: true,      // trifft nur die Gegnerseite
  activeIn: ['hand', 'support'],
  attachmentStatus: STATUS_NAME,

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    if (!bedingungErfuellt(eng, pi)) return false;
    return attachmentHostsFor(gs, pi, eng, wirtOpts(eng, pi)).length > 0;
  },

  /** Umhängen (Tea, Inheritance Ceremony): die Karte liegt an einem anderen Helden — dort übernehmen (am alten hat `onCardLeaveZone` zurückgegeben). */
  async attachmentMovedToHost(engine, inst) {
    await uebernehme(engine, inst);
    await pruefeObergrenze(engine);
  },

  /** Puzzle-Aufbau (kein `onPlay`): die Karte gehört dem Spieler der anderen Seite des Wirts; er übernimmt den Helden. */
  async puzzleAnheften(engine, inst) {
    if (!Number.isInteger(inst.originalOwner) || inst.originalOwner === inst.owner) inst.originalOwner = engine.opponentOf(inst.owner);
    await uebernehme(engine, inst);
  },

  hooks: {
    ...statusHooks,

    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      if (!bedingungErfuellt(engine, pi)) { gs._spellCancelled = true; return; }
      const opts = wirtOpts(engine, pi);
      const host = await pickAttachmentHost(ctx, CARD_NAME, {
        ...opts,
        ignoreDropHints: true,
        preferCaster: false,
        description: 'Choose a Hero your opponent controls. You gain permanent control of it while Mind Control remains attached.',
        confirmLabel: '🧠 Control!', confirmClass: 'btn-danger',
      });
      if (!host) return;
      const inst = await placeAttachment(ctx, CARD_NAME, host, { skipEnterHook: true });
      if (!inst) { engine.sync(); return; }                        // Anti Magic / Resistance / Immunität: die Karte geht in die Ablage
      // Status, dann Kontrolle (Eintritts-Hook der Karte läuft hier selbst, damit beides in EINER Reihenfolge steht).
      const wirt = gs.players[host.owner]?.heroes?.[host.heroIdx];
      await statusHooks.onCardEnterZone({ ...ctx, card: inst, enteringCard: inst, toZone: 'support', _engine: engine });
      if (wirt?.name && !wirt.statuses?.[STATUS_NAME]) {
        require('./_attachment-shared').setzeAnhaengselStatus(engine, host.owner, host.heroIdx, CARD_NAME, STATUS_NAME);
      }
      await uebernehme(engine, inst);
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx, _skipReactionCheck: true, _anhaengselAnleger: pi, _mcSchon: true,
      });
      await pruefeObergrenze(engine);
      engine.sync();
    },

    /** Eintritt in eine Support Zone (auch Umhängen): Status anlegen, Kontrolle übernehmen. Das eigene Anlegen in `onPlay` hat beides schon getan (`_mcSchon`). */
    onCardEnterZone: async (ctx) => {
      await statusHooks.onCardEnterZone(ctx);
      const inst = ctx.card;
      if (!inst || inst.name !== CARD_NAME || ctx.enteringCard?.id !== inst.id) return;
      if (ctx._mcSchon) return;
      if (ctx.toZone && ctx.toZone !== 'support') return;
      if (inst.zone !== 'support' || inst.faceDown) return;
      await uebernehme(ctx._engine, inst);
      await pruefeObergrenze(ctx._engine);
    },

    /** Austritt: Status nehmen (Hook des Bausteins) und die Kontrolle zurückgeben. */
    onCardLeaveZone: async (ctx) => {
      await statusHooks.onCardLeaveZone(ctx);
      const inst = ctx.card;
      if (!inst || inst.name !== CARD_NAME) return;
      const gehend = ctx.leavingCard || ctx._onlyCard;
      if (gehend?.id !== inst.id) return;
      if (ctx.fromZone && ctx.fromZone !== 'support') return;
      const engine = ctx._engine;
      await gibZurueck(engine, inst, ctx.fromOwner ?? inst.owner, ctx.fromHeroIdx ?? inst.heroIdx);
      await pruefeObergrenze(engine, inst);
    },

    // Obergrenze nach jeder Wiederbelebung / jedem Kontrollwechsel / zu jedem Zugbeginn.
    onHeroRevive: async (ctx) => { await pruefeObergrenze(ctx._engine); },
    onTakeControl: async (ctx) => { await pruefeObergrenze(ctx._engine); },
    onTurnStart: async (ctx) => { await pruefeObergrenze(ctx._engine); },
  },

  /** CPU: den wertvollsten Gegnerhelden wählen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget' || promptData?.config?.title !== CARD_NAME) return undefined;
    const helden = (promptData.validTargets || []).filter(t => !t.ineligible && t.type === 'hero');
    if (helden.length === 0) return [];
    let best = helden[0], bestV = -Infinity;
    for (const t of helden) { const v = heldenWert(engine, t.owner, t.heroIdx); if (v > bestV) { bestV = v; best = t; } }
    return [best.id];
  },
};
