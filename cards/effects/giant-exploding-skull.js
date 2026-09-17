// ═══════════════════════════════════════════
//  CARD EFFECT: „Giant Exploding Skull"
//  Creature (Destruction Magic / Summoning Magic Lv1, 1 HP)
//
//  "You may once per turn defeat this Creature. When this Creature is
//   defeated by a Creature's effect or damage inflicted by a Creature's
//   effect, defeat all Creatures on the board."
//
//  ── DIE BEIDEN HAELFTEN GREIFEN INEINANDER ────────────────────────
//  ★ Der Selbstmord IST ein Kreatur-Effekt — naemlich der eigene. Wer
//  den Schaedel per Knopfdruck sprengt, loest damit die zweite Haelfte
//  aus; das ist offensichtlich der Zweck der Karte und kein Nebenweg.
//  Der Selbstmord meldet sich deshalb mit dem eigenen Namen als Quelle
//  an, damit die Erkennung unten greift.
//
//  ── „BY A CREATURE'S EFFECT OR DAMAGE INFLICTED BY ONE" ───────────
//  Zwei Wege, beide erkennbar:
//    • SCHADEN aus einem Kreatur-Effekt traegt den Schadenstyp
//      `'creature'` — so setzt ihn „Exploding Skull" fuer genau diese
//      Bedeutung („damage from a Creature's effect").
//    • ZERSTOERUNG durch einen Kreatur-Effekt: die Quelle traegt den
//      Namen der Kreatur, ihr Kartentyp ist 'Creature' (oder 'Token').
//
//  ★ ALLES ANDERE LOEST NICHT AUS. Ein Spell, ein Attack, ein Artefakt
//  oder ein Heldeneffekt sprengt den Schaedel wirkungslos — das ist die
//  eigentliche Bremse der Karte und der Grund, warum sie trotz
//  Brett-Wischer spielbar ist. Wer hier grosszuegig erkennt, macht aus
//  ihr eine ganz andere Karte.
//
//  ── „DEFEAT ALL CREATURES ON THE BOARD" ──────────────────────────
//  BEIDE Seiten, ohne Ausnahme — auch die eigenen. Der Schaedel selbst
//  ist zu diesem Zeitpunkt schon draussen.
//
//  ★ ZERSTOERUNGS-KLAMMER (v1057): hier fallen viele Karten auf einmal,
//  „Enhanced Guard Dog" darf also nicht feuern. Gezaehlt wird die ECHTE
//  Menge; bleibt am Ende nur eine Kreatur uebrig, ist es korrekt eine
//  Einzelzerstoerung.
// ═══════════════════════════════════════════

const CARD_NAME = 'Giant Exploding Skull';

/**
 * Kam der Tod aus einem KREATUR-Effekt?
 *
 * Bewusst eng: nur der Schadenstyp `'creature'` und Quellen, die
 * wirklich eine Kreatur sind. Ein Heldeneffekt, Spell, Attack oder
 * Artefakt zaehlt NICHT.
 */
function vonKreaturEffekt(engine, ctx) {
  if (ctx.type === 'creature') return true;
  const src = ctx.source;
  const name = (typeof src === 'string') ? src : src?.name;
  if (!name) return false;
  const cd = engine._getCardDB()[name];
  if (!cd) return false;
  return cd.cardType === 'Creature' || cd.cardType === 'Token';
}

/** Alle Kreaturen auf dem Brett, beide Seiten. */
function alleKreaturen(engine) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd) continue;
    const typ = (cd.cardType || '');
    if (typ !== 'Creature' && typ !== 'Token') continue;
    out.push(inst);
  }
  return out;
}

module.exports = {
  activeIn: ['support'],

  // ── „You may once per turn defeat this Creature." ────────────────
  // Die Einmal-pro-Runde-Grenze fuehrt die Engine selbst ueber
  // `creature-effect:<instId>` — die Karte braucht keinen eigenen
  // Zaehler.
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    return !!inst && inst.zone === 'support';
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const pi = inst.controller ?? inst.owner;

    const ja = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      showCard: CARD_NAME,
      message: `Defeat ${CARD_NAME}? If it is defeated by a Creature's effect, ALL Creatures on the board are defeated.`,
      confirmLabel: '💀 Blow it up!',
      cancelLabel: 'Not now',
      cancellable: true,
    });
    if (!ja) return false;
    if (inst.zone !== 'support') return false;

    // ★ Als EIGENER Kreatur-Effekt sterben — nur so greift die zweite
    // Haelfte. Die Quelle nennt deshalb den Schaedel selbst.
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, controller: pi, heroIdx: inst.heroIdx },
      inst,
      { sourceOwner: pi, sourceName: CARD_NAME, fireCreatureDeath: true },
    );
    engine.log('giant_exploding_skull_selfdestruct', {
      player: engine.gs.players[pi]?.username,
    });
    engine.sync();
    return true;
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      const tot = ctx.creature;
      // Nur der eigene Tod zaehlt — der Hook feuert fuer jeden Lauscher.
      if (!inst || !tot || tot.instId !== inst.id) return;
      if (!vonKreaturEffekt(engine, ctx)) return;

      // ══ ★★ ZWEI RIEGEL GEGEN DIE ENDLOSSCHLEIFE (v1124) ══════════
      //
      // Al 15.9.: „Der Versuch, Giant Exploding Skull auszuloesen,
      // erzeugt (vermutlich) unendlich viele Kopien von Skull, die dann
      // zum Discard gehen! BEIDE SPIELER hatten je einen."
      //
      // Genau das war es. Die Kette ist an sich RICHTIG — die Explosion
      // ist ein Kreatur-Effekt, also loest ein zweiter Skull, den sie
      // mitnimmt, seinerseits aus (so steht es auf der Karte). Falsch
      // war nur, dass sie nie endete:
      //
      //   A explodiert → toetet B → B explodiert → toetet A
      //
      // A lag zu diesem Zeitpunkt noch in `support` (sein Tod wurde ja
      // gerade erst abgearbeitet), wurde also ein ZWEITES Mal zerstoert,
      // feuerte erneut … und jede Runde legte eine weitere Kopie in die
      // Ablage.
      //
      //   ① `_skullExploded` — jede Instanz explodiert HOECHSTENS EINMAL.
      //   ② `_skullExploding` — wer gerade explodiert, ist kein ZIEL.
      //      Ohne ihn zerstoerte B den noch auf dem Brett stehenden A
      //      ein zweites Mal.
      //
      // Beide zusammen machen aus der Schleife eine endliche Kette:
      // jeder Skull auf dem Brett kommt genau einmal dran.
      if (inst._skullExploded) return;
      inst._skullExploded = true;
      inst._skullExploding = true;

      const opfer = alleKreaturen(engine)
        .filter(c => c.id !== inst.id && !c._skullExploding);
      if (opfer.length === 0) { inst._skullExploding = false; return; }

      // ★★ v1147 (Waechter `check-triggered-reveal`): Auftritt in dem
      // Moment, in dem die Explosion wirklich ausloest.
      await engine.showTriggeredEffect(CARD_NAME);

      const quelle = {
        name: CARD_NAME,
        owner: inst.owner,
        controller: inst.controller ?? inst.owner,
        heroIdx: inst.heroIdx,
      };
      // ★ v1125 (Al 15.9.): „Fuege eine riesige, ueber dem Skull selbst
      // zentrierte Explosion hinzu!"
      //
      // Zentriert auf die EIGENE Zone — die Karte ist die Bombe, nicht
      // das Brett. Sie laeuft VORAUS, damit der Knall kommt, bevor die
      // Opfer fallen; sonst raeumt das Brett sich still ab und die
      // Explosion erklaert nichts mehr.
      //
      // Hier steht die Animation richtig VOR den Zerstoerungen und
      // trotzdem hinter dem verbindlichen Punkt (v736/v1122): wir sind
      // im Todes-Hook, es gibt nichts mehr abzubrechen.
      // ★★ v1126 (Als Beobachtung 15.9.): „Wenn mein Giant Exploding
      // Skull einen gegnerischen hochjagt, wird dieser, nachdem er schon
      // visuell zum Discard geflogen ist, noch mal in seiner Support
      // Zone sichtbar."
      //
      // Der Grund steht im Motor selbst: der Todes-Hook laeuft in einem
      // Fenster, in dem „die Support Zone bereits leer, die Instanz aber
      // noch als 'support' markiert" ist. Alles, was in diesem Fenster
      // einen Zustand veroeffentlicht — unsere eigene Explosion mit
      // ihrer Wartezeit, und jede Folge-Zerstoerung — zeigt die Karte
      // deshalb noch einmal an ihrem alten Platz.
      //
      // Wir merken uns den Platz fuer die Animation und setzen die Marke
      // SOFORT auf ihren Endstand. Der Zerstoerungspfad tut das eine
      // Zeile spaeter ohnehin; wir ziehen es nur vor, damit kein
      // Zwischenstand mehr luegt.
      // ★★ v1127 — MEIN v1126-EINGRIFF WAR FALSCH UND SCHAEDLICH.
      //
      // Ich hatte hier `inst.zone = 'discard'` gesetzt, um den
      // Zwischenstand „ehrlich" zu machen. Genau das bricht aber den
      // Mechanismus, der das Problem seit v898 loesen soll:
      // `creatureCounters` wird im Server mit
      //     if (inst.zone !== 'support') continue;
      // gebaut. Eine Instanz, die nicht mehr `support` ist, liefert also
      // GAR KEINE Zaehler — auch nicht die Marke `_dying`, an der der
      // Client erkennt, dass er den Platz leer zeichnen soll.
      //
      // Mein „Fix" hat der Karte damit genau die Abschirmung genommen,
      // die sie brauchte. Die Marke bleibt jetzt unangetastet; die
      // Instanz liest waehrend der Hooks weiter `support`, so wie der
      // Motor es ausdruecklich vorsieht.
      const platz = { owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot };

      engine._broadcastEvent('play_zone_animation', {
        type: 'skull_detonation',
        owner: platz.owner, heroIdx: platz.heroIdx, zoneSlot: platz.zoneSlot,
      });
      await engine._delay(520);

      engine.log('giant_exploding_skull_wipe', {
        player: engine.gs.players[inst.controller ?? inst.owner]?.username,
        anzahl: opfer.length,
      });

      // ★ Zerstoerungs-Klammer: hier faellt nie nur eine Karte.
      engine.beginDestroyScope(opfer.length);
      try {
        for (const ziel of opfer) {
          if (ziel.zone !== 'support') continue;   // schon weg
          await engine.actionDestroyCard(quelle, ziel, {
            sourceOwner: quelle.controller, sourceName: CARD_NAME,
            fireCreatureDeath: true,
          });
        }
      } finally {
        engine.endDestroyScope();
        inst._skullExploding = false;
      }
      engine.sync();
    },
  },

  /**
   * CPU: der Knopf ist eine echte Entscheidung (er raeumt auch das
   * eigene Brett ab), also KEINE pauschale Zusage. Ja nur, wenn der
   * Gegner mehr Kreaturen verliert als man selbst.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'confirm') return undefined;
    const pi = engine._cpuPlayerIdx ?? engine.gs.activePlayer;
    let eigene = 0, fremde = 0;
    for (const inst of alleKreaturen(engine)) {
      if ((inst.controller ?? inst.owner) === pi) eigene++; else fremde++;
    }
    // Der Schaedel selbst zaehlt bei den eigenen mit und geht ohnehin.
    return { confirmed: fremde > Math.max(0, eigene - 1) };
  },
};
