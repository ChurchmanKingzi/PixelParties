// ═══════════════════════════════════════════
//  CARD EFFECT: "Winged Haressassin"
//  Creature (Normal, Lv 0, 50 HP, Summoning Magic)
//
//  „Once per turn, when an opponent's card or effect chooses exactly one other
//   target you control, you may discard a card to redirect it to this Creature.
//   When this Creature is defeated by a card or effect redirected by this
//   effect, deal 150 damage to any target."
//
//  ── ① UMLEITUNG (Brett-Wächter `isBoardRedirect`, Muster Empty Armor / Anti-Magnetic Armor) ──
//  Die Engine öffnet nach JEDER Zielwahl ein Umleitungsfenster (`applyRedirectWindows`, je gewähltem Ziel einzeln; auch der Einzeltreffer
//  `trefferAlsWahl`); der Wächter sitzt im vierten Scan von `_checkTargetRedirectOnce`.
//  • „an opponent's card or effect": die Quelle gehört dem GEGNER (Kontrolle). Jede Art von Quelle zählt (Attack, Spell, Creature-Effekt, Heldeneffekt, Artefakt,
//    Potion, Ability, Surprise — „card or effect", wie Anti-Magnetic Armor). „Cannot be redirected"-Quellen (Truth-Seeing Eye, `cannotBeRedirected`) sperren
//    die Umleitung zentral (die Engine ruft den Wächter dann gar nicht), ebenso der Erste-Runden-Schutz.
//  • „chooses another target you control": das GEWÄHLTE Ziel ist ein Held oder eine Kreatur, die der Besitzer der Winged Haressassin KONTROLLIERT (Kontrolle,
//    nicht Brettseite) und NICHT diese Kreatur selbst. Flächeneffekte („all targets") wählen niemanden und lösen nichts aus; Ausrüstung/Anhängsel/Surprises/
//    Areas/Abilities und Spielerziele sind keine „targets you control" in diesem Sinn (nur Held/Kreatur).
//  • „chooses EXACTLY ONE … target" (Al 27.10.): das Angebot kommt nur, wenn die GESAMTWAHL des Effekts genau ein Ziel ist (`genauEinZiel`). KEIN Angebot — für keines der
//    Ziele —, wenn der Effekt mehrere Ziele wählt: Fireball mit zwei Zielen (`_redirectPickCount` > 1), Chain Lightning und andere Mehrfachketten (`_mehrTreffer`, von
//    `engine.trefferAlsWahl` gesetzt), Mehrfachwähler (`maxTotal`/`selectCount`/`max`/`maxTargets` > 1) auch dann, wenn nur ein Ziel gültig ist/gewählt wurde. Macht ein
//    Effekt nacheinander mehrere EINZELwahlen (jede eine eigene Zielwahl, z. B. „trigger this effect as many times"), gilt jede Einzelwahl als eigene Wahl.
//  • „redirect it to this Creature": die Kreatur muss in der Zielliste des Effekts stehen und wählbar sein (nicht `ineligible`: Zielschutz, Typ-/Level-Filter,
//    „cannot be chosen"). Sonst gibt es kein Angebot (kein Leerlauf). (Mehrere Ziele ⇒ ohnehin kein Angebot, damit kann die Kreatur nie doppelt getroffen werden.)
//  • „you may discard a card": Rückfrage („Ja/Nein", Engine-Standard des Brett-Wächters, CPU über `cpuResponse`), danach der Handabwurf als Kosten
//    (`zahleAbwurfKosten`, Abwurf-Konvention des Bestands: Boris erlässt die Kosten, Abbruch der Kartenwahl = keine Umleitung, nichts verbraucht; Kosten-Lernkanal
//    `costFor`). Ohne wählbare Handkarte (leere Hand, die auflösende Karte zählt nicht) kein Angebot.
//  • „Once per turn": je Exemplar (`_charges`, Schlüssel `wingedHaressRedirect`), verbraucht erst, wenn wirklich umgeleitet wird. Zwei Exemplare haben je ein
//    Angebot. Wie bei allen Umleitern fragt danach noch der Kontrolleur des NEUEN Ziels (Kette der Engine, Tiefe 8); leitet er weiter, ist der Effekt nicht mehr
//    „von diesem Effekt umgeleitet" auf diese Kreatur — sie wird dann nicht getroffen.
//
//  ── ② „DEFEATED BY A CARD OR EFFECT REDIRECTED BY THIS EFFECT" ──
//  Beim Umleiten merkt sich die Karte die Quelle des umgeleiteten Effekts (Name + Kontrolleur [+ Instanz]) in `gs._wingedHaressRedirects` (reine Daten, überlebt
//  Snapshot/Restore; Einträge gelten nur im Zug der Umleitung). Danach gibt es zwei Wege:
//  • SCHADEN: im Kreaturenschaden-Durchgang (`beforeCreatureDamageBatch` der Kreatur) bindet sich der ERSTE Treffer, dessen Quelle zu einem offenen Eintrag passt (derselbe
//    Zug, dieselbe Karte/derselbe Kontrolleur; liegt auf beiden Seiten eine Instanz-ID vor, muss sie gleich sein), an die Kreatur (Marke `_wingedHaressHit`) und verbraucht
//    den Eintrag. Fällt die Kreatur in diesem Durchgang (auch ein in der Flächenklammer aufgeschobener Tod), liest `onCreatureDeath` die Marke → der 150-Schaden-Effekt
//    feuert. Überlebt sie, räumt `afterCreatureDamageBatch` die Marke ab: ein späterer, NICHT umgeleiteter Treffer derselben Karte zählt nie.
//  • ZERSTÖREN/BESIEGEN (kein Schadenspfad, `ctx.type` fehlt am Todes-Hook): ein offener Eintrag zur Todesquelle genügt.
//  Fällt sie anders (direkt gewählt, andere Karte, Status-Tick, Opfer) — nichts. Wird der Effekt nach der Umleitung noch weiter umgeleitet (Kette), trifft er die Kreatur
//  nie, und der Eintrag verfällt am Zugende ungenutzt.
//  • „deal 150 damage to any target": Pflicht (kein „may"), Held ODER Kreatur beider Seiten, kanonische Zielwahl (`promptDamageTarget`: Schutz-/Umleitungs-
//    Fenster, ausgegraut, was nicht wählbar ist), Schadensart 'creature' (wie Haressassin: Kreatureneffekt), Kontrolleur der Kreatur ist der Verursacher. Die
//    Wirkung ist an die Kreatur gebunden: ruht sie (negiert/eingefroren/betäubt), feuert der Hook nicht (Engine-Filter).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `winged_haress_feathers` (Umleitung): kleine Pixel-Federn stieben vom ursprünglich gewählten Ziel und flattern zur Kreatur; sie schlägt kurz mit den Flügeln.
//  `winged_haress_slash` (150 Schaden): ein schneller, gerader Schnitt über das Ziel, hinter dem Federn fallen (Flügelschlag). Beide Pixelart (`ppSalve`, ANIM_REGISTRY),
//  Klänge in ZONE_ANIM_SFX. Der Schaden fällt im Einschlag (Server wartet `SCHNITT_MS`), die Umleitung wirkt erst nach dem Flug (`FLUG_MS`).
// ═══════════════════════════════════════════

const { usesLeft, spendUse } = require('./_charges');

const CARD_NAME = 'Winged Haressassin';
const DAMAGE = 150;
const ZAEHLER = { key: 'wingedHaressRedirect', max: 1 };

const ANIM_FEDERN = 'winged_haress_feathers';
const ANIM_FEDERN_MS = 900;     // Länge von `winged_haress_feathers` im Client (ENDE)
const FLUG_MS = 620;            // Ankunft der Federn bei der Kreatur — dann darf der Effekt auf ihr auflösen
const ANIM_SCHNITT = 'winged_haress_slash';
const ANIM_SCHNITT_MS = 1200;   // Länge von `winged_haress_slash` im Client (ENDE)
const SCHNITT_MS = 330;         // Einschlag des Schnitts — dann fällt der Schaden

const REGISTER = '_wingedHaressRedirects';

// ─── HELFER ──────────────────────────────────

/** Die Kreatur selbst als Eintrag in der Zielliste des Effekts (wählbar) — oder null. */
function eigenerEintrag(inst, validTargets) {
  return (validTargets || []).find(t => t && t.type === 'equip' && !t.ineligible && (
    (t.cardInstance && t.cardInstance.id === inst.id)
    || (t._cardInstance && t._cardInstance.id === inst.id)
    || (t.owner === inst.owner && t.heroIdx === inst.heroIdx && t.slotIdx === inst.zoneSlot && !t.cardInstance && !t._cardInstance)
  )) || null;
}

/** Ist das gewählte Ziel ein „anderes Ziel", das `ownerIdx` kontrolliert (lebender Held oder offene Kreatur ≠ diese)? */
function passendesZiel(engine, ownerIdx, inst, selected) {
  if (!selected) return false;
  if (selected.type === 'hero') {
    const h = engine.gs.players[selected.owner]?.heroes?.[selected.heroIdx];
    return !!(h?.name && h.hp > 0) && engine.zielSeite(selected) === ownerIdx;
  }
  if (selected.type !== 'equip') return false;
  const ci = selected.cardInstance || selected._cardInstance;
  if (!ci || ci.id === inst.id || ci.zone !== 'support' || ci.faceDown) return false;
  if (!engine._istKreaturenInstanz(ci)) return false;               // Ausrüstung/Anhängsel sind keine „targets" in diesem Sinn
  if (!((ci.counters?.currentHp ?? 1) > 0)) return false;
  return (ci.controller ?? ci.owner) === ownerIdx;
}

/**
 * „chooses EXACTLY ONE other target": hat der Effekt insgesamt genau ein Ziel gewählt (Al 27.10.)? Nein, wenn
 *  • das Fenster mehrere gewählte Ziele sieht (`_redirectPickCount` > 1: Fireball mit zwei Zielen, Mehrfachwahlen),
 *  • der Wähler MEHRERE Ziele erlaubt, auch wenn nur eines gewählt wurde (Obergrenze `maxTotal`/`selectCount`/`max`/`maxTargets` > 1, Untergrenze > 1 —
 *    „Mehrfachziel-Karte mit nur einem gültigen Ziel": der Effekt wählt trotzdem mehrere),
 *  • der Treffer ein Einzelglied einer Mehrfachkette ist (`_mehrTreffer`, `engine.trefferAlsWahl`: Chain Lightning & Co.).
 * Effekte, die nacheinander mehrere EINZELwahlen machen (jede eine eigene Zielwahl), gelten je Wahl als eigener Fall.
 */
function genauEinZiel(config) {
  const c = config || {};
  if ((c._redirectPickCount ?? 1) !== 1) return false;
  if (c._mehrTreffer) return false;
  for (const k of ['maxTotal', 'selectCount', 'max', 'maxTargets']) if (typeof c[k] === 'number' && c[k] > 1) return false;
  if ((c.minRequired ?? c.minSelect ?? 0) > 1) return false;
  return true;
}

/** Bildschirmanker (physische Brettseite) eines gewählten Ziels. */
function anker(engine, t) {
  if (t.type === 'hero') return { owner: t.owner, heroIdx: t.heroIdx, zoneSlot: -1 };
  const ci = t.cardInstance || t._cardInstance;
  if (ci) return { owner: engine.physicalSide(ci), heroIdx: ci.heroIdx, zoneSlot: ci.zoneSlot };
  return { owner: t.owner, heroIdx: t.heroIdx, zoneSlot: t.slotIdx ?? -1 };
}
function ankerKreatur(engine, inst) {
  return { owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot };
}

/** Name einer Quelle (Karteninstanz, Quellobjekt oder nur der Name). */
function quellName(src) {
  if (!src) return null;
  if (typeof src === 'string') return src;
  return src.cardName || src.name || null;
}
function quellSeite(src) {
  if (!src || typeof src !== 'object') return null;
  const s = src.controller ?? src.owner ?? src.sourceOwner;
  return (typeof s === 'number' && s >= 0) ? s : null;
}
function quellInstanz(src) {
  if (!src || typeof src !== 'object') return null;
  const id = src.id ?? src.instId ?? src.cardInstance?.id;
  return id != null ? id : null;
}

// ─── DAS MERKBUCH „UMGELEITET" ───────────────

function buch(gs) {
  if (!Array.isArray(gs[REGISTER])) gs[REGISTER] = [];
  // Alte Züge fallen heraus: die Umleitung gehört zu dem Effekt, der in DIESEM Zug auflöst.
  if (gs[REGISTER].some(e => e.turn !== gs.turn)) gs[REGISTER] = gs[REGISTER].filter(e => e.turn === gs.turn);
  return gs[REGISTER];
}
function verbrauche(gs, eintrag) {
  const b = buch(gs), i = b.indexOf(eintrag);
  if (i >= 0) b.splice(i, 1);
}
function merkeUmleitung(gs, inst, sourceCard) {
  const name = quellName(sourceCard);
  if (!name) return;
  const eintraege = buch(gs);
  const eintrag = { instId: inst.id, srcName: name, srcOwner: quellSeite(sourceCard), srcInstId: quellInstanz(sourceCard), turn: gs.turn };
  const gleich = eintraege.findIndex(e => e.instId === eintrag.instId && e.srcName === eintrag.srcName && e.srcOwner === eintrag.srcOwner && e.srcInstId === eintrag.srcInstId);
  if (gleich >= 0) eintraege[gleich] = eintrag; else eintraege.push(eintrag);
}
/**
 * Passt die Todes-/Schadensquelle zu einem offenen Eintrag dieser Kreatur? Liefert den Eintrag oder null. Gleicher Name und Kontrolleur; liegt auf beiden Seiten eine
 * Instanz-ID vor (Handkarten, Kreaturen auf dem Brett), muss auch sie gleich sein — eine ZWEITE Kopie derselben Karte ist nicht der umgeleitete Effekt.
 */
function findeUmleitung(gs, instId, src) {
  const name = quellName(src);
  if (!name) return null;
  const owner = quellSeite(src);
  const sid = quellInstanz(src);
  for (const e of buch(gs)) {
    if (e.instId !== instId || e.srcName !== name) continue;
    if (owner != null && e.srcOwner != null && owner !== e.srcOwner) continue;
    if (sid != null && e.srcInstId != null && sid !== e.srcInstId) continue;
    return e;
  }
  return null;
}
function vergiss(gs, instId) {
  if (Array.isArray(gs[REGISTER])) gs[REGISTER] = gs[REGISTER].filter(e => e.instId !== instId);
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT, läuft ihr Effekt-Rumpf nie — die Engine spielt dann dieses Bild.
  spellVisual: { impact: { type: 'quick_slash' }, impactMs: 260 },

  activeIn: ['support'],

  // ── CPU ────────────────────────────────────
  // Rückfrage der Umleitung („Discard a card to redirect?"): nur mit einer entbehrlichen Handkarte (mindestens zwei). Der Kosten-Abwurf selbst läuft über den Lernkanal
  // (`costFor`); die Kreatur stirbt am umgeleiteten Treffer meist — und zahlt dann mit 150 Schaden zurück.
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm' && promptData?.showCardLeft === CARD_NAME) {
      const instId = promptData?.promptConfig?.extra?._boardInstId;
      const inst = instId != null ? engine.cardInstances.find(c => c.id === instId) : null;
      const pi = inst ? (inst.controller ?? inst.owner) : engine._cpuPlayerIdx;
      const hand = engine.gs.players[pi]?.hand?.length || 0;
      return { confirmed: hand >= 2 };
    }
    return undefined;
  },

  // ── ① Umleitung ────────────────────────────
  isBoardRedirect: true,

  canBoardRedirect(gs, ownerIdx, inst, selected, validTargets, config, sourceCard, engine) {
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    if (!engine.isCardEffectActive(inst)) return false;                       // gefroren / betäubt / negiert … ruht
    // „an opponent's card or effect".
    const seite = sourceCard?.controller ?? sourceCard?.owner;
    if (typeof seite !== 'number' || seite < 0 || seite === ownerIdx) return false;
    // „another target you control" (Held oder Kreatur, nicht diese Kreatur).
    if (!passendesZiel(engine, ownerIdx, inst, selected)) return false;
    if (usesLeft(inst, gs, ZAEHLER) <= 0) return false;
    // „chooses exactly one other target": die GESAMTWAHL des Effekts ist genau ein Ziel.
    if (!genauEinZiel(config)) return false;
    // „redirect it to this Creature": muss ein wählbares Ziel DIESES Effekts sein.
    const ziel = eigenerEintrag(inst, validTargets);
    if (!ziel) return false;
    // „you may discard a card": es muss eine Handkarte als Kosten da sein.
    if (engine.handSizeWithoutResolving(ownerIdx) < 1) return false;
    return true;
  },

  boardRedirectPrompt(attackerName, selected) {
    return `${selected.cardName} was chosen by ${attackerName}! Discard a card to redirect it to ${CARD_NAME}?`;
  },

  async onBoardRedirect(engine, ownerIdx, inst, selected, validTargets, config, sourceCard) {
    const gs = engine.gs;
    const ziel = eigenerEintrag(inst, validTargets);
    if (!ziel) return null;
    // Kosten: eine Handkarte. Abbruch der Kartenwahl = keine Umleitung, nichts verbraucht.
    const kosten = await engine.zahleAbwurfKosten(ownerIdx, 1, {
      costFor: CARD_NAME,          // Kosten-Abwurf-Lernkanal der CPU
      costKind: 'protect',
      title: CARD_NAME,
      source: CARD_NAME,
      skipSourceGlow: true,
      cancellable: true,
      description: `Discard a card to redirect ${sourceCard?.name || 'the effect'} from ${selected.cardName} to ${CARD_NAME}.`,
    });
    if (!kosten.bezahlt) return null;
    // Zwischen Frage und Zahlung kann sich das Brett geändert haben (Abwurf-Trigger).
    if (inst.zone !== 'support' || !(((inst.counters?.currentHp) ?? 1) > 0)) return null;

    spendUse(inst, gs, ZAEHLER);
    merkeUmleitung(gs, inst, sourceCard);
    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: inst.controller ?? inst.owner });

    // Federn stieben vom gewählten Ziel zur Kreatur.
    const von = anker(engine, selected);
    const nach = ankerKreatur(engine, inst);
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_FEDERN, zoneType: 'board', owner: nach.owner, heroIdx: -1, zoneSlot: -1, duration: ANIM_FEDERN_MS,
      originOwner: von.owner, originHeroIdx: von.heroIdx, originZoneSlot: von.zoneSlot,
      targets: [nach],
    });
    await engine._delay(FLUG_MS);

    engine.log('winged_haressassin_redirect', {
      player: gs.players[ownerIdx]?.username, from: selected.cardName, source: sourceCard?.name || null,
    });
    engine.sync();
    return { redirectTo: ziel };
  },

  // ── ② Todes-Trigger ────────────────────────
  hooks: {
    // Schadens-Weg: der ERSTE Treffer, der zu einem offenen Umleitungs-Eintrag passt, bindet sich an die Kreatur (Marke `_wingedHaressHit`) und verbraucht den Eintrag — ein
    // späterer, nicht umgeleiteter Treffer derselben Karte zählt so nie. Der Tod (auch ein in der Flächenklammer aufgeschobener) liest die Marke.
    beforeCreatureDamageBatch: (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.cardZone !== 'support') return;
      const gs = ctx._engine.gs;
      for (const e of (ctx.entries || [])) {
        if (!e || e.cancelled || !e.inst || e.inst.id !== inst.id) continue;
        const eintrag = findeUmleitung(gs, inst.id, e.source);
        if (!eintrag) continue;
        verbrauche(gs, eintrag);
        (inst.counters || (inst.counters = {}))._wingedHaressHit = true;
      }
    },
    // Überlebt die Kreatur den Treffer, ist der Treffer erledigt (die Marke gilt nur für den Durchgang, in dem sie fällt; eine aufgeschobene Todesabwicklung hat `_deathResolved` schon gestempelt).
    afterCreatureDamageBatch: (ctx) => {
      const inst = ctx.card;
      if (!inst?.counters?._wingedHaressHit) return;
      if (inst._deathResolved || !((inst.counters.currentHp ?? 1) > 0)) return;
      delete inst.counters._wingedHaressHit;
    },

    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const tot = ctx.creature;
      if (!engine || !inst || !tot) return;
      if ((tot.instId ?? tot.id) !== inst.id) return;                       // nur der eigene Tod
      // Schaden: die Marke des Treffers. Zerstören/Besiegen (kein Schadensweg, `ctx.type` fehlt): ein offener Eintrag zur Quelle.
      let ausgeloest = false;
      if (inst.counters?._wingedHaressHit) { ausgeloest = true; delete inst.counters._wingedHaressHit; }
      else if (ctx.type === undefined && findeUmleitung(gs, inst.id, ctx.source)) ausgeloest = true;
      vergiss(gs, inst.id);                                                 // die Kreatur ist tot: ihre Einträge sind erledigt
      if (!ausgeloest) return;                                              // nicht von einem umgeleiteten Effekt besiegt

      const pi = tot.controller ?? tot.owner;
      const heroIdx = tot.heroIdx;
      const seite = tot.seite ?? engine.physicalSide(inst);
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // pflichtwahl: Todes-Trigger ohne „may" — „deal 150 damage to any target" ist zwingend, der Spieler wählt nur das Ziel (die Kreatur ist schon gefallen, es gibt nichts zurückzunehmen).
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to any target.`,
        confirmLabel: `🗡️ ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
        dimUnmetCondition: true,
      });
      if (!target) return;

      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: ANIM_SCHNITT, zoneType: 'board', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtSlot, duration: ANIM_SCHNITT_MS,
        originOwner: seite, originHeroIdx: heroIdx, originZoneSlot: tot.zoneSlot,
        targets: [{ owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtSlot }],
      });
      await engine._delay(SCHNITT_MS);

      // Verursacher = die (noch auf dem Brett liegende) Kreatur selbst, wie bei `ctx.dealDamage` jeder Kreatur: Kontrolleur, Zone und Kartentyp lesen die Schutz-Fenster daran.
      const quelle = inst;
      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero?.name && hero.hp > 0) await engine.actionDealDamage(quelle, hero, DAMAGE, 'creature');
      } else if (target.cardInstance && target.cardInstance.zone === 'support') {
        await engine.actionDealCreatureDamage(quelle, target.cardInstance, DAMAGE, 'creature', { sourceOwner: pi, canBeNegated: true });
      }
      engine.log('winged_haressassin_revenge', {
        player: gs.players[pi]?.username, target: target.cardName, by: ctx.source?.name || quellName(ctx.source) || null,
      });
      engine.sync();
      await engine._delay(300);
    },
  },
};
