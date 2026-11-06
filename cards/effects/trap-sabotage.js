'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Trap Sabotage"
//  Spell (Normal, Destruction Magic Lv0), PP SOD
//
//  „Choose a face-down Surprise your opponent controls and send it to the discard pile. Your opponent must send all copies of that Surprise from their hand and deck to
//   their discard pile. If the user has at least Destruction Magic 1, this counts as an additional Action."
//
//  ── ZIELE: VERDECKTE SURPRISES, DIE DER GEGNER KONTROLLIERT ──────────────
//  • Karten in einer Surprise Zone, die verdeckt liegen (`faceDown`) und den Untertyp „Surprise" tragen — nach KONTROLLE (`engine._getAllSurpriseEntries`: auch die Zone eines
//    Helden, den der Gegner gerade geliehen hat);
//  • verdeckte Surprise-Creatures in den Support Zones eines Bakhm („face-down Surprise" auch dort).
//  NICHT wählbar: offene Karten (Spider Silk Bridge, Glass Wall und andere, die nach der Aktivierung offen liegen bleiben — der Text sagt „face-down"), festgesetzte
//  (`immovable`) Karten und Cardinal Beasts. Eine verdeckte Nicht-Surprise (Create Secret Room) ist keine Surprise: wie bei Detection (Al, Q163) wird sie dem Wirker einmal gezeigt
//  (er bestätigt wie bei einer Suche), bleibt verdeckt liegen und ist kein Ziel. Die Namen verdeckter Ziele sieht der Wähler nicht (Name leer); erst in der Ablage liegt die Karte offen.
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Zielwahl (`promptEffectTarget`, abbrechbar — dann bleibt die Karte auf der Hand). Schutz vor Auswahl und die Fenster der Zielwahl macht der Zielwähler selbst. Helden und Karten in den
//     Support Zonen stehen AUSGEGRAUT in der Liste (`ausgegrauteRestkarten`), damit man nicht intuitiv darauf klickt.
//  2. Bild (`play_zone_animation` `trap_burn`, Pixelart): ein Feuerball fliegt vom Wirker auf die Karte, Flammen schlagen hoch, die Karte verkohlt von unten nach oben und zerfällt
//     zu Asche. Im verkohlten Moment (`BRAND_MS`) wird sie abgelegt — im Skript wie bei Breakthrough: Surprise Zone `actionDestroyCard` (das Fenster „von deiner Seite abgelegt" der
//     Aquatic-Karten und `onSurpriseDiscarded` laufen mit), Bakhm-Slot `sendBoardCardToDiscard` (abgelegt, nicht „besiegt"). Die Karte geht in die Ablage ihres ursprünglichen Besitzers.
//  3. „Your opponent must send all copies of that Surprise from their hand and deck to their discard pile" — der Gegner = der KONTROLLEUR der gewählten Surprise. Gleichnamig heißt
//     gleicher BASISNAME (v875: „Pawn of Kings [B]" und „[W]"). Die Kopien aus der Hand gehen einzeln über `actionDiscardHandCard` (On-Discard-Hooks, Flug) — EIN Fenster
//     „Hand-Interaktion / discard" (Ambush the Scout) für alle Kopien, Boris darf den erzwungenen Abwurf ignorieren (`borisVerzicht`); die Kopien im Deck wandern über `takeFromPile`
//     (Stapel-Sperren) in die Ablage, mit EINER gesammelten Deck→Ablage-Animation (Muster Pusher). Das Deck wird nicht gemischt, nichts bleibt sichtbar außer der Ablage.
//     Dieser Satz hängt NICHT am Ablegen der gewählten Karte: auch wenn die Karte selbst nicht abgelegt werden konnte (etwas verhindert es), muss der Gegner die Kopien abwerfen.
//     Hat die gewählte Surprise den Platz inzwischen von selbst verlassen (reagiert und aktiviert), verpufft der Zauber — ohne Karte gibt es keinen Namen.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „If the user has at least Destruction Magic 1, this counts as an additional Action" → `inherentAction` als FUNKTION, je Held (`effectiveSchoolLevelForCaster`). Die Karte selbst ist Stufe 0:
//  ein Held ohne Destruction Magic kann sie wirken, bekommt aber keine Zusatzaktion (sie kostet dann die Aktion; in der Main Phase ist sie für ihn nur mit Destruction Magic 1 spielbar).
//
//  ── ANNAHMEN ────────────────────────────────────────────────────────────
//  „Your opponent" = der Kontrolleur der gewählten Surprise (im 1-gegen-1 der Gegner; im Skill Test mit mehreren Gegnern der, dessen Surprise gewählt wurde).
//  Erste-Runden-Schutz des Gegners: die Karte ist unspielbar (`blockedByFirstTurnProtection`) — sie träfe nur die Gegnerseite.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Mangels Wissen über verdeckte Karten wählt die CPU zufällig eine der wählbaren Surprises (Namen sind verdeckt).
// ═══════════════════════════════════════════

const { baseCardName } = require('./_hooks');
const { ausgegrauteRestkarten } = require('./_target-dim-shared');

const CARD_NAME = 'Trap Sabotage';
const SCHULE = 'Destruction Magic';
const BRAND_MS = 1130;       // die Karte ist verkohlt (Animation ~1030 ms + 100 ms Einbau-Versatz des Clients) — jetzt wird sie abgelegt
const DAUER_MS = 1800;       // Länge der Animation (deckt sich mit `trap_burn` im Client)
const NACH_MS = 560;         // Asche noch ein Stück aufsteigen lassen, bevor der Zauber endet

/** Hat die Karte den Untertyp „Surprise"? (Create Secret Room legt auch Nicht-Surprises verdeckt in die Zone.) */
function istSurpriseName(engine, name) {
  return String(engine._getCardDB()[name]?.subtype || '').toLowerCase() === 'surprise';
}

/** Alle wählbaren verdeckten Surprises, die ein Gegner von `pi` kontrolliert, als Zielobjekte der Zielwahl. */
function surpriseZiele(engine, pi) {
  const out = [];
  for (const oi of engine.opponentsOf(pi)) {
    for (const e of engine._getAllSurpriseEntries(oi)) {
      const seite = e.seite ?? oi;
      const inst = e.isBakhmSlot
        ? engine.cardInstances.find(c => c.owner === seite && c.zone === 'support' && c.heroIdx === e.heroIdx && c.zoneSlot === e.zoneSlot && c.name === e.cardName)
        : engine.cardInstances.find(c => c.owner === seite && c.zone === 'surprise' && c.heroIdx === e.heroIdx && c.name === e.cardName);
      if (!inst || !inst.faceDown) continue;                                // „face-down": offen liegende Karten sind kein Ziel
      if (inst.counters?.immovable || inst.counters?._cardinalImmune) continue;
      if (!e.isBakhmSlot && !istSurpriseName(engine, inst.name)) continue;  // verdeckte Nicht-Surprise (Create Secret Room)
      if (e.isBakhmSlot) {
        out.push({
          id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', zoneType: 'support',
          owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: '',
          cardInstance: inst, _cardInstance: inst, controller: oi,
        });
      } else {
        out.push({
          id: `surprise-${seite}-${inst.heroIdx}`, type: 'surprise', zoneType: 'surprise',
          owner: seite, heroIdx: inst.heroIdx, cardName: '',
          cardInstance: inst, _cardInstance: inst, controller: oi,
        });
      }
    }
  }
  return out;
}

/** Verdeckte Nicht-Surprises in den Surprise Zones der Gegner (Create Secret Room): werden dem Wirker einmal gezeigt, sind aber kein Ziel. */
function versteckteNichtSurprises(engine, pi) {
  const out = [];
  for (const oi of engine.opponentsOf(pi)) {
    for (const e of engine._getAllSurpriseEntries(oi)) {
      if (e.isBakhmSlot) continue;
      const seite = e.seite ?? oi;
      const inst = engine.cardInstances.find(c => c.owner === seite && c.zone === 'surprise' && c.heroIdx === e.heroIdx && c.name === e.cardName);
      if (!inst || !inst.faceDown) continue;
      if (!istSurpriseName(engine, inst.name)) out.push({ cardName: inst.name, seite, heroIdx: e.heroIdx, oi });
    }
  }
  return out;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  blockedByFirstTurnProtection: true,      // trifft nur die Gegnerseite

  // „If the user has at least Destruction Magic 1, this counts as an additional Action" — je Held.
  inherentAction(gs, pi, heroIdx, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    let lvl = 0;
    try { lvl = eng.effectiveSchoolLevelForCaster(SCHULE, pi, heroIdx) || 0; } catch { lvl = 0; }
    return lvl >= 1;
  },

  /** Grau, solange der Gegner keine wählbare verdeckte Surprise kontrolliert. */
  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    return surpriseZiele(eng, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const heroSeite = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[heroSeite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      let ziele = surpriseZiele(engine, pi);
      if (ziele.length === 0) { gs._spellCancelled = true; return; }

      // Verdeckte Nicht-Surprises (Create Secret Room) einmal zeigen — wie bei Detection (Q163): der Wirker bestätigt, die Karte bleibt verdeckt und ist kein Ziel.
      for (const v of versteckteNichtSurprises(engine, pi)) {
        engine.log('trap_sabotage_peek', { player: ps.username, hero: gs.players[v.seite]?.heroes?.[v.heroIdx]?.name });
        await engine.promptGeneric(pi, {
          type: 'deckSearchReveal',
          cardName: v.cardName,
          searcherName: gs.players[v.oi]?.username || 'Opponent',
          title: CARD_NAME,
          cancellable: false,
        });
      }

      // ── 1. Zielwahl ──
      const gewaehlt = await engine.promptEffectTarget(pi, [...ziele, ...ausgegrauteRestkarten(engine, ziele)], {
        title: CARD_NAME, source: CARD_NAME,
        description: "Choose a face-down Surprise your opponent controls. It is sent to the discard pile, and every copy in their hand and deck follows.",
        confirmLabel: '🔥 Burn it!', confirmClass: 'btn-danger',
        maxTotal: 1, exclusiveTypes: true, maxPerType: { surprise: 1, equip: 1 },
        cancellable: true,
      });
      const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
      // Nach der Abfrage neu einsammeln — das Brett kann sich bewegt haben (Reaktionsfenster der Zielwahl).
      ziele = surpriseZiele(engine, pi);
      const ziel = id && ziele.find(z => z.id === id);
      if (!ziel?.cardInstance) {
        // Von einer Reaktion in der Zielwahl negiert: der Zauber ist gespielt und verbraucht. Sonst echter Abbruch → die Karte bleibt auf der Hand.
        if (id || gs._spellNegatedByEffect || gs._zielNegiertDurchSchutz) { delete gs._zielNegiertDurchSchutz; engine.sync(); return; }
        gs._spellCancelled = true;
        return;
      }
      delete gs._zielNegiertDurchSchutz;
      const inst = ziel.cardInstance;
      const name = inst.name;
      const kontrolleur = ziel.controller;
      const ops = gs.players[kontrolleur];

      // ── 2. Bild: Feuerball, Flammen, Asche ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'trap_burn', zoneType: 'board', owner: ziel.owner, heroIdx: -1, zoneSlot: -1, duration: DAUER_MS,
        targets: [{
          owner: ziel.owner, heroIdx: ziel.heroIdx,
          ...(ziel.type === 'surprise' ? { zoneType: 'surprise' } : { zoneSlot: ziel.slotIdx }),
        }],
        originOwner: heroSeite, originHeroIdx: heroIdx, originZoneSlot: -1,
      });
      await engine._delay(BRAND_MS);

      // ── 3. Ablegen ──
      const noch = engine.cardInstances.find(c => c.id === inst.id && (c.zone === 'surprise' || c.zone === 'support'));
      if (!noch) { engine.log('trap_sabotage_fizzle', { player: ps.username }); engine.sync(); return; }
      const quelle = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, heroOwner: heroSeite };
      const vorher = noch.zone;
      if (vorher === 'surprise') {
        await engine.actionDestroyCard(quelle, noch, { sourceName: CARD_NAME });
      } else {
        await engine.sendBoardCardToDiscard(noch, { source: quelle, sourceName: CARD_NAME, sourceOwner: pi });
      }
      const abgelegt = noch.zone !== vorher;
      engine.sync();

      // ── 4. Alle Kopien aus Hand und Deck des Kontrolleurs ──
      const gleich = (n) => baseCardName(n) === baseCardName(name);
      let ausHand = 0, ausDeck = 0;
      if (ops) {
        // Hand: ein Fenster für alle Kopien; Boris darf den erzwungenen Abwurf ignorieren.
        const anzahl = (ops.hand || []).filter(gleich).length;
        let weiter = anzahl > 0;
        if (weiter && await engine.checkHandInteractionReaction(kontrolleur, 'discard', { byPi: pi, count: anzahl, sourceName: CARD_NAME })) weiter = false;
        if (weiter && await engine.borisVerzicht(kontrolleur, anzahl, { source: CARD_NAME, sourceOwner: pi })) weiter = false;
        let waechter = 0;
        while (weiter && waechter++ < 60) {
          const idx = (ops.hand || []).findIndex(gleich);
          if (idx < 0) break;
          const ok = await engine.actionDiscardHandCard(kontrolleur, ops.hand[idx], idx, { source: CARD_NAME, sourceOwner: pi, _skipHandInteractionCheck: true });
          if (!ok) break;
          ausHand++;
        }
        // Deck: alle Kopien, gesammelte Animation (Deck-Karten sind keine verfolgten Instanzen — Muster Pusher).
        const treffer = [];
        for (let i = (ops.mainDeck || []).length - 1; i >= 0; i--) {
          if (!gleich(ops.mainDeck[i])) continue;
          const nm = ops.mainDeck[i];
          if (await engine.takeFromPile(ops, 'deck', i, { source: CARD_NAME, sourceOwner: pi })) treffer.push(nm);
        }
        if (treffer.length > 0) {
          for (const n of treffer) ops.discardPile.push(n);
          engine._broadcastEvent('deck_to_discard_animation', { owner: kontrolleur, cardNames: treffer.slice(), source: CARD_NAME });
          ausDeck = treffer.length;
        }
      }

      engine.log('trap_sabotage', {
        player: ps.username, opponent: ops?.username, card: name, discarded: abgelegt, fromHand: ausHand, fromDeck: ausDeck,
      });
      engine.sync();
      await engine._delay(NACH_MS);
    },
  },

  /** CPU: mangels Wissen über verdeckte Karten eine zufällige wählbare Surprise; ohne Ziel abbrechen. */
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'deckSearchReveal' && promptData?.title === CARD_NAME) return { confirmed: true };
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = promptData || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    return [frei[Math.floor(Math.random() * frei.length)].id];
  },
};
