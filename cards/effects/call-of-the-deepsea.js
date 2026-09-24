'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Call of the Deepsea"  (v1358, neuer Text von Al 24.9.)
//  Spell — Summoning Magic Lv3, Attachment
//
//  "Attach this card to a Hero you control. Once per turn, when a Creature
//   in one of your Heroes' Support Zones is defeated, you may delete it and
//   summon a Creature with a different name from your hand or discard pile
//   into the same Support Zone as an additional Action."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  · Anlegen: Attachment-Bauform (Light Ball / Prophecy of Tempeste) —
//    die Karte liegt in einer freien Support Zone eines eigenen Helden.
//  · Ausloeser: `onCreatureDeath` einer Creature, die in einer Support Zone
//    EINES EIGENEN Helden lag (die Seite des Platzes, nicht der Besitzer —
//    „in one of your Heroes' Support Zones"). Jede Todesart, auch Opfer.
//    Im eigenen wie im gegnerischen Zug.
//  · „Once per turn" = WEICH (v249): pro Karte (Instanz), nicht pro
//    Spieler. Verbraucht erst, wenn wirklich beschworen wird; Ablehnen
//    kostet nichts, der naechste Tod fragt erneut.
//  · „delete it": die besiegte Karte aus der Ablage in den Deleted Pile.
//    „delete it AND summon" ist EIN Paket: geht eins nicht (Ablage
//    gesperrt, Karte nicht mehr in der Ablage, kein Kandidat), bietet die
//    Karte gar nicht erst an (Leerlauf-Regel).
//  · „summon … as an additional Action": eine ECHTE Beschwoerung durch den
//    Helden DIESES Platzes — lebend, handlungsfaehig, keine Beschwoerungs-
//    oder Aktionssperre, Stufe reicht (`canHeroSummon`, `alsAktion`) —
//    gemeldet als Aktion (`alsZusatzaktion`, Madame Guillotine & Co.).
//  · „a different name": anderer Name als die besiegte Creature.
//  · Bild: Tiefsee-Strudel auf dem Platz beim Ausloesen
//    (`deepsea_summon_whirlpool`), danach der normale Beschwoerungsflug.
// ═══════════════════════════════════════════
const { isPileCreature } = require('./_hooks');
const { attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const { canHeroSummon } = require('./_summon-eligibility');

const CARD_NAME = 'Call of the Deepsea';

/** HOPT-Schluessel je Instanz (weiche Form). */
const hoptKey = (inst) => `call-of-the-deepsea:${inst.id}`;

/** Galerie: beschwoerbare Creatures aus Hand und Ablage, ohne den Namen der besiegten. */
function kandidaten(engine, pi, heroIdx, ausserName) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const out = [];
  for (const quelle of ['hand', 'discard']) {
    if (quelle === 'discard' && !engine.pileOutAllowed(pi, 'discard', { source: CARD_NAME })) continue;
    const pool = quelle === 'hand' ? (ps?.hand || []) : (ps?.discardPile || []);
    const zaehler = new Map();
    for (const n of pool) {
      if (n === ausserName) continue;
      const cd = db[n];
      if (!cd || !isPileCreature(cd)) continue;
      if (!canHeroSummon(engine, pi, heroIdx, cd, { alsAktion: true })) continue;
      if (!engine.isCreatureSummonable(n, pi, heroIdx)) continue;
      zaehler.set(n, (zaehler.get(n) || 0) + 1);
    }
    for (const [name, count] of [...zaehler.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      out.push({ name, source: quelle, count });
    }
  }
  return out;
}

module.exports = {
  requiresTarget: true,
  activeIn: ['hand', 'support'],

  spellPlayCondition(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine).length > 0;
  },
  attachmentHosts(gs, pi, engine) { return attachmentHostsFor(gs, pi, engine); },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const ps = engine.gs.players[ctx.cardOwner];
      const res = await attachToHero(ctx, CARD_NAME, {
        preferCaster: true,
        description: 'Choose a Hero you control (leftmost free Support Zone) or a specific empty Support Zone to attach Call of the Deepsea to.',
        confirmLabel: '🌊 Attach!', animationType: 'deep_sea_bubbles', animOnHero: true,
      });
      if (!res) return;
      engine.log('call_of_the_deepsea_attached', { player: ps?.username, hero: ps?.heroes?.[res.host.heroIdx]?.name });
      engine.sync();
    },

    onCreatureDeath: async (ctx) => {
      const self = ctx.card;
      if (!self || self.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = self.controller ?? self.owner;
      const tod = ctx.creature;
      if (!tod?.name) return;
      // In der Support Zone eines EIGENEN Helden (Seite des Platzes).
      if (tod.owner !== pi) return;
      const heroIdx = tod.heroIdx, slotIdx = tod.zoneSlot;
      if (heroIdx == null || heroIdx < 0 || slotIdx == null || slotIdx < 0) return;
      if (gs.hoptUsed?.[`${hoptKey(self)}:${pi}`] === gs.turn) return;
      const ps = gs.players[pi];

      // „delete it": die besiegte Karte muss in einer Ablage liegen.
      const stapelBesitzer = tod.originalOwner ?? tod.owner;
      if (!(gs.players[stapelBesitzer]?.discardPile || []).includes(tod.name)) return;
      if (!engine.pileOutAllowed(stapelBesitzer, 'discard', { source: CARD_NAME })) return;
      // Derselbe Platz muss frei sein.
      if (engine.supportSlotBelegt(pi, heroIdx, slotIdx)) return;
      const karten = kandidaten(engine, pi, heroIdx, tod.name);
      if (karten.length === 0) return;

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
        description: `${tod.name} was defeated. Delete it and summon a Creature with a different name from your hand or discard pile into the same Support Zone as an additional Action?`,
        cards: karten, confirmLabel: '🌊 Summon!', cancellable: true, cancelLabel: 'No',
      });
      if (!wahl || wahl.cancelled || !wahl.cardName) return;
      const quelle = wahl.source === 'discard' ? 'discard' : 'hand';
      const name = wahl.cardName;
      // Brett kann sich waehrend der Wahl gedreht haben.
      if (!kandidaten(engine, pi, heroIdx, tod.name).some(k => k.name === name && k.source === quelle)) {
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'no_target' });   // v1360
        return;
      }
      if (engine.supportSlotBelegt(pi, heroIdx, slotIdx)) {
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'zone_taken' });   // v1360
        return;
      }
      if (!engine.claimHOPT(hoptKey(self), pi)) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      engine._broadcastEvent('play_zone_animation', {
        type: 'deepsea_summon_whirlpool', owner: pi, heroIdx, zoneSlot: slotIdx,
      });
      await engine._delay(450);

      // ① delete it
      const geloescht = await engine.deleteFromPile(stapelBesitzer, 'discard', tod.name, { source: CARD_NAME });
      if (!geloescht) {
        if (gs.hoptUsed) delete gs.hoptUsed[`${hoptKey(self)}:${pi}`];
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'delete_failed' });
        return;
      }
      // v1359: der Platz kann waehrend des Loeschens belegt worden sein.
      if (engine.supportSlotBelegt(pi, heroIdx, slotIdx)) {
        engine.log('call_of_the_deepsea_fizzle', { player: ps.username, card: name });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'zone_taken' });
        return;
      }
      // ② summon … as an additional Action
      const neu = await engine.summonFromPile(pi, quelle, name, heroIdx, slotIdx, {
        source: CARD_NAME, alsZusatzaktion: true,
      });
      if (!neu) {
        engine.log('call_of_the_deepsea_fizzle', { player: ps.username, card: name });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'summon_refused' });
        return;
      }
      engine.log('call_of_the_deepsea', {
        player: ps.username, card: CARD_NAME, deleted: tod.name, target: name, from: quelle,
        hero: ps.heroes?.[heroIdx]?.name || null,
      });
      engine.sync();
    },
  },

  // CPU: nimmt immer an und waehlt die staerkste Creature (Level, dann HP).
  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME || p?.type !== 'cardGallery') return undefined;
    const db = engine._getCardDB();
    let best = null, bestWert = -Infinity;
    for (const c of (p.cards || [])) {
      const cd = db[c.name];
      if (!cd) continue;
      const wert = (cd.level || 0) * 1000 + (cd.hp || 0) + (c.source === 'discard' ? 1 : 0);
      if (wert > bestWert) { bestWert = wert; best = c; }
    }
    return best ? { cardName: best.name, source: best.source } : undefined;
  },
};
