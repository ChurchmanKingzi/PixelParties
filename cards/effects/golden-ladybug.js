'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Golden Ladybug"  (v1344)
//  Creature — Summoning Magic Lv0, 20 HP
//
//  "You may immediately summon this Creature from your hand as an
//   additional Action when you activate a Surprise. During each of your
//   Resource Phases, gain 4 additional Gold OR draw 1 additional card."
//
//  ① AUS DER HAND (Hook `onSurpriseActivated`, activeIn 'hand')
//     • Nur EIGENE Surprises. Zeitpunkt = das Aufdecken, also BEVOR der
//       Effekt der Surprise aufloest (Als Ruling 24.9.: „immediately").
//       Auch eine danach negierte Surprise (Boots of Hermes) zaehlt —
//       aktiviert wurde sie trotzdem.
//     • Ganz normale Beschwoerung als Zusatzaktion (Als Ruling 8.8.):
//       tauglicher Caster, Zonenwahl, Beschwoerungs- und Aktionssperren
//       — alles ueber `sofortAusHandBeschwoeren` (_summon-eligibility).
//     • Mehrere Ladybugs auf der Hand: EIN Durchgang je Aktivierung, der
//       nacheinander jede Kopie anbietet (Merker `_goldenLadybugAngebot`
//       am Hook-Kontext — die uebrigen Hand-Instanzen sehen ihn).
//     • Platzschutz: ist die Surprise selbst eine Creature, die gleich in
//       die Support Zone ihres Helden wandert, bleibt dessen letzter
//       freier Platz fuer sie reserviert — sonst landete sie in der Ablage.
//     • Auftritt nach der bindenden Zonenwahl (v736-Regel).
//
//  ② RESOURCE PHASE (Hook `onPhaseEnd`, Phase RESOURCE, activeIn 'support')
//     • Laeuft NACH dem normalen Zug und Einkommen, noch innerhalb der
//       Resource Phase. Je Ladybug-Instanz und Zug einmal.
//     • Als Ruling 24.9.: die Karte (und ebenso das Gold) kommt DURCH
//       EINEN EFFEKT — kein „Draw for turn", kein Rundeneinkommen. Also
//       eigener `actionDrawCards`/`actionGainGold` mit Quelle, OHNE
//       `_isResourceDraw` / `_isResourceGain`. Folgen: Intrude, Nomu,
//       Monkees („through an effect") reagieren; Albrecht und Traveler
//       from the Future zaehlen die Karte NICHT als Resource-Draw.
//     • Wahl ueber `optionPicker` mit den IDs `gold` / `draw` — die CPU
//       nimmt damit automatisch den Gold-oder-Ziehen-Bewerter. Gerrymander
//       darf die Wahl uebernehmen (zwei verschiedene Effekte).
//     • Leerlauf (Als Bestaetigung 24.9.): eine Option, die nichts
//       bewirken kann, entfaellt (Gold-Sperre; Zieh-/Handsperre oder
//       leeres Deck). Bleibt nur eine, gilt sie ohne Abfrage. Bleibt
//       keine, loest die Ladybug gar nicht aus (kein Auftritt).
//     • The Golden Abomination (Als Ruling 24.9.): lenkt auch das
//       Ladybug-Gold um. Die Gold-Option bleibt waehlbar (das Gold wird
//       ja gewonnen, nur eben umgeleitet) — die CPU nimmt dann aber die
//       Karte, und unter Gerrymander waehlt die CPU fuer den Gegner Gold.
// ═══════════════════════════════════════════
const { eligibleSummonZones, sofortAusHandBeschwoeren } = require('./_summon-eligibility');
const { goldGainWouldBeBlocked } = require('./_gold-block-shared');
const { PHASES, hasCardType } = require('./_hooks');
const { goldWuerdeUmgeleitet } = require('./the-golden-abomination');

const CARD_NAME = 'Golden Ladybug';
const GOLD_BONUS = 4;
const ZIEH_BONUS = 1;

// ─── ① Beschwoerung beim Aktivieren einer Surprise ─────────────────

/** Freie Basiszonen (0-2) eines Helden, unabhaengig von Beschwoerungsrechten. */
function freieZonen(ps, heroIdx) {
  const zonen = ps?.supportZones?.[heroIdx] || [];
  let n = 0;
  for (let zi = 0; zi < Math.min(zonen.length, 3); zi++) if ((zonen[zi] || []).length === 0) n++;
  return n;
}

/**
 * Filter, der der aktivierten Surprise-Creature ihren Platz freihaelt.
 * Nur, wenn sie wirklich gleich platziert wird: sie liegt noch in einer
 * Surprise Zone (Bakhm-Slots liegen schon in der Support Zone, Aktivierung
 * aus der Ablage platziert nicht).
 */
function platzschutz(engine, pi, heroIdx, surpriseName) {
  const cd = engine._getCardDB()[surpriseName];
  if (!cd || !hasCardType(cd, 'Creature')) return null;
  const liegtInSurpriseZone = (engine.cardInstances || []).some(c =>
    c.owner === pi && c.zone === 'surprise' && c.name === surpriseName && c.heroIdx === heroIdx);
  if (!liegtInSurpriseZone) return null;
  return (zone) => {
    if (zone.heroIdx !== heroIdx) return true;
    return freieZonen(engine.gs.players[pi], heroIdx) > 1;
  };
}

async function handAngebot(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.card.owner;
  const surprise = ctx.surpriseCardName;
  const filter = platzschutz(engine, pi, ctx.heroIdx, surprise);

  // Eine Runde je Kopie auf der Hand; Obergrenze nur als Schleifenriegel.
  for (let runde = 0; runde < 12; runde++) {
    const ps = gs.players[pi];
    if (!(ps?.hand || []).includes(CARD_NAME)) return;
    let zonen = eligibleSummonZones(engine, pi, CARD_NAME);
    if (filter) zonen = zonen.filter(filter);
    if (zonen.length === 0) return;

    const ja = await engine.promptGeneric(pi, {
      type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
      message: `You activated "${surprise}". Summon ${CARD_NAME} from your hand as an additional Action?`,
      confirmLabel: '🐞 Summon!', cancelLabel: 'No', cancellable: true,
    });
    if (!engine._confirmSaidYes(ja)) return;

    const ok = await sofortAusHandBeschwoeren(engine, pi, CARD_NAME, {
      source: CARD_NAME,
      zonenFilter: filter || undefined,
      // Auftritt erst nach der bindenden Wahl — ein Abbruch zeigt nichts.
      nachZonenwahl: () => engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi }),
    });
    if (!ok) return;
    engine.sync();
  }
}

// ─── ② Bonus in der Resource Phase ─────────────────────────────────

function kannGoldGewinnen(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps || ps.goldLocked) return false;
  return !goldGainWouldBeBlocked(engine, pi);
}

function kannZiehen(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps || ps.handLocked || ps.drawLocked) return false;
  // Ein Zug aus dem leeren Deck waere der sofortige Deck-out.
  return (ps.mainDeck || []).length >= ZIEH_BONUS;
}

async function resourceBonus(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const inst = ctx.card;
  const pi = inst.controller ?? inst.owner;
  if (gs.activePlayer !== pi) return;
  if (!engine.isCardEffectActive(inst)) return;

  const sperre = `golden-ladybug-resource:${inst.id}`;
  if (gs.hoptUsed?.[sperre] === gs.turn) return;

  const optionen = [];
  if (kannGoldGewinnen(engine, pi)) {
    optionen.push({ id: 'gold', label: `💰 Gain ${GOLD_BONUS} Gold`, description: `Gain ${GOLD_BONUS} additional Gold.`, color: '#ffcc00' });
  }
  if (kannZiehen(engine, pi)) {
    optionen.push({ id: 'draw', label: `🃏 Draw ${ZIEH_BONUS} card`, description: `Draw ${ZIEH_BONUS} additional card.`, color: '#4488ff' });
  }
  if (optionen.length === 0) return;               // Leerlauf: kein Auftritt

  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[sperre] = gs.turn;

  let wahl = optionen[0].id;
  if (optionen.length > 1) {
    const antwort = await engine.promptGeneric(pi, {
      type: 'optionPicker', title: CARD_NAME, showCard: CARD_NAME,
      description: 'Resource Phase bonus — choose one:',
      options: optionen,
      cancellable: false,
      gerrymanderEligible: true,   // Gold vs. Karte sind verschiedene Effekte
    });
    const id = antwort?.optionId;
    if (optionen.some(o => o.id === id)) wahl = id;
  }

  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
  engine._broadcastEvent('play_zone_animation', {
    type: 'gold_sparkle', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
  });
  await engine._delay(250);

  const ps = gs.players[pi];
  engine.log('golden_ladybug_bonus', {
    player: ps?.username, card: CARD_NAME, choice: wahl,
    amount: wahl === 'gold' ? GOLD_BONUS : ZIEH_BONUS,
  });
  if (wahl === 'gold') {
    await engine.actionGainGold(pi, GOLD_BONUS, { source: CARD_NAME });
    engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', selector: `[data-gold-player="${pi}"]` });
  } else {
    await engine.actionDrawCards(pi, ZIEH_BONUS, { source: CARD_NAME });
  }
  engine.sync();
}

module.exports = {
  activeIn: ['hand', 'support'],

  // CPU-Bedrohungsbild: im Schnitt eine Einkommens-Stufe je Zug.
  supportYield() {
    return { goldPerTurn: GOLD_BONUS };
  },

  hooks: {
    onSurpriseActivated: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'hand') return;
      if (ctx.surpriseOwner !== inst.owner) return;       // „when YOU activate"
      if (ctx._goldenLadybugAngebot) return;               // eine Runde je Aktivierung
      ctx.setFlag('_goldenLadybugAngebot', true);
      await handAngebot(ctx);
    },

    onPhaseEnd: async (ctx) => {
      if (ctx.phaseIndex !== PHASES.RESOURCE) return;
      if (ctx.card?.zone !== 'support') return;
      await resourceBonus(ctx);
    },
  },

  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME) return undefined;
    if (p.type === 'confirm') return { confirmed: true };
    // Gold, das gleich zum Gegner wandert, ist nichts wert → Karte.
    if (p.type === 'optionPicker' && (p.options || []).some(o => o.id === 'draw')) {
      const pi = engine.gs.activePlayer;
      if (goldWuerdeUmgeleitet(engine, pi)) return { optionId: 'draw' };
    }
    return undefined;   // sonst der allgemeine Gold-oder-Ziehen-Bewerter
  },

  // Gerrymander: die CPU waehlt fuer den Ladybug-Spieler. Stiehlt ihre
  // Abomination das Gold, ist „Gold" fuer sie die beste Wahl.
  cpuGerrymanderResponse(engine, cpuIdx, p) {
    const opfer = cpuIdx === 0 ? 1 : 0;
    if ((p?.options || []).some(o => o.id === 'gold') && goldWuerdeUmgeleitet(engine, opfer)) return { optionId: 'gold' };
    return undefined;
  },
};
