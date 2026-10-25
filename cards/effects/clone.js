// ═══════════════════════════════════════════
//  CARD EFFECT: "Clone"
//  Creature (Normal, Lv 2, Summoning Magic, HP 0 — geteilter Pool)
//
//  „Once per turn, when the corresponding Hero uses a Normal Attack or Spell, this Creature may perform an exact copy of it against the same target(s), using the same Attack stat
//   and Ability level. This Creature and the corresponding Hero share 1 HP pool. You can only control 1 "Clone" at a time."
//
//  ── GETEILTER HP-POOL ───────────────────────────────────────────────────
//  `sharesHpWithHero: true` (Puppets-/Bonded-Companion-Vertrag v704): Schaden und Heilung an der Kreatur werden auf den Helden derselben Spalte umgebucht, deshalb 0 HP in der Datenbank.
//  Fällt der Held auf anderem Weg (Insta-Kill, Opferung), geht der Klon mit (`companionHeldGefallen`, wie die Bonded Companions). Der Klon darf umgezogen werden (der Text sagt nichts anderes);
//  „corresponding Hero" ist der Held der Spalte, in der er gerade steht.
//
//  ── „YOU CAN ONLY CONTROL 1" ────────────────────────────────────────────
//  `beforeSummon` (jede Beschwörung dieser Karte, auch nicht aus der Hand) + `canSummon` (Spielbarkeit, Muster Cute Phoenix/Crum): solange der Spieler einen aufgedeckten Clone kontrolliert, ist
//  keine zweite Beschwörung möglich. Der Zähler ist KONTROLLE, nicht Brettseite (`controller ?? owner`).
//
//  ── „WHEN THE CORRESPONDING HERO USES A NORMAL ATTACK OR SPELL" ─────────
//  `afterSpellResolved` des Klons: Der Held der Spalte hat eine Karte vom Typ Attack ODER Spell mit Untertyp NORMAL (nicht Reaction/Attachment/Area/Surprise) über den normalen Spielweg
//  gewirkt (`doPlaySpell`), sie wurde nicht ganz negiert (das Ereignis kommt dann gar nicht) und der Wirker ist der Kontrolleur des Klons. Der Held muss noch leben, der Klon steht noch (er konnte
//  im Schlag gefallen sein), ist nicht stummgeschaltet (Hook-Filter) und das Limit „1 pro Zug" (`claimHOPT('clone-copy')`) ist frei — es wird erst NACH dem Ja des Spielers gestempelt.
//
//  ── „EXACT COPY … AGAINST THE SAME TARGET(S)" ───────────────────────────
//  Der Server zeichnet die Zielwahlen des Wurfs auf (`gs._klonAufnahme`, Engine `_zielwahlAbschliessen`: je Wahl Titel + gewählte IDs). Die Kopie läuft über denselben Weg wie der Zauber
//  (`onPlay` einer synthetischen Instanz der Karte, Wirker = der Held der Spalte, `gs._wirkerSeite` gestempelt → Ability-Stufe und Attack-Stat sind die des Helden), nur beantwortet die Engine
//  jede Zielwahl des Wirkers aus der Aufzeichnung (`gs._klonWiedergabe`, Engine `promptEffectTarget`): derselbe Titel, in Aufnahme-Reihenfolge, nur noch wählbare Ziele. Schutz-/Umlenk-/
//  Surprise-Fenster laufen für die Kopie wie für jeden Wurf (ein Surprise des Gegners kann die Kopie negieren). Alle anderen Entscheidungen der Karte (Optionen, Karten wählen) trifft der Spieler
//  neu. Eine Kopie wird nur angeboten, wenn mindestens ein aufgezeichnetes Ziel noch steht (lebender Held / Kreatur an seinem Platz) und die Karte jetzt noch spielbar ist
//  (`spellPlayCondition`); eine „once per game"-Karte hat kein zweites Wirken. Kosten der Karte („to use this Spell", `payActivationCost`) zahlt die Kopie wie bei Magic Mirror.
//  ★ Der KLON führt die Kopie aus (Al, 24.10.): Schadensquelle ist der Klon, nicht der Held (`gs._klonKopie` → Engine `istKlonQuelle`/`_klonSicht`: Shrink, Waffen-Boni, Pfeile und Angriffs-Fenster des Helden
//  gelten für die Kopie nicht; Schutz des Ziels schon). Dashes und Projektile starten an seinem Platz (`_spellCasterOverride`), Surprises/Rückstoß sehen ihn als Angreifer (`_spellCasterCreature`);
//  ATK und Fähigkeitsstufen sind die des Helden. Test: `docs/niche-tests/repro/W72/c-05`.
//  Die Kopie ist KEIN Gebrauch einer Karte durch den Helden: keine Zähler (gespielte Attacks/Spells), kein `afterSpellResolved`, keine Aktion, keine Ablage — die Instanz verschwindet danach.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Keine eigene Zonen-Animation (das Echo-Abbild am Helden ist entfallen, Al 24.10.): nur der Auftritt der Karte (`showTriggeredEffect`) und das Glühen am Klon beim Auslösen — danach die Kopie selbst.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const { kontrolliert } = require('./_double-shared');
const { companionHeldGefallen, companionGlow } = require('./_bonded-companions-shared');

const CARD_NAME = 'Clone';
const HOPT_KEY = 'clone-copy';
const ANIM_MS = 250;
// gs-Marken, die eine Kopie verändern darf und die der äußere Wurf danach unverändert wiederfinden muss
const dbg = (m) => { if (process.env.CLONE_DEBUG) process.stderr.write('[clone] ' + m + '\n'); };
// „Performs a copy of the Spell" schließt Kosten UND Einschränkungen ein (Al, 24.10.): jede Karte mit einem Limit je Zug/Partie oder einer „must be the only/first …"-Bedingung ist nicht klonbar.
const NICHT_KLONBAR = [
  /can only (?:play|use|activate) (?:1|one)\b[^.]*\bper (?:turn|game)/i,   // „You can only play 1 "X" per turn" / „Each Hero can only use 1 "X" per turn"
  /\bonce per (?:turn|game)\b/i,
  /\bper game\b/i,
  /must be the (?:only|first)\b/i,                                         // „This must be the only Attack you play this turn" (Knife Throw, Eraser Beam, Off with His Head! …)
];
const GS_MARKEN = ['_spellCancelled', '_spellNegatedByEffect', '_negationWhole', '_spellPlacedOnBoard', '_spellReturnToHand', '_spellFreeAction', '_spellForcesActionConsume',
  '_spellDamageLog', '_spellExcludeTargets', '_immediateActionContext', '_surpriseCheckedHeroes', '_deferredRecoil'];

/** Steht dieses aufgezeichnete Ziel noch? (Held lebt / Kreatur an ihrem Platz; andere Zieltypen gelten als vorhanden) */
function zielSteht(engine, id) {
  const m = /^hero-(\d+)-(\d+)$/.exec(id);
  if (m) { const h = engine.gs.players[+m[1]]?.heroes?.[+m[2]]; return !!(h?.name && h.hp > 0); }
  const e = /^equip-(\d+)-(\d+)-(\d+)$/.exec(id);
  if (e) { const inst = engine.kreaturAnBrett(+e[1], +e[2], +e[3]); return !!(inst && inst.zone === 'support' && (inst.counters?.currentHp ?? 1) > 0); }
  return true;
}

module.exports = {
  activeIn: ['support'],
  sharesHpWithHero: true,              // „share 1 HP pool" — Puppets-Vertrag

  /** „You can only control 1": jede Beschwörung prüft es. */
  async beforeSummon(ctx) { return !kontrolliert(ctx._engine, ctx.cardOwner, CARD_NAME); },
  canSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    return !engine.cardInstances.some(c => c.zone === 'support' && c.name === CARD_NAME && !c.faceDown && (c.controller ?? c.owner) === pi && c.id !== ctx.card?.id);
  },

  /** CPU: die Kopie immer annehmen (die Standard-Ablehnung abbrechbarer Bestätigungen würde den Klon nie auslösen). */
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onHeroKO: companionHeldGefallen,    // der Held fällt → der Klon geht mit (kein eigener HP-Vorrat)

    // ★ Darion (geteilte Equip-Zone): „same target(s)" ist die konkrete KARTE. Die Aufzeichnung kennt nur die Platz-ID (`equip-<Seite>-<Held>-<Platz>`); bei einem Stapel bleibt der Platz
    // stehen, auch wenn die gewählte Karte weg ist — die Kopie würde dann eine ANDERE Karte des Stapels treffen (bei getrennten Zonen ist der Platz leer und das Ziel erloschen).
    // Darum merkt sich der Klon, aus welchen Plätzen während des Original-Wurfs eine Ausrüstung abgegangen ist; solche Ziele gelten bei der Kopie als erloschen.
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const rec = gs._klonAufnahme;
      if (!rec || gs._klonWiedergabe || gs._klonKopie) return;
      const weg = ctx.leavingCard;
      if (!weg || ctx.fromZone !== 'support' || !engine.istEquipArtifact(weg)) return;
      (rec.wegAusPlatz = rec.wegAusPlatz || []).push(`equip-${engine.physicalSide(weg)}-${weg.heroIdx}-${weg.zoneSlot}`);
    },

    afterSpellResolved: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || inst.faceDown) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      dbg('afterSpellResolved ' + ctx.spellName);
      if (gs._klonKopie) return;                                       // eine Kopie löst keine Kopie aus
      const rec = gs._klonAufnahme;
      if (!rec || rec.name !== ctx.spellName) { dbg('keine Aufzeichnung ' + ctx.spellName); return; }                  // nur Würfe über den normalen Spielweg tragen eine Aufzeichnung

      // ── der „corresponding Hero" hat gewirkt ──
      const feld = engine.physicalSide(inst);                           // Brettseite des Klons = Reihe seines Helden
      if (ctx.heroOwner !== feld || ctx.heroIdx !== inst.heroIdx) { dbg('anderer Held'); return; }
      const pi = engine.kontrolleurVon(inst);
      if (ctx.casterIdx !== pi) { dbg('anderer Wirker'); return; }                                 // der Kontrolleur des Klons spielt die Karte
      const hero = gs.players[feld]?.heroes?.[inst.heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // ── Normal Attack oder Spell ──
      const cd = ctx.spellCardData;
      if (!cd || cd.subtype !== 'Normal' || !(hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell'))) return;
      if (hasCardType(cd, 'Creature') || hasCardType(cd, 'Artifact') || hasCardType(cd, 'Potion')) return;

      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return;

      // ── ist die Karte kopierbar? ──
      const name = ctx.spellName;
      const script = loadCardEffect(name);
      if (!script?.hooks?.onPlay) { dbg('kein onPlay'); return; }
      if (script.oncePerGame || script.oncePerGameKey || NICHT_KLONBAR.some(r => r.test(cd.effect || ''))) { dbg('Limit/Einschränkung der Karte'); return; }   // ein zweites Wirken gibt das Limit nicht her
      const wegAusPlatz = new Set(rec.wegAusPlatz || []);   // Darion: Plätze, aus denen das Original eine Ausrüstung abgezogen hat (das gewählte Ziel ist dort weg)
      const eintraege = rec.eintraege.map(e => ({ title: e.title, ids: e.ids.filter(id => zielSteht(engine, id) && !wegAusPlatz.has(id)) }));
      if (rec.eintraege.length > 0 && !eintraege.some(e => e.ids.length > 0)) { dbg('Ziele weg'); return; }   // keines der Ziele steht noch → „same target(s)" gibt es nicht mehr
      // Einschränkungen der Karte gelten für die Kopie (Al, 24.10.): die Voraussetzungen des SPIELENS (`spellPlayCondition`) müssen jetzt noch erfüllt sein.
      try { if (script.spellPlayCondition && !script.spellPlayCondition(gs, pi, engine)) { dbg('spellPlayCondition false'); return; } }
      catch (err) { console.error('[Clone] spellPlayCondition', name, err.message); return; }

      // ── „may": der Spieler entscheidet ──
      const ja = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Perform an exact copy of ${name} against the same target(s)?`,
      });
      if (!ja) return;
      // ── Kosten der Karte (wie Magic Mirror: nur die Zauber-Form `payActivationCost(ctx)`) — abbrechbar, darum VOR dem Stempel des Limits ──
      const synth = engine._trackCard(name, pi, 'hand', inst.heroIdx, -1);
      if (feld !== pi) synth.heroOwner = feld;
      if (typeof script.payActivationCost === 'function' && script.payActivationCost.length <= 1) {
        let bezahlt;
        try { bezahlt = await script.payActivationCost(engine._createContext(synth, {})); }
        catch (err) { console.error('[Clone] payActivationCost', name, err.message); bezahlt = false; }
        if (bezahlt === false) { engine._untrackCard(synth.id); engine.sync(); dbg('Kosten nicht zahlbar'); return; }   // nichts passiert, das Limit bleibt frei
      }
      // COMMIT: ab hier gibt es keinen Abbruch mehr
      if (!engine.claimHOPT(HOPT_KEY, pi)) { engine._untrackCard(synth.id); return; }
      engine.log('clone_copy', { player: gs.players[pi]?.username, card: name, hero: hero.name });
      await engine.showTriggeredEffect(CARD_NAME, { source: inst });
      companionGlow(engine, inst);
      await engine._delay(ANIM_MS);

      // ── die Kopie: Zustand des äußeren Wurfs sichern, wirken, zurückstellen ──
      const gesichert = {};
      for (const k of GS_MARKEN) gesichert[k] = Object.prototype.hasOwnProperty.call(gs, k) ? gs[k] : undefined;
      for (const k of GS_MARKEN) delete gs[k];
      gs._spellDamageLog = [];
      gs._spellExcludeTargets = [];
      const wirkerAlt = gs._wirkerSeite;
      gs._wirkerSeite = { pi, heroIdx: inst.heroIdx, heroOwner: feld };
      const aufnahmeAlt = gs._klonAufnahme;
      delete gs._klonAufnahme;
      gs._klonKopie = { heroIdx: inst.heroIdx, feld, spellName: name, cloneId: inst.id };   // Quelle der Kopie ist der Klon (Engine `istKlonQuelle`)
      // „Der Clone SELBST führt die Kopie aus": Animationen (Dash, Projektil, Aufschlag) starten an seinem Platz, Surprise-/Rückstoß-Fenster sehen ihn als Angreifer
      // (Demon's-Gate-Muster: `_spellCasterOverride` + `_spellCasterCreature`); Fähigkeitsstufe und ATK bleiben die des Helden (`_wirkerSeite`, Hero-Kontext der Karte).
      const casterOvrAlt = gs._spellCasterOverride;
      const casterKreaturAlt = gs._spellCasterCreature;
      gs._spellCasterOverride = { owner: pi, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot };
      gs._spellCasterCreature = inst;
      gs._klonWiedergabe = { pi, queue: eintraege.map(e => ({ title: e.title, ids: e.ids.slice() })) };
      const geloeschtVor = (gs.players[pi].deletedPile || []).filter(n => n === name).length;
      try {
        await engine.runHooks('onPlay', {
          _onlyCard: synth, playedCard: synth, cardName: name, zone: 'hand', heroIdx: inst.heroIdx, _skipReactionCheck: true,
        });
      } catch (err) {
        console.error(`[Clone] copy of "${name}" failed:`, err.message);
      } finally {
        delete gs._klonKopie;
        if (casterOvrAlt === undefined) delete gs._spellCasterOverride; else gs._spellCasterOverride = casterOvrAlt;
        if (casterKreaturAlt === undefined) delete gs._spellCasterCreature; else gs._spellCasterCreature = casterKreaturAlt;
        delete gs._klonWiedergabe;
        // „Delete this card" einer kopierten Karte (Meditation …): die Kopie ist keine Karte — das Duplikat im Löschstapel wieder nehmen
        if (script.deleteOnUse) {
          const pile = engine.handKartenBesitzerPs(gs.players[pi], name).deletedPile;
          const jetzt = pile.filter(n => n === name).length;
          for (let k = 0; k < jetzt - geloeschtVor; k++) { const i = pile.lastIndexOf(name); if (i >= 0) pile.splice(i, 1); }
        }
        if (!gs._spellPlacedOnBoard) engine._untrackCard(synth.id);
        for (const k of GS_MARKEN) { if (gesichert[k] === undefined) delete gs[k]; else gs[k] = gesichert[k]; }
        if (wirkerAlt === undefined) delete gs._wirkerSeite; else gs._wirkerSeite = wirkerAlt;
        if (aufnahmeAlt) gs._klonAufnahme = aufnahmeAlt;
        engine.sync();
      }
    },
  },
};
