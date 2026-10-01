// ═══════════════════════════════════════════
//  CARD EFFECT: "Fun-Fun Circus Clown"
//  Creature (Magic Arts / Summoning Magic Lv1, Normal, 10 HP) — PP MBS
//
//  „At the end of your opponent's turn, you may remove 1 Applause Counter
//   from any card on your side of the board to immediately summon this
//   Creature as an additional Action. You may once per turn place 1
//   Applause Counter on this Creature for every other "Fun-Fun Circus"
//   Creature on the board OR place 1 Applause Counter on every other
//   "Fun-Fun Circus" Creature on the board."
//
//  ── ① AUS DER HAND, AM ENDE DES GEGNERZUGES ────────────────────────
//  Hook `onTurnEnd` fuer die Hand-Instanz; nur wenn der GEGNER am Zug
//  ist. Angeboten wird nur, wenn (a) eine meiner Creatures mindestens
//  einen Applause Counter traegt und (b) der Clown regulaer beschwoerbar
//  ist (tauglicher Held mit BEIDEN Schulen Lv1, freie Zone). Ablauf:
//  Bestaetigen → Counter-Quelle waehlen (bei mehreren) → Zone waehlen →
//  ERST DANN wird der Counter entfernt (Zusagepunkt = `nachZonenwahl`) →
//  Beschwoerung „as an additional Action" (`sofortAusHandBeschwoeren`).
//  Mehrere Clowns in der Hand: das Angebot wiederholt sich, solange
//  Counter und Clowns da sind — jeder Clown kostet einen Counter.
//
//  ── ② AKTIVER EFFEKT (frei, einmal pro Zug) ─────────────────────────
//  Wahl: (A) N Counter auf DIESEN Clown, N = Zahl der ANDEREN Fun-Fun-
//  Circus-Creatures auf dem Brett, ODER (B) je 1 Counter auf JEDE andere
//  Fun-Fun-Circus-Creature. „On the board" = beide Seiten (Auslegung).
//  Platziert wird ueber `placeApplause` (jeder Counter zaehlt fuer den
//  Elephant in der Hand). Nur nutzbar, wenn es eine andere gibt.
// ═══════════════════════════════════════════

const {
  circusCreatures, placeApplause, removeApplause, zaehler, istBrettCreature,
} = require('./_applause-shared');
const { eligibleSummonZones, sofortAusHandBeschwoeren } = require('./_summon-eligibility');

const CARD_NAME = 'Fun-Fun Circus Clown';

/** Meine Creatures mit mindestens einem Applause Counter. */
function meineZaehlerTraeger(engine, pi) {
  return engine.cardInstances.filter(i =>
    istBrettCreature(engine, i) && (i.controller ?? i.owner) === pi && zaehler(i) > 0);
}

/** Eine Angebotsrunde. Rueckgabe: weiter anbieten? (false = Schluss.) */
async function angebotsRunde(engine, pi, runde) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!(ps.hand || []).includes(CARD_NAME)) return false;
  const traeger = meineZaehlerTraeger(engine, pi);
  if (traeger.length === 0) return false;
  if (eligibleSummonZones(engine, pi, CARD_NAME, { nachKontrolle: true }).length === 0) return false;

  const ja = await engine.promptGeneric(pi, {
    type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
    message: `Remove 1 Applause Counter from a card on your side to immediately summon ${CARD_NAME} from your hand as an additional Action?`,
    confirmLabel: '🤡 Summon!', cancelLabel: 'No', cancellable: true,
  });
  if (!engine._confirmSaidYes(ja)) return false;

  // Counter-Quelle waehlen (bei nur einer automatisch).
  let quelle = traeger[0];
  if (traeger.length > 1) {
    const zonen = traeger.map(i => ({
      owner: engine.physicalSide(i), heroIdx: i.heroIdx, slotIdx: i.zoneSlot,
      label: `${i.name} — ${zaehler(i)} Applause`,
    }));
    const wahl = await engine.promptGeneric(pi, {
      type: 'zonePick', title: CARD_NAME,
      description: 'Choose the card to remove 1 Applause Counter from.',
      zones: zonen, cancellable: true, heroShortcut: false,
    });
    if (!wahl || wahl.cancelled) return false;
    quelle = traeger.find(i => i.heroIdx === wahl.heroIdx && i.zoneSlot === wahl.slotIdx
      && engine.physicalSide(i) === (wahl.owner ?? engine.physicalSide(i))) || null;
    if (!quelle) return false;
  }

  const ok = await sofortAusHandBeschwoeren(engine, pi, CARD_NAME, {
    source: CARD_NAME,
    // Zusagepunkt: Zone ist gewaehlt — jetzt kostet es den Counter.
    nachZonenwahl: async () => {
      removeApplause(engine, quelle, 1);
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: `clown:${gs.turn}:${runde}` });
    },
  });
  if (!ok) return false;                                        // Zonenwahl abgebrochen
  engine.log('clown_summon', { player: ps.username, from: quelle.name });
  return true;
}

async function angebotAmZugende(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const ps = gs.players[pi];
  if (!ps || gs.activePlayer === pi) return;                     // nur am Ende des GEGNERZUGES
  if (gs.firstTurnProtectedPlayer === pi) return;
  // Nur die erste Kopie fragt; sie wiederholt das Angebot selbst.
  if (gs._clownAngebot === gs.turn) return;
  gs._clownAngebot = gs.turn;

  for (let runde = 0; runde < 20; runde++) {
    // Jede Runde einzeln abgesichert: ein Fehler in einer Beschwoerung darf
    // die weiteren Clowns am selben Zugende nicht stillschweigend kappen.
    let weiter = false;
    try {
      weiter = await angebotsRunde(engine, pi, runde);
    } catch (err) {
      console.error(`[${CARD_NAME}] Runde ${runde}:`, err.message);
      engine.log('clown_round_error', { player: ps.username, round: runde, error: String(err.message || '').slice(0, 200) });
    }
    if (!weiter) break;
  }
  engine.sync();
}

module.exports = {
  activeIn: ['hand', 'support'],
  creatureEffect: true,

  // CPU: Applause Counter sind fuer die Sofortbewertung unsichtbar — ohne
  // dieses Flag feuert der Clown-Effekt beim CPU nie (gemessen: 0 Zaehler in
  // 6 Partien), und der ganze Archetyp bleibt tot. Gleiche Begruendung wie
  // bei den Cardinal Beasts.
  cpuMeta: { alwaysCommit: true },

  canActivateCreatureEffect(ctx) {
    return circusCreatures(ctx._engine, ctx.card).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    const andere = circusCreatures(engine, inst);
    if (andere.length === 0) return false;
    const n = andere.length;

    const antwort = await engine.promptGeneric(ctx.cardOwner, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: 'Choose how to hand out Applause.',
      options: [
        { id: 'self', label: `👏 ${n} on ${CARD_NAME}`,
          description: `Place ${n} Applause Counter${n === 1 ? '' : 's'} on this Creature (1 for every other "Fun-Fun Circus" Creature on the board).` },
        { id: 'all', label: '👏 1 on each other Circus Creature',
          description: `Place 1 Applause Counter on each of the ${n} other "Fun-Fun Circus" Creature${n === 1 ? '' : 's'} on the board.` },
      ],
      cancellable: true,
    });
    if (!antwort || antwort.cancelled || !antwort.optionId) return false;

    if (antwort.optionId === 'self') {
      await placeApplause(engine, inst, circusCreatures(engine, inst).length, { source: CARD_NAME });
    } else {
      for (const ziel of circusCreatures(engine, inst)) {
        await placeApplause(engine, ziel, 1, { source: CARD_NAME });
      }
    }
    engine.sync();
  },

  // CPU: die Wahl „auf sich selbst" (mehr Counter am Stueck), Bestaetigungen ja.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'optionPicker') return { optionId: 'self' };
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onTurnEnd: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      await angebotAmZugende(ctx);
    },
  },
};
