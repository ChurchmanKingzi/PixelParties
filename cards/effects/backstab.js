'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Backstab"
//  Attack (Normal, Fighting Lv0)
//
//  „Perform this Attack with a Hero your opponent controls. Choose another target your
//   opponent controls and deal damage equal to the Hero's Attack stat to it."
//
//  ── WER SPIELT, WER FÜHRT AUS ──────────────────────────────────────────
//  Die KARTE spielt der Spieler wie jede Attack aus SEINER Hand mit einem eigenen Helden (Aktion, Zähler „Attack gespielt", Reaktionsfenster des Gegners: alles der
//  normale Weg `doPlaySpell`). Lv0 verlangt keine Fähigkeit. Der AUSFÜHRENDE der Attack ist aber ein Held, den der GEGNER kontrolliert („mit einem Helden des Gegners"):
//  seine AKTUELLE Attack-Stat (`hero.atk` — Buffs, Debuffs, Ausrüstung inklusive, nicht `baseAtk`) bestimmt den Schaden. Der Held braucht keine Aktion, keinen Zug und keine
//  Fähigkeit — er „leiht" nur seinen Angriffswert und seine Position (Richtung des Stichs, Quelle der Attack-Hooks). Die Aktion bezahlt der Spieler der Karte
//  (wie Love Shot/Charme: seine eigene Hauptaktion).
//
//  ── ① DER AUSFÜHRENDE (Wahl 1) ──────────────────────────────────────────
//  Ein lebender Held, den der Gegner KONTROLLIERT (Kontrolle statt Spalte: ein von ihm übernommener eigener Held — Charme, Paraseed Control — zählt, ein von mir
//  übernommener Gegnerheld nicht; `engine.heroesControlledBy`). Er muss ANGREIFEN können (`engine.heroKannAngreifen`, dieselbe Prüfung wie bei Alluring Light/W34a):
//  Frozen, Stunned, Webbed, Bound, harte Negierung, Blendung, Attack-Sperren des Gegners in diesem Zug (Trial of Coolness …) sperren ihn. Schutz vor Targeting
//  (Butterfly Cloud, Invisibility, Stealth …) gilt: die Wahl ist eine ganz normale Zielwahl gegen den Gegner (`promptEffectTarget`: Zielschutz, Truth-Seeing Eye des Wirkers,
//  Post-Target- und Surprise-Fenster mit der Karte als Quelle). Attack-Stat 0 ist zulässig (der Stich richtet dann 0 Schaden an); die Karte spielt die CPU dann nur bei lohnender Wahl.
//  Abbruch der Wahl = Karte zurück auf die Hand, nichts bezahlt (Regel 23.9).
//
//  ── ② DAS ZIEL (Wahl 2: „another target your opponent controls") ──────────
//  Held ODER Kreatur, die der Gegner kontrolliert (Kontrolle: von ihm übernommene eigene Helden/Kreaturen zählen, die von mir übernommenen nicht), NIE der Ausführende
//  selbst („another"). Ausrüstung, Abilities & Co. sind keine Ziele; liegt die Kreatur in einem Darion-Stapel, fragt die Engine zentral, welche Karte gemeint ist.
//  Die Wahl läuft über `ctx.promptDamageTarget` MIT dem Ausführenden als Quelle (`attackerSourceOverride`): Umleiter (Challenge, Anti-Magnet, Empty Armor), Surprise-/Post-Target-
//  Fenster (Escape Device, Invisibility Cloak, Bluff …), Taunt, Alliance und das Auge sehen den gegnerischen Helden als Angreifer. Hat der Wirker (Held, mit dem er die Karte spielt)
//  ein Truth-Seeing Eye, wählt er auch hier jedes Ziel (und der Stich ist nicht umlenkbar).
//
//  ── ③ SCHADEN, QUELLE, ZÄHLUNG ──────────────────────────────────────────
//  Schadenstyp `attack`: Reduktionen, Schilde, Immunitäten, Stoneskin & Co. des Ziels greifen wie bei jeder Attack. Betrag = aktuelle Attack-Stat des Ausführenden beim AUFLÖSEN
//  (nach den Fenstern der Wahl neu gelesen; Buffs/Debuffs aus Reaktionen zählen). Quelle des Treffers: `{ name: 'Backstab', owner: ich, controller: ich, heroIdx/heroOwner: der
//  Ausführende, usesHeroAtk }` — Hooks „when this Hero attacks" (`onAttackDeclare`), Attack-Reaktionen und Zielschutz sehen den gegnerischen Helden als Angreifer (wie `ctx.executeAttack`
//  bei einem geliehenen Helden), der VERURSACHER bleibt der Spieler der Karte (Kill-/„defeated by"-Zählungen, `dealtDamageToOp`): ein besiegtes Ziel ist „von mir besiegt".
//  Die Attack zählt als Attack-Karte des SPIELERS (Zähler, Berserk, Mirjam, „only Attack" laufen über den Helden, der die Karte spielt), nicht für den Ausführenden.
//  Fällt der Ausführende zwischen Wahl und Treffer (Reaktion: gefroren, betäubt, besiegt), greift er nicht mehr an: die Karte ist verbraucht, es passiert nichts.
//
//  ── NICHT SPIELBAR / ERSTE RUNDE ────────────────────────────────────────
//  `spellPlayCondition`: mindestens ein angriffsfähiger Held des Gegners UND ein zweites Ziel des Gegners (anderer Held oder Kreatur) — hat der Gegner nur EINEN Helden und keine
//  Kreatur, ist die Karte ausgegraut. `blockedByFirstTurnProtection`: der Stich trifft nur den Gegner; in Runde 1 (Erst-Runden-Immunität) unspielbar.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `backstab_stab` (Pixelart, ANIM_REGISTRY, Brett-Animation `ppSalve`): ein Pixel-Schwert steht aus Richtung des ausführenden Helden vor dem Ziel, holt kurz
//  aus und sticht in ganzen Pixeln hinein; Kreuzfunkel, Funken und rote Spritzer. Klänge: ZONE_ANIM_SFX. Der Schaden fällt beim Einschlag (`STICH_WARTE_MS`).
// ═══════════════════════════════════════════

const CARD_NAME = 'Backstab';
const ANIM_MS = 900;           // Länge von `backstab_stab` im Client (ENDE)
const STICH_WARTE_MS = 440;    // bis zum Einschlag (330 ms im Bild + 100 ms Einbau-Versatz des Clients), dann fällt der Schaden

/** Lebende Helden, die `oppIdx` kontrolliert und die als Ausführende angreifen können (Zielobjekte `hero-<Spalte>-<Index>`). */
function ausfuehrende(engine, oppIdx) {
  const out = [];
  for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(oppIdx)) {
    if (!hero?.name || hero.hp <= 0) continue;
    if (!engine.heroKannAngreifen(physOwner, heroIdx, oppIdx, { name: CARD_NAME })) continue;
    out.push({ id: `hero-${physOwner}-${heroIdx}`, type: 'hero', owner: physOwner, heroIdx, cardName: hero.name });
  }
  return out;
}

/** Alle Ziele (Helden und Kreaturen), die `oppIdx` kontrolliert — für die Spielbarkeitsprüfung („another target"). */
function gegnerZiele(engine, oppIdx) {
  const helden = engine.heroesControlledBy(oppIdx)
    .filter(({ hero }) => hero?.name && hero.hp > 0)
    .map(({ physOwner, heroIdx, hero }) => ({ id: `hero-${physOwner}-${heroIdx}`, type: 'hero', owner: physOwner, heroIdx, cardName: hero.name }));
  let kreaturen = [];
  try { kreaturen = engine.getCreatureTargets(oppIdx).filter(t => !t.cardInstance?.faceDown); } catch { kreaturen = []; }
  return helden.concat(kreaturen);
}

/** Id → Zielobjekt der angebotenen Liste (`promptEffectTarget` liefert nur Ids). */
function zielVonAntwort(antwort, angebot) {
  const roh = Array.isArray(antwort) ? antwort[0] : antwort;
  if (!roh) return null;
  if (typeof roh === 'object' && roh.type) return roh;
  const id = typeof roh === 'object' ? roh.id : roh;
  return (angebot || []).find(t => t.id === id) || null;
}

module.exports = {
  // ★ Als Ruling (Al 26.10., Flame Avalanche: „Wenn du andere Schadenskarten unspielbar machst, müssen das Vial und Rockfall auch sein!"): die Karte richtet NUR Schaden an Zielen an (Quelle ist trotz geliehenem Gegnerhelden die Karte des Wirkers — die Sperre greift) —
  // unter der Schadenssperre (`ps.damageLocked`) unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten; Sperr-Stutzen `engine._cardBlockedBySearchLock`).
  blockedByDamageLock: true,
  // ★ Bilder eines NEGIERTEN Stichs (Zielschutz-Reaktion nach der Wahl): die Quelle ist der ausführende Held (`heroOwner`/`heroIdx`), die Ziele die gewählten. Nur Bilder, kein Zustand.
  spellVisual: async (engine, info) => {
    const z = (info.targets || []).filter(Boolean)[0];
    const seite = info.heroOwner ?? info.owner;
    if (!z || !Number.isInteger(info.heroIdx) || info.heroIdx < 0 || !Number.isInteger(seite)) return;
    if (info.schonGezeigt?.zone?.has('backstab_stab')) return;
    engine._broadcastEvent('play_zone_animation', {
      type: 'backstab_stab', zoneType: 'board', owner: z.owner, heroIdx: -1, zoneSlot: -1, duration: ANIM_MS,
      targets: [{ owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.type === 'hero' ? -1 : (z.slotIdx ?? -1) }],
      originOwner: seite, originHeroIdx: info.heroIdx, originZoneSlot: -1,
    });
    await engine._delay(STICH_WARTE_MS);
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // Die Attack führt ein Held des GEGNERS aus: Pfeile/Magic Topaz („when a Hero you control performs an Attack") des Spielers passen nicht (`arrowTriggerCondition`, `_arrows-shared.js`).
  attackPerformedByOpponentHero: true,

  // Der Stich trifft nur Ziele des Gegners (Schaden): in Runde 1 (Erst-Runden-Immunität) wäre er wirkungslos → unspielbar (Welle 12 B-06).
  blockedByFirstTurnProtection: true,

  /** „Perform this Attack with a Hero your opponent controls … another target your opponent controls": ohne ausführenden Helden UND zweites Ziel unspielbar. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return false;
    try {
      const oppIdx = engine.opponentOf(pi);
      if (!ausfuehrende(engine, oppIdx).length) return false;
      return gegnerZiele(engine, oppIdx).length >= 2;   // der Ausführende zählt als eines, „another" braucht ein zweites
    } catch { return false; }
  },

  cpuMeta: { dealsDamage: true },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = engine.opponentOf(pi);

      // ── ① Den AUSFÜHRENDEN wählen: ein Held, den der Gegner kontrolliert ──
      const kandidaten = ausfuehrende(engine, oppIdx);
      if (kandidaten.length === 0) { gs._spellCancelled = true; return; }
      const mitAuge = engine._sourceIgnoresTargetingRestrictions(ctx.card);
      const heldWahl = await engine.promptEffectTarget(pi, kandidaten, {
        ...(mitAuge ? { ignoreUntargetable: true, _truthSeeingEye: true } : {}),
        chooserHeroIdx: ctx.cardHeroIdx,
        title: CARD_NAME, source: CARD_NAME,
        _backstabWahl: 'ausfuehrender',   // Kennung für `cpuResponse` (beide Wahlen tragen denselben Titel)
        description: "Choose a Hero your opponent controls. You perform this Attack with it.",
        confirmLabel: '⚔️ Stab!',
        confirmClass: 'btn-danger',
        maxSelect: 1, maxTotal: 1, minRequired: 1,
        cancellable: true,
      });
      const ausZiel = zielVonAntwort(heldWahl, kandidaten);
      if (!ausZiel) { gs._spellCancelled = true; return; }
      const held = gs.players[ausZiel.owner]?.heroes?.[ausZiel.heroIdx];
      if (!held?.name || held.hp <= 0) { gs._spellCancelled = true; return; }

      // Quelle des Treffers: der gegnerische Held als Angreifer (Platz/Spalte), der Spieler der Karte als Verursacher.
      const attackSource = {
        name: CARD_NAME, owner: pi, heroIdx: ausZiel.heroIdx, controller: pi, heroOwner: ausZiel.owner, usesHeroAtk: true,
      };

      // ── ② Das ZIEL wählen: ein ANDERES Ziel des Gegners ─────────────────
      const istAusfuehrender = (t) => t.type === 'hero' && t.owner === ausZiel.owner && t.heroIdx === ausZiel.heroIdx;
      const gegnerKontrolliert = (t, eng) => {
        if (t.type === 'hero') {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          return !!h && eng.heroSideOf(t.owner, h) === oppIdx;
        }
        return (t.cardInstance ? eng.kontrolleurVon(t.cardInstance) : t.owner) === oppIdx;
      };
      const atkVorab = Math.max(0, held.atk || 0);
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: atkVorab,
        attackerSourceOverride: attackSource,
        // Das Auge des Wirkers (mit dem er die Karte spielt) gilt auch für diese Wahl; das des Ausführenden regelt `attackerSourceOverride`.
        ...(mitAuge ? { ignoreUntargetable: true, _truthSeeingEye: true, cannotBeRedirected: engine._sourceHasTruthSeeingEye(ctx.card) } : {}),
        title: CARD_NAME,
        description: `${held.name} stabs a target of your choice — another target your opponent controls.`,
        confirmLabel: '⚔️ Stab!',
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t, eng) => !istAusfuehrender(t) && gegnerKontrolliert(t, eng),
      });
      if (!target) { gs._spellCancelled = true; return; }   // Abbruch: Karte zurück auf die Hand

      // ── Zwischen Wahl und Treffer: kann der Ausführende noch angreifen? ──
      const heldJetzt = gs.players[ausZiel.owner]?.heroes?.[ausZiel.heroIdx];
      if (!heldJetzt?.name || heldJetzt.hp <= 0
          || !engine.heroKannAngreifen(ausZiel.owner, ausZiel.heroIdx, oppIdx, { name: CARD_NAME })) {
        engine.log('backstab_blocked', { player: gs.players[pi]?.username, hero: held.name });
        engine.sync();
        return;
      }

      // ── ③ Der Stich ─────────────────────────────────────────────────────
      // Betrag: AKTUELLE Attack-Stat beim Auflösen (nach den Fenstern der Wahl neu gelesen).
      const atk = Math.max(0, heldJetzt.atk || 0);
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, atk);

      const zielSlot = target.type === 'hero' ? -1 : (target.slotIdx ?? -1);
      engine._broadcastEvent('play_zone_animation', {
        type: 'backstab_stab', zoneType: 'board', owner: target.owner, heroIdx: -1, zoneSlot: -1, duration: ANIM_MS,
        targets: [{ owner: target.owner, heroIdx: target.heroIdx, zoneSlot: zielSlot }],
        originOwner: ausZiel.owner, originHeroIdx: ausZiel.heroIdx, originZoneSlot: -1,
      });
      await engine._delay(STICH_WARTE_MS);

      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) await engine.actionDealDamage(attackSource, tgtHero, finalDmg, 'attack');
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst && inst.zone === 'support') {
          await engine.actionDealCreatureDamage(attackSource, inst, finalDmg, 'attack', { sourceOwner: pi, canBeNegated: true });
        }
      }

      engine.log('backstab', {
        player: gs.players[pi]?.username, hero: held.name, target: target.cardName, atk, damage: finalDmg,
      });
      await engine._delay(Math.max(0, ANIM_MS - STICH_WARTE_MS - 100));   // der Nachlauf des Bildes (Funken, Zurückziehen), bevor der nächste Schritt kommt
      engine.sync();
    },
  },

  /**
   * CPU: als Ausführenden den Gegnerhelden mit der höchsten Attack-Stat (bei Gleichstand die meisten HP — er bleibt als Ziel eher stehen); nie einen mit 0, solange ein stärkerer
   * wählbar ist. Das Ziel wählt der allgemeine Pilot (alle Ziele gehören dem Gegner, er sucht den besten Treffer).
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = payload || {};
    if (config?.title !== CARD_NAME || config._backstabWahl !== 'ausfuehrender' || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible && t.type === 'hero');
    if (frei.length === 0) return undefined;
    const held = (t) => engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    frei.sort((a, b) => ((held(b)?.atk || 0) - (held(a)?.atk || 0)) || ((held(b)?.hp || 0) - (held(a)?.hp || 0)));
    return [frei[0].id];
  },
};
