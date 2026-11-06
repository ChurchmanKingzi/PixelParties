'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Voodoo Curse"
//  Spell (Normal, Decay Magic Lv2), PP SOB — Secret Rare
//
//  „Choose 2 targets that are controlled by the same player and swap their current and max HP, including all bonuses from Attachments, equipped Artifacts and Abilities. Then, if
//   both targets have an Attack stat, swap those as well."
//
//  ── ZIELE ───────────────────────────────────────────────────────────────
//  „Targets" = lebende Helden (beider Seiten, nach KONTROLLE: ein übernommener Held zählt für den Übernehmer) und aufgedeckte Kreaturen in den Support Zones (`_istKreaturenInstanz`; keine
//  Puppets & Co., keine verdeckten Karten). Beide Ziele müssen vom SELBEN Spieler kontrolliert werden — auch vom Wirker selbst (z. B. Held ↔ eigene Kreatur). EIN Picker für beide Ziele
//  (genau 2, abbrechbar — dann bleibt die Karte auf der Hand): alle Ziele eines Spielers, der mindestens zwei hat, sind wählbar, der Rest ist ausgegraut. Die Picker-Regel `sameBy: 'kontrolleur'`
//  graut nach dem ersten Klick alle Ziele des anderen Spielers aus; bestätigt werden kann erst mit 2 Zielen (`minRequired: 2`).
//  Erstrunden-Schutz: die Ziele des geschützten Gegners stehen nicht zur Wahl (wirkungslos).
//
//  ── DER TAUSCH ──────────────────────────────────────────────────────────
//  Beide Werte wandern PAARWEISE: A bekommt die max HP von B und die aktuellen HP von B, B die von A — NICHT aktuell ↔ max desselben Ziels. „Including all bonuses" heißt: getauscht
//  wird die GESUMME, wie sie auf dem Brett steht (Grundwert + Toughness-Stufen + Ausrüstung + Anhängsel …). Die Boni selbst bleiben bei ihren Karten: verliert ein Ziel später eine Toughness
//  (oder einen Artifact/Anhang mit HP-Bonus), zieht sie IHREN Bonus von dem getauschten Wert ab — die max HP fallen dabei nie unter 1 (`decreaseMaxHp`, ein lebender Held nie unter 1 HP).
//  Beispiel: A hat Toughness 3 (800 max HP), B hat 300 → nach dem Tausch hat B 800, A 300; verliert A dann eine Toughness-Kopie, fällt er von 300 auf nur 100 max HP — weniger, als er
//  ohne Voodoo Curse hätte. Held ↔ Kreatur geht ebenso (die Kreatur führt ihre HP in `counters.maxHp/currentHp`). Überheilte Kreaturen (aktuell > max) behalten ihren Überschuss mit dem Wert.
//  `maxHpCapped` eines Helden („max HP cannot exceed …") gilt: der eingehende Maximalwert wird gedeckelt, die aktuellen HP folgen dem gedeckelten Maximum.
//  ATK: „if both targets have an Attack stat" — heute haben nur HELDEN eine (keine Kreaturenkarte trägt ATK). Haben beide eine, tauschen sie ihren Attack stat; wieder die GESAMTSUMME inkl.
//  Boni (Fighting, Klingen …). Technisch wird der Grundwert getauscht (ohne Aura-Verdopplung wie Rioting Village, die am Helden/Ort hängt und nachgezogen wird); bei einem Fluch (ATK 0,
//  Fluch bleibt am Helden) wandert der versteckte Wert. Alles läuft über den ATK-Trichter (`_applyHeroAtkDelta`).
//
//  ── SCHUTZ ──────────────────────────────────────────────────────────────
//  Ein Nicht-Schaden-Effekt auf jedes Ziel: Helden fragen `heroNonDamageEffectBlocked(…, 'max_hp')` (Resistance, Spell-Immunität des Black-Thorn Dragon), Kreaturen `isOmniImmune`
//  (Cardinal Beasts, Golden Wings, „unaffected by all Spells"). Ist EIN Ziel geschützt, verpufft der ganze Tausch (nichts wandert, der Zauber ist gewirkt) — ein halber Tausch gäbe dem
//  anderen Ziel Werte aus dem Nichts. Der Zielwähler filtert Schutz vor Auswahl (Untargetable …) und öffnet die Fenster der Zielwahl; das Truth-Seeing Eye des Wirkers hebt
//  die Auswahlsperren auf.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `voodoo_swap` (Pixelart, ANIM_REGISTRY, Brett-Animation mit BEIDEN Zielen): Nadeln fallen auf die Ziele, ein gepunkteter Faden verbindet sie, zwei Kugeln wandern
//  in entgegengesetzter Richtung und kreuzen sich; bei der Ankunft (`TAUSCH_MS`) werden die Werte getauscht. Klänge in ZONE_ANIM_SFX; Log `voodoo_curse`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU tauscht nur bei GEGNERISCHEN Paaren, und nur wenn es sich lohnt: Der stärkere Angreifer soll die niedrigeren HP bekommen (Wert = ΔATK × ΔHP > 0, Kreaturen zählen ATK 0).
//  Ohne so ein Paar bricht sie ab.
// ═══════════════════════════════════════════

const { ausgegrauteRestkarten } = require('./_target-dim-shared');

const CARD_NAME = 'Voodoo Curse';
const DAUER_MS = 1500;       // Länge der Animation (deckt sich mit `voodoo_swap` im Client)
const TAUSCH_MS = 1120;      // die Kugeln sind angekommen (ANKUNFT 1020 ms + 100 ms Einbau-Versatz des Clients)
const NACH_MS = 380;         // Funken noch ein Stück fliegen lassen, bevor der Zauber endet

/** Alle Ziele (Helden und Kreaturen), die `kontrolleur` kontrolliert. */
function zieleVon(engine, kontrolleur) {
  const out = [];
  for (const t of engine.getControlledHeroTargets(kontrolleur)) out.push({ ...t, kontrolleur });
  for (const t of engine.getCreatureTargets(kontrolleur)) {
    const inst = t.cardInstance;
    if (!inst || inst.faceDown || inst.zone !== 'support' || inst.counters?.treatAsEquip) continue;
    if (!engine._istKreaturenInstanz(inst)) continue;
    out.push({ ...t, _cardInstance: inst, kontrolleur });
  }
  return out;
}

/** Alle Spieler, die mindestens zwei Ziele kontrollieren, mit ihren Zielen. (Erstrunden-Schutz: der geschützte Gegner entfällt.) */
function gruppen(engine, pi) {
  const out = [];
  for (let c = 0; c < engine.playerCount(); c++) {
    if (engine.ersterZugGeschuetzt(c, pi)) continue;
    const liste = zieleVon(engine, c);
    if (liste.length >= 2) out.push({ kontrolleur: c, ziele: liste });
  }
  return out;
}

/** Wert eines Ziels als Tauschpartner: { kind, hp, maxHp, atk|null, … } — `null` = nicht (mehr) lebendig. */
function lies(engine, t) {
  if (t.type === 'hero') {
    const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    if (!hero?.name || hero.hp <= 0) return null;
    return { kind: 'hero', t, seite: t.owner, heroIdx: t.heroIdx, hero, hp: hero.hp, maxHp: hero.maxHp || hero.hp, atk: true };
  }
  const inst = engine.cardInstances.find(c => c.id === t.cardInstance?.id && c.zone === 'support');
  if (!inst || inst.faceDown) return null;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name] || {};
  const maxHp = inst.counters.maxHp ?? cd.hp ?? 0;
  const hp = engine.creatureCurrentHp(inst);
  if (hp <= 0 && maxHp <= 0) return null;
  return { kind: 'kreatur', t, inst, hp, maxHp, atk: false };
}

/** Grundwert des Attack stat eines Helden (ohne Aura-Verdopplung; bei einem Fluch der versteckte Wert). */
function atkBasis(engine, hero) {
  if (engine._isHeroAtkSuppressed(hero)) return hero._cursedAtkSuppressed || 0;
  return Math.max(0, (hero.atk || 0) - (hero._atkAuraGrant || 0));
}

/** Schreibt HP-Paar `(hp, maxHp)` in das Ziel (Heldendeckel `maxHpCapped`, Held bleibt lebend). */
function setzeHp(engine, w, maxHp, hp) {
  if (w.kind === 'hero') {
    const hero = w.hero;
    let neuMax = Math.max(1, maxHp), neuHp = hp;
    if (hero.maxHpCapped != null && neuMax > hero.maxHpCapped) { neuMax = Math.max(1, hero.maxHpCapped); neuHp = Math.min(neuHp, neuMax); }
    hero.maxHp = neuMax;
    hero.hp = Math.max(1, neuHp);
  } else {
    w.inst.counters.maxHp = Math.max(1, maxHp);
    w.inst.counters.currentHp = Math.max(1, hp);
  }
}

/** Grober Wert eines Tauschs für die CPU: stärkerer Angreifer bekommt die niedrigeren HP. */
function cpuPaarWert(engine, a, b) {
  const wa = lies(engine, a), wb = lies(engine, b);
  if (!wa || !wb) return -Infinity;
  const atkA = wa.kind === 'hero' ? atkBasis(engine, wa.hero) : 0;
  const atkB = wb.kind === 'hero' ? atkBasis(engine, wb.hero) : 0;
  return (atkA - atkB) * (wa.hp - wb.hp);
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  /** Grau, solange kein Spieler zwei Ziele kontrolliert. */
  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    return gruppen(eng, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const heroSeite = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const nutzer = ctx.attachedHero || gs.players[heroSeite]?.heroes?.[heroIdx];
      if (!ps || !nutzer?.name || nutzer.hp <= 0) { gs._spellCancelled = true; return; }

      let gr = gruppen(engine, pi);
      if (gr.length === 0) { gs._spellCancelled = true; return; }

      const mitAuge = engine._sourceIgnoresTargetingRestrictions?.(ctx.card);

      // ── Beide Ziele in EINEM Picker: genau 2, vom selben Kontrolleur (`sameBy`: nach dem ersten Klick graut der Picker alle Ziele des anderen Spielers aus) ──
      delete gs._zielNegiertDurchSchutz;
      const alle = gr.flatMap(g => g.ziele);
      const r = await engine.promptEffectTarget(pi, [...alle, ...ausgegrauteRestkarten(engine, alle)], {
        ...(mitAuge ? { ignoreUntargetable: true, _truthSeeingEye: true } : {}),
        chooserHeroIdx: heroIdx,
        title: CARD_NAME, source: CARD_NAME,
        confirmClass: 'btn-danger',
        description: 'Choose 2 targets controlled by the same player. They swap their current and max HP (and Attack stat).',
        confirmLabel: '🪆 Swap!',
        maxTotal: 2, minRequired: 2, sameBy: 'kontrolleur',
        cancellable: true,
      });
      const ids = Array.isArray(r) ? r : (r ? [r] : []);
      const gr2 = gruppen(engine, pi);
      const g1 = ids.length === 2 && gr2.find(g => ids.every(id => g.ziele.some(z => z.id === id)));
      const a = g1 && g1.ziele.find(z => z.id === ids[0]);
      const b = g1 && g1.ziele.find(z => z.id === ids[1]);
      if (!a || !b || a.id === b.id) {
        if (ids.length > 0 || gs._spellNegatedByEffect || gs._zielNegiertDurchSchutz) { delete gs._zielNegiertDurchSchutz; engine.sync(); return; }
        gs._spellCancelled = true;
        return;
      }
      delete gs._zielNegiertDurchSchutz;

      let wa = lies(engine, a), wb = lies(engine, b);
      if (!wa || !wb) { engine.log('voodoo_curse_fizzle', { player: ps.username }); engine.sync(); return; }

      // ── Bild: Nadeln, Faden, wandernde Kugeln ──
      const zielAnim = (w) => (w.kind === 'hero'
        ? { owner: w.seite, heroIdx: w.heroIdx }
        : { owner: w.t.owner, heroIdx: w.t.heroIdx, zoneSlot: w.t.slotIdx, cardName: w.inst.name });
      engine._broadcastEvent('play_zone_animation', {
        type: 'voodoo_swap', zoneType: 'board', owner: heroSeite, heroIdx: -1, zoneSlot: -1, duration: DAUER_MS,
        targets: [zielAnim(wa), zielAnim(wb)],
        originOwner: heroSeite, originHeroIdx: heroIdx, originZoneSlot: -1,
      });
      await engine._delay(TAUSCH_MS);

      // ── Schutz: ein geschütztes Ziel lässt den ganzen Tausch verpuffen ──
      wa = lies(engine, a); wb = lies(engine, b);
      if (!wa || !wb) { engine.log('voodoo_curse_fizzle', { player: ps.username }); engine.sync(); await engine._delay(NACH_MS); return; }
      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx, heroOwner: heroSeite };
      let blockiert = false;
      for (const w of [wa, wb]) {
        if (blockiert) break;
        if (w.kind === 'hero') {
          if (await engine.heroNonDamageEffectBlocked(w.seite, w.heroIdx, 'max_hp', { sourceOwner: pi, source: CARD_NAME })) blockiert = true;
        } else if (engine.isOmniImmune(w.inst, quelle, { source: quelle, sourceOwner: pi })) {
          blockiert = true;
        } else if (!(await engine.kreaturBetroffen(w.inst, 'stats', quelle, { sourceOwner: pi, detail: 'swap_hp' }))) {
          blockiert = true;   // W71b (Al, 25.10.2026): Schutzfenster (Cool Rescuer Monia & Co.) — ein negierter Teil lässt den ganzen Tausch verpuffen
        }
      }
      if (blockiert) {
        engine.log('voodoo_curse_blocked', { player: ps.username, a: wa.kind === 'hero' ? wa.hero.name : wa.inst.name, b: wb.kind === 'hero' ? wb.hero.name : wb.inst.name });
        engine.sync();
        await engine._delay(NACH_MS);
        return;
      }
      wa = lies(engine, a); wb = lies(engine, b);                 // die Fenster oben können die Werte bewegt haben
      if (!wa || !wb) { engine.log('voodoo_curse_fizzle', { player: ps.username }); engine.sync(); await engine._delay(NACH_MS); return; }

      // ── Der Tausch: HP-Paare, dann (nur Held ↔ Held) der Attack stat ──
      const vor = { a: { hp: wa.hp, max: wa.maxHp }, b: { hp: wb.hp, max: wb.maxHp } };
      setzeHp(engine, wa, vor.b.max, vor.b.hp);
      setzeHp(engine, wb, vor.a.max, vor.a.hp);
      let atkVor = null;
      if (wa.kind === 'hero' && wb.kind === 'hero') {
        const basisA = atkBasis(engine, wa.hero), basisB = atkBasis(engine, wb.hero);
        atkVor = { a: basisA, b: basisB };
        if (basisA !== basisB) {
          engine._applyHeroAtkDelta(wa.hero, wa.seite, wa.heroIdx, basisB - basisA);
          engine._applyHeroAtkDelta(wb.hero, wb.seite, wb.heroIdx, basisA - basisB);
        }
      }
      const nameA = wa.kind === 'hero' ? wa.hero.name : wa.inst.name;
      const nameB = wb.kind === 'hero' ? wb.hero.name : wb.inst.name;
      engine.log('voodoo_curse', {
        player: ps.username, a: nameA, b: nameB,
        aHp: `${vor.b.hp}/${vor.b.max}`, bHp: `${vor.a.hp}/${vor.a.max}`,
        ...(atkVor ? { aAtk: atkVor.b, bAtk: atkVor.a } : {}),
      });
      engine.sync();
      await engine._delay(NACH_MS);
    },
  },

  /** CPU: nur gegnerische Paare, und nur wenn sich der Tausch lohnt (stärkerer Angreifer → niedrigere HP). Antwort: beide Ziele auf einmal. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = promptData || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (frei.length < 2) return [];
    const gegner = (t) => engine.opponentsOf(playerIdx).includes(t.kontrolleur ?? engine.kontrolleurVonHeld?.(t.owner, t.heroIdx));
    const ktrl = (t) => t.kontrolleur ?? (t.type === 'hero' ? engine.kontrolleurVonHeld(t.owner, t.heroIdx) : engine.kontrolleurVon(t.cardInstance));
    // Das beste Paar unter den gegnerischen Zielen (gleicher Kontrolleur).
    let best = null, bestV = 0;
    for (const a of frei) {
      if (!gegner(a)) continue;
      for (const b of frei) {
        if (a.id === b.id || ktrl(a) !== ktrl(b)) continue;
        const v = cpuPaarWert(engine, a, b);
        if (v > bestV) { bestV = v; best = [a.id, b.id]; }
      }
    }
    return best || [];
  },
};
