// ═══════════════════════════════════════════
//  CARD EFFECT: "Resilient Monkee"
//  Creature (Normal, Lv1, 20 HP, Summoning Magic)
//
//  "When you gain 4 or more Gold through an effect, you may immediately
//   summon this Creature from your discard pile as an additional Action by
//   paying that Gold. You can only summon 1 'Resilient Monkee' per turn."
//
//  Ausloeser und Zahlungsregel: siehe `_monkee-shared.js`.
//
//  ── "You can only summon 1 ... per turn" ──
//  HART, pro SPIELER (Unterscheidung aus v249: dieser Wortlaut ist die
//  harte Form — anders als Cheekys blosses "Once per turn"). Zwei
//  Resilient Monkees auf der Hand ergeben also trotzdem nur EINE
//  Beschwoerung je Zug. Gefuehrt ueber `gs.hoptUsed` mit einem Schluessel
//  je Spieler; die Sperre wird ERST beim tatsaechlichen Vollzug gesetzt,
//  ein Ablehnen kostet sie nicht.
//
//  ── "as an additional Action" ──
//  `summonCreatureWithHooks` verbraucht von sich aus keinen Aktionsplatz
//  (Vorbild Green Dragoneer, gleiche Bauart) — es wird also nichts
//  gebucht und nichts zurueckgegeben.
// ═══════════════════════════════════════════

const { monkeeGoldTrigger, eligibleSummonZones, goldSourceVerbraucht, verbraucheGoldSource,
  investHoptUsed, markInvestHopt, payInvestCounters, heroesWithInvest,
} = require('./_monkee-shared');

const CARD_NAME = 'Resilient Monkee';
const HOPT_KEY = (pi) => `monkee-summon:${CARD_NAME}:${pi}`;
const RESOLVING = '_resilientMonkeeResolving';

/** Eigene „Monkee"-Kreaturen auf dem Brett (offen liegend). */
function eigeneMonkeeKreaturen(engine, pi) {
  const { isMonkeeCreature } = require('./_monkee-shared');
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (!isMonkeeCreature(engine, inst)) continue;
    out.push(inst);
  }
  return out;
}

module.exports = {
  activeIn: ['discard', 'support'],

  // v345: OHNE dieses Flag bietet die Engine den Effekt gar nicht an —
  // `creatureEffectScriptAllows` steigt bei `!script.creatureEffect`
  // sofort aus, und `getActivatableCreatures` schickt die Karte dann nie
  // als aktivierbar an den Client. Criminal Monkee hatte es schon, die
  // anderen drei nicht: die Zweitfaehigkeiten aus v343 waren deshalb
  // unausloesbar.
  creatureEffect: true,

  hooks: {
    afterResourceGain: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      if (ctx.card?.zone !== 'discard') return;   // nur die Kopie im Ablagestapel

      const betrag = monkeeGoldTrigger(ctx, pi);
      if (!betrag) return;
      // Hat schon ein anderer Monkee diese Goldquelle genommen? Dann ist
      // sie weg (Als Ruling 8.8.).
      if (goldSourceVerbraucht(ctx)) return;

      // Harte Sperre je Spieler und Zug.
      if (gs.hoptUsed?.[HOPT_KEY(pi)] === gs.turn) return;
      // Wiedereintritts-Riegel: mehrere Kopien im Stapel sind je eigene
      // Listener und wuerden sonst nacheinander fragen, obwohl nur eine
      // Beschwoerung erlaubt ist.
      if (gs[RESOLVING]?.[pi]) return;
      if (!(ps.discardPile || []).includes(CARD_NAME)) return;
      if ((ps.gold || 0) < betrag) return;

      if (eligibleSummonZones(engine, pi, CARD_NAME).length === 0) return;

      const bestaetigt = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `You gained ${betrag} Gold. Pay ${betrag} Gold to summon ${CARD_NAME} from your discard pile as an additional Action?`,
        showCard: CARD_NAME,
        confirmLabel: `🐒 Pay ${betrag} Gold!`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!bestaetigt || bestaetigt.cancelled) return;

      if (!(ps.discardPile || []).includes(CARD_NAME)) return;   // zwischenzeitlich weg

      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[HOPT_KEY(pi)] = gs.turn;
      if (!gs[RESOLVING]) gs[RESOLVING] = {};
      gs[RESOLVING][pi] = true;
      try {
        const bezahlt = await engine.actionSpendGold(pi, betrag);
        if (!bezahlt) {
          delete gs.hoptUsed[HOPT_KEY(pi)];
          return;
        }
        // Die Quelle ist jetzt verbraucht — kein weiterer Monkee reagiert
        // auf dieses Gewinn-Ereignis.
        verbraucheGoldSource(ctx);
        // Zielplatz nach der Zahlung neu bestimmen und den Spieler
        // waehlen lassen, wenn es mehrere Moeglichkeiten gibt — wie bei
        // einer normalen Beschwoerung (Als Vorgabe 8.8.). Nicht
        // abbrechbar: bestaetigt und bezahlt ist bereits verbindlich.
        const zonen = eligibleSummonZones(engine, pi, CARD_NAME);
        if (zonen.length === 0) {
          engine.log('resilient_monkee_fizzle', { player: ps.username, reason: 'no_eligible_caster' });
          return;
        }
        let ziel = zonen[0];
        if (zonen.length > 1) {
          const wahl = await ctx.promptZonePick(zonen, {
            title: CARD_NAME,
            description: `Choose where to summon ${CARD_NAME}.`,
            cancellable: false,
          });
          const gewaehlt = wahl && zonen.find(z =>
            z.heroIdx === wahl.heroIdx && z.slotIdx === (wahl.slotIdx ?? wahl.zoneSlot));
          if (gewaehlt) ziel = gewaehlt;
        }
        engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });

        // `_summonedFromDiscard` ist das kanonische Signal fuer
        // Wiederbelebungs-Auren (Skullmael, Vacarn) — Vorbild
        // `raise-the-minions.js`.
        const res = await engine.actionPlaceCreature(
          CARD_NAME, pi, ziel.heroIdx, ziel.slotIdx,
          {
            source: 'discard', sourceName: CARD_NAME,
            countAsSummon: true, animationType: 'summon',
            fireHooks: true, _summonedFromDiscard: true,
          },
        );
        // `source: 'discard'` heisst: die Primitive nimmt die Karte SELBST
        // aus dem Ablagestapel. Vorher haendisch zu spleissen liess sie
        // dort nicht mehr finden und die Platzierung scheiterte still.
        if (!res?.inst) {
          engine.log('resilient_monkee_fizzle', { player: ps.username, reason: 'place_refused' });
          return;
        }
        engine.log('resilient_monkee_summoned', {
          player: ps.username, goldPaid: betrag, hero: ziel.heroIdx, slot: ziel.slotIdx,
        });
        engine.sync();
      } finally {
        gs[RESOLVING][pi] = false;
      }
    },
  },

  // ══ ZWEITE FAEHIGKEIT (v343): Invest Counter als Kosten ══
  // 10 Invest Counter → eine eigene „Monkee"-Kreatur nimmt bis zum Beginn des naechsten eigenen Zuges keinen Schaden.
  // Die Zaehler kommen von Logan, the Investment Monkee — das ist die
  // Klammer, die ihn in den Archetyp einbindet. Alles Gemeinsame
  // (Kandidatensuche, Auswahl, Abbuchen, Einmal-pro-Zug je Instanz)
  // steht in `_monkee-shared.js`.
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    if (ctx.card?.zone !== 'support') return false;
    if (investHoptUsed(engine.gs, ctx.card)) return false;
    if (heroesWithInvest(engine.gs.players[ctx.cardOwner], 10).length === 0) return false;
    if (eigeneMonkeeKreaturen(engine, ctx.cardOwner).length === 0) return false;
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (ctx.card?.zone !== 'support') return false;
    if (investHoptUsed(engine.gs, ctx.card)) return false;
    const kandidaten = eigeneMonkeeKreaturen(engine, pi);
    if (kandidaten.length === 0) return false;

    // v346 (Als Vorgabe): ganz normaler Ziel-Picker — der Spieler klickt
    // die Kreatur auf dem Brett an, statt einen Namen aus einer Liste zu
    // waehlen. Und ABBRECHBAR.
    //
    // Deshalb steht die Zielwahl VOR der Zahlung: wer abbricht, hat
    // nichts ausgegeben und seine Einmal-pro-Zug-Nutzung noch. Meine
    // erste Fassung buchte zuerst ab — bei einem Abbruch waeren zehn
    // Invest Counter fuer nichts weg gewesen.
    const ziele = kandidaten.map(inst => ({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: inst.owner,
      heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot,
      cardName: inst.name,
      cardInstance: inst,
    }));
    const wahl = await engine.promptEffectTarget(pi, ziele, {
      title: CARD_NAME,
      description: 'Choose a "Monkee" Creature you control to shield from damage.',
      confirmLabel: '🛡️ Shield!',
      cancellable: true,
      greenSelect: true,
      selectCount: 1,
      minSelect: 1,
    });
    const id = Array.isArray(wahl) ? wahl[0] : wahl;
    if (!id) return false;                       // abgebrochen — nichts bezahlt
    const ziel = ziele.find(t => t.id === id)?.cardInstance;
    if (!ziel) return false;

    if (!await payInvestCounters(engine, pi, 10, CARD_NAME)) return false;
    markInvestHopt(engine.gs, ctx.card);
    // v349: Auftritt erst nach bestaetigter Zielwahl (Muster Book of Doom).
    engine.announceActiveEffect();
    if (!ziel.counters) ziel.counters = {};
    // Selbst ablaufender Marker: die Engine wertet ihn in der
    // Schadensstapel-Schleife aus und laesst ihn von allein verfallen.
    // Deshalb haelt der Schutz auch, wenn Resilient Monkee das Brett
    // verlaesst — und braucht keinen Aufraeum-Hook.
    // `gs.turn` zaehlt je HALBZUG hoch, der naechste eigene Zug ist
    // also turn + 2.
    ziel.counters._monkeeShieldUntilTurn = engine.gs.turn + 2;
    // v347: Schild-Animation am Ziel. Der KLANG haengt am Log-Ereignis
    // `resilient_monkee_shield` (zentrale Zuordnung in app-shared.jsx),
    // nicht hier — so klingt es auch beim Zuschauer und im Wiederholer.
    engine._broadcastEvent('play_zone_animation', {
      type: 'monkee_shield',
      owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.zoneSlot,
    });
    await engine._delay(320);
    engine.log('resilient_monkee_shield', {
      player: engine.gs.players[pi]?.username, target: ziel.name,
      untilTurn: ziel.counters._monkeeShieldUntilTurn,
    });
    engine.sync();
    return true;
  },
};
