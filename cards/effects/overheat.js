'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Overheat"
//  Spell (Decay Magic + Destruction Magic Lv1, Normal)
//
//  „Choose an Artifact that is equipped to a Hero and send it to the discard pile. That Hero takes 150 damage. If the user has at least
//   Decay Magic 1 and Destruction Magic 1, this counts as an additional Action."
//
//  ── ZIEL: EIN AUSGERÜSTETES ARTEFAKT ────────────────────────────────────
//  BEIDE Seiten, auch die eigene Ausrüstung: Artefakt-Karten, die in der Support Zone eines LEBENDEN Helden als Ausrüstung zählen (`isEquipInZone`;
//  Gegenstück zu Disarm). Nicht wählbar: unbewegliche Karten (`immovable`), Cardinal Beasts und verdeckte Karten. Es wird die Karte gewählt, nicht der
//  Held — Resistance & Co. fragen deshalb nicht (wie bei Fire Bomb, Pressure Projectile: „Effekte, die die Artefakte selbst wählen"). Alles Übrige
//  (Helden, Kreaturen, Nicht-Ausrüstung) steht AUSGEGRAUT in der Liste (`ausgegrauteRestkarten`). Ohne ausgerüstetes Artefakt ist die Karte grau
//  (`spellPlayCondition`). Abbruch der Wahl bringt die Karte zurück auf die Hand (`gs._spellCancelled`).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  Erst wandert das Artefakt in die Ablage seines BESITZERS (`sendBoardCardToDiscard`: Leave-Hooks, der Bonus fällt vom Helden), dann nimmt der Träger 150
//  Schaden (Typ `destruction_spell`). Beides sind zwei Sätze: Bleibt das Artefakt an einer Schutzklausel hängen, fällt der Schaden trotzdem.
//  Die Artefakt-Wahl IST der Treffer des Trägers: die Zielwahl trägt `hitsBearer: true`, damit Umleiter wissen, dass mit dem Artefakt sein Held getroffen wird. Redirecting Aura am
//  Träger lenkt deshalb auf ein Artefakt eines ANDEREN eigenen Helden um (die Zielliste = Artefakte an lebenden Helden erzwingt „ein anderer Held mit Equip"); dann trifft Overheat
//  dieses Artefakt und seinen Träger. Alle übrigen Umleiter/Negierer des Zielwahl-Fensters (Anti-Magnet, Challenge, Surprises …) gelten wie bei jeder Zielwahl.
//  ★ Spielgestalter-Entscheidung 17.11.2026 (ANG-11/ANG-15): Overheat wählt ein ARTEFAKT, und das ist regeltechnisch kein „target" (Ziele sind nur Helden und Kreaturen). Daraus folgt:
//    • Bartas/Grisgar („exactly 1 target" → Zweitwurf) lösen hier ABSICHTLICH nicht aus — es wurde kein Ziel gewählt. Keine Änderung, nur festgehalten.
//    • Der Träger-Schaden öffnet dennoch die Fenster eines Spell-TREFFERS vollständig: Surprises (Frost Rune, Booby Trap …, Schritt „Treffer-Fenster des Trägers"), die Hand-/Brett-Reaktionen des Post-Target-
//      Hubs (Anti Magic Shield, Test Flight, Unreasonable Anger, Barrier of Faith, Divine Gift of Rain, Future Tech Escape Device, Castling …; Auslegung `nurTreffer`: Reaktionen auf eine WAHL
//      bleiben zu) und die Pre-Schadens-Fenster im Schadenspfad (Spectral Armor, Bamboo Shield …).
//  Der Schaden selbst ist ein Einzelziel-Treffer (`festesZiel`): Schutz der Bauart „solange es andere Ziele gibt" (Submerged, Dive Down) greift nicht, die Quelle kann nur diesen
//  Helden treffen.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „If the user has at least Decay Magic 1 AND Destruction Magic 1": BEIDE Schulen einzeln mindestens Stufe 1 (nicht die Summe!), gezählt mit
//  `effectiveSchoolLevelForCaster` („as if"-Effekte wie Demon's Gate und Performance-Wildcards zählen). `inherentAction` ist eine Funktion je Held. Die
//  Karte bleibt auch ohne beide Schulen spielbar (Stufenanforderung = Summe, z. B. Decay 2 allein), dann kostet sie die Aktion.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `overheat` (Pixelart, ANIM_REGISTRY): das Artefakt glüht auf, Hitzeflimmern, es platzt in glühende Splitter. Klänge in
//  ZONE_ANIM_SFX; Log `overheat`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { ausgegrauteRestkarten } = require('./_target-dim-shared');

const CARD_NAME = 'Overheat';
const DAMAGE = 150;
const DAUER_MS = 1200;       // Länge der Animation (deckt sich mit `overheat` im Client)
const PLATZEN_MS = 700;      // das Artefakt platzt bei ~600 ms (+100 ms Einbau-Versatz des Clients)
const NACH_MS = 380;         // Splitter noch ein Stück fliegen lassen, bevor der Zauber endet
const SCHULEN = ['Decay Magic', 'Destruction Magic'];

/** Alle ausgerüsteten, wegschickbaren Artefakte an lebenden Helden beider Seiten. */
function ausruestung(engine) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.immovable || inst.counters?._cardinalImmune) continue;
    const seite = engine.physicalSide(inst);
    const hero = engine.gs.players[seite]?.heroes?.[inst.heroIdx];
    if (!hero?.name || hero.hp <= 0) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    if (!engine.isEquipInZone(inst.name, inst)) continue;
    out.push(inst);
  }
  return out;
}

function artefaktZiel(engine, inst) {
  const seite = engine.physicalSide(inst);
  return {
    id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
    owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name,
    cardInstance: inst, _cardInstance: inst,
  };
}

/** Hat dieser Wirker beide Schulen mindestens auf Stufe 1? */
function beideSchulen(engine, pi, heroIdx) {
  const seite = engine.heldSeiteFuer ? engine.heldSeiteFuer(pi, heroIdx) : pi;
  return SCHULEN.every(s => engine.effectiveSchoolLevelForCaster(s, pi, heroIdx, seite) >= 1);
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // CPU: auch ohne beide Schulen spielbar (dann als normale Aktion).
  cpuMeta: { optionalInherent: true },

  /** „If the user has at least Decay Magic 1 and Destruction Magic 1, this counts as an additional Action." */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return beideSchulen(engine, pi, heroIdx);
  },

  /** Grau, solange nirgends ein wegschickbares Artefakt ausgerüstet ist. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return ausruestung(engine).length > 0;
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

      // ── 1. Das Artefakt ──
      const ziele = require('./_equip-stack-shared').gruppiereZiele(ausruestung(engine).map(i => artefaktZiel(engine, i)));   // Darion: ein Ziel je Stapelplatz, die Rueckfrage nennt nur die zulaessigen Karten
      if (ziele.length === 0) { gs._spellCancelled = true; return; }
      const gewaehlt = await engine.promptEffectTarget(pi, [...ziele, ...ausgegrauteRestkarten(engine, ziele)], {
        title: CARD_NAME, source: CARD_NAME,
        description: `Choose an Artifact equipped to a Hero. It is sent to the discard pile and its Hero takes ${DAMAGE} damage.`,
        confirmLabel: `🔥 Overheat!`, confirmClass: 'btn-danger',
        minRequired: 1, maxTotal: 1,
        exclusiveTypes: true, maxPerType: { equip: 1 },
        alwaysConfirmable: false,
        hitsBearer: true,       // die Wahl des Artefakts trifft seinen Träger (Redirecting Aura: Umleitung nur auf ein Artefakt eines anderen Helden)
        cancellable: true,
      });
      // ── In der Zielwahl NEGIERT (Frost Rune, Magic Mirror …) oder der Wirker dort besiegt (Booby Trap): der Zauber tut nichts — das Artefakt bleibt ausgerüstet, kein Schaden.
      // Beides geprüft (Negations-Marke UND Wirkerzustand), damit es nicht davon abhängt, welches Fenster die Marke setzt. Kein Abbruch (`_spellCancelled`): die Karte ist verbraucht.
      if (gs._spellNegatedByEffect || hero.hp <= 0) {
        engine.log('overheat_negated', { player: ps.username });
        engine.sync();
        return;
      }
      const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
      // Nach der Abfrage neu einsammeln — das Brett kann sich bewegt haben (Umleitung auf ein anderes Artefakt eingeschlossen).
      const treffer = id && ausruestung(engine).map(i => artefaktZiel(engine, i)).find(z => z.id === id);
      if (!treffer) { gs._spellCancelled = true; return; }

      const inst = engine.stapelWahlFuer(treffer);   // Darion: die gewaehlte Karte des Stapels, nicht die erste mit dieser ID
      const tSeite = treffer.owner;
      const tHeroIdx = treffer.heroIdx;
      const tHero = gs.players[tSeite]?.heroes?.[tHeroIdx];
      const quelle = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, heroOwner: heroSeite };

      // ── Treffer-Fenster des Trägers VOR der Ablage ──
      // „Die Artefakt-Wahl IST der Treffer des Trägers": Surprises, die den Zauber abwehren (Frost Rune, Booby Trap …), öffneten sonst erst beim Schaden in Schritt 3 — da wäre das Artefakt
      // schon in der Ablage, obwohl der Zauber negiert wurde. Wie `actionDealDamage` (Heldenfenster), nur früher; der Träger ist danach vorgemerkt, der Schaden fragt nicht noch einmal.
      const quelleFenster = engine._rewriteSourceForCreatureCaster ? engine._rewriteSourceForCreatureCaster(ctx.card) : ctx.card;
      if (tHero?.name && tHero.hp > 0 && (gs.players[tSeite]?.surpriseZones?.[tHeroIdx] || []).length > 0 && !engine.hasEffectImmunity(tSeite, tHeroIdx, ctx.card)) {
        const sr = await engine._checkSurpriseWindow(
          [{ type: 'hero', owner: tSeite, heroIdx: tHeroIdx, cardName: tHero.name }], quelleFenster, { damageType: 'destruction_spell' });
        if (sr?.effectNegated) {
          if ((gs._spellResolutionDepth || 0) > 0) gs._spellNegatedByEffect = true;
          engine.log('overheat_negated', { player: ps.username, artifact: treffer.cardName });
          engine.sync();
          return;
        }
        if (!gs._surpriseCheckedHeroes) gs._surpriseCheckedHeroes = new Set();
        gs._surpriseCheckedHeroes.add(`${tSeite}-${tHeroIdx}`);
      }
      if (gs._spellNegatedByEffect || hero.hp <= 0) { engine.sync(); return; }   // negiert oder der Wirker fiel dabei (Booby Trap): nichts passiert

      // ── Treffer-Fenster der Hand-/Brett-Reaktionen (Post-Target-Hub) VOR der Ablage ──
      // ★ Spielgestalter-Entscheidung 17.11.2026: „Pre-Schadens-Fenster SOLLTEN beim Overheat-Schaden aufgehen." Der Träger wird von einem SPELL getroffen: alle Reaktionen, deren Kartentext auf diese Lage
      // passt („is hit by an opponent's Spell": Anti Magic Shield; „would be hit": Test Flight; „is hit": Unreasonable Anger; „would be affected": Barrier of Faith, Divine Gift of Rain, Future Tech Escape
      // Device, Castling; „would take damage": Spectral Armor, Bamboo Shield …), bekommen ihr Fenster — wie bei jeder Zielwahl, nur mit dem Träger statt einer Wahl. Das Artefakt wird NICHT als Ziel
      // gewählt (Ziele sind nur Helden und Kreaturen): Reaktionen, die auf eine WAHL warten („is chosen": Invisibility Cloak, Chaorc Interception, Dream Dust, Switcheroo, Cool Tech Jetpack …), bleiben
      // zu (`nurTreffer`, gleiche Auslegung wie beim Flächenschlag). Negiert eine Reaktion den Zauber (Anti Magic Shield), bleibt das Artefakt ausgerüstet und es fällt kein Schaden.
      if (tHero?.name && tHero.hp > 0 && !engine.hasEffectImmunity(tSeite, tHeroIdx, ctx.card)) {
        const pt = await engine.preDamageMultiTargetWindow(quelleFenster,
          [{ type: 'hero', owner: tSeite, heroIdx: tHeroIdx, cardName: tHero.name }], { damageType: 'destruction_spell', nurTreffer: true });
        if (pt?.effectNegated || gs._spellNegatedByEffect) {
          engine.log('overheat_negated', { player: ps.username, artifact: treffer.cardName });
          engine.sync();
          return;
        }
        if (hero.hp <= 0) { engine.sync(); return; }
      }

      // ── Bild: das Artefakt glüht und platzt ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'overheat', zoneType: 'board', owner: tSeite, heroIdx: -1, zoneSlot: -1, duration: DAUER_MS,
        targets: [{ owner: tSeite, heroIdx: tHeroIdx, zoneSlot: treffer.slotIdx }],
        originOwner: heroSeite, originHeroIdx: heroIdx, originZoneSlot: -1,
      });
      await engine._delay(PLATZEN_MS);

      // ── 2. Ab in die Ablage ──
      const vorher = inst.zone;
      if (vorher === 'support') {
        await engine.sendBoardCardToDiscard(inst, { source: quelle, sourceName: CARD_NAME, sourceOwner: pi });
      }
      const weg = vorher === 'support' && inst.zone !== 'support';

      // ── 3. 150 Schaden an den Träger (die Umleitung der Wahl hat den Träger schon bestimmt) ──
      let getroffen = null;
      if (tHero?.name && tHero.hp > 0) {
        engine.sync();
        await ctx.dealDamage(tHero, DAMAGE, 'destruction_spell', { festesZiel: true });
        getroffen = tHero;
      }

      engine.log('overheat', {
        player: ps.username, artifact: treffer.cardName, hero: tHero?.name || null,
        discarded: weg, damaged: getroffen?.name || null, damage: DAMAGE,
      });
      engine.sync();
      await engine._delay(NACH_MS);
    },
  },

  /** CPU: gegnerische Ausrüstung zuerst — die teuerste/stärkste, eigene nur, wenn es keine andere gibt. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = promptData || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible && t.type === 'equip');
    if (frei.length === 0) return [];
    const fremd = frei.filter(t => t.owner !== playerIdx);
    const pool = fremd.length ? fremd : [];
    if (pool.length === 0) return [];   // nie das eigene Artefakt ohne Not
    const preis = (t) => {
      const cd = engine._getCardDB()[t.cardName];
      return Number(cd?.cost) || 0;
    };
    pool.sort((a, b) => preis(b) - preis(a));
    return [pool[0].id];
  },
};
