'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Hot Skull Potato"  (W74d)
//  Creature (Destruction Magic / Summoning Magic Lv2, 1 HP)
//
//  „Summon this card into the free Support Zone of any Hero your opponent controls and put a Skull Counter on it. This Creature is unaffected by all other cards and effects. At the
//   end of your turn, if this Creature is in one of your Heroes' Support Zones, you may discard cards from your hand equal to the number of Skull Counters on this Creature to place
//   it into the free Support Zone of any Hero your opponent controls and place a Skull Counter on it. Otherwise, this Creature is defeated and all targets you control take 50
//   damage +50 times the number of Skull Counters on this card."
//
//  ── „DU" IST IMMER, WESSEN ZONE DIE KARTE GERADE BELEGT ───────────────────
//  (Al: „Der bezahlende Spieler ist immer der, in dessen Zone die Creature gerade liegt.") Die Kartentext-Zeitform „at the end of YOUR turn" meint also den Kontrolleur =
//  den Halter der Zone. Wie beim Plant Golem liegt die Karte physisch in der Zone des Gegners des Beschwörers und trägt `controller` = Zonenseite (der Besitzer bleibt der
//  Spieler, der sie gespielt hat — Bounce/Abwurf gehen an ihn). Beim Weiterreichen wechselt der Kontrolleur mit.
//
//  ① SPIELEN: nur in eine freie Zone eines Helden, den der Gegner kontrolliert (`playOnAnyHeroSide` + `playOnOppSideOnly`, Hinweis des Servers beim Ziehen aufs Brett oder
//     Zonenwahl); der erste Skull Counter kommt sofort darauf (`counters.skullCounter`, Abzeichen am Brett). Gegen den Erste-Runde-Schutz unspielbar (nur Platzieren).
//  ② „UNAFFECTED BY ALL OTHER CARDS AND EFFECTS": derselbe Schild wie bei den Cardinal Beasts (`counters._cardinalImmune`, quellenblind — Schaden, Zerstörung, Bewegung,
//     Status, Zielwahl-Ergebnisse). Die EIGENEN Wirkungen (Weiterreichen, Besiegen) legen den Schild für ihren Augenblick ab und setzen ihn danach wieder.
//  ③ ZUGENDE DES HALTERS (`onTurnEnd`): liegt die Karte in der Zone eines Helden, den der Halter kontrolliert, und ist ein freier Platz bei einem gegnerischen Helden da und
//     hat er genug Handkarten, darf er bezahlen (Ja/Nein): Handkarten = Zähler abwerfen (Wahl des Halters), dann Zone wählen, Karte hinüberreichen, +1 Counter.
//     Sonst (kein Angebot möglich, abgelehnt, Zahlung nicht erbracht, Karte nicht in einer eigenen Zone): die Karte wird besiegt und ALLE Ziele des Halters (seine Helden UND
//     Kreaturen) erleiden 50 + 50 × Counter Schaden. Bild: große Pixelart-Explosion (`hot_potato_blast`).
// ═══════════════════════════════════════════
const { hasCardType, PHASES } = require('./_hooks');

const CARD_NAME = 'Hot Skull Potato';
const KEY = 'skullCounter';
const GRUND = 50, JE_COUNTER = 50;
const BLAST_MS = 1500;
const FLUG_MS = 850;   // Dauer des Sprungs in die andere Zone (`hot_potato_throw`)
const MONTAGE_MS = 140;   // Vorlauf, bis der Client die Sprung-Animation eingehängt hat

/** Freie Zonen bei Helden, die der GEGNER von `holder` kontrolliert. */
function freieGegnerZonen(engine, holder) {
  const oppIdx = engine.opponentOf(holder);
  const ops = engine.gs.players[oppIdx];
  const out = [];
  for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (engine.heroSideOf(oppIdx, h) !== oppIdx) continue;   // Kontrolle statt Seite
    for (let si = 0; si < 3; si++) {
      if (((ops.supportZones?.[hi] || [])[si] || []).length === 0) out.push({ ownerIdx: oppIdx, heroIdx: hi, slotIdx: si });
    }
  }
  return out;
}

/** Liegt die Karte in der Zone eines Helden, den ihr Halter kontrolliert? */
function inEigenerZone(engine, inst, holder) {
  const seite = engine.physicalSide(inst);
  const hero = engine.gs.players[seite]?.heroes?.[inst.heroIdx];
  return !!hero?.name && engine.heroSideOf(seite, hero) === holder;
}

/** Den Immunschild für die eigene Wirkung ablegen / wieder aufsetzen. */
const schildAb = (inst) => { if (inst?.counters) delete inst.counters._cardinalImmune; };
const schildAuf = (inst) => { if (inst?.counters) inst.counters._cardinalImmune = 1; };

/** Die Karte in eine freie Zone des Gegners des Halters legen (Plant-Golem-Weg); Kontrolleur wechselt, Counter +1. */
async function weiterreichen(engine, inst, holder, ziel) {
  const gs = engine.gs;
  const oppIdx = engine.opponentOf(holder);
  const altSeite = engine.physicalSide(inst);
  const alt = gs.players[altSeite];
  const altSlot = alt?.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
  if (altSlot) { const i = altSlot.indexOf(CARD_NAME); if (i >= 0) altSlot.splice(i, 1); }
  const altHeld = inst.heroIdx, altSlot2 = inst.zoneSlot;   // für das Fenster „Kreatur wurde bewegt" (Explosion Toss)
  const to = gs.players[oppIdx];
  // Sprung (Pixelart `hot_potato_throw` + Klang): die KARTE selbst hüpft von der alten zur neuen Zone; währenddessen liegt sie in keiner, erst bei der Landung steht sie in der neuen.
  engine._broadcastEvent('play_zone_animation', {
    type: 'hot_potato_throw', zoneType: 'board', duration: FLUG_MS + 330,
    targets: [{ owner: altSeite, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, cardName: CARD_NAME }, { owner: oppIdx, heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx }],
  });
  // Der Client hängt die Animation ~100 ms nach dem Ereignis ein: erst dann nimmt der Zustand die Karte aus der alten Zone, sonst fehlt sie einen Augenblick (die springende Karte IST die Karte).
  await engine._delay(MONTAGE_MS);
  engine.sync();
  await engine._delay(FLUG_MS - MONTAGE_MS);
  if (!to.supportZones[ziel.heroIdx]) to.supportZones[ziel.heroIdx] = [[], [], []];
  to.supportZones[ziel.heroIdx][ziel.slotIdx] = [CARD_NAME];
  inst.heroIdx = ziel.heroIdx;
  inst.zoneSlot = ziel.slotIdx;
  inst.controller = oppIdx;
  inst.counters[KEY] = (inst.counters[KEY] || 1) + 1;
  inst.turnPlayed = gs.turn;
  engine._broadcastEvent('summon_effect', { owner: oppIdx, heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx, cardName: CARD_NAME });
  await engine._delay(250);
  engine.log('hot_skull_potato_pass', { player: gs.players[holder]?.username, counters: inst.counters[KEY] });
  engine.sync();
  // „moved from one of your Heroes' Support Zones to an opponent's Hero's Support Zone": Hand-Fenster für den bisherigen Halter (Explosion Toss) — das ruft der Aufrufer, NACHDEM der Schild
  // wieder steht („unaffected"), mit diesen Angaben.
  return {
    fromKtrl: holder, fromSeite: altSeite, fromHeroIdx: altHeld, fromSlot: altSlot2,
    toSeite: oppIdx, toHeroIdx: ziel.heroIdx, toSlot: ziel.slotIdx,
    source: { name: CARD_NAME, owner: holder, controller: holder },
  };
}

/** Besiegen und 50 + 50 × Counter an alle Ziele des Halters. */
async function explodieren(engine, inst, holder) {
  const gs = engine.gs;
  const n = inst.counters[KEY] || 1;
  const schaden = GRUND + JE_COUNTER * n;
  const seite = engine.physicalSide(inst);
  engine._broadcastEvent('play_zone_animation', { type: 'hot_potato_blast', owner: seite, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, duration: BLAST_MS + 300 });
  await engine._delay(BLAST_MS * 0.42);
  // Besiegen: die EIGENE Wirkung legt den Schild ab.
  schildAb(inst);
  const quelle = { name: CARD_NAME, owner: holder, controller: holder, heroIdx: inst.heroIdx };
  if (inst.zone === 'support') await engine.actionDestroyCard(quelle, inst, { sourceOwner: holder, sourceName: CARD_NAME, fireCreatureDeath: true });
  // Alle Ziele des Halters: seine Helden und Kreaturen (die Karte selbst ist schon draußen).
  const ziele = [];
  for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(holder)) {
    if (hero?.name && hero.hp > 0) ziele.push({ type: 'hero', owner: physOwner, heroIdx });
  }
  const db = engine._getCardDB();
  for (const k of (engine.cardInstances || [])) {
    if (k.id === inst.id || k.zone !== 'support' || k.faceDown) continue;
    if ((k.controller ?? k.owner) !== holder) continue;
    const cd = engine.getEffectiveCardData(k) || db[k.name];
    if (!cd || (!hasCardType(cd, 'Creature') && !hasCardType(cd, 'Token'))) continue;
    ziele.push({ type: 'creature', inst: k });
  }
  if (ziele.length) {
    await engine.dealDamageToTargets(quelle, ziele, { damage: schaden, damageType: 'creature', sourceName: CARD_NAME, animationType: 'none' });
  }
  engine.log('hot_skull_potato_explode', { player: gs.players[holder]?.username, counters: n, damage: schaden, targets: ziele.length });
  engine.sync();
  await engine._delay(BLAST_MS * 0.58);
}

module.exports = {
  blockedByFirstTurnProtection: true,
  hitsMultipleTargets: true,        // „all targets you control" — Flächenschaden (Text-Wächter)
  playOnAnyHeroSide: true,
  playOnOppSideOnly: true,
  activeIn: ['support'],

  spellVisual: { impact: { type: 'hot_potato_blast' }, impactMs: 600 },

  canSummon: (ctx) => freieGegnerZonen(ctx._engine, ctx.cardOwner).length > 0,

  // CPU: bezahlen, wenn es billig ist (≤ 2 Karten) oder die Hand reichlich gefüllt ist; sonst lieber sprengen.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm' || promptData.title !== CARD_NAME) return undefined;
    const n = promptData._kartoffel?.zaehler ?? 99, hand = promptData._kartoffel?.hand ?? 0;
    return { confirmed: n <= 2 || hand >= n * 2 + 1 };
  },

  hooks: {
    /** Spielen: in die freie Zone eines gegnerischen Helden legen (Plant-Golem-Weg), erster Counter, Schild. */
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = engine.opponentOf(pi);
      if (!inst.counters) inst.counters = {};
      schildAuf(inst);
      if ((inst.controller ?? inst.owner) === oppIdx) { inst.counters[KEY] = inst.counters[KEY] || 1; return; }   // liegt schon beim Gegner

      let dest = null;
      const hint = gs._chillyWizardHint?.[pi];
      if (hint) delete gs._chillyWizardHint[pi];
      const free = freieGegnerZonen(engine, pi);
      if (hint && hint.ownerIdx === oppIdx && free.some(z => z.heroIdx === hint.heroIdx && z.slotIdx === hint.slotIdx)) dest = hint;
      if (!dest) {
        if (free.length === 0) return;   // verhindert `canSummon`
        if (free.length === 1) dest = free[0];
        else {
          const pick = await ctx.promptZonePick(free.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, ownerIdx: oppIdx })), {
            title: CARD_NAME, description: `Choose a free Support Zone of a Hero your opponent controls for the ${CARD_NAME}.`, cancellable: false, previewCardName: CARD_NAME,
          });
          dest = (pick && free.find(z => z.heroIdx === pick.heroIdx && z.slotIdx === pick.slotIdx)) || free[0];
        }
      }
      const fromPs = gs.players[pi];
      const fromSlot = fromPs.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
      if (fromSlot) { const i = fromSlot.indexOf(CARD_NAME); if (i >= 0) fromSlot.splice(i, 1); }
      const toPs = gs.players[oppIdx];
      if (!toPs.supportZones[dest.heroIdx]) toPs.supportZones[dest.heroIdx] = [[], [], []];
      toPs.supportZones[dest.heroIdx][dest.slotIdx] = [CARD_NAME];
      inst.heroIdx = dest.heroIdx;
      inst.zoneSlot = dest.slotIdx;
      inst.controller = oppIdx;
      inst.counters[KEY] = 1;
      engine._broadcastEvent('summon_effect', { owner: oppIdx, heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx, cardName: CARD_NAME });
      await engine._delay(200);
      engine.log('hot_skull_potato_planted', { player: fromPs.username, oppHero: toPs.heroes?.[dest.heroIdx]?.name });
      engine.sync();
    },

    /**
     * Zugende des Halters: bezahlen und weiterreichen — oder besiegen und Schaden an alle seine Ziele.
     * Läuft schon in der END-Phase (`onPhaseEnd`), also VOR dem Abwurf auf die Handgröße (`enforceHandLimit` kommt danach): die Zahlung zählt Handkarten, und die Karten, die dafür
     * abgeworfen werden, müssen nicht mehr für das Handlimit herhalten. `onTurnEnd` bleibt als Rückfall für Zugenden ohne END-Phase (Merker `_kartoffelZug` verhindert ein zweites Mal).
     */
    onPhaseEnd: async (ctx) => {
      if (ctx.phaseIndex !== PHASES.END) return;
      await zugEnde(ctx);
    },

    onTurnEnd: async (ctx) => zugEnde(ctx),
  },
};

/** Zugende-Wirkung (Zahlen und Weiterreichen, sonst Explosion). */
async function zugEnde(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support' || inst.faceDown) return;
  const holder = inst.controller ?? inst.owner;
  if (gs.activePlayer !== holder) return;
  if (inst.counters._kartoffelZug === gs.turn) return;
  inst.counters._kartoffelZug = gs.turn;
  const ps = gs.players[holder];
  const n = inst.counters[KEY] || 1;
  const zonen = freieGegnerZonen(engine, holder);

  let weitergegeben = false;
  if (inEigenerZone(engine, inst, holder) && zonen.length > 0 && (ps.hand || []).length >= n) {
    const ja = await engine.promptGeneric(holder, {
      type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
      _kartoffel: { zaehler: n, hand: (ps.hand || []).length },
      message: `Discard ${n} card${n === 1 ? '' : 's'} to pass ${CARD_NAME} to your opponent? Otherwise it explodes: ${GRUND + JE_COUNTER * n} damage to all your targets.`,
      confirmLabel: `🥔 Pass it (${n})`, cancelLabel: '💥 Let it blow', cancellable: true,
    });
    if (engine._confirmSaidYes(ja)) {
      const vor = (ps.hand || []).length;
      await engine.actionPromptForceDiscard(holder, n, { costFor: CARD_NAME, costKind: 'disrupt', title: `${CARD_NAME} — Discard ${n}`, source: CARD_NAME, selfInflicted: true, skipSourceGlow: true });
      if (vor - (ps.hand || []).length >= n) {
        let ziel = zonen[0];
        if (zonen.length > 1) {
          const wahl = await engine.promptGeneric(holder, {
            type: 'zonePick', title: CARD_NAME, description: `Choose a free Support Zone of a Hero your opponent controls for the ${CARD_NAME}.`,
            zones: zonen.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.ownerIdx })), cancellable: false,
          });
          ziel = (wahl && zonen.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx)) || zonen[0];
        }
        schildAb(inst);
        let fensterInfo = null;
        try { fensterInfo = await weiterreichen(engine, inst, holder, ziel); } finally { schildAuf(inst); }
        weitergegeben = true;
        if (fensterInfo) await engine._checkCreatureMovedHandReactions(inst, fensterInfo);
      }
    }
  }
  if (!weitergegeben && inst.zone === 'support') await explodieren(engine, inst, holder);
}
