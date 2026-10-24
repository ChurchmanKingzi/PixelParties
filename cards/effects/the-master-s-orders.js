'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "The Master's Orders"
//  Spell (Attachment, Decay Magic Lv1), PP SOD
//
//  „Attach this card to a Hero your opponent controls. While this card is attached to a Hero, your opponent may perform Actions with it as if they controlled it, but they
//   cannot make it choose itself as a target for an Attack or Spell. This is treated as a negative status effect."
//
//  ── WER IST „YOUR OPPONENT"? ────────────────────────────────────────────
//  Der Text liest sich AUS DER SICHT DER KARTE (wie Future Tech Control Device): sobald sie am Helden hängt, ist „your opponent" der Gegner des KONTROLLEURS dieses Helden — der Spieler,
//  der „The Master's Orders" gespielt hat (der ANHÄNGER, `inst.originalOwner`). Er darf mit dem fremden Helden handeln, als gehörte er ihm. Der Besitzer des Helden behält ihn für seine
//  eigenen Züge; Orders gibt nur dem Anhänger zusätzlich das Recht.
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Anlegen (Attachment-Baustein `attachToHero`): an einen Helden, den ein GEGNER kontrolliert und der eine freie Support Zone hat (Kontrolle zählt, nicht die Brettseite; ein an den
//     Gegner abgegebener eigener Held ist ein Wirt, ein von mir übernommener Gegnerheld nicht). Treffer-Fenster (Surprises, Hand-Reaktionen, Umlenker), Anti Magic, Resistance und
//     Effekt-Immunität laufen im Baustein. Heldenwahl abbrechbar — dann bleibt die Karte auf der Hand. Helden, die schon unter Orders stehen, stehen ausgegraut in der Liste.
//  2. Der Status `ordered` („Under Orders", negativ, heilbar) wird angelegt — wie bei Berserk als ECHTER Status über `addHeroStatus` (Immunität gegen negative Status, Resistance,
//     Charme-Schutz … gelten). Er trägt die Karte: wird er GEHEILT (Juice, Beer, Cure …), fallen ALLE Orders-Kopien am Helden in die Ablage ihres Besitzers; verlässt die letzte Kopie den
//     Helden, endet der Status. Der Status ist auch der Schalter für alles Weitere — ohne ihn (immun, geheilt) passiert nichts.
//  3. KONTROLLE: am Beginn jedes Zuges des Anhängers (`onTurnStart`) — und sofort, wenn die Karte in seinem EIGENEN Zug angelegt wird — übernimmt er den Helden für den Rest des
//     Zuges: dieselbe Übernahme wie Charme/Love Shot/Control Device (`temporaereKontrolle`, Marken `charmedBy`/`charmedFromOwner`/`charmedHeroIdx`, Status `charmed`), OHNE Schutzklausel
//     (`ohneSchutz`: der Text verspricht keinen), Rechte „beschwören + ausrüsten" (keine Abilities hinlegen). Die Rückgabe am nächsten Zugbeginn ist generisch (Engine). Während der
//     Übernahme zählt der Held für ALLE Abfragen als Held des Anhängers (`heroSideOf`): „you control" trifft ihn, „all targets your opponent controls" trifft ihn NICHT mehr. Die
//     Effekt-Vorbedingungen der Übernahme gelten (Erste-Runden-Schutz, Resistance einmal pro Zug, Effekt-Immunität): scheitert sie, bleibt die Karte liegen und versucht es am nächsten
//     Zugbeginn erneut.
//  4. HANDELN: alles läuft über die bestehende Übernahme-Infrastruktur — Spells/Attacks, Creatures beschwören (sie liegen dann auf fremdem Gebiet und gehören DAUERHAFT dem Anhänger),
//     Abilities aktivieren (Adventurousness), Heldeneffekte (Zi, Friedhelm …), Artefakte. Die Karten in den Ability Zones des übernommenen Helden sind dabei von allen Effekten unberührt
//     (allgemeine Regel für zeitweise Übernahmen).
//  5. „… but they cannot make it choose itself as a target for an Attack or Spell": solange der Anhänger den Helden kontrolliert, darf dieser mit einer Attack oder einem Spell NICHT sich
//     selbst als Ziel wählen — auch kein Support-Spell (Heilung auf sich selbst). Vertrag `blocksTargetingAnywhere` (wie Alliance): die Zielwahl markiert den Helden als Ziel seiner eigenen
//     Attack/Spell ausgegraut. Gilt nur für das WÄHLEN durch den übernommenen Helden (Wirker = Wirt); Effekte anderer Helden/Karten auf ihn und die Wahl durch den Besitzer in dessen eigenem
//     Zug bleiben frei. Heldeneffekte, Abilities und Creature-Effekte sind nicht erfasst (der Text sagt „Attack or Spell").
//
//  ── ANNAHMEN ────────────────────────────────────────────────────────────
//  • Die Übernahme beginnt mit dem Zugbeginn des Anhängers; wird die Karte im eigenen Zug gespielt, gilt sie ab sofort (er darf z. B. in Main Phase 2 eine inherente Zusatzaktion mit
//    dem Helden ausführen). Im Zug des Besitzers hat der Anhänger keine Aktionen.
//  • Das Truth-Seeing Eye des Anhängers hebt die Selbstwahl-Sperre mit auf (die Zielschutz-Schicht der Engine entfällt dann als Ganzes).
//  • Erste-Runden-Schutz des Wirts: die Karte ist unspielbar (`blockedByFirstTurnProtection`).
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU hängt die Karte an den gegnerischen Helden mit den meisten HP + ATK (stärkster Held = größter Nutzen) und handelt am Zugbeginn mit dem übernommenen Helden über die
//  gewöhnliche Übernahme-Logik der Engine.
// ═══════════════════════════════════════════

const { candidateHosts, attachToHero } = require('./_attachment-shared');
const { temporaereKontrolle } = require('./_charm-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = "The Master's Orders";
const STATUS_NAME = 'ordered';

function sitze(engine) {
  return Array.from({ length: engine.playerCount() }, (_, i) => i);
}

/** Wirte: lebende Helden mit freier Support Zone, die ein GEGNER von `pi` kontrolliert (Ausgegraut: schon unter Orders). */
function hostOpts(engine, pi) {
  return {
    sides: sitze(engine),
    heroFilter: (_h, hi, side) => engine.opponentsOf(pi).includes(engine.kontrolleurVonHeld(side, hi)),
    heroDim: (h) => !!h?.statuses?.[STATUS_NAME],
  };
}

/**
 * Der ANHÄNGER = der Spieler, der die Karte gespielt hat (`originalOwner`). Ein Puzzle-Aufbau trägt keine Herkunft (originalOwner = Seite des Wirts): dann der Gegner des Basis-Kontrolleurs
 * des Wirts. Basis-Kontrolleur = dauerhafter Kontrolleur (`permaControlBy`), sonst die Brettseite — die zeitweise Übernahme (`charmedBy`) bleibt außen vor.
 */
function anhaenger(engine, inst) {
  const host = engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx];
  const basis = host?.permaControlBy ?? inst.owner;
  const oo = inst.originalOwner;
  if (Number.isInteger(oo) && oo !== basis) return oo;
  return engine.opponentOf(basis);
}

/** Orders am Wirt anlegen — für das Spielen der Karte UND das Umhängen (Inheritance Ceremony, Secret Spell Book). */
async function ordersAnlegen(engine, appliedBy, owner, heroIdx) {
  const hero = engine.gs.players[owner]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0 || hero.statuses?.[STATUS_NAME]) return false;
  await engine.addHeroStatus(owner, heroIdx, STATUS_NAME, {
    appliedBy,
    source: CARD_NAME,
    animationType: 'dark_swarm',
    festesZiel: true,   // „the Hero this Spell is attached to": der Wirt wurde schon gewählt
  });
  return !!hero.statuses?.[STATUS_NAME];
}

/** Orders-Kopien am Wirt (Brettseite `owner`). */
function kopienAmWirt(engine, owner, heroIdx, ausser = null) {
  return engine.cardInstances.filter(c => c.zone === 'support' && c.name === CARD_NAME && c.owner === owner
    && c.heroIdx === heroIdx && !c.faceDown && c !== ausser);
}

/**
 * Den Wirt für den Rest des Zuges übernehmen, wenn er jetzt unter Orders steht und der Anhänger am Zug ist. Gibt `true` zurück, wenn die Übernahme gelang.
 */
async function nimmKontrolle(engine, inst) {
  const gs = engine.gs;
  if (gs.result || gs._endGameLaeuft) return false;
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  const owner = inst.owner, heroIdx = inst.heroIdx;
  const hero = gs.players[owner]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0 || !hero.statuses?.[STATUS_NAME]) return false;
  const pi = anhaenger(engine, inst);
  if (gs.activePlayer !== pi) return false;
  if (hero.charmedBy != null || hero.permaControlBy != null || hero.controlledBy != null) return false;   // schon übernommen (auch vom Anhänger selbst)
  const ok = await temporaereKontrolle(engine, {
    controllerPi: pi, ownerPi: owner, heroIdx, sourceName: CARD_NAME,
    marker: 'ohneSchutz',          // der Kartentext verspricht keinen Schutz (wie Styx, Control Device)
    supportZonesLocked: false,     // Rechte: beschwören + ausrüsten
  });
  if (!ok.ok) return false;
  if (hero.statuses?.charmed) hero.statuses.charmed.quelle = CARD_NAME;
  await engine.runHooks('onTakeControl', {
    controllerPi: pi, originalOwnerPi: owner,
    targetType: 'hero', targetName: hero.name, targetHero: hero,
    heroIdx, kind: 'controlled', sourceName: CARD_NAME,
  });
  engine._broadcastEvent('dark_control', { owner, heroIdx });
  await engine._delay(450);
  engine.log('masters_orders_control', {
    player: gs.players[pi]?.username, hero: hero.name, opponent: gs.players[owner]?.username,
  });
  engine.sync();
  return true;
}

/** Grober Wert eines Wirts für die CPU (hoch = lohnt sich mehr). */
function wirtWert(engine, side, hi) {
  const h = engine.gs.players[side]?.heroes?.[hi];
  return (h?.hp || 0) + (h?.atk || 0) * 3;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  blockedByFirstTurnProtection: true,      // trifft nur die Gegnerseite
  activeIn: ['hand', 'support'],
  attachmentStatus: STATUS_NAME,           // Puzzle-Aufbau legt den Status an (kein `onPlay` im Puzzle)
  spellVisual: { impact: { type: 'dark_swarm' }, impactMs: 260 },

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    const opts = hostOpts(eng, pi);
    return candidateHosts(gs, pi, eng, opts).some(h => !opts.heroDim(gs.players[h.side]?.heroes?.[h.heroIdx]));
  },

  /** Umhängen (Inheritance Ceremony, Secret Spell Book): den Status am neuen Wirt wieder anlegen (am alten hat ihn `onCardLeaveZone` genommen). */
  async attachmentMovedToHost(engine, inst, { toOwner, toHeroIdx }) {
    await ordersAnlegen(engine, inst.originalOwner ?? toOwner, toOwner, toHeroIdx);
    engine.sync();
  },

  /**
   * ★ „… they cannot make it choose itself as a target for an Attack or Spell" — der zweite Zielvertrag (wie Alliance): gefragt wird diese Instanz für JEDES Ziel. Gesperrt ist der Wirt als
   * Ziel einer Attack/eines Spells, die er SELBST (als übernommener Held des Anhängers) wirkt.
   */
  blocksTargetingAnywhere(gs, engine, info, inst) {
    if (inst.zone !== 'support' || inst.faceDown) return false;
    const hostSeite = engine.physicalSide(inst);
    if (info.heroOwner !== hostSeite || info.heroIdx !== inst.heroIdx) return false;      // das Ziel ist der Wirt
    const host = gs.players[hostSeite]?.heroes?.[inst.heroIdx];
    if (!host?.name || !host.statuses?.[STATUS_NAME]) return false;
    const pi = anhaenger(engine, inst);
    if (host.charmedBy !== pi) return false;                                               // nur, solange der Anhänger ihn führt
    // Wer wählt? Der Wirt selbst. `chooserHeroIdx` kennt nicht jeder Aufrufer — dann zählt der laufende Wirker der Aktion (`gs._wirkerSeite`).
    const w = gs._wirkerSeite;
    let waehlerIdx = info.chooserHeroIdx, waehlerSeite = info.chooserHeroOwner;
    if (!(waehlerIdx >= 0) && w && w.pi === info.chooserIdx) { waehlerIdx = w.heroIdx; waehlerSeite = w.heroOwner; }
    if (waehlerSeite == null) waehlerSeite = (w && w.pi === info.chooserIdx && w.heroIdx === waehlerIdx) ? w.heroOwner : info.chooserIdx;
    if (info.chooserIdx !== pi) return false;
    if (waehlerSeite !== hostSeite || waehlerIdx !== inst.heroIdx) return false;
    // Nur Attacks und Spells (auch solche, die als Attack/Spell ZÄHLEN).
    const cd = info.sourceData;
    if (cd) return hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell') || info.treatedAsLevel != null;
    return info.treatedAsLevel != null;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const res = await attachToHero(ctx, CARD_NAME, {
        ...hostOpts(engine, pi),
        ignoreDropHints: true,
        description: "Attach The Master's Orders to a Hero your opponent controls. You may perform Actions with it as if you controlled it.",
        confirmLabel: '📜 Attach!', confirmClass: 'btn-danger', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      const hero = gs.players[host.owner]?.heroes?.[host.heroIdx];
      const gesetzt = await ordersAnlegen(engine, pi, host.owner, host.heroIdx);
      if (!gesetzt && !hero?.statuses?.[STATUS_NAME]) {
        engine.log('masters_orders_noop', { player: gs.players[pi]?.username, hero: hero?.name });
      }

      engine._broadcastEvent('play_zone_animation', { type: 'dark_swarm', owner: host.owner, heroIdx: host.heroIdx, zoneSlot: -1 });
      await engine._delay(400);

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx,
        _skipReactionCheck: true, _anhaengselAnleger: pi,
      });
      engine.log('masters_orders_attached', { player: gs.players[pi]?.username, target: hero?.name });
      engine.sync();

      // Im EIGENEN Zug des Anhängers gilt die Karte ab sofort (Zusatzaktionen mit dem Helden).
      if (gs.activePlayer === pi) await nimmKontrolle(engine, inst);
    },

    /** Zugbeginn des Anhängers: den Helden für diesen Zug übernehmen (die Rückgabe am nächsten Zugbeginn besorgt die Engine). */
    onTurnStart: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.name !== CARD_NAME || inst.zone !== 'support') return;
      if (ctx.cardZone && ctx.cardZone !== 'support') return;
      await nimmKontrolle(ctx._engine, inst);
    },

    /**
     * Cleanse-Routing wie bei Berserk: wird `ordered` GEHEILT (Juice, Beer, Cure …), fallen ALLE Orders-Kopien am Helden in die Ablage ihres ursprünglichen Besitzers. Mit der Heilung endet
     * auch eine laufende Übernahme dieses Zuges (die Kontrolle hing an der Karte).
     */
    onStatusRemoved: async (ctx) => {
      if (ctx.status !== STATUS_NAME || !ctx._viaCleanse) return;
      const engine = ctx._engine;
      const owner = ctx.heroOwner, heroIdx = ctx.heroIdx;
      if (typeof owner !== 'number' || typeof heroIdx !== 'number') return;
      const kopien = kopienAmWirt(engine, owner, heroIdx);
      if (kopien.length === 0) return;
      engine.gs._ordersCleanseInProgress = true;
      try {
        engine.beginDestroyScope(kopien.length);
        try {
          for (const inst of [...kopien]) {
            await engine.actionDestroyCard({ name: CARD_NAME, owner: ctx.cardOwner ?? owner, heroIdx: ctx.cardHeroIdx ?? heroIdx }, inst);
          }
        } finally { engine.endDestroyScope(); }
      } finally { delete engine.gs._ordersCleanseInProgress; }
      const hero = engine.gs.players[owner]?.heroes?.[heroIdx];
      if (hero?.charmedBy != null && hero.statuses?.charmed?.quelle === CARD_NAME) {
        delete hero.charmedBy; delete hero.charmedFromOwner; delete hero.charmedHeroIdx;
        delete hero.statuses.charmed; delete hero._kontrollRechte;
      }
      engine.log('masters_orders_cleansed', { target: hero?.name, copies: kopien.length });
      engine.sync();
    },

    /** Letzte Kopie weg (zerstört, abgeworfen, …): der Wirt trägt den Status nicht mehr, eine laufende Übernahme endet. */
    onCardLeaveZone: async (ctx) => {
      const card = ctx.card;
      if (!card || card.name !== CARD_NAME) return;
      if ((ctx.leavingCard || ctx._onlyCard)?.id !== card.id) return;
      if (ctx.fromZone && ctx.fromZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs._ordersCleanseInProgress) return;
      const owner = ctx.fromOwner ?? card.owner;
      const heroIdx = ctx.fromHeroIdx ?? card.heroIdx;
      const hero = gs.players[owner]?.heroes?.[heroIdx];
      if (!hero?.name) return;
      if (kopienAmWirt(engine, owner, heroIdx, card).length > 0) return;
      if (hero.charmedBy != null && hero.statuses?.charmed?.quelle === CARD_NAME && hero.permaControlBy == null) {
        delete hero.charmedBy; delete hero.charmedFromOwner; delete hero.charmedHeroIdx;
        delete hero.statuses.charmed; delete hero._kontrollRechte;
      }
      if (hero.statuses?.[STATUS_NAME]) {
        delete hero.statuses[STATUS_NAME];
        await engine.runHooks('onStatusRemoved', {
          target: hero, status: STATUS_NAME, heroOwner: owner, heroIdx, _viaCleanse: false, _skipReactionCheck: true,
        });
        engine.sync();
      }
    },
  },

  /** CPU: den gegnerischen Helden mit den meisten HP + ATK nehmen (Wirtswahl). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = promptData || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    const helden = frei.filter(t => t.type === 'hero');
    const zonen = frei.filter(t => t.type === 'equip');
    const pool = helden.length ? helden : zonen;
    let best = pool[0], bestV = -Infinity;
    for (const t of pool) { const v = wirtWert(engine, t.owner, t.heroIdx); if (v > bestV) { bestV = v; best = t; } }
    return [best.id];
  },
};
