// ═══════════════════════════════════════════
//  CARD EFFECT: "Enemy of my Enemy"
//  Spell (Magic Arts Lv0, Normal)
//
//  „Choose 2 Creatures your opponent controls. Your opponent must choose one of them and give permanent control of it to you,
//   then the other one is shuffled back into its original owner's deck."
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Der Wirker wählt GENAU 2 gegnerische Kreaturen (`promptMultiTarget`, kein Schaden → `dealsDamage: false`, damit nur die
//     Wählbarkeits-Regeln greifen). Beide müssen übernehmbar sein (kein Cardinal Beast, kein „control cannot change", keine
//     `control_immune`), sonst wären sie keine Option für „give control".
//  2. Der GEGNER (Kontrolleur der beiden) wählt eine davon (Pflichtwahl, nicht abbrechbar). Die gewählte geht dauerhaft an den
//     Wirker (`actionTransferCreature`, der EINE Weg aller Übernahmen) in eine freie Support Zone SEINER Helden — bei mehreren
//     freien Zonen wählt der Wirker die Zone.
//  3. Die andere wird ins Deck ihres URSPRÜNGLICHEN Besitzers (`kartenBesitzerVon`) gemischt. Tokens haben kein Deck: sie
//     verschwinden. Verhindert ein Effekt das Zurückmischen (Hatusbal), bleibt die Kreatur liegen.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Flüge der Engine (Übernahme-Flug, Flug ins Deck); kein eigenes Sprite.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Enemy of my Enemy';
const FLUG_MS = 650;      // Flug der Kreatur ins Deck
const MISCH_MS = 800;     // Länge der Misch-Animation (`deck_shuffle`)

/** Ist `inst` eine gegnerische, übernehmbare Kreatur für `pi`? */
function istZiel(engine, pi, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  const ktrl = inst.controller ?? inst.owner;
  if (ktrl === pi || !engine.opponentsOf(pi).includes(ktrl)) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || !hasCardType(cd, 'Creature') || !engine.isChoosableAsCreature(inst, cd)) return false;
  if (engine.isOmniImmune(inst, pi) || engine.controlIsLocked(inst) || engine.isCreatureImmune(inst, 'control_immune')) return false;
  return true;
}

/** Freie Support Zones der eigenen Helden (Brettseite des Spielers): [{ heroIdx, slotIdx, label }]. */
function freieZonen(engine, pi) {
  const gs = engine.gs;
  const out = [];
  for (const { hero, physOwner, heroIdx } of engine.heroesControlledBy(pi)) {
    if (physOwner !== pi || !hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      const slot = gs.players[pi]?.supportZones?.[heroIdx]?.[si];
      if (Array.isArray(slot) && slot.length === 0) out.push({ heroIdx, slotIdx: si, label: `${hero.name} — Slot ${si + 1}` });
    }
  }
  return out;
}

function zielListe(engine, pi) {
  return engine.cardInstances.filter(c => istZiel(engine, pi, c));
}

/** Wert einer Kreatur für die CPU (Stufe + HP). */
function wert(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || {};
  return (cd.level || 0) * 100 + (cd.hp || 0);
}

module.exports = {
  requiresTarget: true,
  // Boris-Sperre: übernimmt die Kontrolle über gegnerische Ziele.
  takesControlOfTargets: true,

  cpuMeta: { scalesWithSchool: 'Magic Arts' },

  /** Grau, solange keine zwei übernehmbaren gegnerischen Kreaturen oder keine freie eigene Zone da ist. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return false;
    return zielListe(engine, pi).length >= 2 && freieZonen(engine, pi).length > 0;
  },

  /** CPU: als Wirker die zwei stärksten Kreaturen wählen; als Gegner die schwächere hergeben. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = payload || {};
    if (!Array.isArray(validTargets) || config?.title !== CARD_NAME) return undefined;
    const frei = validTargets.filter(t => !t.ineligible && t.cardInstance);
    const sortiert = frei.slice().sort((a, b) => wert(engine, b.cardInstance) - wert(engine, a.cardInstance));
    if (config?.maxTotal === 1) return sortiert.slice(-1).map(t => t.id);   // Gegner: die schwächere hergeben
    return sortiert.slice(0, 2).map(t => t.id);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }
      if (freieZonen(engine, pi).length === 0) { gs._spellCancelled = true; return; }

      // ── 1. Der Wirker wählt zwei gegnerische Kreaturen ──
      const gewaehlt = await ctx.promptMultiTarget({
        side: 'enemy',
        types: ['creature'],
        min: 2, max: 2,
        dealsDamage: false,
        title: CARD_NAME,
        description: 'Choose 2 Creatures your opponent controls. Your opponent gives you one of them; the other is shuffled back into its owner\'s deck.',
        confirmLabel: '⚔️ Choose!',
        confirmClass: 'btn-warning',
        cancellable: true,
        dimUnmetCondition: true,
        condition: (t) => istZiel(engine, pi, t.cardInstance),
      });
      if (!gewaehlt || gewaehlt.length < 2) { gs._spellCancelled = true; return; }
      const insts = gewaehlt.map(t => t.cardInstance
        || engine.cardInstances.find(c => c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx
          && engine.physicalSide(c) === t.owner)).filter(Boolean);
      if (insts.length < 2 || !insts.every(i => istZiel(engine, pi, i))) { gs._spellCancelled = true; return; }

      // ── 2. Der Gegner wählt, welche er hergibt ──
      const gegner = insts[0].controller ?? insts[0].owner;
      const abgabe = await ctx.promptMultiTarget({
        chooser: gegner,
        side: 'my',
        types: ['creature'],
        min: 1, max: 1,
        dealsDamage: false,
        title: CARD_NAME,
        description: `${ps.username}'s ${CARD_NAME}: choose one of these Creatures to give to ${ps.username}. The other one is shuffled back into its owner's deck.`,
        confirmLabel: '🤝 Give!',
        confirmClass: 'btn-warning',
        cancellable: false,
        noSpellCancel: true,
        _skipRedirectCheck: true,
        _skipSurpriseCheck: true,
        _skipPostTargetReactions: true,
        ignoreUntargetable: true,
        condition: (t) => insts.some(i => i === t.cardInstance),
      });
      let geben = abgabe?.[0]?.cardInstance;
      if (!geben || !insts.includes(geben)) {
        // Notfall (Abbruch/Zeitablauf): die schwächere hergeben
        geben = insts.slice().sort((a, b) => wert(engine, a) - wert(engine, b))[0];
      }
      const behalten = insts.find(i => i !== geben);

      // ── 3. Die gewählte geht an den Wirker ──
      let frei = freieZonen(engine, pi);
      let zone = frei[0];
      if (frei.length > 1) {
        const z = await ctx.promptZonePick(frei, {
          title: CARD_NAME,
          description: `Place ${geben.name} into one of your free Support Zones.`,
          cancellable: false,
          heroShortcut: false,
        });
        if (z) zone = frei.find(f => f.heroIdx === z.heroIdx && f.slotIdx === z.slotIdx) || frei[0];
      }
      const vorher = geben.controller ?? geben.owner;
      const nameGeben = geben.name;
      let uebernommen = false;
      if (zone && geben.zone === 'support' && (geben.controller ?? geben.owner) === vorher) {
        const res = await engine.actionTransferCreature(geben, pi, zone.heroIdx, zone.slotIdx, {
          sourceName: CARD_NAME, sourceOwner: pi, controller: pi,
        });
        uebernommen = !!res?.success;
      }

      // ── 4. Die andere wird ins Deck ihres ursprünglichen Besitzers gemischt ──
      const nameAndere = behalten.name;
      let gemischt = false;
      // Cool Rescuer Monia & Co.: „zurück ins Deck" ist ein Effekt auf die Kreatur (Schutzfenster; negiert → sie bleibt liegen).
      const erlaubt = behalten.zone === 'support'
        && await engine.kreaturBetroffen(behalten, 'move', { name: CARD_NAME, owner: pi }, { sourceOwner: pi, detail: 'shuffle' });
      if (erlaubt && behalten.zone === 'support') {
        const besitzer = engine.kartenBesitzerVon(behalten);
        if (engine.isTokenCard(behalten)) {
          await engine.actionMoveCard(behalten, 'deleted', -1, -1, { source: CARD_NAME, _skipReactionCheck: true });
          gemischt = true;
        } else if (gs.players[besitzer] && !engine.shuffleBackIntoOwnDeckBlocked(besitzer)) {
          const seite = engine.physicalSide(behalten);
          engine._broadcastEvent('play_pile_transfer', {
            owner: seite, cardName: behalten.name, from: 'support', to: 'deck',
            fromHeroIdx: behalten.heroIdx, fromSlotIdx: behalten.zoneSlot,
            ...(seite !== besitzer ? { fromOwner: seite, toOwner: besitzer } : {}),
          });
          await engine._delay(FLUG_MS);                    // die Karte fliegt ins Deck, erst DANN wird gemischt
          await engine.runHooks('onCardLeaveZone', {
            card: behalten, leavingCard: behalten, fromZone: 'support',
            fromHeroIdx: behalten.heroIdx, fromZoneSlot: behalten.zoneSlot, fromOwner: seite,
            toZone: 'deck', sourceOwner: pi,
          });
          const zoneArr = gs.players[seite]?.supportZones?.[behalten.heroIdx];
          if (zoneArr?.[behalten.zoneSlot]) {
            const i = zoneArr[behalten.zoneSlot].indexOf(behalten.name);
            if (i >= 0) zoneArr[behalten.zoneSlot].splice(i, 1);
          }
          gs.players[besitzer].mainDeck.push(behalten.name);
          engine.shuffleDeck(besitzer);                     // `deck_shuffle`: Rütteln + Klang auf dem Stapel des Besitzers
          engine.sync();
          await engine._delay(MISCH_MS);
          await engine.noteShuffledBack(besitzer, 1, CARD_NAME);
          engine._untrackCard(behalten.id);
          gemischt = true;
        }
      }

      engine.log('enemy_of_my_enemy', {
        player: ps.username, taken: uebernommen ? nameGeben : null, shuffled: gemischt ? nameAndere : null,
      });
      engine.sync();
    },
  },
};
