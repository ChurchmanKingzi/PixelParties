// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Sword - Kunagi"
//  Artifact / Equipment (Idej) — Cost 20 (0 on Idej Lord Shoguwana)
//  (Banned)
//
//  "You can only equip this Artifact to an "Idej" Hero you control.
//   If you equip this Artifact to "Idej Lord Shoguwana", its Cost
//   becomes 0. A Hero can only be equipped with 1 "Idej Sword"
//   Artifact. When the equipped Hero defeats exactly 1 Creature with
//   an Attack, it may immediately perform that Attack again against a
//   different target your opponent controls. For every Creature the
//   equipped Hero defeats, draw 1 card."
//
//  • Cost-0-on-Shoguwana: Idej Lord Shoguwana's `equipCostReduction`.
//  • `afterSpellResolved` watches the equipped Hero's Attacks. A repeat
//    RE-RUNS THE SAME Attack card's `onPlay` (the Bomb Berserker Bartas
//    re-cast pattern) — so it replays that Attack's own animation. The
//    repeat fires automatically with no confirm pop-up; the player
//    opts out via the Attack's OWN Cancel button in its target picker.
//  • The chain loops: a repeat that itself defeats exactly 1 Creature
//    triggers the next, and so on (bounded by the opponent's Creatures).
//  • Draws happen the instant a Creature is defeated — one individual
//    draw per kill, never a batch, interleaved with the repeats.
//
//  ★ W40a (Al, 22.10.2026, Punkt 3: „Kunagi soll auch Effekte wie Broghan wiederholen können. Im Fall von Brackle wäre dafür ein zweites Opfer
//    nötig, im Fall von Effekten wie Javelin Throw müsste ein weiteres Equip entfernt werden."): auch ein Effekt, der als Attack ZÄHLT (Broghan,
//    Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle, Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw,
//    Alluring Light …), wird wiederholt. Der Effekt hängt seine Wiederholung selbst an das Ereignis (`ctx._wiederhole`, siehe
//    `engine.alsAttackKette({ wiederhole })`); sie führt den Schlag des Effekts mit seinen KOSTEN erneut aus (zweites Opfer, weiteres Equip …),
//    lässt aber Einmal-Stempel, Limits und die Aktion unberührt (es ist „that Attack again", keine neue Aktivierung) und wählt das Ziel neu
//    („a different target your opponent controls": `gs._kunagiWdh` → nur Gegnerziele, das vorige ausgenommen). Ist die Wiederholung nicht möglich
//    (Kosten fehlen) oder wird sie abgebrochen/negiert, findet sie nicht statt bzw. endet die Kette — ohne Kosten, ohne Stempel.
//    Der Pfeil-Bonus (Arrows: „that Attack") ist mit der ersten Attack verbraucht (`clearArmedArrows` vor jeder Wiederholung).
//
//  ★ W41a (Al, 22.10.2026, Punkte 2 und 6):
//    • JEDE Wiederholung (Attack-KARTE wie Effekt) ist eine EIGENE Attack-Instanz: sie zählt für alle Attack-Zähler (`attacksPlayedThisTurn`, `heroesAttackedThisTurn`,
//      `hero._attacksThisTurn`, `onEffectCountedAsArt` → Berserk, Rioting Village, Mirjam, Knife Throw …) und unterliegt den Attack-Limits/Sperren (`heroKannAngreifen`): ist die Wiederholung
//      dadurch gesperrt (Mirjam hat ihre eine Attack schon gehabt, Berserk-Limit, Rioting Village, Knife Throw …), triggert Kunagi für diesen Helden nicht — kein Angebot, nichts bezahlt,
//      nichts verbraucht. Die ORIGINAL-Attack-KARTE wird dafür schon vor der ersten Wiederholung gezählt (sonst zählt sie der Server erst NACH `afterSpellResolved`); die Vormerkung
//      `gs._attackVorgezaehlt` macht den späteren regulären Zählschritt dieser Karte zum No-op (`engine.zaehleAlsArt`).
//    • Die Wiederholung ist ein ANGEBOT ("may"): das Abbrechen der ersten Abfrage der Wiederholung (Kostenwahl bzw. Zielwahl) lehnt sie ab — es wird nichts bezahlt, kein Stempel/keine Marke
//      verbraucht, Kunagi triggert nicht. Fehlen die Kosten (kein weiteres Opfer, keine Karte in der Ablage, kein weiteres Equip …), kommt gar kein Angebot (Kosten-Tabelle: CARD_API.md, „Welle 41 / W41a").
//
//  ★ W42a (Al, 22.10.2026, Punkte 1, 3 und 4) — Präzisierung der W41a-Kostenregel: erneut bezahlt wird nur, was der Effekt als PREIS verlangt (Brackle, Infected Greatmaw: das Opfer; Javelin Throw: das weitere Equip).
//    NICHT erneut bezahlt wird (a) das Ausspielen/die Aktion (Handkarte, Gold, Aktion: Kohta „spend your Action", Sword in a Bottle, Alluring Light, Javelin Throw als Karte) und (b) eine bloße
//    AKTIVIERUNGSBEDINGUNG bzw. ein Auslöser (Sacrificial Dagger „when you sacrifice a target", Bamboo Staff „when a card is added from your discard pile"): deren Wiederholung kostet NICHTS extra.
//    Das Abbrechen der Zielwahl/Kostenwahl der Wiederholung genügt als Ablehnen (kein eigenes Ja/Nein-Fenster).
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { canEquipToIdejHero, heroHasIdejSword } = require('./_idej-shared');
const { clearArmedArrows } = require('./_arrows-shared');

const CARD_NAME = 'Idej Sword - Kunagi';
const LOOP_CAP = 30; // safety only — the chain ends when an Attack stops
                     // defeating exactly 1 Creature (opponent runs dry).

module.exports = {
  activeIn: ['support'],

  canEquipToHero(gs, pi, heroIdx, engine) {
    if (!canEquipToIdejHero(gs, pi, heroIdx, engine)) return false;
    const eng = engine || gs._engineRef;
    return eng ? !heroHasIdejSword(eng, pi, heroIdx) : true;
  },

  hooks: {
    afterSpellResolved: async (ctx) => {
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Attack') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
      // Styx 28.9.: gleicher Index reicht nicht — gleiche Brettseite (geliehener Held).
      if ((ctx.heroOwner ?? ctx.casterIdx) !== (ctx.cardHeroOwner ?? ctx.cardOwner)) return;
      if (ctx.isSecondCast) return; // a repeat itself — don't recurse
      if (ctx._wiederholung || ctx._engine.gs._kunagiWdh) return;   // W40a: die Wiederholung eines Effekts selbst — keine Verschachtelung

      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs._spellNegatedByEffect) return;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const feld = ctx.cardHeroOwner ?? pi;   // Styx 28.9.: Brettseite des Helden
      const attackName = ctx.spellName;
      const attackScript = loadCardEffect(attackName);

      // Count Creatures a damage-target list defeated — a creature
      // entry with no live support-zone instance left was defeated.
      const countDefeated = (targets) => {
        let n = 0;
        for (const t of (targets || [])) {
          if (!t || (t.type !== 'creature' && t.type !== 'equip')) continue;
          const inst = t.cardInstance;
          const live = inst && engine.cardInstances.find(c =>
            c.id === inst.id && c.zone === 'support' && (c.counters?.currentHp ?? 1) > 0);
          if (!live) n++;
        }
        return n;
      };

      const heroReady = () => {
        const h = gs.players[feld]?.heroes?.[heroIdx];
        return !!h?.name && h.hp > 0
          && !h.statuses?.frozen && !h.statuses?.stunned && !h.statuses?.negated
          // W41a (Al, 22.10.2026, Punkt 6): die Wiederholung ist eine eigene Attack — Attack-Limits/Sperren (Mirjam, Berserk, Rioting Village, Knife Throw …) gelten: gesperrt = kein Angebot
          && engine.heroKannAngreifen(feld, heroIdx, pi, { name: attackName });
      };
      // W41a: die ORIGINAL-Attack-KARTE ist beim Eintreffen dieses Hooks noch NICHT gezählt (der Server zählt nach `afterSpellResolved`) — vor der ersten Wiederholung nachholen
      let originalGezaehlt = false;
      const zaehleOriginal = async () => {
        if (originalGezaehlt || ctx._alsEffekt) return;
        originalGezaehlt = true;
        await engine.zaehleAlsArt('attack', { pi, heroIdx, heroOwner: feld, name: attackName, karte: true });
      };

      // "For every Creature the equipped Hero defeats, draw 1 card."
      // Each draw is its OWN trigger — drawn one at a time, the moment
      // the kills happen, never batched.
      const drawPerKill = async (n) => {
        for (let i = 0; i < n; i++) await ctx.drawCards(pi, 1);
        if (n > 0) {
          engine.log('idej_kunagi_draw', { player: gs.players[pi]?.username, drew: n });
        }
      };

      // Re-perform the SAME Attack card — re-running its `onPlay`
      // replays the Attack's own animation and opens its OWN target
      // picker (whose Cancel button is the player's opt-out).
      // `_spellExcludeTargets` forces "a different target";
      // `_bartasSecondCast` skips its cost and marks it a second cast.
      const repeatAttack = async (excludeId) => {
        await clearArmedArrows(engine, pi);   // W40a (Al): ein Pfeil-Bonus („that Attack") gilt nur für die ERSTE Attack — verbraucht, bevor die Wiederholung schlägt
        const prevCancelled = gs._spellCancelled;
        gs._spellDamageLog = [];
        gs._spellExcludeTargets = excludeId ? [excludeId] : [];
        gs._bartasSecondCast = true;
        gs._spellCancelled = false;
        const tempInst = engine._trackCard(attackName, pi, 'hand', heroIdx, -1);
        if (feld !== pi) tempInst.heroOwner = feld;   // Styx 28.9.: geliehener Held
        try {
          await engine.runHooks('onPlay', {
            _onlyCard: tempInst, playedCard: tempInst,
            cardName: attackName, zone: 'hand', heroIdx,
            _skipReactionCheck: true,
          });
        } catch (err) {
          console.error(`[${CARD_NAME}] repeat-attack error for "${attackName}":`, err.message);
        }
        const targets = [...(gs._spellDamageLog || [])];
        engine._untrackCard(tempInst.id);
        delete gs._spellDamageLog;
        delete gs._spellExcludeTargets;
        delete gs._bartasSecondCast;
        gs._spellCancelled = prevCancelled; // don't leak the repeat's cancel
        return targets;
      };

      // The original Attack's kills — draw for them immediately.
      await drawPerKill(countDefeated(ctx.damageTargets));

      // ── W40a: Effekt, der als Attack zählt (Broghan, Javelin Throw, Alluring Light …) ──
      // Die Wiederholung kommt vom Effekt selbst (`ctx._wiederhole`); ohne sie (Duel: trifft nur Helden …) bleibt es bei den Karten für besiegte Kreaturen.
      if (ctx._alsEffekt) {
        let letzte = ctx.damageTargets || [];
        let wache = 0;
        const wiederhole = ctx._wiederhole;
        while (typeof wiederhole === 'function' && countDefeated(letzte) === 1 && heroReady()
               && ctx.card?.zone === 'support' && wache++ < LOOP_CAP) {
          await clearArmedArrows(engine, pi);   // der Pfeil-Bonus der vorigen Attack ist verbraucht
          const wdh = gs._kunagiWdh = { pi, ausser: [letzte[0]?.id].filter(Boolean), ausgefuehrt: false, ziele: [] };
          const vorherAusschluss = gs._spellExcludeTargets;
          const vorherAbbruch = gs._spellCancelled;   // W41a: ein abgelehntes Angebot (Abbruch der Wiederholung) darf die gerade auflösende Karte nicht als abgebrochen markieren
          gs._spellExcludeTargets = wdh.ausser;
          try { await wiederhole({ ausser: wdh.ausser }); }
          catch (err) { console.error(`[${CARD_NAME}] repeat-effect error for "${attackName}":`, err.message); }
          finally {
            gs._spellCancelled = vorherAbbruch;
            delete gs._kunagiWdh;
            if (vorherAusschluss === undefined) delete gs._spellExcludeTargets; else gs._spellExcludeTargets = vorherAusschluss;
          }
          if (!wdh.ausgefuehrt) break;   // Kosten nicht zahlbar / abgebrochen / negiert: keine (weitere) Wiederholung
          await drawPerKill(countDefeated(wdh.ziele));
          engine.log('idej_kunagi_repeat', { player: gs.players[pi]?.username, attack: attackName, effect: true });
          letzte = wdh.ziele;
        }
        engine.sync();
        return;
      }

      // ── Chain ── each Attack that defeats EXACTLY 1 Creature
      // repeats automatically; the repeat's kills draw the instant
      // they land, and the repeat itself can chain the next one.
      let lastTargets = ctx.damageTargets || [];
      let guard = 0;
      // W41a: Wiederholung = eigene Attack → die Original-Karte zuerst zählen, DANN die Limits prüfen (`heroReady` im Schleifenkopf)
      if (attackScript?.hooks?.onPlay && countDefeated(lastTargets) === 1) await zaehleOriginal();
      while (
        attackScript?.hooks?.onPlay
        && countDefeated(lastTargets) === 1
        && heroReady()
        && guard++ < LOOP_CAP
      ) {
        const repeatTargets = await repeatAttack(lastTargets[0]?.id || null);
        if (repeatTargets.length > 0) {
          // W41a (Al, 22.10.2026, Punkt 6): auch die Wiederholung einer Attack-KARTE ist eine eigene Attack-Instanz (Zähler, Mirjam, Berserk, Rioting Village …)
          await engine.zaehleAlsArt('attack', { pi, heroIdx, heroOwner: feld, name: attackName, karte: true });
        }
        await drawPerKill(countDefeated(repeatTargets));
        if (repeatTargets.length > 0) {
          engine.log('idej_kunagi_repeat', {
            player: gs.players[pi]?.username, attack: attackName,
          });
        }
        lastTargets = repeatTargets; // empty (cancelled) / non-lethal ends the loop
      }

      // W41a: der Server zählt die Original-Karte nach diesem Hook — nicht ein zweites Mal (siehe `zaehleAlsArt`)
      if (originalGezaehlt) gs._attackVorgezaehlt = { pi, heroIdx, name: attackName };
      engine.sync();
    },
  },
};
