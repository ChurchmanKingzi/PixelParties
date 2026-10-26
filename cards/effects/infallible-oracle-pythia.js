// ═══════════════════════════════════════════
//  CARD EFFECT: „Infallible Oracle Pythia"
//  Creature (Normal, Lv 1, 50 HP, Summoning Magic)
//
//  „When you summon this Creature, choose any target on the board. Place 1 Pythia Counter onto this card at the beginning of each of your turns.
//   When the third Pythia Counter is placed on this card, immediately defeat the chosen target. When this Creature would be defeated, you may
//   sacrifice another target you control to fully heal its HP instead."
//
//  Kunst: grünhaarige Seherin zwischen vier grünen Flammenschalen — daher die Animation `pythia_flames` (grüne Pixel-Flammen).
//
//  ── Vorgaben des Spielgestalters (Al) ────────────────────────────
//  • Pythia „stirbt" bei der Selbstheilung nicht wirklich: KEINE Kill-/On-Death-Trigger FÜR SIE; solange sie nicht wirklich stirbt, behält sie ihre Counter.
//  • Das Besiegen zeigt GRÜNE FLAMMEN um das Ziel (wie die Flammenschalen auf der Karte).
//  • Das vorgemerkte Ziel trägt ein Abzeichen „Death Foreseen by Pythia" (mit Tooltip; Baustein `_pythia-shared.js`, Client `StatusBadges`).
//
//  ── Bauart ──────────────────────────────────────────────────────
//  ① „When you summon this Creature, choose any target on the board": `onPlay` (auch Platzieren/Effektbeschwörung, wie Wire Hatchling); jedes lebende Ziel beider
//     Seiten — Helden UND Kreaturen, auch Pythia selbst und eigene Karten (`side:'any'`). PFLICHTWAHL (`cancellable:false`, Regel W12: wer die Kreatur liegen hat, MUSS wählen;
//     ohne legales Ziel fizzelt der Effekt). Das Ziel wird als Plan an der Instanz vermerkt (`counters.pythiaPlan`); die Marke am Ziel leitet `_pythia-shared.abgleichen` ab.
//  ② „Place 1 Pythia Counter … at the beginning of each of your turns": `onTurnStart` des KONTROLLEURS. Wie bei Nachbarkarten ruht der Effekt bei Frost/Betäubung/Negation
//     der Kreatur (Engine-Hook-Filter): dann wird kein Counter gelegt (der Plan bleibt bestehen). Es gibt keine Obergrenze; „third" = der Zähler steht nach dem Legen genau auf 3
//     (einmalig; danach nichts mehr, auch kein Reset).
//  ③ „immediately defeat the chosen target": im selben Moment (Zugbeginn) über den Kill-Baustein `engine.actionDefeat(…, { wirkungsSchutz: true })` — Helden: normale Heldentod-
//     Pipeline (Siegbedingung inklusive), Kreaturen: `actionDestroyCard` mit allen Todes-Triggern. Effekt-Schutz (Immunität, Resistance, Gate …) gilt, Schadens-Schutz nicht.
//     Verfallener Plan (Kreatur zwischendurch besiegt/vom Brett — eine wiederbelebte Kreatur ist eine neue Instanz —, Pythia vom Brett): Pythia zählt weiter, am Ende passiert nichts.
//     HELDEN behalten Plan und Marke über Tod und Wiederbelebung (Al): beim dritten Zähler stirbt der Held, falls er dann nicht gerade tot ist; war er zwischendurch tot und
//     wurde wiederbelebt, trifft es ihn trotzdem. Ist er beim dritten Zähler tot, passiert nichts (der Plan ist verbraucht).
//  ④ „When this Creature would be defeated, you may sacrifice another target you control to fully heal its HP instead": Engine-Vertrag `selfPreDefeat` (siehe
//     `_checkCreaturePreDefeatHandReactions`), gilt für Schaden, Zerstörung und Insta-Kill-Effekte; NICHT für ein Opfer als Kosten (dort entscheidet der Spieler selbst) und
//     nicht für das unaufhaltsame Besiegen. „Target" wörtlich: Helden UND Kreaturen, die man kontrolliert, außer Pythia selbst (Annahme, Al entscheidet). Das Opfer wird WIRKLICH
//     besiegt (volle Pipeline, seine On-Death-/On-Sacrifice-Trigger feuern, Hero: `isSacrifice`), Pythia heilt auf volle Max-HP OHNE Todes-Pipeline (Counter, Plan, Statuswerte
//     bleiben). Abbruch („may") = Pythia wird normal besiegt. Wird das Opfer selbst gerettet (Barrier of Undying, Guardian Angel …), heilt Pythia nicht und stirbt.
//     Gibt es kein anderes Ziel, entfällt die Frage. Ruht der Effekt (Frost/Betäubung/Negation), greift der Ersatz nicht.
//  • Verlässt Pythia das Brett (Tod, Hand, Deck …), verfallen Counter und Plan (neue Instanz = neuer Anlauf); Bewegen auf dem Brett behält beides.
// ═══════════════════════════════════════════

const P = require('./_pythia-shared');
const { ausgegrauteRestkarten } = require('./_target-dim-shared');

const CARD_NAME = P.CARD_NAME;
const ANIM = 'pythia_flames';
const DRITTER = 3;

/** Ankerdaten für `play_zone_animation` am Ziel (Held: Zone −1). */
function anker(engine, z) {
  return z.kind === 'hero'
    ? { owner: z.owner, heroIdx: z.heroIdx, zoneSlot: -1 }
    : { owner: engine.physicalSide(z.inst), heroIdx: z.inst.heroIdx, zoneSlot: z.inst.zoneSlot };
}

function zeigeFlammen(engine, z, phase, duration) {
  try { engine._broadcastEvent('play_zone_animation', { type: ANIM, phase, duration, ...anker(engine, z) }); } catch { /* Bild ist Beiwerk */ }
}

/** Quellenobjekt der Pythia für Kill/Opfer. */
function quelleVon(engine, inst) {
  const pi = inst.controller ?? inst.owner;
  return { name: CARD_NAME, owner: pi, controller: pi, heroIdx: inst.heroIdx, heroOwner: engine.physicalSide(inst), zoneSlot: inst.zoneSlot };
}

/** Maximale HP einer Kreatur (gedruckt bzw. gesetzt). */
function maxHpVon(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  return inst.counters?.maxHp ?? cd?.hp ?? 0;
}

/** Opferbare Ziele von `pi` außer Pythia: Kreaturen (Opfer-Regeln der Engine) und lebende Helden — Picker-Einträge. */
function opferZiele(engine, pi, selbst) {
  const out = [];
  for (const c of engine.getSacrificableCreatures(pi)) {
    const inst = c.inst;
    if (!inst || inst.id === selbst.id || inst.zone !== 'support') continue;
    const seite = engine.physicalSide(inst);
    out.push({ id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
  }
  for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(pi)) {
    if (!hero?.name || !(hero.hp > 0)) continue;
    out.push({ id: `hero-${physOwner}-${heroIdx}`, type: 'hero', owner: physOwner, heroIdx, cardName: hero.name });
  }
  return out;
}

/** Wert eines Ziels für die CPU-Wahl (höher = lohnender zu töten). */
function zielWert(engine, t) {
  if (t.type === 'hero') {
    const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    return 1000 + (h?.hp || 0) / 10 + (h?.atk || 0);
  }
  const inst = t.cardInstance;
  const cd = inst ? (engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name]) : null;
  return (cd?.level || 0) * 40 + (inst ? maxHpVon(engine, inst) : 0) / 10;
}

/** Der dritte Zähler liegt: das Ziel fällt. */
async function urteil(engine, inst) {
  const plan = inst.counters?.[P.PLAN];
  const pi = inst.controller ?? inst.owner;
  const z = P.zielVon(engine, plan);          // nur ein LEBENDES Ziel: ist der Held jetzt gerade tot, passiert nichts (er behielt den Plan nur bis hierher)
  if (!z) {                                  // Ziel zwischendurch weg bzw. gerade tot: nichts passiert
    delete inst.counters[P.PLAN];
    engine.log('pythia_fizzle', { player: engine.gs.players[pi]?.username, target: plan?.cardName || null });
    engine.sync();
    return;
  }
  zeigeFlammen(engine, z, 'doom', 1500);
  await engine._delay(1150);                  // die Flammen lodern, dann fällt das Ziel
  const z2 = P.zielVon(engine, inst.counters?.[P.PLAN]);   // zwischen Flammen und Urteil neu prüfen
  if (!z2 || inst.zone !== 'support') { engine.sync(); return; }
  const ziel = z2.kind === 'hero' ? z2.hero : z2.inst;
  const name = z2.kind === 'hero' ? z2.hero.name : z2.inst.name;
  delete inst.counters[P.PLAN];               // der Plan ist erfüllt — die Marke fällt, auch wenn der Kill an einem Schutz scheitert
  P.abgleichen(engine);
  engine.log('pythia_defeat', { player: engine.gs.players[pi]?.username, target: name });
  const r = await engine.actionDefeat(quelleVon(engine, inst), ziel, { reason: CARD_NAME, sourceName: CARD_NAME, damageType: 'creature', wirkungsSchutz: true });
  engine.sync();
  return r;
}

module.exports = {
  activeIn: ['support'],
  requiresTarget: true,   // Tor für Blinded (`_hooks.js`)

  /** CPU: Zielwahl (Plan) und Opferwahl (Selbstheilung; `config._pythiaOpfer` = Instanz-ID der Pythia, nie das Objekt selbst — die CPU protokolliert die Konfiguration). */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets = [], config = {}, playerIdx } = payload || {};
    if ((config.source || config.title) !== CARD_NAME) return undefined;
    const frei = validTargets.filter(t => t && !t.ineligible);
    if (config._pythiaOpfer) {
      // Nur Kreaturen opfern, nie Helden; nur wenn Pythias Plan noch lebt und das Opfer billig ist.
      const inst = (engine.cardInstances || []).find(c => c.id === config._pythiaOpfer);
      if (!inst?.counters?.[P.PLAN] || !((inst.counters[P.ZAEHLER] || 0) >= 1)) return [];
      const kreaturen = frei.filter(t => t.type === 'equip' && t.cardInstance);
      if (kreaturen.length === 0) return [];
      kreaturen.sort((a, b) => maxHpVon(engine, a.cardInstance) - maxHpVon(engine, b.cardInstance));
      const billig = kreaturen[0];
      return maxHpVon(engine, billig.cardInstance) <= 100 ? [billig.id] : [];
    }
    if (frei.length === 0) return undefined;
    const gegner = frei.filter(t => {
      if (t.type === 'hero') { const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx]; return engine.heroSideOf(t.owner, h) !== playerIdx; }
      return t.cardInstance && (t.cardInstance.controller ?? t.cardInstance.owner) !== playerIdx;
    });
    // Der wertvollste Gegner. Ist keiner wählbar (Erstrunden-Schutz des Gegners, Zielschutz), den WERTLOSESTEN eigenen Treffer nehmen — nie einen eigenen Helden, wenn es eine Kreatur gibt.
    if (gegner.length) { gegner.sort((a, b) => zielWert(engine, b) - zielWert(engine, a)); return [gegner[0].id]; }
    frei.sort((a, b) => zielWert(engine, a) - zielWert(engine, b));
    return [frei[0].id];
  },

  /**
   * ④ Ersatz der Niederlage (Engine: `_checkCreaturePreDefeatHandReactions` → `_creatureSelfPreDefeat`). `true` = Pythia ist gerettet (volle HP, kein Tod).
   * @param {object} source  was sie besiegen würde · @param {string} type  'damage'-Typ bzw. 'destroy'
   */
  async selfPreDefeat(engine, inst, source, amount, type, info = {}) {
    if (info.isSacrifice) return false;            // ein Opfer als Kosten ist die eigene Entscheidung des Spielers
    if (!inst || inst.zone !== 'support' || inst._pythiaRettet) return false;
    const pi = inst.controller ?? inst.owner;
    const ziele = opferZiele(engine, pi, inst);
    if (ziele.length === 0) return false;          // kein anderes Ziel: die Frage entfällt
    inst._pythiaRettet = true;                     // keine zweite Frage, solange die erste läuft
    try {
      const wahl = await engine.promptEffectTarget(pi, [...ziele, ...ausgegrauteRestkarten(engine, ziele)], {
        title: CARD_NAME, source: CARD_NAME,
        description: `${CARD_NAME} would be defeated! You may sacrifice another target you control to fully heal her instead.`,
        confirmLabel: '🔥 Sacrifice!', confirmClass: 'btn-danger', cancellable: true, redSelect: true,
        maxTotal: 1, minRequired: 1, previewCardName: CARD_NAME, dealsDamage: false,
        _pythiaOpfer: inst.id,
      });
      if (!wahl || wahl.length === 0) return false;   // „may": abgelehnt → sie wird normal besiegt
      const opfer = ziele.find(t => t.id === wahl[0]);
      if (!opfer) return false;
      const quelle = quelleVon(engine, inst);
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      let geopfert = false;
      if (opfer.type === 'hero') {
        const held = engine.gs.players[opfer.owner]?.heroes?.[opfer.heroIdx];
        if (!held?.name || !(held.hp > 0)) return false;
        zeigeFlammen(engine, { kind: 'hero', owner: opfer.owner, heroIdx: opfer.heroIdx }, 'burn', 1100);
        await engine._delay(800);
        const r = await engine.actionDefeatHero(quelle, held, { reason: CARD_NAME, respectFirstTurnProtection: false, isSacrifice: true });
        geopfert = !!r?.defeated;
      } else {
        const v = opfer.cardInstance;
        if (!v || v.zone !== 'support') return false;
        zeigeFlammen(engine, { kind: 'creature', inst: v }, 'burn', 1100);
        await engine._delay(800);
        geopfert = !!(await engine.opfereKreatur(v, quelle, { animation: false }));
      }
      if (!geopfert || inst.zone !== 'support' || !engine.cardInstances.includes(inst)) {
        engine.log('pythia_save_failed', { player: engine.gs.players[pi]?.username, sacrificed: opfer.cardName });
        return false;                              // das Opfer wurde gerettet bzw. Pythia ist unterdessen weg
      }
      // Volle Heilung, ohne Todes-Pipeline. Die Engine-Heilung zuerst (Haken wie `afterCreatureHeal`), danach auf das Maximum nageln.
      const maxHp = maxHpVon(engine, inst);
      if (maxHp > 0) {
        await engine.actionHealCreature({ name: CARD_NAME, owner: pi, controller: pi }, inst, maxHp);
        if ((inst.counters.currentHp ?? maxHp) < maxHp) inst.counters.currentHp = maxHp;
      }
      delete inst.counters._dyingThisBatch;
      zeigeFlammen(engine, { kind: 'creature', inst }, 'save', 1000);
      engine.log('pythia_save', { player: engine.gs.players[pi]?.username, sacrificed: opfer.cardName, hp: inst.counters.currentHp ?? maxHp });
      engine.sync();
      await engine._delay(250);
      return true;
    } finally {
      delete inst._pythiaRettet;
    }
  },

  hooks: {
    /** ① Beschwören: Ziel wählen und als Plan vermerken. */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (ctx.playedCard?.id !== inst?.id || inst.zone !== 'support') return;
      const pi = inst.controller ?? inst.owner;

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'other',
        dealsDamage: false,   // Kill-Effekt ohne Schaden: reine Schadensminderer-Reaktionen bleiben draußen (wie Lunatic Golem Stufe 5)
        title: CARD_NAME,
        description: 'Choose any target on the board — it is doomed: when the third Pythia Counter is placed on Pythia, it is defeated.',
        confirmLabel: '🔮 Foresee Death',
        confirmClass: 'btn-danger',
        cancellable: false,   // pflichtwahl: Kartentext erzwingt die Wahl (Regel W12: liegt die Kreatur einmal da, MUSS man wählen); ohne legales Ziel fizzelt der Effekt
      });
      if (!ziel) return engine.summonEffektFizzelt(inst, CARD_NAME, { playerIdx: pi });

      let plan = null;
      if (ziel.type === 'hero') {
        const held = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (held?.name && held.hp > 0) plan = { kind: 'hero', owner: ziel.owner, heroIdx: ziel.heroIdx, cardName: held.name };
      } else {
        const v = ziel.cardInstance || engine.cardInstances.find(c => c.zone === 'support' && engine.physicalSide(c) === ziel.owner && c.heroIdx === ziel.heroIdx && c.zoneSlot === ziel.slotIdx);
        if (v && v.zone === 'support') plan = { kind: 'creature', instId: v.id, cardName: v.name };
      }
      if (!plan || inst.zone !== 'support') return engine.summonEffektFizzelt(inst, CARD_NAME, { playerIdx: pi });

      inst.counters[P.PLAN] = plan;
      if (!(inst.counters[P.ZAEHLER] > 0)) inst.counters[P.ZAEHLER] = 0;
      const z = P.zielVon(engine, plan);
      if (z) zeigeFlammen(engine, z, 'mark', 900);
      engine.log('pythia_foresee', { player: engine.gs.players[pi]?.username, target: plan.cardName });
      P.abgleichen(engine);
      engine.sync();
      await engine._delay(350);
    },

    /** ② Zugbeginn des Kontrolleurs: Counter legen; der dritte vollstreckt. */
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || engine.gs.result) return;
      const pi = inst.controller ?? inst.owner;
      if (engine.gs.activePlayer !== pi) return;
      const n = (inst.counters[P.ZAEHLER] || 0) + 1;
      inst.counters[P.ZAEHLER] = n;
      P.abgleichen(engine);
      const z = P.zielVon(engine, inst.counters[P.PLAN]);
      if (z) {
        // Sichtbar nur, wenn es etwas anzukündigen gibt (Plan lebt); sonst stilles Zählen
        await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      }
      engine._broadcastEvent('play_zone_animation', { type: ANIM, phase: 'tick', duration: 650, owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
      engine.log('pythia_counter', { player: engine.gs.players[pi]?.username, counters: n });
      engine.sync();
      await engine._delay(300);
      if (n === DRITTER) await urteil(engine, inst);
    },
  },
};
