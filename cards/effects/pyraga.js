// ═══════════════════════════════════════════
//  CARD EFFECT: „Pyraga"
//  Creature (Summoning Magic Lv 1, 80 HP, PP CROSS)
//
//  „Up to 4 times per turn, when a Creature activates its active effect
//   for the first time that turn while you control this Creature, you
//   may choose a target and deal 80 damage to it."
//
//  BAUART
//  ──────
//  • Ausloeser: `afterCreatureEffect` — das Fenster feuert in BEIDEN
//    Wegen (regulaere Aktivierung im Server und Wiederholung ueber
//    `retriggerCreatureEffect`), und es feuert fuer JEDE Kreatur auf dem
//    Brett. Der Text macht keine Seiteneinschraenkung: auch der
//    Aktiveffekt einer GEGNERISCHEN Kreatur laesst Pyraga feuern.
//
//  • ★ „for the FIRST TIME that turn" (Als Praezisierung 12.9.): gemeint
//    sind Kreaturen, die MEHRFACH je Zug aktivieren koennen — 3-Headed
//    Giant (bis zu dreimal), Elven Leader (Wiederholung je Kreatur).
//    Nur der erste Einsatz einer Kreatur in einem Zug zaehlt, die
//    Wiederholungen nicht. Pyraga fuehrt dafuer ein EIGENES Register je
//    Zug (`_pyragaSeenIds`) statt sich auf fremde Stempel zu verlassen:
//    die Wiederholungswege stempeln unterschiedlich, das Register hier
//    ist unabhaengig davon richtig.
//    Eingetragen wird IMMER, auch wenn der Spieler ablehnt — der
//    Ausloeser hat stattgefunden. Der 4er-Zaehler steigt dagegen nur
//    bei tatsaechlicher Nutzung („UP TO 4 times … you MAY").
//
//  • Beide Zaehler haengen an der INSTANZ, nicht in `counters`: es ist
//    reine Buchhaltung, die weder der Client noch der Puzzle-Editor
//    sehen muss. Zugstempel, damit nichts in den naechsten Zug
//    hineinreicht.
//
//  • ★ EIN GEFALLENES PYRAGA FEUERT NICHT MEHR (Als Befund 12.9.):
//    haben beide Spieler eines und das erste erschiesst das zweite,
//    haengt das tote am selben Ausloeser und kam trotzdem dran. Der
//    Grund: der Tod wird im Schadens-Batch erst NACH der Hook-Runde
//    vollzogen, die Instanz steht also noch in ihrer Zone — nur mit 0
//    HP. Gepruft wird deshalb der HP-Stand, und zwar vor JEDEM Schritt.
//
//  • Animation: die von Fireball (Als Vorgabe) — ein fliegender
//    Feuerball aus Pyragas Zone zum Ziel, beim Aufschlag
//    `flame_strike`. Vorhandene Typen, also kein neuer Klang noetig.
// ═══════════════════════════════════════════

const CARD_NAME = 'Pyraga';
const SCHADEN = 80;
const MAX_PRO_ZUG = 4;
const FLUGZEIT = 520;

/**
 * ★ LEBT PYRAGA NOCH? (v982, Als Befund 12.9.)
 *
 * `zone === 'support'` allein reicht NICHT: der Tod einer Kreatur wird
 * im Schadens-Batch erst NACH der laufenden Hook-Runde vollzogen — die
 * Instanz steht also noch in ihrer Zone, hat aber schon 0 HP. Haben
 * BEIDE Spieler ein Pyraga und das erste erschiesst das zweite, feuerte
 * das bereits tote trotzdem: es haengt am selben Ausloeser.
 * Deshalb wird zusaetzlich der HP-Stand geprueft — und die Pruefung
 * wiederholt sich vor jedem Schritt, weil das Brett sich waehrend der
 * Rueckfrage aendern kann.
 */
function lebt(engine, ich) {
  if (!ich || ich.zone !== 'support') return false;
  if ((ich.counters?.currentHp ?? 0) <= 0) return false;
  return engine.cardInstances.includes(ich);
}

/** Zaehler/Register der Instanz auf den aktuellen Zug bringen. */
function buchhaltung(engine, ich) {
  const turn = engine.gs.turn || 0;
  if (ich._pyragaTurn !== turn) {
    ich._pyragaTurn = turn;
    ich._pyragaSeenIds = new Set();
    ich._pyragaUses = 0;
  }
  return { turn, gesehen: ich._pyragaSeenIds, nutzungen: ich._pyragaUses };
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    projectile: { emoji: '🔥', baseAngle: 90, duration: 520 },
    stagger: 110, flightMs: 330,
    impact: { type: 'flame_strike' }, impactMs: 260,
  },

  activeIn: ['support'],

  // Der „you may"-Confirm ist abbrechbar; ohne Antwort bricht die
  // Engine ihn fuer die CPU pauschal ab (Befund v828). 80 Schaden
  // gratis nimmt sie immer.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    return { confirmed: true };
  },

  hooks: {
    afterCreatureEffect: async (ctx) => {
      const engine = ctx._engine;
      const ich = ctx.card;
      // „while you control this Creature" — und zwar LEBEND (s.o.).
      if (!lebt(engine, ich)) return;

      const ausloeser = ctx.creature;
      if (!ausloeser?.id) return;

      const buch = buchhaltung(engine, ich);
      // Erster Einsatz DIESER Kreatur in diesem Zug?
      if (buch.gesehen.has(ausloeser.id)) return;
      buch.gesehen.add(ausloeser.id);                    // gilt auch bei Ablehnung

      if (buch.nutzungen >= MAX_PRO_ZUG) return;

      const pi = ich.controller ?? ich.owner;
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${ctx.cardName || ausloeser.name} used its effect — deal ${SCHADEN} damage to a target? `
          + `(${MAX_PRO_ZUG - buch.nutzungen} left this turn)`,
        showCard: CARD_NAME,
        confirmLabel: `🔥 ${SCHADEN} damage`,
        cancelLabel: 'No',
        cancellable: true,
      });
      const bestaetigt = typeof engine._confirmSaidYes === 'function'
        ? engine._confirmSaidYes(ja)
        : !!(ja && !ja.cancelled);
      if (!bestaetigt) return;
      if (!lebt(engine, ich)) return;                    // waehrend der Rueckfrage gefallen

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: SCHADEN,
        title: CARD_NAME,
        description: `Deal ${SCHADEN} damage to a target.`,
        confirmLabel: `🔥 ${SCHADEN}!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!ziel) return;                                 // abgebrochen — keine Nutzung
      if (!lebt(engine, ich)) return;                    // waehrend der Zielwahl gefallen

      ich._pyragaUses = buch.nutzungen + 1;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ── Fireball-Bildsprache (Als Vorgabe) ────────────────────────
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: engine.physicalSide ? engine.physicalSide(ich) : pi,
        sourceHeroIdx: ich.heroIdx,
        sourceZoneSlot: ich.zoneSlot,
        targetOwner: ziel.owner,
        targetHeroIdx: ziel.heroIdx,
        targetZoneSlot: ziel.type === 'hero' ? undefined : ziel.slotIdx,
        emoji: '🔥',
        // Das 🔥 zeigt von Natur aus nach OBEN, der Dreh-Rahmen nimmt
        // OSTEN an — `baseAngle: 90` dreht es auf die Flugachse.
        baseAngle: 90,
        emojiStyle: { fontSize: 44 },
        duration: FLUGZEIT,
      });
      await engine._delay(FLUGZEIT);

      if (ziel.type === 'hero') {
        const held = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (!held?.name || held.hp <= 0) return;
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1,
        });
        await ctx.dealDamage(held, SCHADEN, 'creature');
      } else {
        const inst = ziel.cardInstance || engine.findCards({
          controller: ziel.owner, zone: 'support', heroIdx: ziel.heroIdx,
        }).find(c => c.zoneSlot === ziel.slotIdx);
        if (!inst) return;
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx,
        });
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: ich.heroIdx },
          inst, SCHADEN, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('pyraga_burst', {
        player: engine.gs.players[pi]?.username,
        trigger: ausloeser.name, target: ziel.cardName,
        amount: SCHADEN, used: ich._pyragaUses,
      });
      engine.sync();
    },
  },
};
